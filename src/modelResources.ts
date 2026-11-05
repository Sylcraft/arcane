import {
  Box3,
  Group,
  Material,
  Mesh,
  Object3D,
  Sphere,
  Texture,
  Vector3,
} from "three";
import type {
  BufferGeometry,
  InstancedMesh,
  Skeleton,
  SkinnedMesh,
} from "three";

function disposeMaterials(materials: Set<Material>) {
  const textures = new Set<Texture>();
  materials.forEach((material) =>
    Object.values(material).forEach((value) => {
      if (value instanceof Texture) textures.add(value);
    }),
  );
  const images = new Set<unknown>();
  textures.forEach((texture) => {
    images.add(texture.source.data);
    texture.dispose();
  });
  images.forEach((image) => {
    if (image && typeof (image as { close?: unknown }).close === "function")
      (image as { close: () => void }).close();
  });
  materials.forEach((material) => material.dispose());
  materials.clear();
}

// Capture ownership before removing imported lights or replacing materials.
// Sets prevent double disposal when meshes/scenes share geometry or textures.
export class ModelResources {
  private geometries = new Set<BufferGeometry>();
  private materials = new Set<Material>();
  private skeletons = new Set<Skeleton>();
  private instances = new Set<InstancedMesh>();
  private disposed = false;
  constructor(roots: Object3D[]) {
    roots.forEach((root) =>
      root.traverse((object) => {
        const mesh = object as Mesh;
        if (mesh.geometry) this.geometries.add(mesh.geometry);
        if (mesh.material)
          (Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          ).forEach((material) => this.materials.add(material));
        const skeleton = (object as SkinnedMesh).skeleton;
        if (skeleton) this.skeletons.add(skeleton);
        if ((object as InstancedMesh).isInstancedMesh)
          this.instances.add(object as InstancedMesh);
      }),
    );
  }
  replaceMaterials(material: Material) {
    disposeMaterials(this.materials);
    this.materials.add(material);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    disposeMaterials(this.materials);
    this.skeletons.forEach((skeleton) => skeleton.dispose());
    this.instances.forEach((instance) => instance.dispose());
    this.geometries.forEach((geometry) => geometry.dispose());
    this.skeletons.clear();
    this.instances.clear();
    this.geometries.clear();
  }
}

export function fitHologramModel(scene: Group) {
  let triangles = 0,
    meshes = 0;
  const remove: Object3D[] = [];
  scene.traverse((object) => {
    if ((object as Mesh).isMesh) {
      const mesh = object as Mesh;
      meshes++;
      const position = mesh.geometry.getAttribute("position");
      const instances = (mesh as InstancedMesh).isInstancedMesh
        ? (mesh as InstancedMesh).count
        : 1;
      triangles +=
        Math.floor((mesh.geometry.index?.count ?? position?.count ?? 0) / 3) *
        instances;
    } else if (
      object.type.includes("Light") ||
      object.type.includes("Camera") ||
      object.type === "Points" ||
      object.type.startsWith("Line")
    )
      remove.push(object);
  });
  if (!meshes || !triangles)
    throw new Error("Le GLB ne contient aucun maillage triangulé affichable.");
  if (triangles > 1_000_000 || meshes > 2000)
    throw new Error(
      "Modèle trop complexe : maximum 1 million de triangles et 2 000 maillages. Simplifiez-le avant l’import.",
    );
  remove.forEach((object) => object.removeFromParent());
  scene.traverse((object) => {
    const mesh = object as Mesh;
    if (
      mesh.isMesh &&
      mesh.geometry.getAttribute("position") &&
      !mesh.geometry.getAttribute("normal")
    )
      mesh.geometry.computeVertexNormals();
  });
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene, true);
  const sphere = bounds.getBoundingSphere(new Sphere());
  if (
    bounds.isEmpty() ||
    !Number.isFinite(sphere.radius) ||
    sphere.radius <= 1e-12 ||
    ![sphere.center.x, sphere.center.y, sphere.center.z].every(Number.isFinite)
  )
    throw new Error("Le modèle possède des dimensions nulles ou invalides.");
  const center = bounds.getCenter(new Vector3());
  const root = new Group(),
    pivot = new Group();
  pivot.position.copy(center).multiplyScalar(-1);
  pivot.add(scene);
  root.add(pivot);
  const scale = 1.02 / sphere.radius;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  return { root, triangles, meshes, scale };
}
