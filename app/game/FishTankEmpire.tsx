"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Game } from "./game";
import { LanguageProvider, useI18n } from "./i18n";
import { TankScene } from "./scene";
import { buildCursor } from "./sprites";
import { World } from "./world";
import { HudBar, GameHud, ComboMeter, FoodBar, Toasts, TankStatus } from "./ui/Hud";
import { ShopPanel } from "./ui/Shop";
import { DebugPanel } from "./ui/DebugPanel";

// Glue. React owns the shop and the readouts; the RAF loop owns the tank. The only
// bridge between them is `game.flush()`, which is deliberately throttled so a frame
// of the simulation never costs a React render.

const HUD_HZ = 12;

type Engine = { game: Game; world: World };

// A module singleton rather than per-mount state: StrictMode's double effect and
// HMR both remount this component, but the engine should only load the save once.
let engineSingleton: Engine | null = null;
function getEngine(): Engine {
  if (!engineSingleton) {
    const game = Game.load();
    engineSingleton = { game, world: new World(game) };
    // Handy from the console when tuning the economy: __tank.game.earn(1e9).
    (window as unknown as { __tank?: Engine }).__tank = engineSingleton;
  }
  return engineSingleton;
}

/** The engine never changes once built, so the store never has to notify. */
const noSubscribe = () => () => {};
const serverEngine = () => null;

export function FishTankEmpire() {
  return <LanguageProvider><FishTankEmpireInner /></LanguageProvider>;
}

function FishTankEmpireInner() {
  // The engine needs localStorage, a canvas and `document`, so it cannot exist
  // during the server render — this is the client-only gate.
  const engine = useSyncExternalStore(noSubscribe, getEngine, serverEngine);
  if (!engine) return <BootScreen />;
  return <GameShell engine={engine} />;
}

function BootScreen() {
  const { t } = useI18n();
  return (
    <main className="ft-boot">
      <div className="ft-boot-inner">
        <span className="ft-boot-fish">🐟</span>
        <strong>FISH TANK EMPIRE</strong>
        <small>{t("loading")}</small>
      </div>
    </main>
  );
}

function GameShell({ engine }: { engine: Engine }) {
  const { t } = useI18n();
  const { game, world } = engine;
  // One subscription for the whole tree; every panel reads straight off `game`.
  useSyncExternalStore(game.subscribe, game.getSnapshot, game.getSnapshot);

  const mountRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [hudOpen, setHudOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const mount = mountRef.current;
    const popupLayer = popupRef.current;
    if (!mount || !popupLayer) return;

    const scene = new TankScene(mount, world, game);
    (window as unknown as { __tank?: Engine & { scene?: TankScene } }).__tank!.scene = scene;

    // Pixel-art pointer, generated the same way as every other sprite. The
    // crosshair keyword stays as the fallback for anything that rejects the image.
    // The scale has to stay a whole number — the sprite is blitted pixel-by-pixel,
    // and a fractional factor would smear the very edges that make it read as
    // pixel art.
    const cursor = buildCursor(2);
    mount.style.cursor = `url(${cursor.url}) ${cursor.hotspotX} ${cursor.hotspotY}, crosshair`;

    const resize = () => scene.resize();
    window.addEventListener("resize", resize);
    resize();

    // ── Input ────────────────────────────────────────────────────────────────
    let feeding = false;
    const toWorld = (e: PointerEvent) => scene.screenToWorld(e.clientX, e.clientY);
    const onDown = (e: PointerEvent) => {
      mount.setPointerCapture(e.pointerId);
      feeding = true;
      const p = toWorld(e);
      world.pointerX = p.x; world.pointerY = p.y; world.pointerInside = true;
      // A tap both scoops up whatever is under it and drops food — the two things
      // the player wants from a click, without a mode switch.
      world.clickAt(p.x, p.y);
      world.feedAt(p.x, p.y);
    };
    const onMove = (e: PointerEvent) => {
      const p = toWorld(e);
      world.pointerX = p.x; world.pointerY = p.y; world.pointerInside = true;
      // Dragging sprinkles: this is the gesture the whole game is built around.
      if (feeding) world.feedAt(p.x, p.y);
    };
    const onUp = (e: PointerEvent) => {
      feeding = false;
      if (mount.hasPointerCapture(e.pointerId)) mount.releasePointerCapture(e.pointerId);
    };
    const onLeave = () => { world.pointerInside = false; feeding = false; };
    mount.addEventListener("pointerdown", onDown);
    mount.addEventListener("pointermove", onMove);
    mount.addEventListener("pointerup", onUp);
    mount.addEventListener("pointercancel", onUp);
    mount.addEventListener("pointerleave", onLeave);

    // ── Floating numbers ─────────────────────────────────────────────────────
    // Pooled DOM nodes rather than React children: at frenzy there can be twenty of
    // these a second and none of them should touch the reconciler.
    const nodes: HTMLDivElement[] = [];
    const syncPopups = () => {
      const list = world.popups;
      while (nodes.length < list.length) {
        const node = document.createElement("div");
        node.className = "ft-popup";
        popupLayer.appendChild(node);
        nodes.push(node);
      }
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const popup = list[i];
        if (!popup) { node.style.display = "none"; continue; }
        const { left, top } = scene.worldToScreen(popup.x, popup.y);
        node.style.display = "block";
        node.style.left = `${left}%`;
        node.style.top = `${top}%`;
        node.style.opacity = `${Math.min(1, popup.life * 1.6)}`;
        node.style.color = popup.color;
        node.classList.toggle("big", popup.big);
        node.classList.toggle("earning", popup.text.startsWith("+"));
        if (node.textContent !== popup.text) node.textContent = popup.text;
      }
    };

    // ── Loop ─────────────────────────────────────────────────────────────────
    let raf = 0;
    let last = performance.now();
    let hudAccum = 0;
    let saveAccum = 0;
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      const raw = (now - last) / 1000;
      last = now;
      const dt = Math.min(raw, 0.05);
      if (game.rebuildRequested) { game.rebuildRequested = false; world.rebuild(); }
      if (!pausedRef.current) world.step(dt);
      scene.render(dt);
      syncPopups();
      hudAccum += dt;
      if (hudAccum >= 1 / HUD_HZ) { hudAccum = 0; game.flush(); }
      saveAccum += dt;
      if (saveAccum >= 15) { saveAccum = 0; game.state.fish = world.toSave(); game.save(); }
    };
    raf = requestAnimationFrame(animate);

    const persist = () => { game.state.fish = world.toSave(); game.save(); };
    window.addEventListener("beforeunload", persist);
    document.addEventListener("visibilitychange", persist);

    return () => {
      cancelAnimationFrame(raf);
      persist();
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", persist);
      document.removeEventListener("visibilitychange", persist);
      mount.removeEventListener("pointerdown", onDown);
      mount.removeEventListener("pointermove", onMove);
      mount.removeEventListener("pointerup", onUp);
      mount.removeEventListener("pointercancel", onUp);
      mount.removeEventListener("pointerleave", onLeave);
      for (const node of nodes) node.remove();
      scene.dispose();
    };
  }, [game, world]);

  const wipe = useCallback(() => {
    if (window.confirm(t("resetConfirm"))) game.reset();
  }, [game, t]);

  const dirt = game.state.dirt;
  const frenzy = game.live.frenzy > 0;

  return (
    <main className={`ft-shell${frenzy ? " frenzy" : ""}`} data-tank={game.state.tankIndex}>
      <section className={`ft-drawer ft-drawer-hud${hudOpen ? " open" : ""}`}>
        <div className="ft-drawer-content">
          <div id="status-panel" aria-hidden={!hudOpen}>
            <HudBar game={game} paused={paused} onTogglePause={() => setPaused((v) => !v)} onReset={wipe}
              onToggleDebug={() => setDebugOpen((v) => !v)} debugOpen={debugOpen} />
          </div>
          <button
            className="ft-drawer-tab ft-hud-tab"
            type="button"
            onClick={() => setHudOpen((v) => !v)}
            aria-expanded={hudOpen}
            aria-controls="status-panel"
          >
            <span>🐟</span> {t("status")} <i>{hudOpen ? "▲" : "▼"}</i>
          </button>
        </div>
      </section>

      {debugOpen && <DebugPanel game={game} onClose={() => setDebugOpen(false)} />}

      <div className="ft-body">
        <section className="ft-stage">
          <div className="ft-tank-frame">
            <div className="ft-tank" ref={mountRef} />
            <div className="ft-popups" ref={popupRef} />
            <div className="ft-glass" aria-hidden="true" />
            <GameHud game={game} />
            {dirt > 0.25 && (
              <div className="ft-dirty-warning">
                💚 {t("dirty", { percent: Math.round(game.derived.dirtPenalty * 100) })}
              </div>
            )}
            <ComboMeter game={game} />
            <TankStatus game={game} />
            {paused && <div className="ft-paused">{t("paused")}</div>}
          </div>
        </section>

        <aside className={`ft-drawer ft-drawer-shop${shopOpen ? " open" : ""}`}>
          <button
            className="ft-drawer-tab ft-shop-tab"
            type="button"
            onClick={() => setShopOpen((v) => !v)}
            aria-expanded={shopOpen}
            aria-controls="shop-panel"
          >
            <span>🛒</span><b>{t("shop")}</b><i>{shopOpen ? "▶" : "◀"}</i>
          </button>
          <div className="ft-shop" id="shop-panel" aria-hidden={!shopOpen}>
            <ShopPanel game={game} />
          </div>
        </aside>
      </div>

      <section className={`ft-drawer ft-drawer-food${foodOpen ? " open" : ""}`}>
        <div className="ft-food-drawer-content">
          <button
            className="ft-drawer-tab ft-food-tab"
            type="button"
            onClick={() => setFoodOpen((v) => !v)}
            aria-expanded={foodOpen}
            aria-controls="food-panel"
          >
            <span>🍤</span> {t("food")} <i>{foodOpen ? "▼" : "▲"}</i>
          </button>
          <div id="food-panel" aria-hidden={!foodOpen}>
            <FoodBar game={game} />
          </div>
        </div>
      </section>

      <Toasts game={game} />
    </main>
  );
}
