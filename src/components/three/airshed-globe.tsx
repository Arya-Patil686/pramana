"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EPISODES } from "@/data/mock-episodes";

/*
   The airshed globe.

   Everything here is drawn from coordinates, not from a texture. There is no
   basemap image, and deliberately no invented coastline: the sphere carries a
   graticule, a solar terminator, the real FIRMS hotspot positions from the
   episode record, and a advection plume solved along a bezier between the
   source centroid and the receptor city. An instrument shows what it measured.
*/

const R = 1;
const DEG = Math.PI / 180;

function latLngToVec3(lat: number, lng: number, radius = R): THREE.Vector3 {
  const phi = lat * DEG;
  const theta = lng * DEG;
  return new THREE.Vector3(
    -radius * Math.cos(phi) * Math.cos(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.sin(theta)
  );
}

/* ── Sphere with a solar terminator ───────────────────── */

const surfaceVert = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewPos;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const surfaceFrag = /* glsl */ `
  uniform vec3 uNight;
  uniform vec3 uDay;
  uniform vec3 uRim;
  uniform vec3 uSun;
  varying vec3 vNormalW;
  varying vec3 vViewPos;

  void main() {
    float sun = dot(normalize(vNormalW), normalize(uSun));
    // A wide terminator reads as atmosphere rather than a hard shadow line.
    float lit = smoothstep(-0.45, 0.55, sun);
    vec3 base = mix(uNight, uDay, lit * 0.55);

    vec3 viewDir = normalize(-vViewPos);
    vec3 nView = normalize(vec3(viewMatrix * vec4(vNormalW, 0.0)));
    float fres = pow(1.0 - max(dot(nView, viewDir), 0.0), 3.0);
    base += uRim * fres * 0.85;

    gl_FragColor = vec4(base, 1.0);
  }
`;

function GlobeSurface() {
  return (
    <mesh>
      <sphereGeometry args={[R, 96, 96]} />
      <shaderMaterial
        vertexShader={surfaceVert}
        fragmentShader={surfaceFrag}
        uniforms={useMemo(
          () => ({
            uNight: { value: new THREE.Color("#0d141c") },
            uDay: { value: new THREE.Color("#243444") },
            uRim: { value: new THREE.Color("#3f5a7a") },
            uSun: { value: new THREE.Vector3(-0.6, 0.35, 0.9) },
          }),
          []
        )}
      />
    </mesh>
  );
}

/* ── Outer atmospheric shell ──────────────────────────── */

const atmoVert = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const atmoFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  varying vec3 vNormalV;
  varying vec3 vViewPos;

  void main() {
    vec3 viewDir = normalize(-vViewPos);
    float f = 1.0 - abs(dot(normalize(vNormalV), viewDir));
    f = pow(f, uPower);
    gl_FragColor = vec4(uColor, f * uIntensity);
  }
`;

function Atmosphere({
  radius,
  color,
  intensity,
  power,
}: {
  radius: number;
  color: string;
  intensity: number;
  power: number;
}) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uPower: { value: power },
    }),
    [color, intensity, power]
  );

  return (
    <mesh scale={radius}>
      <sphereGeometry args={[R, 64, 64]} />
      <shaderMaterial
        vertexShader={atmoVert}
        fragmentShader={atmoFrag}
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ── Graticule ────────────────────────────────────────── */

function Graticule() {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const rad = R * 1.001;
    const push = (v: THREE.Vector3) => pts.push(v.x, v.y, v.z);

    // Parallels every 20 degrees
    for (let lat = -80; lat <= 80; lat += 20) {
      for (let lng = -180; lng < 180; lng += 3) {
        push(latLngToVec3(lat, lng, rad));
        push(latLngToVec3(lat, lng + 3, rad));
      }
    }
    // Meridians every 20 degrees
    for (let lng = -180; lng < 180; lng += 20) {
      for (let lat = -88; lat < 88; lat += 3) {
        push(latLngToVec3(lat, lng, rad));
        push(latLngToVec3(lat + 3, lng, rad));
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color="#2b3a4c"
        transparent
        opacity={0.42}
        depthWrite={false}
      />
    </lineSegments>
  );
}

/* ── FIRMS hotspots ───────────────────────────────────── */

const fireVert = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime;
  uniform float uDpr;
  varying float vFacing;
  varying float vPulse;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 nView = normalize(normalMatrix * normalize(position));
    vec3 viewDir = normalize(-mv.xyz);
    vFacing = smoothstep(-0.02, 0.32, dot(nView, viewDir));
    vPulse = 0.74 + 0.26 * sin(uTime * 1.9 + aSeed * 6.2831853);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uDpr * vPulse * (230.0 / -mv.z);
  }
`;

const fireFrag = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uHalo;
  varying float vFacing;
  varying float vPulse;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = smoothstep(0.15, 0.0, d);
    float halo = smoothstep(0.5, 0.05, d);
    vec3 col = mix(uHalo, uCore, core);
    float a = (halo * 0.5 + core * 0.95) * vFacing * vPulse;
    gl_FragColor = vec4(col, a);
  }
`;

function FireField({ hotspots }: { hotspots: { lat: number; lng: number; frp: number }[] }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();

  const geometry = useMemo(() => {
    const pos: number[] = [];
    const size: number[] = [];
    const seed: number[] = [];
    hotspots.forEach((h, i) => {
      const v = latLngToVec3(h.lat, h.lng, R * 1.006);
      pos.push(v.x, v.y, v.z);
      // Fire Radiative Power drives marker area, clamped so one big fire
      // does not swallow the corridor.
      size.push(3.4 + Math.min(Math.sqrt(h.frp) * 0.9, 7.5));
      seed.push((i * 0.618) % 1);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.Float32BufferAttribute(size, 1));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
    return g;
  }, [hotspots]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDpr: { value: 1 },
      uCore: { value: new THREE.Color("#ffd9a8") },
      uHalo: { value: new THREE.Color("#e8703a") },
    }),
    []
  );

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      matRef.current.uniforms.uDpr.value = Math.min(viewport.dpr ?? 1, 2);
    }
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

/* ── Advection plume ──────────────────────────────────── */

const plumeVert = /* glsl */ `
  attribute float aOffset;
  attribute float aSpeed;
  attribute vec3 aJitter;
  uniform float uTime;
  uniform float uDpr;
  uniform vec3 uP0;
  uniform vec3 uP1;
  uniform vec3 uP2;
  varying float vAlpha;
  varying float vT;

  vec3 bezier(vec3 p0, vec3 p1, vec3 p2, float t) {
    float u = 1.0 - t;
    return u * u * p0 + 2.0 * u * t * p1 + t * t * p2;
  }

  void main() {
    float t = fract(aOffset + uTime * aSpeed * 0.05);
    vT = t;
    vec3 p = bezier(uP0, uP1, uP2, t);
    // Dispersion widens downwind, which is the physically honest behaviour.
    p += aJitter * (0.010 + t * 0.070);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 nView = normalize(normalMatrix * normalize(p));
    vec3 viewDir = normalize(-mv.xyz);
    float facing = smoothstep(-0.08, 0.28, dot(nView, viewDir));

    vAlpha = facing * smoothstep(0.0, 0.10, t) * smoothstep(1.0, 0.70, t);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.5 + t * 3.8) * uDpr * (200.0 / -mv.z);
  }
`;

const plumeFrag = /* glsl */ `
  uniform vec3 uHot;
  uniform vec3 uCold;
  varying float vAlpha;
  varying float vT;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    // Smoke cools from ember to grey as it travels.
    vec3 col = mix(uHot, uCold, smoothstep(0.0, 0.45, vT));
    gl_FragColor = vec4(col, soft * vAlpha * 0.42);
  }
`;

function PlumeStream({
  source,
  receptor,
  count = 900,
}: {
  source: THREE.Vector3;
  receptor: THREE.Vector3;
  count?: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();

  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const offset = new Float32Array(count);
    const speed = new Float32Array(count);
    const jitter = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      offset[i] = i / count;
      speed[i] = 0.7 + ((i * 37) % 60) / 100;
      // Deterministic scatter, so the plume looks the same on every load.
      const a = Math.sin(i * 12.9898) * 43758.5453;
      const b = Math.sin(i * 78.233) * 12345.6789;
      const c = Math.sin(i * 39.425) * 24634.6345;
      jitter[i * 3] = (a - Math.floor(a)) - 0.5;
      jitter[i * 3 + 1] = (b - Math.floor(b)) - 0.5;
      jitter[i * 3 + 2] = (c - Math.floor(c)) - 0.5;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aOffset", new THREE.BufferAttribute(offset, 1));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    g.setAttribute("aJitter", new THREE.BufferAttribute(jitter, 3));
    // The vertex shader positions every particle, so the bounding sphere has
    // to be set manually or the whole system gets frustum-culled away.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), R * 1.4);
    return g;
  }, [count]);

  const uniforms = useMemo(() => {
    const mid = source.clone().add(receptor).multiplyScalar(0.5).normalize();
    return {
      uTime: { value: 0 },
      uDpr: { value: 1 },
      uP0: { value: source.clone().normalize().multiplyScalar(R * 1.012) },
      uP1: { value: mid.multiplyScalar(R * 1.13) },
      uP2: { value: receptor.clone().normalize().multiplyScalar(R * 1.012) },
      uHot: { value: new THREE.Color("#c07a4a") },
      uCold: { value: new THREE.Color("#8e9aab") },
    };
  }, [source, receptor]);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      matRef.current.uniforms.uDpr.value = Math.min(viewport.dpr ?? 1, 2);
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={plumeVert}
        fragmentShader={plumeFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ── Corridor arc ─────────────────────────────────────── */

function CorridorArc({
  source,
  receptor,
}: {
  source: THREE.Vector3;
  receptor: THREE.Vector3;
}) {
  // Built imperatively: the JSX tag <line> resolves to the SVG intrinsic
  // element, not THREE.Line, so the arc is constructed and mounted directly.
  const arc = useMemo(() => {
    const mid = source
      .clone()
      .add(receptor)
      .multiplyScalar(0.5)
      .normalize()
      .multiplyScalar(R * 1.13);
    const curve = new THREE.QuadraticBezierCurve3(
      source.clone().normalize().multiplyScalar(R * 1.012),
      mid,
      receptor.clone().normalize().multiplyScalar(R * 1.012)
    );
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(72));
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color("#5c8ae6"),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, [source, receptor]);

  useEffect(
    () => () => {
      arc.geometry.dispose();
      (arc.material as THREE.Material).dispose();
    },
    [arc]
  );

  return <primitive object={arc} />;
}

/* ── Receptor ping ────────────────────────────────────── */

const pingVert = /* glsl */ `
  uniform float uDpr;
  uniform float uSize;
  varying float vFacing;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 nView = normalize(normalMatrix * normalize(position));
    vFacing = smoothstep(-0.05, 0.3, dot(nView, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uDpr * (230.0 / -mv.z);
  }
`;

const pingFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying float vFacing;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;

    // Fixed centre mark plus an expanding sonar ring.
    float dot0 = smoothstep(0.20, 0.05, d);
    float phase = fract(uTime * 0.5);
    float ringR = 0.18 + phase * 0.78;
    float ring = smoothstep(0.07, 0.0, abs(d - ringR)) * (1.0 - phase);

    float a = (dot0 * 0.95 + ring * 0.75) * vFacing;
    gl_FragColor = vec4(uColor, a);
  }
`;

function ReceptorPing({ position }: { position: THREE.Vector3 }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();

  const geometry = useMemo(() => {
    const p = position.clone().normalize().multiplyScalar(R * 1.008);
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([p.x, p.y, p.z], 3)
    );
    return g;
  }, [position]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDpr: { value: 1 },
      uSize: { value: 26 },
      uColor: { value: new THREE.Color("#2fbfb0") },
    }),
    []
  );

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      matRef.current.uniforms.uDpr.value = Math.min(viewport.dpr ?? 1, 2);
    }
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={pingVert}
        fragmentShader={pingFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ── Scene ────────────────────────────────────────────── */

function Scene({
  corridor,
  interactive,
}: {
  corridor: "punjab-delhi" | "chiangmai-bangkok";
  interactive: boolean;
}) {
  const spinRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);

  const episode = useMemo(
    () => EPISODES.find((e) => e.corridor === corridor) ?? EPISODES[0],
    [corridor]
  );

  const { sourceVec, receptorVec, centreLng, centreLat } = useMemo(() => {
    const hs = episode.fireHotspots;
    const meanLat = hs.reduce((s, h) => s + h.lat, 0) / hs.length;
    const meanLng = hs.reduce((s, h) => s + h.lng, 0) / hs.length;
    const [rLat, rLng] = episode.receptorCoords;
    return {
      sourceVec: latLngToVec3(meanLat, meanLng),
      receptorVec: latLngToVec3(rLat, rLng),
      centreLat: (meanLat + rLat) / 2,
      centreLng: (meanLng + rLng) / 2,
    };
  }, [episode]);

  // Bring the corridor to face the camera, then hold a slow drift.
  const baseSpin = (90 - centreLng) * DEG;
  const baseTilt = centreLat * DEG;

  useFrame((state, delta) => {
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 0.028;
    }
    if (tiltRef.current && interactive) {
      const { x, y } = state.pointer;
      tiltRef.current.rotation.x = THREE.MathUtils.lerp(
        tiltRef.current.rotation.x,
        baseTilt + y * 0.14,
        0.045
      );
      tiltRef.current.rotation.z = THREE.MathUtils.lerp(
        tiltRef.current.rotation.z,
        x * 0.06,
        0.045
      );
    }
  });

  return (
    <group ref={tiltRef} rotation={[baseTilt, 0, 0]}>
      <group ref={spinRef} rotation={[0, baseSpin, 0]}>
        <GlobeSurface />
        <Graticule />
        <FireField hotspots={episode.fireHotspots} />
        <CorridorArc source={sourceVec} receptor={receptorVec} />
        <PlumeStream source={sourceVec} receptor={receptorVec} />
        <ReceptorPing position={receptorVec} />
      </group>
      <Atmosphere radius={1.035} color="#4a6a8f" intensity={0.55} power={3.2} />
      <Atmosphere radius={1.14} color="#2f4a66" intensity={0.28} power={2.1} />
    </group>
  );
}

/* ── Static fallback for machines without WebGL ───────── */

function GlobeFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 200 200" className="h-[78%] w-[78%] max-w-[420px]">
        <circle cx="100" cy="100" r="72" fill="#0d141c" stroke="#2b3a4c" />
        {[-45, -22.5, 0, 22.5, 45].map((lat) => (
          <ellipse
            key={lat}
            cx="100"
            cy={100 + lat * 1.35}
            rx={72 * Math.cos(lat * DEG)}
            ry={4.5}
            fill="none"
            stroke="#2b3a4c"
            strokeWidth="0.6"
          />
        ))}
        {[0, 30, 60, 90, 120, 150].map((lng) => (
          <ellipse
            key={lng}
            cx="100"
            cy="100"
            rx={72 * Math.abs(Math.cos(lng * DEG))}
            ry="72"
            fill="none"
            stroke="#2b3a4c"
            strokeWidth="0.6"
          />
        ))}
        <circle cx="122" cy="76" r="3" fill="#e8703a" />
        <circle cx="128" cy="83" r="2.2" fill="#e8703a" />
        <circle cx="116" cy="82" r="2.6" fill="#e8703a" />
        <path
          d="M120 80 Q135 92 141 104"
          fill="none"
          stroke="#5c8ae6"
          strokeWidth="0.9"
          opacity="0.6"
        />
        <circle cx="141" cy="104" r="3.4" fill="none" stroke="#2fbfb0" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

/* ── Public component ─────────────────────────────────── */

export interface AirshedGlobeProps {
  corridor?: "punjab-delhi" | "chiangmai-bangkok";
  interactive?: boolean;
  className?: string;
}

export default function AirshedGlobe({
  corridor = "punjab-delhi",
  interactive = true,
  className,
}: AirshedGlobeProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={className}>
        <GlobeFallback />
      </div>
    );
  }

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 3.05], fov: 36 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        onError={() => setFailed(true)}
      >
        <Scene corridor={corridor} interactive={interactive} />
      </Canvas>
    </div>
  );
}
