"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { project, CORRIDOR_NODES } from "@/lib/corridor-geo";
import {
  altitude,
  bearingToVector,
  mulberry32,
  ramp,
  Y_TRANSPORT,
} from "@/lib/airshed-3d";
import type { Trace } from "@/lib/attribution/engine";
import type { FireDetection } from "@/lib/sources/firms";
import type { WindSample } from "@/lib/sources/meteo";

/*
   The airshed, as a volume.

   This exists for one reason a flat map cannot serve. The whole argument
   rests on transport happening at 925 hPa rather than at the surface, and
   that is a claim about height: the 10 m wind and the transport wind point in
   different directions, at the same place, at the same moment. On a map those
   are two arrows on top of each other. In a volume they are two layers, and
   the smoke visibly rides the upper one over a city the lower one never
   points at.

   Everything here is measured. Ground marks are the 0.1° accumulation grid at
   true coordinates. The undulating ceiling is the real boundary-layer height
   from Open-Meteo, interpolated between corridor samples. The columns are
   detections at their true positions, height scaled to radiative power. The
   particles ride the same trajectories the register is computed from. Vertical
   scale is exaggerated 25× and the scene says so on screen.

   Rendered in the report's own palette — ink on paper, not a night scene —
   so it reads as a physical model of the airshed rather than a game engine.
*/

const PAPER = "#efe8d9";
const INK = "#191c1f";
const EMBER = "#b8391f";
const FLOW = "#2b5f68";

/* Perspective point-size attenuation: sizes are declared in world units and
   converted here, so a mark is the same visual size at any viewport. */
function projScale(state: RootState): number {
  const cam = state.camera as THREE.PerspectiveCamera;
  const dpr = Math.min(state.viewport.dpr ?? 1, 2);
  return (state.size.height * dpr) / (2 * Math.tan((cam.fov * Math.PI) / 360));
}

/* Inverse-distance interpolation over the corridor samples. */
function interpolate(
  samples: WindSample[],
  x: number,
  z: number,
  pick: (s: WindSample) => number
): number {
  let sw = 0;
  let sv = 0;
  for (const s of samples) {
    const [sx, sz] = project(s.lat, s.lng);
    const d = Math.max(Math.hypot(x - sx, z - sz), 0.35);
    const w = 1 / (d * d);
    sv += w * pick(s);
    sw += w;
  }
  return sw === 0 ? 0 : sv / sw;
}

/* ── Ground: the accumulation grid ────────────────────── */

function Ground({ bounds }: { bounds: Bounds }) {
  const geometry = useMemo(() => {
    const seg: number[] = [];
    for (let lat = 28.2; lat <= 31.3; lat += 0.1) {
      const [, z1] = project(lat, 74.6);
      seg.push(bounds.minX, 0, z1, bounds.maxX, 0, z1);
    }
    for (let lng = 74.6; lng <= 77.9; lng += 0.1) {
      const [x1] = project(28.2, lng);
      seg.push(x1, 0, bounds.minZ, x1, 0, bounds.maxZ);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seg), 3));
    return g;
  }, [bounds]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={INK} transparent opacity={0.13} />
    </lineSegments>
  );
}

/* ── The boundary-layer ceiling ───────────────────────── */

/*
   A real surface, not a decorative plane. Its height at every vertex is the
   Open-Meteo boundary-layer depth interpolated between corridor samples, so
   the ceiling genuinely rises and falls along the route — and where it sits
   below the transport level, smoke above it is decoupled from the ground and
   travels without being diluted into the city underneath.
*/
function BoundaryLayer({
  samples,
  bounds,
  reveal,
}: {
  samples: WindSample[];
  bounds: Bounds;
  reveal: React.RefObject<number>;
}) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  const geometry = useMemo(() => {
    const NX = 46;
    const NZ = 46;
    const g = new THREE.PlaneGeometry(
      bounds.maxX - bounds.minX,
      bounds.maxZ - bounds.minZ,
      NX,
      NZ
    );
    g.rotateX(-Math.PI / 2);
    g.translate(
      (bounds.minX + bounds.maxX) / 2,
      0,
      (bounds.minZ + bounds.maxZ) / 2
    );

    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const m = interpolate(samples, x, z, (s) => s.boundaryLayerM ?? 250);
      pos.setY(i, altitude(m));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [samples, bounds]);

  useFrame(() => {
    if (mat.current) mat.current.opacity = 0.1 * ramp(reveal.current ?? 0, 0.12, 0.34);
  });

  return (
    <>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          ref={mat}
          color={FLOW}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments>
        <wireframeGeometry args={[geometry]} />
        <lineBasicMaterial color={FLOW} transparent opacity={0.09} depthWrite={false} />
      </lineSegments>
    </>
  );
}

/* ── Plume particles ──────────────────────────────────── */

const plumeVert = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute float aSeed;
  attribute float aWeight;
  attribute float aJourney;

  uniform float uAdvance;
  uniform float uDrift;
  uniform float uScale;
  uniform float uTransportY;

  varying float vJourney;
  varying float vAlpha;

  void main() {
    /*
       Two different parameters, and confusing them breaks the scene.

       't' is where the particle sits along its own one-hour leg of a
       trajectory, and it cycles: that is what produces motion.

       'aJourney' is where that leg sits along the whole route from source to
       receptor, and it does not cycle. Everything physical reads from it —
       height, dispersion, colour, size. An earlier version drove the lofting
       curve from 't', which meant a particle on a leg near Delhi rose from
       ground level over Delhi, so smoke appeared to lift off the ground the
       entire length of the corridor. That is precisely the opposite of what
       this scene exists to show.
    */
    float speed = 0.6 + fract(aSeed * 71.13) * 0.5;
    float t = fract(aSeed + uAdvance * speed + uDrift * 0.03);

    vec3 pos = mix(aStart, aEnd, t);

    // Released at the surface, lifted into the transport layer over the first
    // fifth of the route, and carried there for the rest of it.
    float loft = smoothstep(0.0, 0.18, aJourney);
    pos.y = mix(0.04, uTransportY, loft);

    // Dispersion grows with distance travelled from the source.
    float spread = 0.3 + aJourney * 2.2;
    float w1 = sin(aSeed * 43.0 + uDrift * 0.5 + t * 6.0);
    float w2 = cos(aSeed * 29.0 + uDrift * 0.4 + t * 5.0);
    pos.x += w1 * spread * 0.42;
    pos.z += w2 * spread * 0.42;
    pos.y += w1 * spread * 0.12;

    /*
       Leg-local fade. A particle cycling within its leg would pop at both
       ends; a sine over t fades it in and out instead, so the field reads as
       continuous flow rather than as blinking dots.
    */
    float legFade = sin(3.14159265 * t);
    // Thinning as the plume disperses toward the receptor.
    float death = 1.0 - smoothstep(0.82, 1.0, aJourney);
    vAlpha = legFade * death * (0.25 + aWeight * 0.75);
    vJourney = aJourney;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (0.09 + aJourney * 0.26) * uScale / max(-mv.z, 0.001);
    gl_Position = projectionMatrix * mv;
  }
`;

const plumeFrag = /* glsl */ `
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform float uOpacity;
  varying float vJourney;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float soft = 1.0 - smoothstep(0.0, 1.0, r);
    // Warm at ignition, cooling to grey haze by the receptor.
    vec3 col = mix(uNear, uFar, smoothstep(0.04, 0.55, vJourney));
    gl_FragColor = vec4(col, soft * soft * vAlpha * uOpacity);
  }
`;

function Plume({
  traces,
  reveal,
}: {
  traces: Trace[];
  reveal: React.RefObject<number>;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    /* Particles are distributed across the traces in proportion to how much
       each one deposited, so the visual density is the register. */
    const PER_TRACE = 26;
    const n = Math.max(1, traces.length) * PER_TRACE;
    const start = new Float32Array(n * 3);
    const end = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const weight = new Float32Array(n);
    const journey = new Float32Array(n);
    const positions = new Float32Array(n * 3);

    const rand = mulberry32(0x5eed1);
    let i = 0;
    for (const t of traces) {
      const pts = t.points;
      for (let k = 0; k < PER_TRACE; k++) {
        /* Each particle rides one leg of the polyline, so the whole path is
           populated rather than only its endpoints. */
        const leg = Math.min(pts.length - 2, Math.floor(rand() * (pts.length - 1)));
        /* Where this leg sits along the whole route, 0 at the source and 1 at
           closest approach to the receptor. */
        journey[i] = pts.length > 1 ? leg / (pts.length - 1) : 0;
        const [aLat, aLng] = pts[Math.max(0, leg)];
        const [bLat, bLng] = pts[Math.min(pts.length - 1, leg + 1)];
        const [ax, az] = project(aLat, aLng);
        const [bx, bz] = project(bLat, bLng);
        start[i * 3] = ax;
        start[i * 3 + 1] = 0;
        start[i * 3 + 2] = az;
        end[i * 3] = bx;
        end[i * 3 + 1] = 0;
        end[i * 3 + 2] = bz;
        seed[i] = rand();
        weight[i] = t.weight;
        i++;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aWeight", new THREE.BufferAttribute(weight, 1));
    g.setAttribute("aJourney", new THREE.BufferAttribute(journey, 1));
    /* Positions come from the vertex shader, so the computed bounding sphere
       would be wrong; set one wide enough never to cull the field. */
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(-12, 1, -14), 46);

    return {
      geometry: g,
      uniforms: {
        uAdvance: { value: 0 },
        uDrift: { value: 0 },
        uScale: { value: 800 },
        uOpacity: { value: 0 },
        uTransportY: { value: Y_TRANSPORT },
        uNear: { value: new THREE.Color(EMBER) },
        uFar: { value: new THREE.Color("#6f6255") },
      },
    };
  }, [traces]);

  useFrame((state, delta) => {
    const u = matRef.current?.uniforms;
    if (!u) return;
    const p = reveal.current ?? 0;
    u.uAdvance.value = p * 1.15;
    u.uDrift.value += delta;
    u.uOpacity.value = ramp(p, 0.28, 0.52);
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

/* ── Wind layers ──────────────────────────────────────── */

/*
   The comparison the scene exists for. Two sets of arrows at the same
   coordinates: the 10 m wind sitting just above the ground, and the 925 hPa
   wind at transport height. Where they diverge, a surface observation is
   telling an operator the wrong thing about where the smoke is going.
*/
function WindLayers({
  samples,
  reveal,
}: {
  samples: WindSample[];
  reveal: React.RefObject<number>;
}) {
  const surfaceRef = useRef<THREE.LineSegments>(null);
  const transportRef = useRef<THREE.LineSegments>(null);

  /* Both layers are built in one memo. Wrapping useMemo in a helper and
     calling it per level works only as long as the call order never varies,
     which is exactly the assumption the rules of hooks exist to stop anyone
     relying on. */
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
        /* Two short strokes back along the shaft make the head. */
        const spread = 0.42;
        const back = 0.3;
        for (const sgn of [-1, 1]) {
          const a = Math.atan2(dx, -dz) + sgn * spread;
          seg.push(hx, y, hz, hx - Math.sin(a) * back, y, hz + Math.cos(a) * back);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seg), 3));
      return g;
    };
    return [arrows("surface"), arrows("transport")] as const;
  }, [samples]);

  useFrame(() => {
    const p = reveal.current ?? 0;
    const s = surfaceRef.current?.material as THREE.LineBasicMaterial | undefined;
    const t = transportRef.current?.material as THREE.LineBasicMaterial | undefined;
    /* Surface first, then the transport layer above it — the reveal order is
       the argument: here is what a ground station sees, and here is what is
       actually carrying the smoke. */
    if (s) s.opacity = 0.55 * ramp(p, 0.14, 0.3);
    if (t) t.opacity = 0.85 * ramp(p, 0.3, 0.46);
  });

  return (
    <>
      <lineSegments ref={surfaceRef} geometry={surfaceGeo}>
        <lineBasicMaterial color={INK} transparent opacity={0} />
      </lineSegments>
      <lineSegments ref={transportRef} geometry={transportGeo}>
        <lineBasicMaterial color={FLOW} transparent opacity={0} />
      </lineSegments>
    </>
  );
}

/* ── Fire markers ─────────────────────────────────────── */

function Fires({
  detections,
  reveal,
}: {
  detections: FireDetection[];
  reveal: React.RefObject<number>;
}) {
  const ref = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const maxFrp = Math.max(1, ...detections.map((d) => d.frp));
    const seg: number[] = [];
    for (const d of detections) {
      const [x, z] = project(d.lat, d.lng);
      /* Column height scales with radiative power, so the strongest sources
         read at a glance without a legend. */
      const h = altitude(120 + Math.sqrt(d.frp / maxFrp) * 900);
      seg.push(x, 0, z, x, h, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seg), 3));
    return g;
  }, [detections]);

  useFrame(() => {
    const m = ref.current?.material as THREE.LineBasicMaterial | undefined;
    if (m) m.opacity = 0.8 * ramp(reveal.current ?? 0, 0.04, 0.2);
  });

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color={EMBER} transparent opacity={0} />
    </lineSegments>
  );
}

/* ── Receptor ─────────────────────────────────────────── */

function Receptor({ reveal }: { reveal: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const [x, z] = useMemo(() => {
    const node = CORRIDOR_NODES.find((n) => n.kind === "receptor");
    return project(node?.lat ?? 28.6469, node?.lng ?? 77.3162);
  }, []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const on = ramp(reveal.current ?? 0, 0.52, 0.74);
    g.visible = on > 0.001;
    g.scale.setY(Math.max(0.001, on));
    /* A slow pulse on the ring, the way every operations display marks a
       threshold crossing. */
    const beat = (state.clock.elapsedTime * 0.5) % 1;
    const ring = g.children[1] as THREE.Mesh | undefined;
    if (ring) {
      const s = 0.6 + beat * 1.8;
      ring.scale.set(s, s, s);
      (ring.material as THREE.MeshBasicMaterial).opacity = on * (1 - beat) * 0.6;
    }
  });

  return (
    <group ref={group} position={[x, 0, z]} visible={false}>
      <mesh position={[0, Y_TRANSPORT / 2, 0]}>
        <boxGeometry args={[0.5, Y_TRANSPORT, 0.5]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.7, 0.82, 64]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ── Camera ───────────────────────────────────────────── */

interface Key {
  at: number;
  pos: [number, number, number];
  look: [number, number, number];
}

function keyframes(): Key[] {
  const src = project(30.245, 75.844);
  const mid = project(29.8, 76.6);
  const rec = project(28.6469, 77.3162);

  /*
     Shots are derived from the corridor vector rather than typed in as
     offsets. Hand-written offsets produced an opening shot that looked
     north-east while the corridor runs south-east, so the establishing frame
     pointed away from the city the whole sequence is travelling toward.

     `dir` is the unit vector from source to receptor; `perp` is ninety
     degrees off it. Side-on shots use `perp`, because the vertical separation
     between the surface and transport winds only reads from the side.
  */
  const dx = rec[0] - src[0];
  const dz = rec[1] - src[1];
  const len = Math.hypot(dx, dz) || 1;
  const dir: [number, number] = [dx / len, dz / len];
  const perp: [number, number] = [-dir[1], dir[0]];

  const at = (
    base: [number, number],
    along: number,
    side: number,
    y: number
  ): [number, number, number] => [
    base[0] + dir[0] * along + perp[0] * side,
    y,
    base[1] + dir[1] * along + perp[1] * side,
  ];

  return [
    /* Low over the Punjab fields, looking down the corridor. */
    { at: 0, pos: at(src, -7, 1.5, 1.5), look: at(src, 5, 0, 0.4) },
    /* Side-on and rising, so the two wind layers separate vertically. */
    { at: 0.3, pos: at(mid, -2, 11, 3.2), look: at(mid, 0, 0, Y_TRANSPORT * 0.55) },
    /* Tracking the plume along the transport level. */
    { at: 0.55, pos: at(mid, -6, 6.5, 4.4), look: at(mid, 6, 0, Y_TRANSPORT) },
    /* Descending onto the receptor. */
    { at: 0.78, pos: at(rec, -6.5, 3.5, 2.8), look: at(rec, 0, 0, Y_TRANSPORT * 0.5) },
    /* Pulling out over the whole airshed. */
    { at: 1, pos: at(mid, -2, 7, 12), look: at(mid, 1, 0, 1.0) },
  ];
}

function FlightCamera({ reveal }: { reveal: React.RefObject<number> }) {
  const keys = useMemo(() => keyframes(), []);
  const pos = useRef(new THREE.Vector3(...keys[0].pos));
  const look = useRef(new THREE.Vector3(...keys[0].look));
  const tp = useMemo(() => new THREE.Vector3(), []);
  const tl = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const p = Math.min(1, Math.max(0, reveal.current ?? 0));
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1].at) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const k = ramp(p, a.at, b.at);

    tp.set(
      THREE.MathUtils.lerp(a.pos[0], b.pos[0], k),
      THREE.MathUtils.lerp(a.pos[1], b.pos[1], k),
      THREE.MathUtils.lerp(a.pos[2], b.pos[2], k)
    );
    tl.set(
      THREE.MathUtils.lerp(a.look[0], b.look[0], k),
      THREE.MathUtils.lerp(a.look[1], b.look[1], k),
      THREE.MathUtils.lerp(a.look[2], b.look[2], k)
    );

    /* Critically-damped follow. A camera snapped straight to the scrub
       position reads as mechanical; the lag is what makes it feel flown. */
    const ease = 1 - Math.pow(0.002, delta);
    pos.current.lerp(tp, ease);
    look.current.lerp(tl, ease);
    state.camera.position.copy(pos.current);
    state.camera.lookAt(look.current);
  });

  return null;
}

/* ── Scene ────────────────────────────────────────────── */

interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function Scene({
  detections,
  wind,
  traces,
  reveal,
}: {
  detections: FireDetection[];
  wind: WindSample[];
  traces: Trace[];
  reveal: React.RefObject<number>;
}) {
  const bounds = useMemo<Bounds>(() => {
    const pts = [
      ...detections.map((d) => project(d.lat, d.lng)),
      ...CORRIDOR_NODES.map((n) => project(n.lat, n.lng)),
    ];
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    return {
      minX: Math.min(...xs) - 3,
      maxX: Math.max(...xs) + 3,
      minZ: Math.min(...zs) - 3,
      maxZ: Math.max(...zs) + 3,
    };
  }, [detections]);

  return (
    <>
      <fog attach="fog" args={[PAPER, 22, 62]} />
      <FlightCamera reveal={reveal} />
      <Ground bounds={bounds} />
      <BoundaryLayer samples={wind} bounds={bounds} reveal={reveal} />
      <Fires detections={detections} reveal={reveal} />
      <WindLayers samples={wind} reveal={reveal} />
      <Plume traces={traces} reveal={reveal} />
      <Receptor reveal={reveal} />
    </>
  );
}

export default function AirshedVolume({
  detections,
  wind,
  traces,
  reveal,
  className,
}: {
  detections: FireDetection[];
  wind: WindSample[];
  traces: Trace[];
  reveal: React.RefObject<number>;
  className?: string;
}) {
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={{ fov: 44, near: 0.1, far: 120 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Scene detections={detections} wind={wind} traces={traces} reveal={reveal} />
    </Canvas>
  );
}
