"use client";

import { useMemo, useState } from "react";
import {
  CATEGORY_LABELS, DECOR, DECOR_ORDER, SPECIES, SPECIES_ORDER, STAGES, SYNERGIES,
  TANKS, UPGRADES, UPGRADE_ORDER, reputationMultiplier, schoolMultiplier, schoolToMilestone,
} from "../content";
import { formatDuration, formatMultiplier, formatNumber, formatPercent } from "../format";
import type { Game } from "../game";
import { speciesPortrait } from "../sprites";
import type { SpeciesId, UpgradeCategory } from "../types";

const TABS = [
  { id: "fish", label: "BALIK", emoji: "🐟" },
  { id: "upgrades", label: "YÜKSELTME", emoji: "⚙️" },
  { id: "decor", label: "DEKOR", emoji: "🪸" },
  { id: "synergy", label: "SİNERJİ", emoji: "🔗" },
  { id: "tank", label: "TANK", emoji: "🏆" },
  { id: "stats", label: "KAYIT", emoji: "📊" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const portraitCache = new Map<SpeciesId, string>();
function portrait(id: SpeciesId): string {
  let url = portraitCache.get(id);
  if (!url) { url = speciesPortrait(id, 2); portraitCache.set(id, url); }
  return url;
}

export function ShopPanel({ game }: { game: Game }) {
  const [tab, setTab] = useState<TabId>("fish");
  const synergyCount = game.derived.activeSynergies.length;
  return (
    <div className="ft-shop-inner">
      <nav className="ft-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            <span>{t.emoji}</span>
            {t.label}
            {t.id === "synergy" && synergyCount > 0 && <i className="ft-badge">{synergyCount}</i>}
            {t.id === "tank" && game.canMoveTank() && <i className="ft-badge pulse">!</i>}
          </button>
        ))}
      </nav>
      <div className="ft-tab-body">
        {tab === "fish" && <FishTab game={game} />}
        {tab === "upgrades" && <UpgradeTab game={game} />}
        {tab === "decor" && <DecorTab game={game} />}
        {tab === "synergy" && <SynergyTab game={game} />}
        {tab === "tank" && <TankTab game={game} />}
        {tab === "stats" && <StatsTab game={game} />}
      </div>
    </div>
  );
}

// ── Fish ─────────────────────────────────────────────────────────────────────

function FishTab({ game }: { game: Game }) {
  const cap = game.derived.fishCap;
  const total = game.live.fishAlive;
  const visible = SPECIES_ORDER.filter(
    (id) => game.state.unlockedSpecies.includes(id) || SPECIES[id].tier <= game.state.tankIndex + 1,
  );
  return (
    <div className="ft-list">
      <div className="ft-list-note">
        Tank kapasitesi <b>{total}/{cap}</b>. Daha fazla balık için <b>daha büyük tanka</b> taşın.
      </div>
      {visible.map((id) => <FishRow key={id} game={game} id={id} />)}
    </div>
  );
}

function FishRow({ game, id }: { game: Game; id: SpeciesId }) {
  const def = SPECIES[id];
  const owned = game.fishCounts[id] ?? 0;
  const unlocked = game.state.unlockedSpecies.includes(id);
  const cost = game.fishCost(id);
  const full = game.live.fishAlive >= game.derived.fishCap;
  const can = game.canBuyFish(id);
  const synergy = game.derived.speciesMul[id];
  const school = game.schoolLevel(id);
  const schoolPrice = game.schoolCost(id);
  const image = useMemo(() => portrait(id), [id]);
  // Coins per second this species yields per fish, before every multiplier — the
  // number that makes two species actually comparable.
  const throughput = def.baseValue / def.chew;

  return (
    <article className={`ft-card${unlocked ? "" : " locked"}`}>
      {/* A generated data URL of a 44×30 pixel sprite — next/image would only get
          in the way of something that never leaves the client. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="ft-portrait" />
      <div className="ft-card-main">
        <header>
          <b>{def.name}</b>
          {owned > 0 && <span className="ft-owned">×{owned}</span>}
          {synergy && synergy > 1 && <span className="ft-syn">{formatMultiplier(synergy)}</span>}
        </header>
        <p>{def.blurb}</p>
        <div className="ft-tags">
          <i>{formatNumber(throughput)}/sn</i>
          <i>{formatNumber(def.baseValue)} / lokma</i>
          {def.abilities.map((a) => <i key={a.kind} className="ability">{ABILITY_LABELS[a.kind]}</i>)}
        </div>
        {unlocked && (owned > 0 || school > 0) && (
          <button
            className="ft-school"
            onClick={() => game.buySchoolLevel(id)}
            disabled={game.state.coins < schoolPrice}
            title="Yetiştirme programı: bu türün üretimini kalıcı olarak artırır"
          >
            <b>🧬 Sürü sv.{school}</b>
            <span>
              {formatMultiplier(schoolMultiplier(school))} → {formatMultiplier(schoolMultiplier(school + 1))}
              {schoolToMilestone(school) <= 3 && <i className="ft-milestone"> ×1.35&apos;e {schoolToMilestone(school)}</i>}
            </span>
            <em>{formatNumber(schoolPrice)}</em>
          </button>
        )}
      </div>
      <div className="ft-fish-actions">
        <button
          className="ft-buy"
          onClick={() => game.buyFish(id)}
          disabled={!can}
          title={!unlocked ? "Henüz açılmadı" : full ? "Tank dolu" : ""}
        >
          {unlocked ? <>
            <span>{formatNumber(cost)}</span>
            <small>{full ? "TANK DOLU" : "SATIN AL"}</small>
          </> : <>
            <span>🔒</span>
            <small>TANK {def.tier + 1}</small>
          </>}
        </button>
        {owned > 0 && (
          <button
            className="ft-sell"
            onClick={() => game.sellFish(id)}
            title="En küçük olanı sat ve slotu boşalt"
          >
            SAT +{formatNumber(game.sellRefund(id))}
          </button>
        )}
      </div>
    </article>
  );
}

const ABILITY_LABELS: Record<string, string> = {
  collector: "toplayıcı",
  cleaner: "temizlikçi",
  inflate: "patlar",
  dig: "kazıcı",
  shock: "şok",
  school: "sürü",
  lure: "çeker",
  predator: "avcı",
  passive: "pasif gelir",
  bubbler: "baloncuk",
};

// ── Upgrades ─────────────────────────────────────────────────────────────────

function UpgradeTab({ game }: { game: Game }) {
  const categories: UpgradeCategory[] = ["feed", "fish", "collect", "auto", "frenzy"];
  return (
    <div className="ft-list">
      {categories.map((category) => {
        const rows = UPGRADE_ORDER.filter((id) => UPGRADES[id].category === category)
          .filter((id) => UPGRADES[id].tier <= game.state.tankIndex + 1 || (game.state.upgrades[id] ?? 0) > 0);
        if (!rows.length) return null;
        return (
          <section key={category} className="ft-group">
            <h3>{CATEGORY_LABELS[category]}</h3>
            {rows.map((id) => {
              const upgrade = UPGRADES[id];
              const level = game.state.upgrades[id] ?? 0;
              const maxed = level >= upgrade.maxLevel;
              const available = game.upgradeAvailable(id);
              const cost = game.upgradeCost(id);
              return (
                <article key={id} className={`ft-card compact${available ? "" : " locked"}`}>
                  <span className="ft-emoji">{upgrade.emoji}</span>
                  <div className="ft-card-main">
                    <header>
                      <b>{upgrade.name}</b>
                      {upgrade.maxLevel > 1 && (
                        <span className="ft-level">{level}/{upgrade.maxLevel}</span>
                      )}
                    </header>
                    <p>{maxed ? upgrade.blurb : upgrade.detail(level)}</p>
                    {!available && upgrade.requires?.upgrade && (
                      <p className="ft-req">
                        Gerekli: {UPGRADES[upgrade.requires.upgrade[0]].name} sv.{upgrade.requires.upgrade[1]}
                      </p>
                    )}
                  </div>
                  <button
                    className="ft-buy"
                    onClick={() => game.buyUpgrade(id)}
                    disabled={maxed || !available || game.state.coins < cost}
                  >
                    {maxed ? <span>MAKS</span> : <>
                      <span>{formatNumber(cost)}</span>
                      <small>AL</small>
                    </>}
                  </button>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

// ── Decor ────────────────────────────────────────────────────────────────────

function DecorTab({ game }: { game: Game }) {
  return (
    <div className="ft-list">
      <div className="ft-list-note">
        Dekorlar tankta <b>görünür</b> ve kalıcı bonus verir. Bazı balıklar onlarla sinerji kurar.
      </div>
      {DECOR_ORDER.map((id) => {
        const decor = DECOR[id];
        const owned = game.state.decor.includes(id);
        const visible = owned || decor.tier <= game.state.tankIndex + 1;
        if (!visible) return null;
        const effect = decor.effect;
        return (
          <article key={id} className={`ft-card compact${owned ? " owned" : ""}`}>
            <span className="ft-emoji">{decor.emoji}</span>
            <div className="ft-card-main">
              <header><b>{decor.name}</b></header>
              <p>{decor.blurb}</p>
              <div className="ft-tags">
                <i>
                  {effect.kind === "globalMul" && `tüm üretim ${formatMultiplier(effect.mul)}`}
                  {effect.kind === "coinValue" && `toplanan değer ${formatMultiplier(effect.mul)}`}
                  {effect.kind === "speciesMul" && `${SPECIES[effect.species].name} ${formatMultiplier(effect.mul)}`}
                  {effect.kind === "flag" && "özel etki"}
                </i>
              </div>
            </div>
            <button className="ft-buy" onClick={() => game.buyDecor(id)}
              disabled={owned || game.state.coins < decor.cost}>
              {owned ? <span>✓</span> : <>
                <span>{formatNumber(decor.cost)}</span>
                <small>YERLEŞTİR</small>
              </>}
            </button>
          </article>
        );
      })}
    </div>
  );
}

// ── Synergies ────────────────────────────────────────────────────────────────

function SynergyTab({ game }: { game: Game }) {
  const active = new Set(game.derived.activeSynergies);
  return (
    <div className="ft-list">
      <div className="ft-list-note">
        Asıl soru şu: <b>hangi balıkları aynı tankta tutarsan sistem kırılır?</b>
      </div>
      {SYNERGIES.map((synergy) => {
        const on = active.has(synergy.id);
        return (
          <article key={synergy.id} className={`ft-card compact synergy${on ? " on" : ""}`}>
            <span className="ft-emoji">{synergy.emoji}</span>
            <div className="ft-card-main">
              <header>
                <b>{synergy.name}</b>
                {on && <span className="ft-owned live">AKTİF</span>}
              </header>
              <p>{synergy.blurb}</p>
              <div className="ft-tags">
                {Object.entries(synergy.req.species ?? {}).map(([id, need]) => {
                  const have = game.fishCounts[id as SpeciesId] ?? 0;
                  return (
                    <i key={id} className={have >= (need ?? 0) ? "met" : ""}>
                      {SPECIES[id as SpeciesId].name} {have}/{need}
                    </i>
                  );
                })}
                {(synergy.req.decor ?? []).map((id) => (
                  <i key={id} className={game.state.decor.includes(id) ? "met" : ""}>
                    {DECOR[id].name}
                  </i>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ── Tank / prestige ──────────────────────────────────────────────────────────

function TankTab({ game }: { game: Game }) {
  const index = game.state.tankIndex;
  const tank = TANKS[index];
  const next = TANKS[index + 1];
  const progress = next ? Math.min(1, game.state.runCoins / tank.moveRequirement) : 1;
  const reward = game.moveTankReward();
  const can = game.canMoveTank();

  return (
    <div className="ft-list">
      <section className="ft-prestige">
        <h3>{tank.emoji} {tank.name}</h3>
        <p>{tank.blurb}</p>
        {next ? (
          <>
            <div className="ft-progress">
              <i style={{ width: `${progress * 100}%` }} />
              <span>
                {formatNumber(game.state.runCoins)} / {formatNumber(tank.moveRequirement)}
              </span>
            </div>
            <div className="ft-prestige-next">
              <div>
                <small>SONRAKİ</small>
                <b>{next.emoji} {next.name}</b>
                <span>{next.fishCap} balık kapasitesi</span>
              </div>
              <div>
                <small>KAZANILACAK ÜN</small>
                <b className="rep">+{formatNumber(reward)}</b>
                <span>kalıcı {formatMultiplier(reputationMultiplier(game.state.reputation + reward))}</span>
              </div>
            </div>
            <button className="ft-move" disabled={!can} onClick={() => game.moveTank()}>
              {can ? "BÜYÜK TANKA TAŞIN" : `${formatNumber(tank.moveRequirement - game.state.runCoins)} para daha`}
            </button>
            <p className="ft-warn">
              Taşınınca balıklar, yükseltmeler ve dekorlar satılır; <b>ün, açılan yemler ve türler kalır</b>.
            </p>
          </>
        ) : (
          <p className="ft-warn">Son tanktasın. Buradan sonrası sadece daha fazlası.</p>
        )}
      </section>

      <section className="ft-group">
        <h3>Tank Zinciri</h3>
        {TANKS.map((t) => (
          <article key={t.index} className={`ft-card compact${t.index === index ? " owned" : ""}${t.index > index ? " locked" : ""}`}>
            <span className="ft-emoji">{t.emoji}</span>
            <div className="ft-card-main">
              <header><b>{t.name}</b><span className="ft-level">{t.fishCap} balık</span></header>
              <p>{t.blurb}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────────

function StatsTab({ game }: { game: Game }) {
  const s = game.state.stats;
  const stages = game.state.fish.reduce<Record<string, number>>((acc, f) => {
    const name = STAGES[f.stage]?.name ?? "Yavru";
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});
  const rows: [string, string][] = [
    ["Toplam kazanç", formatNumber(game.state.allTimeCoins)],
    ["Bu tankta", formatNumber(game.state.runCoins)],
    ["Serpilen yem", formatNumber(s.pelletsDropped)],
    ["Yenen yem", formatNumber(s.pelletsEaten)],
    ["İsabet oranı", s.pelletsDropped > 0 ? formatPercent(s.pelletsEaten / s.pelletsDropped) : "—"],
    ["En yüksek combo", formatNumber(s.bestCombo)],
    ["Frenzy sayısı", formatNumber(s.frenzies)],
    ["Kirpi patlaması", formatNumber(s.popCount)],
    ["Kazı", formatNumber(s.digs)],
    ["Avlanan balık", formatNumber(s.devoured)],
    ["Nadir varyant", formatNumber(s.mutations)],
    ["Oynama süresi", formatDuration(s.playTime)],
    ["Toplam ün", formatNumber(game.state.allTimeReputation)],
  ];
  return (
    <div className="ft-list">
      <section className="ft-group">
        <h3>Kayıtlar</h3>
        <div className="ft-stats">
          {rows.map(([label, value]) => (
            <div key={label}><small>{label}</small><b>{value}</b></div>
          ))}
        </div>
      </section>
      <section className="ft-group">
        <h3>Balık Kademeleri</h3>
        <div className="ft-stats">
          {STAGES.map((stage) => (
            <div key={stage.name}>
              <small>{stage.name} ({formatMultiplier(stage.mul)})</small>
              <b>{stages[stage.name] ?? 0}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
