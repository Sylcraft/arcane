import { Component, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import type { HologramController } from "./hologramController";
import type { HologramFile, ModelLoadStatus } from "./hologramAssets";
const Scene = lazy(() => import("./HologramScene"));
class HologramBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="hologram-error" role="alert">
        L’hologramme n’a pas pu démarrer. Vérifiez WebGL et rechargez ce module.
        Le suivi et Air Canvas restent disponibles.
      </div>
    ) : (
      this.props.children
    );
  }
}
export function HologramPanel({
  controller,
  model,
  onModelStatus,
}: {
  controller: HologramController;
  model?: HologramFile;
  onModelStatus: (status: ModelLoadStatus) => void;
}) {
  return (
    <div className="hologram-layer">
      <HologramBoundary>
        <Suspense
          fallback={
            <div className="hologram-loading">
              Initialisation du projecteur 3D…
            </div>
          }
        >
          <Scene
            controller={controller}
            model={model}
            onModelStatus={onModelStatus}
          />
        </Suspense>
      </HologramBoundary>
    </div>
  );
}
