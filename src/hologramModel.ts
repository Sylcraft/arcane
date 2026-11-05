import {
  AdditiveBlending,
  DoubleSide,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
} from "three";
import type { Group } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { inspectGlb, validateGlbFile } from "./glbValidation.ts";
import { fitHologramModel, ModelResources } from "./modelResources.ts";

export type HologramModel = {
  root: Group;
  triangles: number;
  meshes: number;
  update: (time: number, grabbed: boolean, delta: number) => void;
  dispose: () => void;
};
let parsing: Promise<void> = Promise.resolve();

export function makeImportedHologramMaterial() {
  const uniforms = { uHoloTime: { value: 0 }, uHoloGrab: { value: 0 } };
  const material = new MeshStandardMaterial({
    color: "#4acfff",
    emissive: "#155e89",
    emissiveIntensity: 0.7,
    metalness: 0.2,
    roughness: 0.4,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  // Additive transparency is order independent: avoid Three's default double
  // draw for transparent DoubleSide materials on complex imported meshes.
  material.forceSinglePass = true;
  // Use Three's built-in skin/morph/instance transforms, then add the same
  // holographic rim/scan vocabulary as the crystal. No custom vertex pipeline.
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vHoloNormal;\nvarying vec3 vHoloView;",
      )
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvHoloNormal = normalize(transformedNormal);\nvHoloView = -mvPosition.xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uHoloTime;\nuniform float uHoloGrab;\nvarying vec3 vHoloNormal;\nvarying vec3 vHoloView;",
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        float holoRim = pow(1.0 - abs(dot(normalize(vHoloNormal), normalize(vHoloView))), 2.0);
        float holoScan = pow(0.5 + 0.5 * sin(vHoloView.y * 85.0 + uHoloTime * 3.0), 10.0);
        vec3 holoColor = mix(vec3(0.12,0.74,1.0), vec3(0.62,1.0,0.88), uHoloGrab * 0.7);
        gl_FragColor.rgb = gl_FragColor.rgb * 0.3 + holoColor * (0.55 + holoRim * 0.8 + holoScan * 0.25 + uHoloGrab * 0.3);
        gl_FragColor.a = clamp(0.12 + holoRim * 0.5 + holoScan * 0.08 + uHoloGrab * 0.1, 0.0, 0.9);
      `,
      );
  };
  material.customProgramCacheKey = () => "arcane-import-hologram-v1";
  return {
    material,
    update: (time: number, grabbed: boolean, delta: number) => {
      uniforms.uHoloTime.value = time;
      uniforms.uHoloGrab.value +=
        ((grabbed ? 1 : 0) - uniforms.uHoloGrab.value) *
        (1 - Math.exp(-Math.max(0, delta) * 18));
    },
  };
}

export async function parseHologramGlb(
  data: ArrayBuffer,
  draco?: DRACOLoader,
): Promise<HologramModel> {
  inspectGlb(data);
  const manager = new LoadingManager();
  const objectURLs = new Set<string>();
  let finished = false;
  manager.setURLModifier((url) => {
    if (url.startsWith("blob:")) {
      if (finished) {
        URL.revokeObjectURL(url);
        throw new Error("Chargement du modèle terminé ou interrompu.");
      }
      objectURLs.add(url);
      return url;
    }
    if (url.startsWith("data:")) return url;
    throw new Error(
      "Le modèle contient une ressource externe. Exportez un GLB autonome.",
    );
  });
  const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  // Hologram supplies its own surface. Avoid decoding/uploading potentially
  // large original textures that would immediately be discarded anyway.
  loader.register(() => ({
    name: "ARCANE_hologram_surface",
    loadMaterial: () => Promise.resolve(new MeshStandardMaterial()),
  }));
  if (draco) loader.setDRACOLoader(draco);
  const gltf = await loader.parseAsync(data, "").finally(() => {
    finished = true;
    objectURLs.forEach((url) => URL.revokeObjectURL(url));
    objectURLs.clear();
  });
  const resources = new ModelResources(gltf.scenes);
  try {
    const fit = fitHologramModel(gltf.scene);
    const surface = makeImportedHologramMaterial();
    resources.replaceMaterials(surface.material);
    gltf.scene.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.isMesh) {
        mesh.material = surface.material;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });
    return {
      root: fit.root,
      triangles: fit.triangles,
      meshes: fit.meshes,
      update: surface.update,
      dispose: () => resources.dispose(),
    };
  } catch (cause) {
    resources.dispose();
    throw cause;
  }
}

async function makeDraco() {
  const [{ DRACOLoader }, wrapper, binary] = await Promise.all([
    import("three/addons/loaders/DRACOLoader.js"),
    import("three/addons/libs/draco/gltf/draco_wasm_wrapper.js?url"),
    import("three/addons/libs/draco/gltf/draco_decoder.wasm?url"),
  ]);
  // Explicit Vite asset URLs also work when the loader is prebundled in dev;
  // Three's default relative URLs then resolve inside node_modules/.vite/libs.
  return new DRACOLoader()
    .setDecoderPath({ js: wrapper.default, wasm: binary.default })
    .setWorkerLimit(1);
}

export function loadHologramModel(
  file: File,
  signal: AbortSignal,
): Promise<HologramModel> {
  const result = parsing.then(async () => {
    signal.throwIfAborted();
    await validateGlbFile(file);
    signal.throwIfAborted();
    const data = await file.arrayBuffer();
    signal.throwIfAborted();
    const document = inspectGlb(data);
    const extensions = [
      ...(document.extensionsUsed ?? []),
      ...(document.extensionsRequired ?? []),
    ];
    const draco = extensions.includes("KHR_draco_mesh_compression")
      ? await makeDraco()
      : undefined;
    let model: HologramModel | undefined;
    try {
      signal.throwIfAborted();
      model = await parseHologramGlb(data, draco);
      signal.throwIfAborted();
      return model;
    } catch (cause) {
      model?.dispose();
      throw cause;
    } finally {
      draco?.dispose();
    }
  });
  // At most one parser/decoder in flight, including a stale selection. A late
  // result is disposed rather than mounted; the next selection still proceeds.
  parsing = result.then(
    () => {},
    () => {},
  );
  return result;
}
