"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import {
  CORRIDOR_NODES,
  TRANSPORT_XZ,
  attributionGrid,
  project,
} from "@/lib/corridor-geo";
import type { FireDetection } from "@/lib/sources/firms";

/*
   The corridor flight.

   One continuous scroll-scrubbed shot from the stubble fires of Sangrur to
   the receptor monitors of Delhi, which is the journey the whole system is an
   argument about. Scroll position is the only clock: nothing here plays on a
   timer, so a reader who stops moving stops the plume mid-corridor and can
   look at it.

   The scene keeps the rule the rest of the product follows — everything is
   drawn from coordinates, nothing from a texture. The floor is the actual
   0.1° attribution grid, the markers sit at real tehsil centroids, the
   hotspots are at their true FIRMS positions and bloom at their true
   acquisition times, and the plume is advected along the 925 hPa path the
   episode actually took. There is no basemap and no invented terrain,
   because an instrument shows what it measured.

   Progress arrives through a ref rather than a prop. React never re-renders
   during the flight; the scroll listener writes a number and useFrame reads
   it, which is what keeps a four-viewport scrub at frame rate.
*/

const CHAPTERS = { IGNITION: 0.0, TRANSPORT: 0.26, ARRIVAL: 0.62, ATTRIBUTION: 0.82 };

/*
   Deterministic noise.

   The particle field is seeded from a fixed sequence rather than Math.random,
   for two reasons: React may re-render this tree and an unstable field would
   visibly reshuffle the plume, and a scene that is reproducible frame-for-
   frame is easier to compare across commits than one that is not.
*/
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Smoothstep between two scroll positions, clamped at both ends. */
function ramp(p: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (p - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* ── Floor: the 0.1° attribution grid ─────────────────── */

const gridVert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const gridFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uFocus;
  uniform float uReach;
  varying vec3 vWorld;

  void main() {
    // The grid is legible only near what the camera is looking at. Drawing
    // three thousand segments at full strength reads as noise, and a floor
    // that competes with the plume defeats the shot.
    float d = distance(vWorld.xz, uFocus.xz);
    float near = 1.0 - smoothstep(uReach * 0.25, uReach, d);
    gl_FragColor = vec4(uColor, near * 0.5);
  }
`;

function AttributionFloor({ focus }: { focus: React.RefObject<THREE.Vector3> }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(attributionGrid(), 3));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#26313e") },
      uFocus: { value: new THREE.Vector3() },
      uReach: { value: 9 },
    }),
    []
  );

  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(() => {
    if (matRef.current && focus.current) {
      matRef.current.uniforms.uFocus.value.copy(focus.current);
    }
  });

  return (
    <lineSegments geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={gridVert}
        fragmentShader={gridFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </lineSegments>
  );
}

/* ── Fire hotspots ────────────────────────────────────── */

const fireVert = /* glsl */ `
  attribute float aFrp;
  attribute float aIgnite;
  uniform float uProgress;
  uniform float uScale;
  varying float vAlpha;

  void main() {
    // A hotspot appears when the scrub passes its true acquisition time, and
    // then decays. Nothing is visible before it was actually detected.
    float age = uProgress - aIgnite;
    float appear = smoothstep(0.0, 0.03, age);
    float decay = 1.0 - smoothstep(0.10, 0.55, age);
    vAlpha = appear * max(decay, 0.28);

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Marker area scales with Fire Radiative Power, so radius goes as sqrt.
    float radius = 0.045 + sqrt(aFrp) * 0.019;
    gl_PointSize = radius * uScale / max(-mv.z, 0.001);
    gl_Position = projectionMatrix * mv;
  }
`;

const fireFrag = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uEdge;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float core = 1.0 - smoothstep(0.0, 0.45, r);
    float halo = 1.0 - smoothstep(0.35, 1.0, r);
    vec3 col = mix(uEdge, uCore, core);
    gl_FragColor = vec4(col, (core * 0.95 + halo * 0.35) * vAlpha);
  }
`;

function Hotspots({
  detections,
  progress,
}: {
  detections: FireDetection[];
  progress: React.RefObject<number>;
}) {
  const { geometry, uniforms } = useMemo(() => {
    const n = detections.length;
    const positions = new Float32Array(n * 3);
    const frp = new Float32Array(n);
    const ignite = new Float32Array(n);

    const times = detections.map((d) => Date.parse(d.acquiredAt));
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const span = Math.max(1, tMax - tMin);

    detections.forEach((d, i) => {
      const [x, z] = project(d.lat, d.lng);
      positions[i * 3] = x;
      positions[i * 3 + 1] = 0.02;
      positions[i * 3 + 2] = z;
      frp[i] = d.frp;
      /* Detections are spread across the ignition chapter in true order. */
      ignite[i] = ((times[i] - tMin) / span) * (CHAPTERS.TRANSPORT + 0.06);
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aFrp", new THREE.BufferAttribute(frp, 1));
    g.setAttribute("aIgnite", new THREE.BufferAttribute(ignite, 1));
    /* Points are placed by the vertex shader, so the computed bounding sphere
       would be wrong; set one wide enough to never cull the field. */
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(-8, 0, -12), 40);

    return {
      geometry: g,
      uniforms: {
        uProgress: { value: 0 },
        uScale: { value: 800 },
        uCore: { value: new THREE.Color("#e8703a") },
        uEdge: { value: new THREE.Color("#7d1a10") },
      },
    };
  }, [detections]);

  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    const u = matRef.current?.uniforms;
    if (!u) return;
    u.uProgress.value = progress.current ?? 0;
    u.uScale.value = projScale(state);
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={fireVert}
        fragmentShader={fireFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ── Plume ────────────────────────────────────────────── */

const PATH_POINTS = 10;

const plumeVert = /* glsl */ `
  attribute float aSeed;
  attribute float aLane;
  uniform vec3 uPath[${PATH_POINTS}];
  uniform float uAdvance;
  uniform float uDrift;
  uniform float uScale;
  varying float vAlpha;
  varying float vAge;

  vec3 samplePath(float t) {
    float f = clamp(t, 0.0, 0.9999) * float(${PATH_POINTS} - 1);
    int i = int(floor(f));
    float k = fract(f);
    vec3 a = uPath[i];
    vec3 b = uPath[min(i + 1, ${PATH_POINTS} - 1)];
    return mix(a, b, k);
  }

  void main() {
    // Each particle carries its own release time and speed, so the plume
    // spreads along the corridor instead of moving as one rigid block —
    // dispersion is the whole reason a 40-hour transport arrives as a
    // sustained load rather than a pulse.
    float speed = 0.55 + fract(aSeed * 71.13) * 0.55;
    float t = fract(aSeed + uAdvance * speed + uDrift * 0.04);

    vec3 base = samplePath(t);

    // Lateral spread and lift both grow with distance travelled.
    float spread = 0.35 + t * 2.4;
    float wobble = sin(aSeed * 43.0 + uDrift * 0.6 + t * 7.0);
    base.x += aLane * spread + wobble * 0.18 * t;
    base.z += wobble * spread * 0.28;
    base.y = 0.05 + t * 1.15 + fract(aSeed * 17.7) * 0.5 * t;

    // Released at the source, thinned as it disperses, gone at the receptor.
    float birth = smoothstep(0.0, 0.06, t);
    float death = 1.0 - smoothstep(0.72, 1.0, t);
    vAlpha = birth * death;
    vAge = t;

    vec4 mv = modelViewMatrix * vec4(base, 1.0);
    gl_PointSize = (0.10 + t * 0.30) * uScale / max(-mv.z, 0.001);
    gl_Position = projectionMatrix * mv;
  }
`;

const plumeFrag = /* glsl */ `
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vAge;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float soft = 1.0 - smoothstep(0.0, 1.0, r);
    // Warm at ignition, cooling to grey haze by the time it reaches the city.
    vec3 col = mix(uNear, uFar, smoothstep(0.05, 0.6, vAge));
    gl_FragColor = vec4(col, soft * soft * vAlpha * uOpacity);
  }
`;

function Plume({ progress }: { progress: React.RefObject<number> }) {
  const { geometry, uniforms } = useMemo(() => {
    const n = 4200;
    const positions = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const lane = new Float32Array(n);

    const rand = mulberry32(0x9e3779b9);
    for (let i = 0; i < n; i++) {
      seed[i] = rand();
      /* Concentrated on the corridor axis, thinning at the edges. */
      lane[i] = (rand() + rand() - 1) * 0.9;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aLane", new THREE.BufferAttribute(lane, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(-8, 1, -12), 44);

    const path = TRANSPORT_XZ.map(([x, z]) => new THREE.Vector3(x, 0, z));

    return {
      geometry: g,
      uniforms: {
        uPath: { value: path },
        uAdvance: { value: 0 },
        uDrift: { value: 0 },
        uScale: { value: 800 },
        uOpacity: { value: 0 },
        uNear: { value: new THREE.Color("#b8815b") },
        uFar: { value: new THREE.Color("#6f7b8c") },
      },
    };
  }, []);

  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state, delta) => {
    const u = matRef.current?.uniforms;
    if (!u) return;
    const p = progress.current ?? 0;
    /* Scroll drives the advance; a slow drift keeps it alive when the reader
       stops, so a paused plume still looks like weather rather than a still. */
    u.uAdvance.value = p * 1.25;
    u.uDrift.value += delta;
    u.uOpacity.value = ramp(p, 0.06, 0.3) * (1 - ramp(p, 0.9, 1.0) * 0.45);
    u.uScale.value = projScale(state);
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={plumeVert}
        fragmentShader={plumeFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

/* ── Attribution columns ──────────────────────────────── */

/*
   The final chapter. Each named source cell raises a column whose height is
   the share of Delhi's excess attributed to it — the register, stood up in
   the place it refers to.
*/
function AttributionColumns({ progress }: { progress: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);

  const columns = useMemo(
    () =>
      CORRIDOR_NODES.filter((n) => (n.contribution ?? 0) > 0).map((n) => {
        const [x, z] = project(n.lat, n.lng);
        return { ...n, x, z, height: (n.contribution ?? 0) * 0.11 };
      }),
    []
  );

  useFrame(() => {
    const p = progress.current ?? 0;
    const rise = ramp(p, CHAPTERS.ATTRIBUTION - 0.06, 0.98);
    const g = group.current;
    if (!g) return;

    g.visible = rise > 0.001;
    g.children.forEach((child, i) => {
      const col = columns[i];
      if (!col) return;
      /* Staggered by contribution, so the largest source rises first and the
         eye is led to it before the others arrive. */
      const stagger = Math.min(1, Math.max(0, rise * 1.5 - i * 0.07));
      const eased = stagger * stagger * (3 - 2 * stagger);
      const h = Math.max(0.0001, col.height * eased);
      child.scale.set(1, h, 1);
      child.position.set(col.x, h / 2, col.z);
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = eased * 0.72;
    });
  });

  return (
    <group ref={group} visible={false}>
      {columns.map((c) => (
        <mesh key={c.label}>
          <boxGeometry args={[0.34, 1, 0.34]} />
          <meshBasicMaterial
            color={c.state === "Punjab" ? "#e3a84e" : "#5c8ae6"}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Receptor ─────────────────────────────────────────── */

function Receptor({ progress }: { progress: React.RefObject<number> }) {
  const ring = useRef<THREE.Mesh>(null);
  const [x, z] = useMemo(() => project(28.6469, 77.3162), []);

  useFrame((state) => {
    const p = progress.current ?? 0;
    const on = ramp(p, 0.5, 0.72);
    const m = ring.current;
    if (!m) return;
    m.visible = on > 0.001;
    /* A slow expanding pulse, which is what a receptor crossing a threshold
       looks like on every operations display ever built. */
    const beat = (state.clock.elapsedTime * 0.55) % 1;
    const s = 0.5 + beat * 2.6;
    m.scale.set(s, s, s);
    (m.material as THREE.MeshBasicMaterial).opacity = on * (1 - beat) * 0.7;
  });

  return (
    <mesh ref={ring} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.62, 0.72, 64]} />
      <meshBasicMaterial color="#dd5e3c" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/* ── Camera ───────────────────────────────────────────── */

interface Keyframe {
  at: number;
  pos: [number, number, number];
  look: [number, number, number];
}

/* Positions are derived from the projected corridor rather than typed in, so
   the shot stays framed on the real geography if the path is ever revised. */
function buildKeyframes(): Keyframe[] {
  const source = project(30.245, 75.844);
  const mid = project(29.7, 76.7);
  const receptor = project(28.6469, 77.3162);

  return [
    /* Low over the Punjab fields, looking along the corridor. */
    { at: 0, pos: [source[0] - 2.4, 1.5, source[1] + 3.4], look: [source[0], 0.2, source[1]] },
    /* Lifting as the plume forms. */
    { at: CHAPTERS.TRANSPORT, pos: [source[0] - 0.6, 4.2, source[1] + 5.6], look: [mid[0], 0.6, mid[1]] },
    /* Tracking the transport southeast. */
    { at: 0.46, pos: [mid[0] - 3.0, 6.4, mid[1] + 7.0], look: [mid[0] + 1.5, 0.9, mid[1] - 2.0] },
    /* Descending onto the receptor. */
    { at: CHAPTERS.ARRIVAL, pos: [receptor[0] - 2.2, 3.4, receptor[1] + 5.4], look: [receptor[0], 0.4, receptor[1]] },
    /* Pulling up for the register. */
    { at: CHAPTERS.ATTRIBUTION, pos: [mid[0] - 1.0, 9.0, mid[1] + 11.0], look: [mid[0], 0.5, mid[1] - 1.5] },
    { at: 1, pos: [mid[0] + 1.5, 12.5, mid[1] + 13.5], look: [mid[0] - 0.5, 0.5, mid[1] - 2.5] },
  ];
}

function FlightCamera({
  progress,
  focus,
}: {
  progress: React.RefObject<number>;
  focus: React.RefObject<THREE.Vector3>;
}) {
  const keys = useMemo(() => buildKeyframes(), []);
  const pos = useRef(new THREE.Vector3(...keys[0].pos));
  const look = useRef(new THREE.Vector3(...keys[0].look));
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetLook = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const p = Math.min(1, Math.max(0, progress.current ?? 0));

    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1].at) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const k = ramp(p, a.at, b.at);

    targetPos.set(
      THREE.MathUtils.lerp(a.pos[0], b.pos[0], k),
      THREE.MathUtils.lerp(a.pos[1], b.pos[1], k),
      THREE.MathUtils.lerp(a.pos[2], b.pos[2], k)
    );
    targetLook.set(
      THREE.MathUtils.lerp(a.look[0], b.look[0], k),
      THREE.MathUtils.lerp(a.look[1], b.look[1], k),
      THREE.MathUtils.lerp(a.look[2], b.look[2], k)
    );

    /* Critically-damped follow rather than a hard set. Even with Lenis
       smoothing the scroll, a camera snapped straight to the scrub position
       reads as mechanical; the lag is what makes it feel flown. */
    const ease = 1 - Math.pow(0.0016, delta);
    pos.current.lerp(targetPos, ease);
    look.current.lerp(targetLook, ease);

    state.camera.position.copy(pos.current);
    state.camera.lookAt(look.current);
    if (focus.current) focus.current.copy(look.current);
  });

  return null;
}

/* Perspective point-size attenuation, matching the globe's convention so a
   marker is the same visual size in both scenes. */
function projScale(state: RootState): number {
  const cam = state.camera as THREE.PerspectiveCamera;
  const dpr = Math.min(state.viewport.dpr ?? 1, 2);
  return (state.size.height * dpr) / (2 * Math.tan((cam.fov * Math.PI) / 360));
}

/* ── Scene ────────────────────────────────────────────── */

function Scene({
  progress,
  detections,
}: {
  progress: React.RefObject<number>;
  detections: FireDetection[];
}) {
  const focus = useRef(new THREE.Vector3());

  return (
    <>
      <fog attach="fog" args={["#0b1015", 14, 42]} />
      <FlightCamera progress={progress} focus={focus} />
      <AttributionFloor focus={focus} />
      <Hotspots detections={detections} progress={progress} />
      <Plume progress={progress} />
      <Receptor progress={progress} />
      <AttributionColumns progress={progress} />
    </>
  );
}

export default function CorridorFlight({
  progress,
  detections,
  className,
}: {
  progress: React.RefObject<number>;
  detections: FireDetection[];
  className?: string;
}) {
  return (
    <Canvas
      className={className}
      /* Two is the point past which extra pixel density costs battery and
         buys nothing on a scene made of points and hairlines. */
      dpr={[1, 2]}
      camera={{ fov: 42, near: 0.1, far: 90 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Scene progress={progress} detections={detections} />
    </Canvas>
  );
}
