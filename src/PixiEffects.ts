import {
  Application,
  Container,
  MeshSimple,
  Particle,
  ParticleContainer,
  RenderTexture,
  Sprite,
  Texture,
} from "pixi.js";
import {
  EffectSimulation,
  MAX_POINTS,
  MAX_PARTICLES,
  STRIP_POINTS,
  writeEffectGeometry,
} from "./effectSimulation";
import type { EffectSegment, EffectSink, Strand } from "./effectSimulation";

type Strip = {
  root: Container;
  tube: MeshSimple;
  core: MeshSimple;
  vertices: Float32Array;
  coreVertices: Float32Array;
  centers: Float32Array;
};

function makeTexture(radial: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = radial
    ? ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    : ctx.createLinearGradient(0, 0, 0, 64);
  const stops: [number, string][] = radial
    ? [
        [0, "#ffffffff"],
        [0.12, "#ffffffe0"],
        [0.3, "#ffffff80"],
        [0.6, "#ffffff20"],
        [1, "#ffffff00"],
      ]
    : [
        [0, "#ffffff00"],
        [0.15, "#ffffff10"],
        [0.4, "#ffffffaa"],
        [0.5, "#ffffffff"],
        [0.6, "#ffffffaa"],
        [0.85, "#ffffff10"],
        [1, "#ffffff00"],
      ];
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return Texture.from(canvas);
}

export class PixiEffects implements EffectSink {
  private app = new Application();
  private model = new EffectSimulation();
  private cache!: RenderTexture;
  private cached!: Sprite;
  private animated = new Container();
  private particleLayer!: ParticleContainer;
  private particles: Particle[] = [];
  private strips = new Map<number, Strip>();
  private tubeTexture!: Texture;
  private sparkTexture!: Texture;
  private lastTime: number | undefined;
  private dirty = true;
  private destroyed = false;
  private width = 0;
  private height = 0;
  private onContextLost: (event: Event) => void;
  private canvas: HTMLCanvasElement;

  private constructor(
    canvas: HTMLCanvasElement,
    onError: (message: string) => void,
  ) {
    this.canvas = canvas;
    this.onContextLost = (event) => {
      event.preventDefault();
      this.pause();
      onError(
        "Le contexte graphique PixiJS a été perdu. Les pinceaux classiques restent disponibles ; rechargez pour réinitialiser les effets GPU.",
      );
    };
  }

  static async create(
    canvas: HTMLCanvasElement,
    onError: (message: string) => void,
  ) {
    const engine = new PixiEffects(canvas, onError);
    try {
      await engine.app.init({
        canvas,
        preference: ["webgl"],
        width: 1280,
        height: 720,
        resolution: 1,
        backgroundAlpha: 0,
        antialias: true,
        autoStart: false,
        sharedTicker: false,
        powerPreference: "high-performance",
      });
      engine.app.stop();
      engine.tubeTexture = makeTexture(false);
      engine.sparkTexture = makeTexture(true);
      engine.cache = RenderTexture.create({
        width: 1280,
        height: 720,
        resolution: 1,
      });
      engine.cached = new Sprite(engine.cache);
      engine.app.stage.eventMode = "none";
      engine.app.stage.addChild(engine.cached, engine.animated);
      engine.particleLayer = new ParticleContainer({
        dynamicProperties: {
          position: true,
          vertex: true,
          rotation: true,
          color: true,
        },
      });
      engine.particleLayer.blendMode = "add";
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const particle = new Particle({
          texture: engine.sparkTexture,
          anchorX: 0.5,
          anchorY: 0.5,
          alpha: 0,
        });
        engine.particles.push(particle);
        engine.particleLayer.addParticle(particle);
      }
      engine.app.stage.addChild(engine.particleLayer);
      engine.app.renderer.render({
        container: engine.animated,
        target: engine.cache,
        clear: true,
      });
      canvas.addEventListener("webglcontextlost", engine.onContextLost);
      return engine;
    } catch (cause) {
      if (engine.app.renderer) engine.destroy();
      throw cause;
    }
  }

  get hasWork() {
    return !this.destroyed && (this.dirty || this.model.active);
  }
  get metrics() {
    return {
      particles: this.model.particleCount,
      strands: this.model.strands.length,
    };
  }
  emit(segment: EffectSegment) {
    if (!this.destroyed) {
      this.model.emit(segment);
      this.dirty = true;
    }
  }
  endStroke() {
    this.model.endStroke();
  }
  pause() {
    this.lastTime = undefined;
  }

  resize(sourceWidth: number, sourceHeight: number) {
    if (this.destroyed) return;
    const width = Math.min(1280, sourceWidth),
      height = Math.round((width * sourceHeight) / sourceWidth);
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.app.renderer.resize(width, height);
    this.app.stage.scale.set(width / 1280, height / 720);
    this.dirty = true;
  }

  private strip(strand: Strand) {
    let strip = this.strips.get(strand.id);
    if (strip) return strip;
    const vertices = new Float32Array(STRIP_POINTS * 4),
      coreVertices = new Float32Array(STRIP_POINTS * 4);
    const uvs = new Float32Array(STRIP_POINTS * 4),
      indices = new Uint32Array((STRIP_POINTS - 1) * 6);
    for (let i = 0; i < STRIP_POINTS; i++) {
      const at = i * 4;
      uvs[at] = i / (STRIP_POINTS - 1);
      uvs[at + 1] = 0;
      uvs[at + 2] = uvs[at];
      uvs[at + 3] = 1;
      if (i < STRIP_POINTS - 1) {
        const j = i * 2;
        indices.set([j, j + 1, j + 2, j + 1, j + 3, j + 2], i * 6);
      }
    }
    const root = new Container();
    const tube = new MeshSimple({
      texture: this.tubeTexture,
      vertices,
      uvs,
      indices,
    });
    const core = new MeshSimple({
      texture: this.tubeTexture,
      vertices: coreVertices,
      uvs: uvs.slice(),
      indices: indices.slice(),
    });
    tube.autoUpdate = false;
    core.autoUpdate = false;
    tube.blendMode = "add";
    core.blendMode = "add";
    tube.tint = Number.parseInt(strand.settings.color.slice(1), 16);
    tube.alpha = 0.3 + (strand.settings.glow / 100) * 0.7;
    core.alpha = 0.3 + (strand.settings.glow / 100) * 0.55;
    root.addChild(tube, core);
    this.animated.addChild(root);
    strip = {
      root,
      tube,
      core,
      vertices,
      coreVertices,
      centers: new Float32Array(MAX_POINTS * 2),
    };
    this.strips.set(strand.id, strip);
    return strip;
  }
  private updateStrip(strand: Strand) {
    const strip = this.strip(strand);
    writeEffectGeometry(
      strand,
      this.model.time,
      strip.vertices,
      strip.coreVertices,
      strip.centers,
    );
    strip.tube.geometry.getBuffer("aPosition").update();
    strip.core.geometry.getBuffer("aPosition").update();
    return strip;
  }
  private disposeStrip(id: number) {
    const strip = this.strips.get(id);
    if (!strip) return;
    const tubeGeometry = strip.tube.geometry,
      coreGeometry = strip.core.geometry;
    strip.root.destroy({ children: true });
    tubeGeometry.destroy(true);
    coreGeometry.destroy(true);
    this.strips.delete(id);
  }
  render(now: number) {
    if (this.destroyed) return false;
    const dt = this.lastTime === undefined ? 0 : (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!this.hasWork) return false;
    this.model.advance(dt);
    for (const strand of this.model.retired) {
      const strip = this.updateStrip(strand);
      // Flatten only finished/old geometry into one bounded persistent texture.
      strip.root.removeFromParent();
      this.app.renderer.render({
        container: strip.root,
        target: this.cache,
        clear: false,
      });
      this.disposeStrip(strand.id);
    }
    this.model.retired.length = 0;
    for (const strand of this.model.strands) this.updateStrip(strand);
    this.model.sparks.forEach((spark, i) => {
      const particle = this.particles[i];
      if (!spark.active) {
        particle.alpha = 0;
        return;
      }
      const remaining = Math.max(0, 1 - spark.age / spark.life);
      particle.x = spark.x;
      particle.y = spark.y;
      particle.scaleX =
        (spark.size / 64) *
        (0.35 + remaining * 0.65) *
        (spark.cosmic ? 1 : 2.5);
      particle.scaleY = (spark.size / 64) * (0.35 + remaining * 0.65);
      particle.rotation = Math.atan2(spark.vy, spark.vx);
      particle.alpha = spark.alpha * remaining * remaining;
      particle.tint = spark.color;
    });
    this.app.render();
    this.dirty = false;
    return true;
  }
  clear() {
    if (this.destroyed) return;
    this.model.clear();
    for (const id of this.strips.keys()) this.disposeStrip(id);
    this.particles.forEach((p) => {
      p.alpha = 0;
    });
    this.app.renderer.render({
      container: this.animated,
      target: this.cache,
      clear: true,
    });
    this.dirty = true;
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    for (const id of this.strips.keys()) this.disposeStrip(id);
    this.model.clear();
    this.app.destroy({ removeView: false }, { children: true });
    this.cache?.destroy(true);
    this.tubeTexture?.destroy(true);
    this.sparkTexture?.destroy(true);
  }
}
