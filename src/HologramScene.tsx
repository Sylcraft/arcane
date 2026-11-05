import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector3,
} from "three";
import type { HologramController } from "./hologramController";
import type { HologramFile, ModelLoadStatus } from "./hologramAssets";
const ImportedHologram = lazy(() =>
  import("./ImportedHologram").then((module) => ({
    default: module.ImportedHologram,
  })),
);

const vertex = `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = -mv.xyz;
  vLocal = position;
  gl_Position = projectionMatrix * mv;
}`;
const fragment = `
uniform float uTime;
uniform float uGrab;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.1);
  float scan = pow(0.5 + 0.5 * sin(vLocal.y * 90.0 - uTime * 3.0), 12.0);
  float sweep = pow(0.5 + 0.5 * sin(vLocal.y * 3.0 - uTime * 0.7), 18.0);
  vec3 cyan = vec3(0.15, 0.86, 1.0);
  vec3 violet = vec3(0.43, 0.34, 1.0);
  vec3 color = mix(cyan, violet, 0.25 + vLocal.y * 0.15);
  color = mix(color, vec3(0.6, 1.0, 0.88), uGrab * 0.7);
  float alpha = 0.045 + rim * 0.44 + scan * 0.075 + sweep * 0.065 + uGrab * 0.07;
  gl_FragColor = vec4(color * (0.65 + rim + sweep * 0.4 + uGrab * 0.3), alpha);
}`;

function Scene({
  controller,
  onFailure,
  model,
  onModelStatus,
}: {
  controller: HologramController;
  onFailure: (message: string) => void;
  model?: HologramFile;
  onModelStatus: (status: ModelLoadStatus) => void;
}) {
  const body = useRef<Group>(null);
  const orbit = useRef<Group>(null);
  const stars = useRef<Group>(null);
  const shell = useRef<ShaderMaterial>(null);
  const wire = useRef<MeshBasicMaterial>(null);
  const core = useRef<MeshStandardMaterial>(null);
  const captureRing = useRef<MeshBasicMaterial>(null);
  const elapsed = useRef(0);
  const { camera, size, gl } = useThree();
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uGrab: { value: 0 } }),
    [],
  );
  const particles = useMemo(() => {
    const points = new Float32Array(84 * 3);
    for (let i = 0; i < 84; i++) {
      const angle = i * 2.399963;
      const radius = 2 + ((i * 37) % 100) / 100;
      points[i * 3] = Math.cos(angle) * radius;
      points[i * 3 + 1] = (((i * 13) % 100) / 100) * 4.2 - 2.1;
      points[i * 3 + 2] = Math.sin(angle) * radius - 1;
    }
    return points;
  }, []);
  useEffect(() => {
    camera.updateMatrixWorld();
    const center = new Vector3(0, 0.12, 0).project(camera);
    const right = new Vector3(1.28, 0.12, 0).project(camera);
    const top = new Vector3(0, 1.4, 0).project(camera);
    controller.setViewport(size.width, size.height, {
      x: (center.x + 1) / 2,
      y: (1 - center.y) / 2,
      rx: Math.abs(right.x - center.x) / 2,
      ry: Math.abs(top.y - center.y) / 2,
    });
  }, [controller, camera, size.width, size.height]);
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      controller.interrupt();
      onFailure(
        "Le contexte WebGL de l’hologramme a été perdu. Revenez à un autre module puis réouvrez Hologram.",
      );
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [controller, gl, onFailure]);
  // Positive priority takes over R3F rendering. Count only completed submissions
  // to the actual renderer, separately from MediaPipe/2D canvas telemetry.
  useFrame((state, delta) => {
    const started = performance.now();
    controller.expire(started);
    elapsed.current += Math.min(delta, 0.05);
    const t = elapsed.current;
    if (body.current) body.current.quaternion.copy(controller.rotation);
    if (orbit.current) {
      orbit.current.rotation.y = t * 0.13;
      orbit.current.rotation.z = Math.sin(t * 0.4) * 0.07;
    }
    if (stars.current) stars.current.rotation.y = t * 0.025;
    if (shell.current) {
      shell.current.uniforms.uTime.value = t;
      shell.current.uniforms.uGrab.value +=
        ((controller.grabbed ? 1 : 0) - shell.current.uniforms.uGrab.value) *
        (1 - Math.exp(-delta * 18));
    }
    if (wire.current) {
      wire.current.opacity = controller.grabbed
        ? 0.88
        : controller.hovered
          ? 0.65
          : 0.35;
      wire.current.color.set(controller.grabbed ? "#a0ffe7" : "#51cfff");
    }
    if (core.current)
      core.current.emissiveIntensity = controller.grabbed ? 2.8 : 1.1;
    if (captureRing.current) {
      captureRing.current.opacity = controller.grabbed
        ? 0.8
        : controller.hovered
          ? 0.5
          : 0.15;
      captureRing.current.color.set(controller.grabbed ? "#8cffe2" : "#53b8ff");
    }
    state.gl.render(state.scene, state.camera);
    controller.recordRender(performance.now(), performance.now() - started);
  }, 1);
  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[2, 3, 4]} color="#4bedff" intensity={18} />
      <pointLight position={[-3, 1, -2]} color="#9b6bff" intensity={12} />
      <group position={[0, 0.12, 0]}>
        <group ref={body}>
          {model ? (
            <Suspense
              fallback={
                <mesh>
                  <icosahedronGeometry args={[1.08, 1]} />
                  <meshBasicMaterial
                    color="#5cceff"
                    wireframe
                    transparent
                    opacity={0.3}
                  />
                </mesh>
              }
            >
              <ImportedHologram
                key={model.id}
                model={model}
                controller={controller}
                onStatus={onModelStatus}
              />
            </Suspense>
          ) : (
            <>
              <mesh>
                <icosahedronGeometry args={[1.08, 1]} />
                <shaderMaterial
                  ref={shell}
                  uniforms={uniforms}
                  vertexShader={vertex}
                  fragmentShader={fragment}
                  transparent
                  depthWrite={false}
                  blending={AdditiveBlending}
                  side={DoubleSide}
                />
              </mesh>
              <mesh>
                <icosahedronGeometry args={[1.09, 1]} />
                <meshBasicMaterial
                  ref={wire}
                  color="#51cfff"
                  wireframe
                  transparent
                  opacity={0.35}
                  depthWrite={false}
                  blending={AdditiveBlending}
                  toneMapped={false}
                />
              </mesh>
              <mesh rotation={[0.4, 0.2, 0.3]}>
                <octahedronGeometry args={[0.56, 0]} />
                <meshStandardMaterial
                  ref={core}
                  color="#10364c"
                  emissive="#31bce8"
                  emissiveIntensity={1.1}
                  metalness={0.55}
                  roughness={0.24}
                  transparent
                  opacity={0.5}
                />
              </mesh>
              <mesh rotation={[0.4, 0.2, 0.3]}>
                <octahedronGeometry args={[0.58, 0]} />
                <meshBasicMaterial
                  color="#b8ffff"
                  wireframe
                  transparent
                  opacity={0.5}
                  blending={AdditiveBlending}
                  toneMapped={false}
                />
              </mesh>
            </>
          )}
        </group>
        <group ref={orbit}>
          <mesh rotation={[1.2, 0.2, 0.25]}>
            <torusGeometry args={[1.4, 0.008, 8, 96]} />
            <meshBasicMaterial
              color="#579aff"
              transparent
              opacity={0.45}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
          <mesh rotation={[0.4, 1.1, -0.4]}>
            <torusGeometry args={[1.32, 0.006, 8, 96, Math.PI * 1.7]} />
            <meshBasicMaterial
              color="#b291ff"
              transparent
              opacity={0.5}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
        <mesh>
          <torusGeometry args={[1.3, 0.012, 8, 96]} />
          <meshBasicMaterial
            ref={captureRing}
            color="#53b8ff"
            transparent
            opacity={0.15}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
      <group position={[0, -1.55, 0]}>
        {[1.4, 1.65, 1.85].map((radius, i) => (
          <mesh key={radius} rotation={[-Math.PI / 2, 0, i * 0.4]}>
            <torusGeometry
              args={[
                radius,
                i === 0 ? 0.015 : 0.005,
                6,
                96,
                i === 1 ? Math.PI * 1.6 : Math.PI * 2,
              ]}
            />
            <meshBasicMaterial
              color={i === 0 ? "#62efef" : "#4b70ba"}
              transparent
              opacity={i === 0 ? 0.65 : 0.3}
              blending={AdditiveBlending}
            />
          </mesh>
        ))}
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.85, 1.4, 1.3, 48, 1, true]} />
          <meshBasicMaterial
            color="#42b3ee"
            transparent
            opacity={0.035}
            depthWrite={false}
            side={DoubleSide}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
      <gridHelper
        args={[9, 24, "#21465e", "#112939"]}
        position={[0, -1.59, 0]}
      />
      <group ref={stars}>
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[particles, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            color="#80deff"
            size={0.018}
            transparent
            opacity={0.5}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>
    </>
  );
}

export default function HologramScene({
  controller,
  model,
  onModelStatus,
}: {
  controller: HologramController;
  model?: HologramFile;
  onModelStatus: (status: ModelLoadStatus) => void;
}) {
  const [visible, setVisible] = useState(!document.hidden);
  const [error, setError] = useState("");
  useEffect(() => {
    const changed = () => {
      controller.interrupt();
      setVisible(!document.hidden);
    };
    document.addEventListener("visibilitychange", changed);
    return () => {
      document.removeEventListener("visibilitychange", changed);
      controller.interrupt();
    };
  }, [controller]);
  if (error)
    return (
      <div className="hologram-error" role="alert">
        {error}
      </div>
    );
  return (
    <Canvas
      camera={{ position: [0, 0, 5.8], fov: 42, near: 0.1, far: 40 }}
      dpr={[1, 1.5]}
      frameloop={visible ? "always" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      fallback={
        <div className="hologram-error">
          WebGL est nécessaire pour Hologram. Les autres modules restent
          disponibles.
        </div>
      }
    >
      <Scene
        controller={controller}
        onFailure={setError}
        model={model}
        onModelStatus={onModelStatus}
      />
    </Canvas>
  );
}
