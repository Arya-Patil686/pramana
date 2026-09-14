"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { project, CORRIDOR_NODES, DOMAIN, PLACE_ANCHORS } from "@/lib/corridor-geo";
import { altitude, bearingToVector, mulberry32, Y_TRANSPORT } from "@/lib/airshed-3d";
import {
  applyDrag,
  applyZoom,
  easeOrbit,
  fitRadius,
  orbitAt,
  orbitToPosition,
  type Orbit,
  type OrbitKey,
} from "@/lib/orbit";
import type { TehsilContribution, Trace } from "@/lib/attribution/engine";
import type { FireDetection } from "@/lib/sources/firms";
import type { WindSample } from "@/lib/sources/meteo";
import { projectLabels, type Anchor } from "@/components/three/label-layer";

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

/* Bars top out just under the transport plane, so the tallest source reads
   against the layer its smoke ends up in rather than poking through it. */
const COLUMN_MAX_H = Y_TRANSPORT * 0.86;

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

/**
 * Named viewpoints.
 *
 * `extent` is the span the overview has to contain, in world units, measured
 * from the data. The overview radius used to be a hand-picked 27, chosen once
 * against a ×25 vertical exaggeration and never revisited when that became
 * ×45 — which is exactly why it stopped framing the corridor. Deriving it
 * means the shot cannot drift away from what it is supposed to hold.
 */
export function presets(extent = 28.8): Record<PresetId, Orbit> {
  const src = project(30.245, 75.844);
  const rec = project(28.6469, 77.3162);
  const mid: [number, number, number] = [
    (src[0] + rec[0]) / 2,
    Y_TRANSPORT * 0.45,
    (src[1] + rec[1]) / 2,
  ];
  /* Azimuth measured so the camera sits back down the corridor. */
  const along = Math.atan2(rec[0] - src[0], rec[1] - src[1]);

  /* Nominal aspect for the framed model column, which is wider than tall. */
  const overviewRadius = fitRadius(extent, 42, 1.2, 1.1);

  return {
    overview: { azimuth: along + Math.PI * 0.72, polar: 1.0, radius: overviewRadius, target: mid },
    source: { azimuth: along + Math.PI * 1.05, polar: 1.24, radius: 15, target: [src[0], 1.4, src[1]] },
    /* Side-on and low: the only angle at which the two wind layers separate. */
    profile: { azimuth: along + Math.PI / 2, polar: 1.46, radius: 30, target: mid },
    receptor: { azimuth: along + Math.PI * 0.88, polar: 1.2, radius: 14, target: [rec[0], Y_TRANSPORT * 0.6, rec[1]] },
  };
}

/**
 * The scripted path the scroll stage flies.
 *
 * Same four viewpoints, in the order the chapters make their argument:
 * the sources, what a ground station sees, what is actually carrying the
 * smoke, and the transport itself.
 */
export function scrollPath(extent?: number): OrbitKey[] {
  const p = presets(extent);
  return [
    { at: 0, orbit: p.source },
    { at: 0.3, orbit: p.profile },
    { at: 0.62, orbit: { ...p.profile, azimuth: p.profile.azimuth + 0.5, radius: p.profile.radius * 0.86 } },
    { at: 1, orbit: p.receptor },
  ];
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
  scroll,
  path,
}: {
  goal: React.RefObject<Orbit>;
  start: Orbit;
  /* When present the camera follows the scripted path at this progress
     instead of the user's goal. One camera, two drivers. */
  scroll?: React.RefObject<number>;
  path?: OrbitKey[];
}) {
  const look = useMemo(() => new THREE.Vector3(), []);
  const live = useRef<Orbit>(start);

  useFrame((state, delta) => {
    if (scroll && path) {
      const target = orbitAt(scroll.current ?? 0, path);
      live.current = easeOrbit(live.current, target, delta, 0.0008);
      const sp = orbitToPosition(live.current);
      state.camera.position.set(sp[0], sp[1], sp[2]);
      look.set(...live.current.target);
      state.camera.lookAt(look);
      return;
    }
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

/*
   A bounded ground, not an endless grid.

   The first version drew graticule lines out to the horizon, which gave a
   viewer nothing to orient against — it read as graph paper floating in
   space — and implied the model had an opinion about places it was never run
   over. This is the box the register actually covers: a filled plane, a hard
   edge, and the 0.1° accumulation grid inside it.
*/
function Ground() {
  const { fill, grid, edge } = useMemo(() => {
    const [x0, z0] = project(DOMAIN.latMax, DOMAIN.lngMin);
    const [x1, z1] = project(DOMAIN.latMin, DOMAIN.lngMax);

    const plane = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
    plane.rotateX(-Math.PI / 2);
    plane.translate((x0 + x1) / 2, -0.01, (z0 + z1) / 2);

    const seg: number[] = [];
    for (let lat = DOMAIN.latMin; lat <= DOMAIN.latMax + 1e-9; lat += 0.1) {
      const [, z] = project(lat, DOMAIN.lngMin);
      seg.push(x0, 0, z, x1, 0, z);
    }
    for (let lng = DOMAIN.lngMin; lng <= DOMAIN.lngMax + 1e-9; lng += 0.1) {
      const [x] = project(DOMAIN.latMin, lng);
      seg.push(x, 0, z0, x, 0, z1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seg), 3));

    const border = new THREE.BufferGeometry();
    border.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1, x0, 0, z0]),
        3
      )
    );

    return { fill: plane, grid: g, edge: border };
  }, []);

  return (
    <>
      <mesh geometry={fill}>
        <meshBasicMaterial color="#e9e2d2" />
      </mesh>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color={INK} transparent opacity={0.09} />
      </lineSegments>
      <line>
        <primitive object={edge} attach="geometry" />
        <lineBasicMaterial color={INK} transparent opacity={0.45} />
      </line>
    </>
  );
}

/*
   The transport corridor, drawn on the ground.

   A translucent band from the source region to the receptor. Without it the
   columns and the city are just objects scattered on a plane, and the single
   most important fact — that these sources feed that city — has to be
   inferred from the plume alone.
*/
function CorridorBand() {
  const geometry = useMemo(() => {
    const src = project(30.3, 75.6);
    const rec = project(28.6469, 77.3162);
    const dx = rec[0] - src[0];
    const dz = rec[1] - src[1];
    const len = Math.hypot(dx, dz) || 1;
    /* Perpendicular, scaled to the corridor's real observed width. */
    const px = (-dz / len) * 3.4;
    const pz = (dx / len) * 3.4;

    const verts = new Float32Array([
      src[0] + px, 0, src[1] + pz,
      src[0] - px, 0, src[1] - pz,
      rec[0] - px * 0.45, 0, rec[1] - pz * 0.45,
      src[0] + px, 0, src[1] + pz,
      rec[0] - px * 0.45, 0, rec[1] - pz * 0.45,
      rec[0] + px * 0.45, 0, rec[1] + pz * 0.45,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    return g;
  }, []);

  return (
    <mesh geometry={geometry} position={[0, 0.005, 0]}>
      <meshBasicMaterial color={FLOW} transparent opacity={0.09} side={THREE.DoubleSide} />
    </mesh>
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
        /*
           Height is the share of the register. The floor is 8% of the tallest
           rather than a fixed minimum, so a 1% source is visibly a stub next
           to a 39% one instead of both rounding to the same crate — but it
           still has enough body to be seen and hit.
        */
        const t = r.contributionPct / maxPct;
        const h = COLUMN_MAX_H * (0.08 + 0.92 * t);
        const isSel = selected === r.tehsil;

        const handlers = {
          onClick: (e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            onSelect(r);
          },
          onPointerOver: (e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            onHover(r.tehsil);
            document.body.style.cursor = "pointer";
          },
          onPointerOut: () => {
            onHover(null);
            document.body.style.cursor = "";
          },
        };

        return (
          <group key={r.tehsil} position={[x, 0, z]}>
            {/* The bar. Slim, so nine of them do not merge into a wall. */}
            <mesh position={[0, h / 2, 0]} {...handlers}>
              <boxGeometry args={[0.34, h, 0.34]} />
              <meshBasicMaterial color={isSel ? EMBER : BRONZE} transparent opacity={isSel ? 0.95 : 0.72} />
            </mesh>
            {/* A cap, so the top of the bar is a definite thing the eye can
                measure against the transport plane behind it. */}
            <mesh position={[0, h, 0]} {...handlers}>
              <boxGeometry args={[0.52, 0.07, 0.52]} />
              <meshBasicMaterial color={isSel ? EMBER : INK} transparent opacity={isSel ? 1 : 0.5} />
            </mesh>
            {/* A dropline to the ground keeps tall bars anchored when the
                camera is low and the base is hidden behind nearer geometry. */}
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[0.012, h, 0.012]} />
              <meshBasicMaterial color={INK} transparent opacity={0.35} />
            </mesh>
            {/* Base ring. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
              <ringGeometry args={[0.26, 0.36, 28]} />
              <meshBasicMaterial color={isSel ? EMBER : INK} transparent opacity={isSel ? 0.85 : 0.32} />
            </mesh>
            {/* A wide invisible target: a 0.34-unit bar is hard to hit on a
                phone, and a missed tap reads as a broken control. */}
            <mesh position={[0, h / 2, 0]} visible={false} {...handlers}>
              <boxGeometry args={[1.6, Math.max(h, 1.4), 1.6]} />
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
            gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.001), 1.0, 30.0);
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
            // Capped. Uncapped, a near camera divides by a tiny depth and
            // every particle becomes a coin-sized smear — which is exactly
            // how the scroll scene ended up looking like scattered dirt.
            gl_PointSize = clamp((0.07 + aJourney * 0.18) * uScale / max(-mv.z, 0.001), 1.0, 26.0);
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
    const beat = (state.clock.elapsedTime * 0.4) % 1;
    const s = 0.9 + beat * 2.6;
    m.scale.set(s, s, s);
    (m.material as THREE.MeshBasicMaterial).opacity = (1 - beat) * 0.6;
  });

  return (
    <group position={[x, 0, z]}>
      {/* Footprint. */}
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
        <circleGeometry args={[1.15, 48]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0.16} />
      </mesh>
      {/* The pulse every operations display uses for a threshold crossing. */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.9, 1.02, 56]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* A mast to the transport level, so the city is findable from any
          angle. The receptor being invisible was the single worst legibility
          failure of the first version. */}
      <mesh position={[0, Y_TRANSPORT * 0.62, 0]}>
        <boxGeometry args={[0.11, Y_TRANSPORT * 1.24, 0.11]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, Y_TRANSPORT * 1.24, 0]}>
        <octahedronGeometry args={[0.3]} />
        <meshBasicMaterial color={EMBER} />
      </mesh>
    </group>
  );
}

/*
   The transport plane.

   A translucent sheet at 925 hPa. It gives the plume something to visibly
   ride and gives every column a common reference to be measured against —
   without it, "the smoke travels at height" is a claim the scene asserts
   rather than shows.
*/
function TransportPlane() {
  const geometry = useMemo(() => {
    const [x0, z0] = project(DOMAIN.latMax, DOMAIN.lngMin);
    const [x1, z1] = project(DOMAIN.latMin, DOMAIN.lngMax);
    const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, Y_TRANSPORT, (z0 + z1) / 2);
    return g;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={FLOW} transparent opacity={0.055} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/*
   The boundary-layer ceiling.

   Height at every vertex is the Open-Meteo boundary-layer depth interpolated
   between corridor samples, so the ceiling genuinely rises and falls along
   the route. Where it sits below the transport level, smoke above it is
   decoupled from the ground and travels without being mixed into the city
   underneath — which is the mechanism the whole corridor depends on.
*/
function BoundaryLayer({ samples }: { samples: WindSample[] }) {
  const geometry = useMemo(() => {
    const [x0, z0] = project(DOMAIN.latMax, DOMAIN.lngMin);
    const [x1, z1] = project(DOMAIN.latMin, DOMAIN.lngMax);
    const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), 36, 36);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);

    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      /* Inverse-distance over the corridor samples. */
      let sw = 0;
      let sv = 0;
      for (const s of samples) {
        const [sx, sz] = project(s.lat, s.lng);
        const d = Math.max(Math.hypot(x - sx, z - sz), 0.4);
        const w = 1 / (d * d);
        sv += w * (s.boundaryLayerM ?? 250);
        sw += w;
      }
      pos.setY(i, altitude(sw === 0 ? 250 : sv / sw));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [samples]);

  return (
    <lineSegments>
      <wireframeGeometry args={[geometry]} />
      <lineBasicMaterial color={FLOW} transparent opacity={0.075} depthWrite={false} />
    </lineSegments>
  );
}

/* ── Labels ───────────────────────────────────────────── */

/*
   Anchors are computed here, in the scene, and written to DOM nodes the
   parent renders in an overlay. One loop, crisp type, no font meshes.
*/
function Labels({
  rows,
  nodes,
}: {
  rows: TehsilContribution[];
  nodes: React.RefObject<Map<string, HTMLElement>>;
}) {
  const maxPct = Math.max(1, ...rows.map((r) => r.contributionPct));

  const anchors = useMemo<Anchor[]>(() => {
    const out: Anchor[] = [];
    for (const p of PLACE_ANCHORS) {
      const [x, z] = project(p.lat, p.lng);
      out.push({
        id: `place:${p.label}`,
        position: [x, p.kind === "receptor" ? Y_TRANSPORT * 1.24 : 0.1, z],
        offset: [0, p.kind === "receptor" ? -26 : 0],
      });
    }
    for (const r of rows) {
      const [x, z] = project(r.lat, r.lng);
      const h = COLUMN_MAX_H * (0.08 + 0.92 * (r.contributionPct / maxPct));
      out.push({ id: `src:${r.tehsil}`, position: [x, h, z], offset: [0, -16] });
    }
    /* The two wind layers name themselves where they are, which is the only
       way a viewer can tell which set of arrows is which. */
    const [wx, wz] = project(29.95, 76.3);
    out.push({ id: "layer:surface", position: [wx, altitude(60), wz], offset: [0, -12] });
    out.push({ id: "layer:transport", position: [wx, Y_TRANSPORT, wz], offset: [0, -12] });
    return out;
  }, [rows, maxPct]);

  useFrame((state) => {
    if (!nodes.current) return;
    projectLabels(anchors, nodes.current, state.camera, state.size.width, state.size.height);
  });

  return null;
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
  /** DOM nodes for the HTML label overlay, keyed by anchor id. */
  labelNodes: React.RefObject<Map<string, HTMLElement>>;
  /* Supplying these puts the camera on a scripted path and disables the
     pointer controls: the same scene, flown instead of held. */
  scroll?: React.RefObject<number>;
  path?: OrbitKey[];
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
  labelNodes,
  scroll,
  path,
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
      {/* Fog set well beyond the domain: pulled in closer it greyed out the
          far half of the corridor, which is the half the argument is about. */}
      <fog attach="fog" args={["#f4f1ea", 52, 120]} />
      <OrbitCamera goal={goal} start={start} scroll={scroll} path={path} />
      {!scroll && <Pointer goal={goal} engaged={engaged} onEngage={onEngage} />}
      <Ground />
      <CorridorBand />
      <BoundaryLayer samples={wind} />
      <TransportPlane />
      <FirePoints detections={detections} />
      <WindLayers samples={wind} />
      <Plume traces={traces} />
      <SourceColumns rows={rows} selected={selected} onSelect={pick} onHover={setHover} />
      <Receptor onSelect={() => onSelect(null)} />
      <Labels rows={rows} nodes={labelNodes} />
    </Canvas>
  );
}
