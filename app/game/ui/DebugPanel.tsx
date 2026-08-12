"use client";

import { useState } from "react";
import { TANKS } from "../content";
import { formatNumber } from "../format";
import type { Game } from "../game";

export function DebugPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [amount, setAmount] = useState("1000");

  const changeCoins = (direction: 1 | -1) => {
    const value = Number(amount);
    if (Number.isFinite(value) && value > 0) game.debugAdjustCoins(direction * value);
  };

  return (
    <aside className="ft-debug" aria-label="Debug panel">
      <div className="ft-debug-head">
        <div><small>GELİŞTİRİCİ</small><strong>DEBUG PANELİ</strong></div>
        <button type="button" onClick={onClose} aria-label="Debug panelini kapat">×</button>
      </div>
      <label className="ft-debug-field">
        <span>TANKA GİT</span>
        <select value={game.state.tankIndex} onChange={(event) => game.debugSetTank(Number(event.target.value))}>
          {TANKS.map((tank) => (
            <option key={tank.index} value={tank.index}>{tank.index + 1}. {tank.emoji} {tank.name}</option>
          ))}
        </select>
      </label>
      <div className="ft-debug-coins">
        <span>PARA <b>{formatNumber(game.state.coins)}</b></span>
        <label>
          <span>MİKTAR</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" type="number" min="0" step="100" aria-label="Para miktarı" />
        </label>
        <div>
          <button type="button" className="add" onClick={() => changeCoins(1)}>+ EKLE</button>
          <button type="button" className="remove" onClick={() => changeCoins(-1)}>− ÇIKAR</button>
        </div>
      </div>
    </aside>
  );
}
