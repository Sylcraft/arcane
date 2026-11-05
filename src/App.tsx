import {
  Activity,
  ArrowUpRight,
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  Cpu,
  Crosshair,
  Hand,
  Layers,
  LoaderCircle,
  LockKeyhole,
  Maximize,
  Scan,
  ShieldCheck,
  Sparkles,
  Video,
  Trash2,
  Pencil,
  Box,
} from "lucide-react";
import { useRef } from "react";
import { useHandTracking } from "./useHandTracking";
import { BrushPanel } from "./BrushPanel";
import type { EnginePreference } from "./handLandmarker";
import { HologramPanel } from "./HologramPanel";
import { HologramModels } from "./HologramModels";
import { useHologramAssets } from "./hologramAssets";

export default function App() {
  const assets = useHologramAssets();
  const {
    videoRef,
    magicCanvasRef,
    canvasRef,
    drawingCanvasRef,
    effectsCanvasRef,
    effectsStatus,
    effectsError,
    cursorRef,
    mode,
    hologram,
    changeMode,
    clearDrawing,
    brushSettings,
    changeBrush,
    status,
    error,
    stats,
    engine,
    enginePreference,
    setEnginePreference,
    inputWidth,
    setInputWidth,
    start,
    stop,
    skeleton,
    toggleSkeleton,
  } = useHandTracking();
  const stage = useRef<HTMLDivElement>(null);
  const active = status === "running";
  const loading = status === "loading";
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
    } catch {
      /* Fullscreen is optional on unsupported browsers. */
    }
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-icon">
            <Scan size={23} />
          </span>
          ARCANE<span className="version">LAB / V4.0</span>
        </a>
        <div className="header-right">
          <span className="local">
            <i />
            Traitement local
          </span>
          <a className="about-link" href="#guide">
            À propos du lab <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span /> EXPERIMENTAL INTERACTION LAB
            </div>
            <h1>
              Le mouvement devient<span> une interface.</span>
            </h1>
            <p>
              Explorez le suivi des mains en temps réel. Vos gestes, un nouveau
              terrain de jeu.
            </p>
          </div>
          <div className="edition">
            <Crosshair size={22} />
            <span>
              {mode === "magic"
                ? "EXPÉRIENCE 004"
                : mode === "hologram"
                  ? "EXPÉRIENCE 003"
                  : mode === "air-canvas"
                    ? "EXPÉRIENCE 002"
                    : "EXPÉRIENCE 001"}
              <strong>
                {mode === "magic"
                  ? "MAGIC"
                  : mode === "hologram"
                    ? "HOLOGRAM"
                    : mode === "air-canvas"
                      ? "AIR CANVAS"
                      : "HAND TRACKING"}
              </strong>
            </span>
          </div>
        </section>
        <div className="mode-toolbar">
          <div
            className="mode-selector"
            role="group"
            aria-label="Mode du laboratoire"
          >
            <button
              aria-pressed={mode === "tracking"}
              onClick={() => changeMode("tracking")}
            >
              <Crosshair size={15} />
              Suivi classique <span>V1</span>
            </button>
            <button
              aria-pressed={mode === "air-canvas"}
              onClick={() => changeMode("air-canvas")}
            >
              <Pencil size={15} />
              Air Canvas <span>V2</span>
            </button>
            <button
              aria-pressed={mode === "hologram"}
              onClick={() => changeMode("hologram")}
            >
              <Box size={15} />
              Hologram <span>V3</span>
            </button>
            <button
              aria-pressed={mode === "magic"}
              onClick={() => changeMode("magic")}
            >
              <Sparkles size={15} /> Magic <span>V4</span>
            </button>
          </div>
          {mode === "air-canvas" && (
            <button className="clear-drawing" onClick={clearDrawing}>
              <Trash2 size={15} />
              Effacer le dessin
            </button>
          )}
        </div>
        {mode === "air-canvas" && (
          <p className="air-instructions">
            <Pencil size={15} />
            <span>
              Rapprochez le pouce et l’index pour dessiner. Écartez-les pour
              déplacer le curseur sans tracer ; les autres doigts sont libres.
              Anneau blanc : déplacement · cyan plein : dessin · pointillé :
              relâchement en cours. Utilisez une seule main pour dessiner.
            </span>
          </p>
        )}
        {mode === "hologram" && (
          <p className="air-instructions">
            <Box size={15} />
            <span>
              Visez le cœur de l’hologramme avec le curseur, puis pincez le
              pouce et l’index. Déplacez la main pour le faire tourner ; écartez
              les doigts pour figer son orientation. Une seule main contrôle
              l’objet.
            </span>
          </p>
        )}
        {mode === "magic" && (
          <p className="air-instructions">
            <Sparkles size={15} />
            <span>
              Ouvrez la main, doigts dépliés et pouce écarté, pour invoquer une
              orbe lumineuse. Elle suit votre paume ; refermez la main pour la
              dissiper. Une seule main contrôle l’orbe.
            </span>
          </p>
        )}
        <div className="workspace">
          <section className="viewer-panel">
            {mode === "hologram" && (
              <>
                <div className="hologram-module-status">
                  <Box size={15} />
                  <strong>HOLOGRAM / MODEL LAB</strong>
                  <span>Cristal et modèles personnels</span>
                </div>
                <HologramModels
                  models={assets.models}
                  selectedId={assets.selectedId}
                  importing={assets.importing}
                  importError={assets.importError}
                  loadStatus={assets.loadStatus}
                  onImport={assets.importFile}
                  onSelect={(id) => {
                    hologram.interrupt();
                    assets.select(id);
                  }}
                  onRemove={() => {
                    hologram.interrupt();
                    assets.removeSelected();
                  }}
                />
              </>
            )}
            {mode === "air-canvas" && (
              <>
                <BrushPanel settings={brushSettings} onChange={changeBrush} />
                <div className="effects-state" role="status">
                  <span
                    className={effectsStatus === "ready" ? "effects-ready" : ""}
                  >
                    ●
                  </span>
                  {effectsStatus === "ready"
                    ? "PixiJS · WebGL prêt"
                    : effectsStatus === "loading"
                      ? "Initialisation des effets GPU…"
                      : effectsStatus === "error"
                        ? effectsError
                        : "Effets GPU en attente"}
                  <span>
                    Animations : rubans et éclairs conservés · Cosmic Trail
                    éphémère
                  </span>
                </div>
              </>
            )}
            <div className="panel-heading">
              <div>
                <Video size={16} />
                <h2>
                  {mode === "hologram"
                    ? "Projecteur holographique"
                    : "Vision en direct"}
                </h2>
                <span className="tag">
                  {mode === "hologram" ? "3D" : "WEBCAM"}
                </span>
              </div>
              <span className={`status ${active ? "on" : ""}`}>
                <i />
                {active
                  ? "Suivi actif"
                  : loading
                    ? "Initialisation"
                    : "En veille"}
              </span>
            </div>
            <div
              className={`stage ${active ? "is-live" : ""} ${mode === "hologram" ? "hologram-mode" : ""}`}
              ref={stage}
            >
              {mode === "hologram" && (
                <HologramPanel
                  controller={hologram}
                  model={assets.selectedModel}
                  onModelStatus={assets.setLoadStatus}
                />
              )}
              <div className="video-layer">
                <video ref={videoRef} autoPlay muted playsInline />
                <canvas ref={canvasRef} />
                <canvas
                  ref={drawingCanvasRef}
                  hidden={mode !== "air-canvas"}
                  aria-label="Dessin Air Canvas"
                />
                <canvas
                  ref={effectsCanvasRef}
                  hidden={mode !== "air-canvas"}
                  aria-label="Effets animés PixiJS"
                />
                <canvas
                  ref={magicCanvasRef}
                  hidden={mode !== "magic"}
                  aria-label="Orbe d’énergie Magic"
                />
                <svg
                  className={`air-cursor ${mode === "tracking" || mode === "magic" ? "is-hidden" : ""}`}
                  viewBox="0 0 1280 720"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                >
                  <g ref={cursorRef} style={{ visibility: "hidden" }}>
                    <circle className="cursor-ring" r="14" />
                    <circle className="cursor-dot" r="3" />
                    <path
                      className="cursor-cross"
                      d="M-20 0h5M15 0h5M0-20v5M0 15v5"
                    />
                    <text className="cursor-hover-label" x="23" y="5">
                      {mode === "hologram" ? "Viser / pincer" : "Déplacement"}
                    </text>
                    <text className="cursor-drawing-label" x="23" y="5">
                      {mode === "hologram" ? "Saisi" : "Dessin"}
                    </text>
                    <text className="cursor-holding-label" x="23" y="5">
                      Relâchement
                    </text>
                  </g>
                </svg>
              </div>
              <div className="stage-grid" />
              <div className="corner tl" />
              <div className="corner tr" />
              <div className="corner bl" />
              <div className="corner br" />
              <div className="stage-top">
                <span>
                  <i className={active ? "live-dot" : ""} />
                  {active ? "LIVE INPUT" : "NO SIGNAL"}
                </span>
                <span>MP / HAND LANDMARKER</span>
              </div>
              {!active && mode !== "hologram" && (
                <div className="empty-state">
                  <div className={`hand-orbit ${loading ? "loading" : ""}`}>
                    <div className="orbit-ring" />
                    {loading ? (
                      <LoaderCircle size={54} className="spin" />
                    ) : (
                      <Hand size={68} strokeWidth={1} />
                    )}
                    <span className="orbit-point" />
                  </div>
                  <span className="mini-label">
                    VOTRE PROCHAINE INTERFACE, C’EST VOUS
                  </span>
                  <h3>
                    {loading
                      ? "Préparation du laboratoire"
                      : "Entrez dans l’expérience"}
                  </h3>
                  <p>
                    {loading
                      ? "Autorisation caméra et chargement du modèle…"
                      : "Activez votre caméra et placez vos mains dans le cadre."}
                  </p>
                  <button
                    className="primary"
                    onClick={loading ? stop : () => void start()}
                  >
                    {loading ? <CameraOff size={17} /> : <Camera size={17} />}{" "}
                    {loading ? "Annuler le démarrage" : "Activer la caméra"}
                    {!loading && <ChevronRight size={17} />}
                  </button>
                  <span className="privacy-note">
                    <LockKeyhole size={12} />
                    Aucune image n’est enregistrée ni envoyée.
                  </span>
                </div>
              )}
              {!active && mode === "hologram" && (
                <div className="hologram-start">
                  <button
                    className="primary"
                    onClick={loading ? stop : () => void start()}
                  >
                    {loading ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Camera size={16} />
                    )}{" "}
                    {loading
                      ? "Annuler le démarrage"
                      : "Activer la caméra pour saisir"}
                  </button>
                </div>
              )}
              {active && (
                <div className="tracking-hint">
                  <Crosshair size={14} />
                  {mode === "magic"
                    ? "Ouvrez la main pour invoquer l’orbe"
                    : mode === "hologram"
                      ? "Visez le cœur · Pincez pour saisir · Relâchez pour figer"
                      : mode === "air-canvas" && stats.hands
                        ? "Pincez pour dessiner · Écartez pour déplacer"
                        : stats.hands
                          ? `${stats.hands} main${stats.hands > 1 ? "s" : ""} dans le champ`
                          : "Placez vos mains dans le cadre"}
                </div>
              )}
              <div className="stage-bottom">
                <span>
                  COORD. NORMALISÉES <b> X / Y / Z</b>
                </span>
                <button
                  onClick={() => void fullscreen()}
                  aria-label="Afficher la vision en plein écran"
                  title="Plein écran"
                >
                  <Maximize size={16} />
                </button>
              </div>
            </div>
            <div className="viewer-footer">
              <span>
                <ShieldCheck size={15} /> Votre caméra, votre navigateur. Rien
                d’autre.
              </span>
              <span>
                <i /> MEDIA PIPE ENGINE
              </span>
            </div>
            {error && (
              <div className="error" role="alert">
                <strong>Le suivi a été interrompu.</strong> {error}
                <button onClick={() => void start()}>
                  Réessayer <ChevronRight size={14} />
                </button>
              </div>
            )}
          </section>
          <aside className="sidebar">
            <section className="control-card">
              <div className="section-title">
                <Activity size={16} />
                <h2>Contrôle du suivi</h2>
                <span>01</span>
              </div>
              <p className="card-description">
                Un lien direct entre vos mains
                <br />
                et le monde numérique.
              </p>
              <button
                className={`camera-control ${active ? "stop" : ""}`}
                onClick={active || loading ? stop : () => void start()}
              >
                {active || loading ? (
                  <CameraOff size={17} />
                ) : (
                  <Camera size={17} />
                )}{" "}
                {active
                  ? "Désactiver la caméra"
                  : loading
                    ? "Annuler le démarrage"
                    : "Activer la caméra"}
                {!active && !loading && <ArrowUpRight size={16} />}
              </button>
              <div className="divider" />
              <div className="option">
                <span>
                  <Layers size={16} />
                  Afficher le squelette
                </span>
                <button
                  role="switch"
                  aria-checked={skeleton}
                  aria-label="Afficher le squelette"
                  onClick={toggleSkeleton}
                  className={`switch ${skeleton ? "checked" : ""}`}
                >
                  <span />
                </button>
              </div>
              <div className="option">
                <span>
                  <Hand size={16} />
                  Mains détectées
                </span>
                <b>
                  {stats.hands}
                  <em>/ 2</em>
                </b>
              </div>
              <div className="hand-slots">
                {[0, 1].map((i) => (
                  <div key={i} className={stats.hands > i ? "detected" : ""}>
                    <Hand size={22} />
                    <span>
                      {stats.hands > i
                        ? stats.labels[i] === "Left"
                          ? "Main droite"
                          : "Main gauche"
                        : `Main 0${i + 1}`}
                    </span>
                    <i />
                  </div>
                ))}
              </div>
            </section>
            <section className="metrics-card">
              <div className="section-title">
                <Cpu size={16} />
                <h2>Télémétrie</h2>
                <span>LIVE</span>
              </div>
              <div className="metrics performance-metrics">
                <div>
                  <span>DÉTECTION</span>
                  <strong>
                    {active ? stats.detectionFps : "—"}
                    <small>fps</small>
                  </strong>
                  <div className="meter">
                    <i
                      style={{
                        width: `${Math.min((stats.detectionFps / 30) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <span>RENDU</span>
                  <strong>
                    {active ? stats.renderFps : "—"}
                    <small>fps</small>
                  </strong>
                  <div className="meter">
                    <i
                      style={{
                        width: `${Math.min((stats.renderFps / 30) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <span>INFÉRENCE</span>
                  <strong>
                    {active ? stats.inferenceMs : "—"}
                    <small>ms</small>
                  </strong>
                  <div className="metric-dots">••••••••••••</div>
                </div>
              </div>
              <dl className="performance-details">
                <div>
                  <dt>Inférence p95</dt>
                  <dd>{active ? `${stats.inferenceP95} ms` : "—"}</dd>
                </div>
                <div>
                  <dt>Préparation image</dt>
                  <dd>{active ? `${stats.preparationMs} ms` : "—"}</dd>
                </div>
                <div>
                  <dt>Dessin Canvas</dt>
                  <dd>{active ? `${stats.renderMs} ms` : "—"}</dd>
                </div>
                {mode === "hologram" && (
                  <>
                    <div>
                      <dt>Rendu hologramme</dt>
                      <dd>{active ? `${stats.hologramFps} fps` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Soumission 3D</dt>
                      <dd>{active ? `${stats.hologramMs} ms` : "—"}</dd>
                    </div>
                  </>
                )}
                <div>
                  <dt>Effets actifs</dt>
                  <dd>{stats.fxStrands} rubans / arcs</dd>
                </div>
                <div>
                  <dt>Particules GPU</dt>
                  <dd>{stats.fxParticles} / 1000</dd>
                </div>
                <div>
                  <dt>Moteur sélectionné</dt>
                  <dd>{engine.delegate}</dd>
                </div>
                <div>
                  <dt>Entrée du modèle</dt>
                  <dd>
                    {engine.width ? `${engine.width} × ${engine.height}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Webcam</dt>
                  <dd>
                    {engine.sourceWidth
                      ? `${engine.sourceWidth} × ${engine.sourceHeight} / ${Math.round(engine.cameraFps)} fps`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <p className="telemetry-note">
                Mesures sur 1 s : détections terminées et rendus réels,
                animations PixiJS comprises. Les callbacks sans dessin ne sont
                pas comptés. Inférence et dessin : temps moyens.
              </p>
              <div className="engine-options">
                <label>
                  Moteur
                  <select
                    value={enginePreference}
                    disabled={active || loading}
                    onChange={(e) =>
                      setEnginePreference(e.target.value as EnginePreference)
                    }
                  >
                    <option value="auto">Auto · GPU prioritaire</option>
                    <option value="GPU">GPU</option>
                    <option value="CPU">CPU · comparaison</option>
                  </select>
                </label>
                <label>
                  Largeur d’analyse maximale
                  <select
                    value={inputWidth}
                    disabled={active || loading}
                    onChange={(e) => setInputWidth(Number(e.target.value))}
                  >
                    <option value={1280}>1280 px · détail maximal</option>
                    <option value={960}>960 px · intermédiaire</option>
                    <option value={640}>640 px · charge réduite</option>
                  </select>
                </label>
                <p>
                  Arrêtez la caméra pour modifier ces réglages. La vidéo
                  affichée conserve sa résolution.
                </p>
              </div>
              {engine.fallback && (
                <details className="engine-fallback">
                  <summary>GPU indisponible : repli CPU</summary>
                  <p>{engine.fallback}</p>
                </details>
              )}
              <div className="engine">
                <span>MODÈLE</span>
                <b>MediaPipe Hand Landmarker</b>
                <span className="engine-state">
                  <i />
                  {active
                    ? "Modèle prêt"
                    : loading
                      ? "Chargement en cours"
                      : "En attente d’activation"}
                </span>
              </div>
            </section>
            <div className="local-card">
              <LockKeyhole size={19} />
              <div>
                <strong>100 % dans votre navigateur</strong>
                <p>
                  Le traitement reste sur votre appareil.
                  <br />
                  Votre vie privée reste la vôtre.
                </p>
              </div>
            </div>
          </aside>
        </div>
        <section className="guide" id="guide">
          <div className="guide-heading">
            <span className="eyebrow">QUELQUES REPÈRES</span>
            <h2>Prêt en trois gestes.</h2>
          </div>
          <div className="guide-step">
            <span>01</span>
            <div>
              <h3>
                Autorisez la caméra <Camera size={14} />
              </h3>
              <p>Votre webcam donne vie à l’expérience.</p>
            </div>
          </div>
          <div className="guide-step">
            <span>02</span>
            <div>
              <h3>
                Montrez vos mains <Hand size={14} />
              </h3>
              <p>Paumes visibles, dans un espace éclairé.</p>
            </div>
          </div>
          <div className="guide-step">
            <span>03</span>
            <div>
              <h3>
                Explorez le mouvement <Sparkles size={14} />
              </h3>
              <p>21 points par main. À vous de jouer.</p>
            </div>
          </div>
        </section>
        <footer>
          <span>
            ARCANE <b> / </b> EXPLORING HUMAN–COMPUTER INTERACTION
          </span>
          <span>
            <Check size={12} /> React + MediaPipe{" "}
            <span className="footer-version">
              V3.0 — HAND TRACKING / AIR CANVAS / HOLOGRAM
            </span>
          </span>
        </footer>
      </main>
    </div>
  );
}
