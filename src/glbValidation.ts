export const MAX_GLB_BYTES = 64 * 1024 * 1024;
type Resource = { uri?: unknown };
export type GlbDocument = {
  asset: { version: string };
  buffers?: Resource[];
  images?: Resource[];
  extensionsRequired?: string[];
  extensionsUsed?: string[];
};

export function validateGlbHeader(data: ArrayBuffer, totalBytes: number) {
  if (data.byteLength < 12 || totalBytes < 20)
    throw new Error("Le fichier GLB est incomplet.");
  const view = new DataView(data);
  if (view.getUint32(0, true) !== 0x46546c67)
    throw new Error("Ce fichier n’est pas un GLB valide.");
  if (view.getUint32(4, true) !== 2)
    throw new Error("Seuls les modèles glTF/GLB 2.0 sont pris en charge.");
  if (view.getUint32(8, true) !== totalBytes)
    throw new Error("La taille déclarée du GLB ne correspond pas au fichier.");
}
export async function validateGlbFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".glb"))
    throw new Error("Choisissez un fichier au format .glb.");
  if (file.size > MAX_GLB_BYTES)
    throw new Error(
      "Le fichier dépasse la limite de 64 Mio. Exportez un modèle plus léger.",
    );
  validateGlbHeader(await file.slice(0, 12).arrayBuffer(), file.size);
}
export function inspectGlb(data: ArrayBuffer): GlbDocument {
  if (data.byteLength > MAX_GLB_BYTES)
    throw new Error("Le GLB dépasse 64 Mio.");
  validateGlbHeader(data, data.byteLength);
  const view = new DataView(data);
  let offset = 12,
    document: GlbDocument | undefined;
  while (offset < data.byteLength) {
    if (offset + 8 > data.byteLength)
      throw new Error("En-tête de section GLB incomplet.");
    const length = view.getUint32(offset, true),
      type = view.getUint32(offset + 4, true);
    if (length % 4 !== 0 || offset + 8 + length > data.byteLength)
      throw new Error("Section GLB endommagée.");
    if (offset === 12) {
      if (type !== 0x4e4f534a)
        throw new Error("Le GLB ne contient pas de description JSON valide.");
      try {
        document = JSON.parse(
          new TextDecoder()
            .decode(new Uint8Array(data, offset + 8, length))
            .replace(/\0+$/, "")
            .trim(),
        );
      } catch {
        throw new Error("La description JSON du GLB est illisible.");
      }
    }
    offset += 8 + length;
  }
  if (!document || document.asset?.version !== "2.0")
    throw new Error("Le modèle doit être exporté en glTF 2.0.");
  for (const extensions of [
    document.extensionsRequired,
    document.extensionsUsed,
  ]) {
    if (
      extensions !== undefined &&
      (!Array.isArray(extensions) ||
        extensions.some((name) => typeof name !== "string"))
    )
      throw new Error("Liste d’extensions GLB invalide.");
  }
  for (const resources of [document.buffers, document.images]) {
    if (resources !== undefined && !Array.isArray(resources))
      throw new Error("Ressources GLB invalides.");
    for (const resource of resources ?? []) {
      if (
        !resource ||
        (resource.uri !== undefined &&
          (typeof resource.uri !== "string" ||
            !resource.uri.startsWith("data:")))
      )
        throw new Error(
          "Le GLB doit intégrer ses textures et buffers. Les fichiers et URL externes ne sont pas chargés.",
        );
    }
  }
  return document;
}
