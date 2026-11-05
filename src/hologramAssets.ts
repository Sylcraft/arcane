// File descriptors only: importing/selecting this store never imports Three.js.
import { useEffect, useRef, useState } from "react";
import { validateGlbFile } from "./glbValidation.ts";
export type HologramFile = { id: string; name: string; file: File };
export type ModelLoadStatus = {
  state: "idle" | "loading" | "ready" | "error";
  message: string;
};
let nextId = 0;
export function useHologramAssets() {
  const [models, setModels] = useState<HologramFile[]>([]);
  const [selectedId, setSelectedId] = useState("crystal");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [loadStatus, setLoadStatus] = useState<ModelLoadStatus>({
    state: "idle",
    message: "",
  });
  const request = useRef({ id: 0 }),
    alive = useRef(true);
  useEffect(() => {
    const generation = request.current;
    alive.current = true;
    return () => {
      alive.current = false;
      generation.id++;
    };
  }, []);
  const importFile = async (file: File) => {
    const id = ++request.current.id;
    setImporting(true);
    setImportError("");
    try {
      await validateGlbFile(file);
      if (!alive.current || request.current.id !== id) return;
      const model = { id: `import-${++nextId}`, name: file.name, file };
      setModels((previous) => [...previous, model]);
      setSelectedId(model.id);
      setLoadStatus({ state: "loading", message: "Préparation du modèle…" });
    } catch (cause) {
      if (alive.current && request.current.id === id)
        setImportError(
          cause instanceof Error ? cause.message : "Import impossible.",
        );
    } finally {
      if (alive.current && request.current.id === id) setImporting(false);
    }
  };
  const select = (id: string) => {
    if (id !== "crystal" && !models.some((model) => model.id === id)) return;
    request.current.id++;
    setImporting(false);
    setImportError("");
    if (id === selectedId) return;
    setSelectedId(id);
    setLoadStatus({
      state: id === "crystal" ? "idle" : "loading",
      message: id === "crystal" ? "" : "Préparation du modèle…",
    });
  };
  const removeSelected = () => {
    if (selectedId === "crystal") return;
    setModels((previous) =>
      previous.filter((model) => model.id !== selectedId),
    );
    select("crystal");
  };
  return {
    models,
    selectedId,
    selectedModel: models.find((model) => model.id === selectedId),
    importing,
    importError,
    loadStatus,
    setLoadStatus,
    importFile,
    select,
    removeSelected,
  };
}
