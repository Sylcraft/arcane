import { useRef } from "react";
import { LoaderCircle, Trash2, Upload } from "lucide-react";
import type { HologramFile, ModelLoadStatus } from "./hologramAssets";

export function HologramModels({
  models,
  selectedId,
  importing,
  importError,
  loadStatus,
  onImport,
  onSelect,
  onRemove,
}: {
  models: HologramFile[];
  selectedId: string;
  importing: boolean;
  importError: string;
  loadStatus: ModelLoadStatus;
  onImport: (file: File) => Promise<void>;
  onSelect: (id: string) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="hologram-models" aria-label="Modèles holographiques">
      <div className="model-controls">
        <label>
          Objet projeté
          <select
            value={selectedId}
            onChange={(event) => onSelect(event.target.value)}
          >
            <option value="crystal">Cristal ARCANE</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
        <input
          ref={input}
          type="file"
          accept=".glb,model/gltf-binary"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void onImport(file);
          }}
        />
        <button
          className="clear-drawing"
          onClick={() => input.current?.click()}
          aria-busy={importing}
        >
          {importing ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <Upload size={15} />
          )}
          Importer un GLB
        </button>
        <button
          className="remove-model"
          disabled={selectedId === "crystal"}
          onClick={onRemove}
          title="Retirer le modèle sélectionné"
        >
          <Trash2 size={15} />
          Retirer
        </button>
      </div>
      <p>
        Fichier local autonome · 64 Mio maximum · forme et proportions
        conservées, teinte holographique appliquée. Les imports restent
        disponibles pendant cette session.
      </p>
      {importError && (
        <p className="model-error" role="alert">
          {importError}
        </p>
      )}
      {selectedId !== "crystal" && (
        <p
          className={`model-status ${loadStatus.state === "error" ? "model-error" : ""}`}
          role={loadStatus.state === "error" ? "alert" : "status"}
        >
          {loadStatus.state === "loading" && (
            <LoaderCircle size={12} className="spin" />
          )}
          {loadStatus.message}
        </p>
      )}
    </section>
  );
}
