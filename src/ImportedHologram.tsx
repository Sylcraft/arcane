import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { HologramController } from "./hologramController";
import type { HologramFile, ModelLoadStatus } from "./hologramAssets";
import { loadHologramModel } from "./hologramModel";
import type { HologramModel } from "./hologramModel";

export function ImportedHologram({
  model,
  controller,
  onStatus,
}: {
  model: HologramFile;
  controller: HologramController;
  onStatus: (status: ModelLoadStatus) => void;
}) {
  const [asset, setAsset] = useState<HologramModel | null>(null);
  const elapsed = useRef(0);
  useEffect(() => {
    const abort = new AbortController();
    let loaded: HologramModel | undefined;
    controller.interrupt();
    onStatus({ state: "loading", message: `Chargement de ${model.name}…` });
    void loadHologramModel(model.file, abort.signal)
      .then((result) => {
        if (abort.signal.aborted) {
          result.dispose();
          return;
        }
        loaded = result;
        setAsset(result);
        controller.interrupt();
        onStatus({
          state: "ready",
          message: `${result.meshes} maillage(s) · ${result.triangles.toLocaleString("fr-FR")} triangles · Écartez les doigts avant de saisir.`,
        });
      })
      .catch((cause) => {
        if (!abort.signal.aborted)
          onStatus({
            state: "error",
            message: `${cause instanceof Error ? cause.message : "Chargement impossible."} Le cristal de secours reste affiché.`,
          });
      });
    return () => {
      abort.abort();
      controller.interrupt();
      loaded?.dispose();
    };
  }, [model, controller, onStatus]);
  useFrame((_, delta) => {
    elapsed.current += Math.min(delta, 0.05);
    asset?.update(elapsed.current, controller.grabbed, delta);
  });
  if (!asset)
    return (
      <mesh>
        <icosahedronGeometry args={[1.08, 1]} />
        <meshBasicMaterial
          color="#5cceff"
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
    );
  // This loader owns all imported resources; R3F must not dispose them a
  // second time. The primitive and buffers leave together on selection change.
  return <primitive object={asset.root} dispose={null} />;
}
