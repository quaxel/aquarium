"use client";

import { FOODS, FOOD_ORDER, TANKS } from "../content";
import { formatMultiplier, formatNumber, formatRate } from "../format";
import type { Game } from "../game";
import { LANGUAGE_OPTIONS, useI18n } from "../i18n";

export function HudBar({
  game, paused, onTogglePause, onReset, onToggleDebug, debugOpen,
}: {
  game: Game;
  paused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  onToggleDebug: () => void;
  debugOpen: boolean;
}) {
  const { language, setLanguage, t, tankText } = useI18n();
  const tank = TANKS[Math.min(game.state.tankIndex, TANKS.length - 1)];
  return (
    <header className="ft-hud">
      <div className="ft-brand">
        <span className="ft-brand-mark">🐟</span>
        <div>
          <strong>FISH TANK EMPIRE</strong>
          <small>{tank.emoji} {tankText(tank.index, 1, tank.short)}</small>
        </div>
      </div>

      <div className="ft-readouts">
        <Readout label={t("reputation")} value={formatNumber(game.state.reputation)} accent="rep"
          hint={t("permanentMultiplier", { value: formatMultiplier(game.derived.reputationMul) })} />
      </div>

      <div className="ft-hud-actions">
        <label className="ft-language" title={t("language")}>
          <span>🌐</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}>
            {LANGUAGE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.short}</option>)}
          </select>
        </label>
        <button onClick={onTogglePause} title={t("pause")}>{paused ? "▶" : "❚❚"}</button>
        <button
          onClick={() => game.toggleAutoFeed()}
          className={game.state.autoFeedOn ? "on" : ""}
          title={t("autoFeeder")}
          disabled={game.derived.autoFeedRate <= 0}
        >🤖</button>
        <button
          onClick={() => game.toggleSharkDiet()}
          className={game.state.sharkDiet ? "on" : ""}
          title={t("sharkDiet")}
          disabled={(game.fishCounts.shark ?? 0) === 0}
        >🦈</button>
        <button onClick={onToggleDebug} className={debugOpen ? "on" : ""} title={t("debug")}>🛠</button>
        <button onClick={onReset} title={t("reset")} className="danger">⟲</button>
      </div>
    </header>
  );
}

export function GameHud({ game }: { game: Game }) {
  const { t } = useI18n();
  const fish = game.live.fishAlive;
  const full = fish >= game.derived.fishCap;
  return (
    <section className="ft-game-hud" aria-label={t("gameStatus")}>
      <Readout label={t("money")} value={formatNumber(game.state.coins)} accent="coin" wide />
      <Readout label={t("second")} value={`${formatRate(game.live.cps)}${t("perSecondShort")}`} />
      <Readout label={t("fish")} value={`${fish}/${game.derived.fishCap}`} accent={full ? "warn" : undefined} />
      <Readout label={t("multiplier")} value={formatMultiplier(game.live.comboMul * game.derived.valueMul)} />
    </section>
  );
}

function Readout({ label, value, accent, hint, wide }: {
  label: string; value: string; accent?: string; hint?: string; wide?: boolean;
}) {
  return (
    <div className={`ft-readout${accent ? ` ${accent}` : ""}${wide ? " wide" : ""}`} title={hint}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

export function ComboMeter({ game }: { game: Game }) {
  const { t } = useI18n();
  const live = game.live;
  const frenzy = live.frenzy > 0;
  const cooling = !frenzy && live.frenzyCooldown > 0;
  const percent = Math.min(100, live.comboProgress * 100);
  if (live.combo < 1 && !frenzy && !cooling) return null;
  return (
    <div className={`ft-combo${frenzy ? " frenzy" : ""}${cooling ? " cooling" : ""}`}>
      <div className="ft-combo-head">
        <b>{frenzy ? "FEEDING FRENZY" : formatMultiplier(live.comboMul)}</b>
        <span>
          {frenzy
            ? `${live.frenzyLeft.toFixed(1)} sn · ${formatMultiplier(game.derived.frenzyPower)}`
            : cooling
              ? t("frenzyAfter", { seconds: live.frenzyCooldown.toFixed(0) })
              : t("combo", { count: Math.floor(live.combo) })}
        </span>
      </div>
      <div className="ft-combo-track">
        <i style={{ width: `${percent}%` }} />
        {!frenzy && [5, 14, 30, 55].map((tier) => (
          <u key={tier} style={{ left: `${(tier / 90) * 100}%` }} className={live.combo >= tier ? "hit" : ""} />
        ))}
      </div>
    </div>
  );
}

export function FoodBar({ game }: { game: Game }) {
  const { t, foodName, foodBlurb } = useI18n();
  const baseline = game.foodCost("shrimpPellet") / (FOODS.shrimpPellet.cost || 1);
  return (
    <div className="ft-foodbar" role="group" aria-label={t("foodChoice")}>
      {FOOD_ORDER.map((id) => {
        const food = FOODS[id];
        const owned = game.state.unlockedFoods.includes(id);
        const active = game.state.foodId === id;
        const tierAvailable = food.tier <= game.state.tankIndex + 1;
        const unitCost = food.cost * baseline;
        const affordable = owned ? true : game.state.coins >= food.unlockCost;
        return (
          <button
            key={id}
            className={`ft-food${active ? " active" : ""}${owned ? "" : " locked"}`}
            onClick={() => game.buyFood(id)}
            disabled={!owned && (!affordable || !tierAvailable)}
            title={foodBlurb(id, food.blurb)}
          >
            <span className="ft-food-emoji">{food.emoji}</span>
            <span className="ft-food-name">{foodName(id, food.name)}</span>
            <span className="ft-food-cost">
              {owned
                ? unitCost > 0 ? `${formatNumber(unitCost)}${t("each")}` : t("free")
                : tierAvailable ? `🔓 ${formatNumber(food.unlockCost)}` : `🔒 TANK ${food.tier + 1}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TankStatus({ game }: { game: Game }) {
  const { t } = useI18n();
  const dirt = game.state.dirt;
  return (
    <div className="ft-tankstatus">
      <div className="ft-meter" title={t("dirtHint", { value: formatMultiplier(1 - game.derived.dirtPenalty) })}>
        <small>{t("water")}</small>
        <div className="ft-meter-track"><i className="dirt" style={{ width: `${dirt * 100}%` }} /></div>
      </div>
      <span>{t("pelletsCoins", { pellets: game.live.pellets, coins: game.live.pickups })}</span>
    </div>
  );
}

export function Toasts({ game }: { game: Game }) {
  // The log is pruned in Game.flush, so rendering stays a pure read.
  const visible = game.log.slice(0, 3);
  if (!visible.length) return null;
  return (
    <div className="ft-toasts" aria-live="polite">
      {visible.map((entry) => (
        <div key={entry.id} className={`ft-toast ${entry.kind}`}>
          <b>{entry.title}</b>
          {entry.body && <span>{entry.body}</span>}
        </div>
      ))}
    </div>
  );
}
