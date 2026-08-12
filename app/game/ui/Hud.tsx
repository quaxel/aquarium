"use client";

import { FOODS, FOOD_ORDER, TANKS } from "../content";
import { formatDuration, formatMultiplier, formatNumber, formatRate } from "../format";
import type { Game } from "../game";

export function HudBar({
  game, paused, onTogglePause, onReset,
}: {
  game: Game;
  paused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
}) {
  const tank = TANKS[Math.min(game.state.tankIndex, TANKS.length - 1)];
  const fish = game.live.fishAlive;
  const full = fish >= game.derived.fishCap;
  return (
    <header className="ft-hud">
      <div className="ft-brand">
        <span className="ft-brand-mark">🐟</span>
        <div>
          <strong>FISH TANK EMPIRE</strong>
          <small>{tank.emoji} {tank.short}</small>
        </div>
      </div>

      <div className="ft-readouts">
        <Readout label="PARA" value={formatNumber(game.state.coins)} accent="coin" wide />
        <Readout label="SANİYE" value={`${formatRate(game.live.cps)}/sn`} />
        <Readout label="ÜN" value={formatNumber(game.state.reputation)} accent="rep"
          hint={`Kalıcı çarpan ${formatMultiplier(game.derived.reputationMul)}`} />
        <Readout label="BALIK" value={`${fish}/${game.derived.fishCap}`} accent={full ? "warn" : undefined} />
        <Readout label="ÇARPAN" value={formatMultiplier(game.live.comboMul * game.derived.valueMul)} />
      </div>

      <div className="ft-hud-actions">
        <button onClick={onTogglePause} title="Duraklat">{paused ? "▶" : "❚❚"}</button>
        <button
          onClick={() => game.toggleAutoFeed()}
          className={game.state.autoFeedOn ? "on" : ""}
          title="Otomatik yemlik"
          disabled={game.derived.autoFeedRate <= 0}
        >🤖</button>
        <button
          onClick={() => game.toggleSharkDiet()}
          className={game.state.sharkDiet ? "on" : ""}
          title="Köpekbalığı avlansın mı?"
          disabled={(game.fishCounts.shark ?? 0) === 0}
        >🦈</button>
        <button onClick={onReset} title="Sıfırla" className="danger">⟲</button>
      </div>
    </header>
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
              ? `frenzy ${live.frenzyCooldown.toFixed(0)} sn sonra`
              : `${Math.floor(live.combo)} combo`}
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
  const baseline = game.foodCost("shrimpPellet") / (FOODS.shrimpPellet.cost || 1);
  return (
    <div className="ft-foodbar" role="group" aria-label="Yem seçimi">
      {FOOD_ORDER.map((id) => {
        const food = FOODS[id];
        const owned = game.state.unlockedFoods.includes(id);
        const active = game.state.foodId === id;
        const visible = owned || food.tier <= game.state.tankIndex + 1;
        if (!visible) return null;
        const unitCost = food.cost * baseline;
        const affordable = owned ? true : game.state.coins >= food.unlockCost;
        return (
          <button
            key={id}
            className={`ft-food${active ? " active" : ""}${owned ? "" : " locked"}`}
            onClick={() => game.buyFood(id)}
            disabled={!owned && !affordable}
            title={food.blurb}
          >
            <span className="ft-food-emoji">{food.emoji}</span>
            <span className="ft-food-name">{food.name}</span>
            <span className="ft-food-cost">
              {owned
                ? unitCost > 0 ? `${formatNumber(unitCost)}/adet` : "bedava"
                : `🔓 ${formatNumber(food.unlockCost)}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TankStatus({ game }: { game: Game }) {
  const dirt = game.state.dirt;
  return (
    <div className="ft-tankstatus">
      <div className="ft-meter" title={`Kirlilik: üretim ${formatMultiplier(1 - game.derived.dirtPenalty)}`}>
        <small>SU</small>
        <div className="ft-meter-track"><i className="dirt" style={{ width: `${dirt * 100}%` }} /></div>
      </div>
      <span>{game.live.pellets} yem · {game.live.pickups} para</span>
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

export function OfflineReport({
  report, onClose,
}: {
  report: { seconds: number; coins: number };
  onClose: () => void;
}) {
  return (
    <div className="ft-modal-backdrop" onClick={onClose}>
      <div className="ft-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🌙 Sen yokken</h2>
        <p>
          Otomatik yemlik <b>{formatDuration(report.seconds)}</b> boyunca çalıştı ve
          {" "}<b>{formatNumber(report.coins)}</b> para biriktirdi.
        </p>
        <button onClick={onClose}>TANKA DÖN</button>
      </div>
    </div>
  );
}
