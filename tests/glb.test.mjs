import test from "node:test";
import assert from "node:assert/strict";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  Box3,
  BoxGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  Sphere,
  Texture,
  Vector3,
  ShaderLib,
} from "three";
import {
  inspectGlb,
  MAX_GLB_BYTES,
  validateGlbFile,
  validateGlbHeader,
} from "../src/glbValidation.ts";
import { fitHologramModel, ModelResources } from "../src/modelResources.ts";
import {
  loadHologramModel,
  makeImportedHologramMaterial,
  parseHologramGlb,
} from "../src/hologramModel.ts";
import { makeGlb, triangleGlb } from "./glbFixture.mjs";

test("validation d’un vrai fichier GLB, extension insensible à la casse", async () => {
  const data = triangleGlb();
  await validateGlbFile(new File([data], "objet.GLB"));
  assert.equal(inspectGlb(data).asset.version, "2.0");
});
test("mauvais format, taille excessive, version ou longueur incohérentes : erreurs lisibles", async () => {
  const data = triangleGlb();
  await assert.rejects(
    validateGlbFile(new File([data], "objet.gltf")),
    /\.glb/,
  );
  await assert.rejects(
    validateGlbFile({ name: "grand.glb", size: MAX_GLB_BYTES + 1 }),
    /64/,
  );
  assert.throws(() => validateGlbHeader(new ArrayBuffer(4), 4), /incomplet/);
  for (const [offset, value, pattern] of [
    [0, 0, /valide/],
    [4, 1, /2\.0/],
    [8, 16, /taille/],
  ]) {
    const broken = data.slice(0);
    new DataView(broken).setUint32(offset, value, true);
    assert.throws(() => inspectGlb(broken), pattern);
  }
});
test("JSON invalide, sections tronquées et extensions mal formées sont rejetés", () => {
  const invalid = triangleGlb().slice(0);
  new Uint8Array(invalid)[20] = 0;
  assert.throws(() => inspectGlb(invalid), /JSON/);
  const badChunk = triangleGlb().slice(0);
  new DataView(badChunk).setUint32(12, 999999, true);
  assert.throws(() => inspectGlb(badChunk), /Section/);
  assert.throws(
    () => inspectGlb(makeGlb({ asset: { version: "2.0" }, extensionsUsed: 3 })),
    /extensions/,
  );
});
test("les ressources externes sont bloquées avant toute tentative de chargement", async () => {
  for (const resource of [
    { buffers: [{ uri: "https://example.com/model.bin" }] },
    { images: [{ uri: "texture.png" }] },
  ]) {
    const data = makeGlb({ asset: { version: "2.0" }, ...resource });
    assert.throws(() => inspectGlb(data), /intégrer/);
    await assert.rejects(parseHologramGlb(data), /intégrer/);
  }
  assert.doesNotThrow(() =>
    inspectGlb(
      makeGlb({
        asset: { version: "2.0" },
        images: [{ uri: "data:image/png;base64,AA==" }],
      }),
    ),
  );
  assert.doesNotThrow(() =>
    inspectGlb(
      makeGlb({
        asset: { version: "2.0" },
        extensionsRequired: ["KHR_texture_basisu"],
      }),
    ),
  );
});
test("GLTFLoader parse le vrai binaire, centre la géométrie et applique l’hologramme", async () => {
  const asset = await parseHologramGlb(triangleGlb());
  try {
    assert.equal(asset.meshes, 1);
    assert.equal(asset.triangles, 1);
    const bounds = new Box3().setFromObject(asset.root, true);
    assert.ok(bounds.getCenter(new Vector3()).length() < 1e-8);
    assert.ok(
      Math.abs(bounds.getBoundingSphere(new Sphere()).radius - 1.02) < 1e-8,
    );
    asset.root.traverse((node) => {
      if (node.isMesh) {
        assert.equal(node.material.transparent, true);
        assert.equal(node.material.depthWrite, false);
        assert.ok(node.geometry.getAttribute("normal"));
      }
    });
    asset.update(1, true, 1 / 30);
  } finally {
    asset.dispose();
  }
});

test("les textures d’origine ne sont pas décodées pour le rendu holographique", async (t) => {
  const self = globalThis.self,
    bitmap = globalThis.createImageBitmap;
  globalThis.self = globalThis;
  const decode = t.mock.fn(async () => ({ width: 1, height: 1, close() {} }));
  globalThis.createImageBitmap = decode;
  t.after(() => {
    if (self === undefined) delete globalThis.self;
    else globalThis.self = self;
    if (bitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = bitmap;
  });
  const document = inspectGlb(triangleGlb());
  document.images = [{ uri: "data:image/png;base64,iVBORw0KGgo=" }];
  document.textures = [{ source: 0 }];
  document.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  const binary = new Uint8Array(
    new Float32Array([-2, -1, 0, 2, -1, 0, 0, 3, 0]).buffer,
  );
  const model = await parseHologramGlb(makeGlb(document, binary));
  try {
    assert.equal(model.meshes, 1);
    assert.equal(decode.mock.callCount(), 0);
  } finally {
    model.dispose();
  }
  document.extensionsUsed = ["KHR_texture_basisu"];
  document.extensionsRequired = ["KHR_texture_basisu"];
  document.textures[0] = { extensions: { KHR_texture_basisu: { source: 0 } } };
  const compressedTexture = await parseHologramGlb(makeGlb(document, binary));
  try {
    assert.equal(compressedTexture.meshes, 1);
    assert.equal(decode.mock.callCount(), 0);
  } finally {
    compressedTexture.dispose();
  }
});
test("cadrage constant pour des modèles minuscules et gigantesques", async () => {
  for (const scale of [0.000001, 1000000]) {
    const asset = await parseHologramGlb(triangleGlb(scale));
    const bounds = new Box3().setFromObject(asset.root, true);
    assert.ok(bounds.getCenter(new Vector3()).length() < 1e-7);
    assert.ok(
      Math.abs(bounds.getBoundingSphere(new Sphere()).radius - 1.02) < 1e-7,
    );
    asset.dispose();
  }
});
test("après rotation, tous les sommets restent dans la sphère de cadrage", () => {
  const scene = new Group(),
    mesh = new Mesh(new BoxGeometry(100, 1, 3), new MeshBasicMaterial());
  mesh.position.set(-50, 200, 30);
  scene.add(mesh);
  const resources = new ModelResources([scene]);
  try {
    const fit = fitHologramModel(scene);
    fit.root.rotation.set(1.1, 2.2, 0.7);
    fit.root.updateMatrixWorld(true);
    const p = new Vector3(),
      positions = mesh.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      assert.ok(p.length() <= 1.020001);
    }
  } finally {
    resources.dispose();
  }
});
test("modèles vides ou dégénérés : rejet ; lumières importées ignorées", () => {
  assert.throws(() => fitHologramModel(new Group()), /maillage/);
  const scene = new Group(),
    mesh = new Mesh(new BoxGeometry(0, 0, 0), new MeshBasicMaterial());
  scene.add(mesh);
  assert.throws(() => fitHologramModel(scene), /dimensions/);
  new ModelResources([scene]).dispose();
  const valid = new Group(),
    light = new PointLight();
  valid.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()), light);
  const resources = new ModelResources([valid]);
  fitHologramModel(valid);
  assert.equal(light.parent, null);
  resources.dispose();
});
test("géométrie, matériaux et textures partagés ne sont détruits qu’une fois", () => {
  let geometries = 0,
    materials = 0,
    textures = 0,
    images = 0;
  const geometry = new BoxGeometry(),
    image = { close: () => images++ },
    texture = new Texture(image),
    material = new MeshBasicMaterial({ map: texture });
  geometry.addEventListener("dispose", () => geometries++);
  material.addEventListener("dispose", () => materials++);
  texture.addEventListener("dispose", () => textures++);
  const root = new Group(),
    a = new Mesh(geometry, material),
    b = new Mesh(geometry, material);
  root.add(a, b);
  const resources = new ModelResources([root]);
  root.remove(b);
  resources.dispose();
  resources.dispose();
  assert.deepEqual([geometries, materials, textures, images], [1, 1, 1, 1]);
});
test("les buffers d’instances et l’ancien matériau sont libérés proprement", () => {
  let instances = 0,
    old = 0,
    holo = 0;
  const previous = new MeshBasicMaterial();
  previous.addEventListener("dispose", () => old++);
  const object = new InstancedMesh(new BoxGeometry(), previous, 2);
  object.addEventListener("dispose", () => instances++);
  const root = new Group();
  root.add(object);
  const resources = new ModelResources([root]);
  const material = makeImportedHologramMaterial().material;
  material.addEventListener("dispose", () => holo++);
  resources.replaceMaterials(material);
  object.material = material;
  assert.equal(old, 1);
  resources.dispose();
  assert.deepEqual([instances, old, holo], [1, 1, 1]);
});
test("le shader conserve le pipeline de transformation Three.js et partage les uniforms", () => {
  const surface = makeImportedHologramMaterial();
  const shader = {
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
    uniforms: {},
  };
  surface.material.onBeforeCompile(shader, {});
  assert.ok(shader.vertexShader.includes("#include <skinning_vertex>"));
  assert.ok(shader.vertexShader.includes("vHoloView = -mvPosition.xyz"));
  assert.ok(shader.fragmentShader.includes("holoRim"));
  surface.update(3, true, 0.1);
  assert.equal(shader.uniforms.uHoloTime.value, 3);
  assert.ok(shader.uniforms.uHoloGrab.value > 0);
  surface.material.dispose();
});
test("un chargement annulé n’est pas parsé et ne bloque pas le prochain fichier", async () => {
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    loadHologramModel(
      { name: "no.glb", arrayBuffer: () => assert.fail("ne doit pas lire") },
      abort.signal,
    ),
    { name: "AbortError" },
  );
  const model = await loadHologramModel(
    new File([triangleGlb()], "triangle.glb"),
    new AbortController().signal,
  );
  assert.equal(model.meshes, 1);
  model.dispose();
});
test("sélections concurrentes : un seul parseur, résultat annulé ignoré, nouveau modèle prêt", async () => {
  const bytes = triangleGlb(),
    abort = new AbortController();
  let release, started;
  const entered = new Promise((resolve) => (started = resolve));
  const slow = {
    name: "slow.glb",
    size: bytes.byteLength,
    slice: (...args) => new Blob([bytes]).slice(...args),
    arrayBuffer: () => {
      started();
      return new Promise((resolve) => (release = resolve));
    },
  };
  const first = loadHologramModel(slow, abort.signal);
  const rejected = assert.rejects(first, { name: "AbortError" });
  await entered;
  let secondRead = false;
  const fast = {
    name: "fast.glb",
    size: bytes.byteLength,
    slice: (...args) => new Blob([bytes]).slice(...args),
    arrayBuffer: async () => {
      secondRead = true;
      return bytes;
    },
  };
  const second = loadHologramModel(fast, new AbortController().signal);
  assert.equal(secondRead, false);
  abort.abort();
  release(bytes);
  await rejected;
  const model = await second;
  assert.equal(secondRead, true);
  assert.equal(model.triangles, 1);
  model.dispose();
});

test("annuler pendant le parsing libère aussi le modèle construit tardivement", async (t) => {
  const abort = new AbortController();
  let geometries = 0,
    materials = 0;
  const original = GLTFLoader.prototype.parseAsync;
  t.mock.method(
    GLTFLoader.prototype,
    "parseAsync",
    async function (data, path) {
      const gltf = await original.call(this, data, path);
      gltf.scene.traverse((node) => {
        if (node.isMesh)
          node.geometry.addEventListener("dispose", () => geometries++);
      });
      abort.abort();
      return gltf;
    },
  );
  const replace = ModelResources.prototype.replaceMaterials;
  t.mock.method(
    ModelResources.prototype,
    "replaceMaterials",
    function (material) {
      material.addEventListener("dispose", () => materials++);
      replace.call(this, material);
    },
  );
  await assert.rejects(
    loadHologramModel(new File([triangleGlb()], "late.glb"), abort.signal),
    { name: "AbortError" },
  );
  assert.equal(geometries, 1);
  assert.equal(materials, 1);
});

test("les budgets de complexité arrêtent un modèle avant son cadrage ou son rendu", () => {
  const object = new InstancedMesh(
    new BoxGeometry(),
    new MeshBasicMaterial(),
    83334,
  );
  const root = new Group();
  root.add(object);
  const resources = new ModelResources([root]);
  try {
    assert.throws(() => fitHologramModel(root), /trop complexe/);
  } finally {
    resources.dispose();
  }
});
