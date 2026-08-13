"use client";

import { useState } from "react";
import { TANKS } from "../content";
import { formatNumber } from "../format";
import type { Game } from "../game";
import { useI18n } from "../i18n";

export function DebugPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState("1000");

  const changeCoins = (direction: 1 | -1) => {
    const value = Number(amount);
    if (Number.isFinite(value) && value > 0) game.debugAdjustCoins(direction * value);
  };

  return (
    <aside className="ft-debug" aria-label={t("debugPanel")}>
      <div className="ft-debug-head">
        <div><small>{t("developer")}</small><strong>{t("debugPanel")}</strong></div>
        <button type="button" onClick={onClose} aria-label={t("closeDebug")}>×</button>
      </div>
      <label className="ft-debug-field">
        <span>{t("goTank")}</span>
        <select value={game.state.tankIndex} onChange={(event) => game.debugSetTank(Number(event.target.value))}>
          {TANKS.map((tank) => (
            <option key={tank.index} value={tank.index}>{tank.index + 1}. {tank.emoji} {tank.name}</option>
          ))}
        </select>
      </label>
      <div className="ft-debug-coins">
        <span>{t("money")} <b>{formatNumber(game.state.coins)}</b></span>
        <label>
          <span>{t("amount")}</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" type="number" min="0" step="100" aria-label={t("amount")} />
        </label>
        <div>
          <button type="button" className="add" onClick={() => changeCoins(1)}>{t("add")}</button>
          <button type="button" className="remove" onClick={() => changeCoins(-1)}>{t("remove")}</button>
        </div>
      </div>
    </aside>
  );
}
