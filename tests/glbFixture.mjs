// Minimal real glTF 2.0 binary triangle, generated in memory, with no network,
// third-party asset or browser dependency. Useful for parser/cancellation tests.
export function makeGlb(document, binary = new Uint8Array()) {
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const binLength = Math.ceil(binary.byteLength / 4) * 4;
  const bytes = new ArrayBuffer(
    12 + 8 + jsonLength + (binLength ? 8 + binLength : 0),
  );
  const view = new DataView(bytes),
    out = new Uint8Array(bytes);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.fill(32, 20, 20 + jsonLength);
  out.set(json, 20);
  if (binLength) {
    view.setUint32(20 + jsonLength, binLength, true);
    view.setUint32(24 + jsonLength, 0x004e4942, true);
    out.set(binary, 28 + jsonLength);
  }
  return bytes;
}
export function triangleGlb(scale = 1) {
  const positions = new Float32Array([-2, -1, 0, 2, -1, 0, 0, 3, 0]);
  return makeGlb(
    {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [
        { mesh: 0, translation: [100, -50, 4], scale: [scale, scale, scale] },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] } }],
      buffers: [{ byteLength: positions.byteLength }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 3,
          type: "VEC3",
          min: [-2, -1, 0],
          max: [2, 3, 0],
        },
      ],
    },
    new Uint8Array(positions.buffer),
  );
}
