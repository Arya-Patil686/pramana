"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { project, CORRIDOR_NODES } from "@/lib/corridor-geo";
import { altitude, bearingToVector, mulberry32, Y_TRANSPORT } from "@/lib/airshed-3d";
import {
  applyDrag,
  applyZoom,
  easeOrbit,
  orbitToPosition,
  type Orbit,
} from "@/lib/orbit";
import type { TehsilContribution, Trace } from "@/lib/attribution/engine";
import type { FireDetection } from "@/lib/sources/firms";
import type { WindSample } from "@/lib/sources/meteo";

/*
   The airshed instrument.

   A physical model of the corridor you can pick up and turn. Drag to orbit,
   wheel to zoom, click any source to interrogate it. The scroll-flown volume
   further down the page tells the story; this one lets a visitor go and check
   it, which is the difference between being shown a finding and being handed
   the instrument that produced it.

   Every object is data. Column height is the tehsil's share of the register,
   the ring around Delhi is the receptor, the barbs are the two real wind
   levels, and the particles ride the computed trajectories. Clicking a column
   returns that tehsil's actual row — share, interval, arrivals, transport
   time — not a caption written about it.
*/

const INK = "#191c1f";
const EMBER = "#b8391f";
const FLOW = "#2b5f68";
const BRONZE = "#8a6114";

export interface Selection {
  tehsil: string;
  state: string | null;
  district: string | null;
  contributionPct: number;
  ciLow: number;
  ciHigh: number;
  arrivals: number;
  cells: number;
  meanTransportHours: number;
  frpTotal: number;
}

/* Named viewpoints. Derived from the corridor rather than typed, for the same
   reason the flown camera is: hand-picked angles drift out of agreement with
   the geometry the moment the geometry changes. */
export type PresetId = "overview" | "source" | "profile" | "receptor";

export function presets(): Record<PresetId, Orbit> {
  const src = project(30.245, 75.844);
  const rec = project(28.6469, 77.3162);
  const mid: [number, number, number] = [
    (src[0] + rec[0]) / 2,
    Y_TRANSPORT * 0.5,
    (src[1] + rec[1]) / 2,
  ];
  /* Azimuth measured so the camera sits back down the corridor. */
  const along = Math.atan2(rec[0] - src[0], rec[1] - src[1]);

  return {
    overview: { azimuth: along + Math.PI * 0.75, polar: 0.72, radius: 34, target: mid },
    source: { azimuth: along + Math.PI, polar: 1.16, radius: 15, target: [src[0], 0.6, src[1]] },
    /* Side-on and low: the only angle at which the two wind layers separate. */
    profile: { azimuth: along + Math.PI / 2, polar: 1.38, radius: 26, target: mid },
    receptor: { azimuth: along + Math.PI * 0.9, polar: 1.02, radius: 13, target: [rec[0], 0.8, rec[1]] },
  };
}

function projScale(state: RootState): number {
  const cam = state.camera as THREE.PerspectiveCamera;
  const dpr = Math.min(state.viewport.dpr ?? 1, 2);
  return (state.size.height * dpr) / (2 * Math.tan((cam.fov * Math.PI) / 360));
}

/* ── Camera driven by the orbit state ─────────────────── */

/*
   The eased orbit is owned here rather than passed in.

   The parent supplies only the goal — where the camera should be heading —
   and this component keeps the position it is actually at. Writing the live
   orbit through a ref handed down as a prop is both a lint error and the
   wrong shape: nothing outside needs to read it, and two owners of one camera
   is how a drag and a fly-to end up fighting.

   `start` seeds the opening frame, so the model can settle in from further
   out on load instead of appearing already parked.
*/
function OrbitCamera({
  goal,
  start,
}: {
  goal: React.RefObject<Orbit>;
  start: Orbit;
}) {
  const look = useMemo(() => new THREE.Vector3(), []);
  const live = useRef<Orbit>(start);

  useFrame((state, delta) => {
    if (!goal.current) return;
    /* Easing toward the goal gives dragging a little weight and makes a
       preset a flight rather than a cut — one mechanism for both. */
    live.current = easeOrbit(live.current, goal.current, delta);
    const p = orbitToPosition(live.current);
    state.camera.position.set(p[0], p[1], p[2]);
    look.set(...live.current.target);
    state.camera.lookAt(look);
  });
  return null;
}

/* ── Ground ───────────────────────────────────────────── */

function Ground() {
  const geometry = useMemo(() => {
    const seg: number[] = [];
    for (let lat = 28.2; lat <= 31.3; lat += 0.1) {
      const [, z] = project(lat, 74.6);
      const [x1] = project(lat, 74.6);
      const [x2] = project(lat, 77.9);
      seg.push(x1, 0, z, x2, 0, z);
    }
    for (let lng = 74.6; lng <= 77.9; lng += 0.1) {
      const [x] = project(28.2, lng);
      const [, z1] = project(28.2, lng);
      const [, z2] = project(31.3, lng);
      seg.push(x, 0, z1, x, 0, z2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seg), 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={INK} transparent opacity={0.12} />
    </lineSegments>
  );
}

/* ── Source columns: the clickable objects ────────────── */

function SourceColumns({
  rows,
  selected,
  onSelect,
  onHover,
}: {
  rows: TehsilContribution[];
  selected: string | null;
  onSelect: (t: TehsilContribution) => void;
  onHover: (t: string | null) => void;
}) {
  const maxPct = Math.max(1, ...rows.map((r) => r.contributionPct));

  return (
    <group>
      {rows.map((r) => {
        const [x, z] = project(r.lat, r.lng);
        /* Height is the share of the register, normalised so the leading
           source reaches the transport level and the rest read against it. */
        const h = Math.max(0.12, (r.contributionPct / maxPct) * Y_TRANSPORT * 1.15);
        const isSel = selected === r.tehsil;
        return (
          <group key={r.tehsil} position={[x, 0, z]}>
            <mesh
              position={[0, h / 2, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(r);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                onHover(r.tehsil);
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                onHover(null);
                document.body.style.cursor = "";
              }}
            >
              <boxGeometry args={[0.42, h, 0.42]} />
              <meshBasicMaterial
                color={isSel ? EMBER : BRONZE}
                transparent
                opacity={isSel ? 0.92 : 0.55}
              />
            </mesh>
            {/* A wider invisible target: a 0.42-unit column is a hard thing to
                hit on a phone, and a missed tap reads as a broken control. */}
            <mesh
              position={[0, h / 2, 0]}
              visible={false}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(r);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                onHover(r.tehsil);
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                onHover(null);
                document.body.style.cursor = "";
              }}
            >
              <boxGeometry args={[1.5, Math.max(h, 1.2), 1.5]} />
            </mesh>
            {/* Base tick, so a near-zero contributor is still locatable. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
              <ringGeometry args={[0.3, 0.4, 24]} />
              <meshBasicMaterial color={isSel ? EMBER : INK} transparent opacity={isSel ? 0.8 : 0.28} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ── Fires, wind, plume, receptor ─────────────────────── */

function FirePoints({ detections }: { detections: FireDetection[] }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const maxFrp = Math.max(1, ...detections.map((d) => d.frp));
    const pos = new Float32Array(detections.length * 3);
    const size = new Float32Array(detections.length);
    detections.forEach((d, i) => {
      const [x, z] = project(d.lat, d.lng);
      pos[i * 3] = x;
      pos[i * 3 + 1] = 0.03;
      pos[i * 3 + 2] = z;
      size[i] = 0.1 + Math.sqrt(d.frp / maxFrp) * 0.32;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    return { geometry: g, uniforms: { uScale: { value: 800 } } };
  }, [detections]);

  useFrame((state) => {
    const u = matRef.current?.uniforms;
    if (u) u.uScale.value = projScale(state);
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={`
          attribute float aSize;
          uniform float uScale;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uScale / max(-mv.z, 0.001);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float r = length(uv) * 2.0;
            if (r > 1.0) discard;
            float a = 1.0 - smoothstep(0.2, 1.0, r);
            gl_FragColor = vec4(${new THREE.Color(EMBER).r.toFixed(3)}, ${new THREE.Color(EMBER).g.toFixed(3)}, ${new THREE.Color(EMBER).b.toFixed(3)}, a * 0.85);
          }
        `}
      />
    </points>
  );
}

function WindLayers({ samples }: { samples: WindSample[] }) {
  const [surfaceGeo, transportGeo] = useMemo(() => {
    const arrows = (level: "surface" | "transport") => {
      const seg: number[] = [];
      const y = level === "surface" ? altitude(60) : Y_TRANSPORT;
      for (const s of samples) {
        const [x, z] = project(s.lat, s.lng);
        const bearing = level === "surface" ? s.surfaceBearingTo : s.bearingTo;
        const speed = level === "surface" ? s.surfaceSpeed : s.speed;
        const [dx, dz] = bearingToVector(bearing);
        const len = 0.6 + speed * 0.16;
        const hx = x + dx * len;
        const hz = z + dz * len;
        seg.push(x, y, z, hx, y, hz);
        for (const sgn of [-1, 1]) {
          const a = Math.atan2(dx, -dz) + sgn * 0.42;
          seg.push(hx, y, hz, hx - Math.sin(a) * 0.3, y, hz + Math.cos(a) * 0.3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seg), 3));
      return g;
    };
    return [arrows("surface"), arrows("transport")] as const;
  }, [samples]);

  return (
    <>
      <lineSegments geometry={surfaceGeo}>
        <lineBasicMaterial color={INK} transparent opacity={0.42} />
      </lineSegments>
      <lineSegments geometry={transportGeo}>
        <lineBasicMaterial color={FLOW} transparent opacity={0.8} />
      </lineSegments>
    </>
  );
}

function Plume({ traces }: { traces: Trace[] }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const PER = 22;
    const n = Math.max(1, traces.length) * PER;
    const start = new Float32Array(n * 3);
    const end = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const weight = new Float32Array(n);
    const journey = new Float32Array(n);
    const rand = mulberry32(0xa11ce);

    let i = 0;
    for (const t of traces) {
      const pts = t.points;
      for (let k = 0; k < PER; k++) {
        const leg = Math.min(pts.length - 2, Math.floor(rand() * (pts.length - 1)));
        journey[i] = pts.length > 1 ? leg / (pts.length - 1) : 0;
        const [aLat, aLng] = pts[Math.max(0, leg)];
        const [bLat, bLng] = pts[Math.min(pts.length - 1, leg + 1)];
        const [ax, az] = project(aLat, aLng);
        const [bx, bz] = project(bLat, bLng);
        start.set([ax, 0, az], i * 3);
        end.set([bx, 0, bz], i * 3);
        seed[i] = rand();
        weight[i] = t.weight;
        i++;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aWeight", new THREE.BufferAttribute(weight, 1));
    g.setAttribute("aJourney", new THREE.BufferAttribute(journey, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(-10, 1, -12), 48);

    return {
      geometry: g,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 800 },
        uTransportY: { value: Y_TRANSPORT },
        uNear: { value: new THREE.Color(EMBER) },
        uFar: { value: new THREE.Color("#6f6255") },
      },
    };
  }, [traces]);

  useFrame((state, delta) => {
    const u = matRef.current?.uniforms;
    if (!u) return;
    /* Runs on its own clock, not on scroll: an instrument sitting still
       should still look like weather. */
    u.uTime.value += delta * 0.08;
    u.uScale.value = projScale(state);
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={`
          attribute vec3 aStart;
          attribute vec3 aEnd;
          attribute float aSeed;
          attribute float aWeight;
          attribute float aJourney;
          uniform float uTime;
          uniform float uScale;
          uniform float uTransportY;
          varying float vJourney;
          varying float vAlpha;

          void main() {
            // 't' animates within one leg; 'aJourney' is position along the
            // whole route. Height, spread, colour and size all read from the
            // journey — driving them from 't' makes smoke rise off the ground
            // the entire length of the corridor.
            float speed = 0.6 + fract(aSeed * 71.13) * 0.5;
            float t = fract(aSeed + uTime * speed);
            vec3 pos = mix(aStart, aEnd, t);

            pos.y = mix(0.04, uTransportY, smoothstep(0.0, 0.18, aJourney));

            float spread = 0.3 + aJourney * 2.0;
            float w1 = sin(aSeed * 43.0 + uTime * 5.0 + t * 6.0);
            float w2 = cos(aSeed * 29.0 + uTime * 4.0 + t * 5.0);
            pos.x += w1 * spread * 0.4;
            pos.z += w2 * spread * 0.4;
            pos.y += w1 * spread * 0.1;

            vAlpha = sin(3.14159265 * t) * (1.0 - smoothstep(0.82, 1.0, aJourney))
                   * (0.25 + aWeight * 0.75);
            vJourney = aJourney;

            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = (0.08 + aJourney * 0.22) * uScale / max(-mv.z, 0.001);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform vec3 uNear;
          uniform vec3 uFar;
          varying float vJourney;
          varying float vAlpha;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float r = length(uv) * 2.0;
            if (r > 1.0) discard;
            float soft = 1.0 - smoothstep(0.0, 1.0, r);
            vec3 col = mix(uNear, uFar, smoothstep(0.04, 0.55, vJourney));
            gl_FragColor = vec4(col, soft * soft * vAlpha * 0.85);
          }
        `}
      />
    </points>
  );
}

function Receptor({ onSelect }: { onSelect: () => void }) {
  const ring = useRef<THREE.Mesh>(null);
  const [x, z] = useMemo(() => {
    const n = CORRIDOR_NODES.find((c) => c.kind === "receptor");
    return project(n?.lat ?? 28.6469, n?.lng ?? 77.3162);
  }, []);

  useFrame((state) => {
    const m = ring.current;
    if (!m) return;
    const beat = (state.clock.elapsedTime * 0.45) % 1;
    const s = 0.7 + beat * 2.1;
    m.scale.set(s, s, s);
    (m.material as THREE.MeshBasicMaterial).opacity = (1 - beat) * 0.55;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <circleGeometry args={[0.9, 40]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0.14} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.72, 0.84, 48]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh position={[0, Y_TRANSPORT / 2, 0]}>
        <boxGeometry args={[0.16, Y_TRANSPORT, 0.16]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

/* ── Pointer handling ─────────────────────────────────── */

/*
   Drag to orbit, wheel to zoom.

   Bound to the canvas element rather than to window so the page still scrolls
   normally everywhere else, and a drag that leaves the canvas is released via
   pointer capture instead of sticking. Wheel is only swallowed once the user
   has actually engaged with the model — otherwise the hero would trap the
   scroll of anyone passing through it, which is the single most irritating
   thing a 3D hero can do.
*/
function Pointer({
  goal,
  engaged,
  onEngage,
}: {
  goal: React.RefObject<Orbit>;
  engaged: React.RefObject<boolean>;
  onEngage: () => void;
}) {
  const { gl } = useThree();
  const dragging = useRef(false);
  const last = useRef<[number, number]>([0, 0]);

  /*
     useEffect, not useMemo. An earlier version attached these in a memo,
     which runs during render and discards the cleanup it returns — so every
     re-render bound another set of handlers to the same canvas and none were
     ever removed. The symptom would have been a model that orbits faster the
     longer the page is open.
  */
  useEffect(() => {
    const el = gl.domElement;

    const down = (e: PointerEvent) => {
      dragging.current = true;
      last.current = [e.clientX, e.clientY];
      el.setPointerCapture(e.pointerId);
      onEngage();
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current || !goal.current) return;
      const dx = e.clientX - last.current[0];
      const dy = e.clientY - last.current[1];
      last.current = [e.clientX, e.clientY];
      goal.current = applyDrag(goal.current, dx, dy);
    };
    const up = (e: PointerEvent) => {
      dragging.current = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      if (!engaged.current || !goal.current) return;
      e.preventDefault();
      goal.current = applyZoom(goal.current, e.deltaY);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      /* A drag interrupted by unmount must not leave the cursor stuck. */
      document.body.style.cursor = "";
    };
  }, [gl, goal, engaged, onEngage]);

  return null;
}

/* ── Scene ────────────────────────────────────────────── */

export interface AirshedInstrumentProps {
  detections: FireDetection[];
  wind: WindSample[];
  traces: Trace[];
  rows: TehsilContribution[];
  goal: React.RefObject<Orbit>;
  /** Where the camera starts on first paint, before easing to the goal. */
  start: Orbit;
  engaged: React.RefObject<boolean>;
  onEngage: () => void;
  selected: string | null;
  onSelect: (s: Selection | null) => void;
  className?: string;
}

export default function AirshedInstrument({
  detections,
  wind,
  traces,
  rows,
  goal,
  start,
  engaged,
  onEngage,
  selected,
  onSelect,
  className,
}: AirshedInstrumentProps) {
  const [, setHover] = useState<string | null>(null);

  const pick = useCallback(
    (r: TehsilContribution) => {
      onEngage();
      onSelect({
        tehsil: r.tehsil,
        state: r.state,
        district: r.district,
        contributionPct: r.contributionPct,
        ciLow: r.ciLow,
        ciHigh: r.ciHigh,
        arrivals: r.arrivals,
        cells: r.cells,
        meanTransportHours: r.meanTransportHours,
        frpTotal: r.frpTotal,
      });
    },
    [onSelect, onEngage]
  );

  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={{ fov: 42, near: 0.1, far: 150 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      /* A click on empty space clears the selection, which is what every
         inspector-style interface does and what a visitor will try. */
      onPointerMissed={() => onSelect(null)}
    >
      <fog attach="fog" args={["#f4f1ea", 34, 86]} />
      <OrbitCamera goal={goal} start={start} />
      <Pointer goal={goal} engaged={engaged} onEngage={onEngage} />
      <Ground />
      <FirePoints detections={detections} />
      <WindLayers samples={wind} />
      <Plume traces={traces} />
      <SourceColumns rows={rows} selected={selected} onSelect={pick} onHover={setHover} />
      <Receptor onSelect={() => onSelect(null)} />
    </Canvas>
  );
}
