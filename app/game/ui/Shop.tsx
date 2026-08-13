"use client";

import { useMemo, useState } from "react";
import {
  CATEGORY_LABELS, DECOR, DECOR_ORDER, SPECIES, SPECIES_ORDER, STAGES, SYNERGIES,
  TANKS, UPGRADES, UPGRADE_ORDER, reputationMultiplier, schoolMultiplier, schoolToMilestone,
} from "../content";
import { formatDuration, formatMultiplier, formatNumber, formatPercent } from "../format";
import type { Game } from "../game";
import { statLabels, useI18n } from "../i18n";
import { speciesPortrait } from "../sprites";
import type { SpeciesId, UpgradeCategory } from "../types";

const TABS = [
  { id: "fish", label: "tabFish", emoji: "🐟" },
  { id: "upgrades", label: "tabUpgrades", emoji: "⚙️" },
  { id: "decor", label: "tabDecor", emoji: "🪸" },
  { id: "synergy", label: "tabSynergy", emoji: "🔗" },
  { id: "tank", label: "tabTank", emoji: "🏆" },
  { id: "stats", label: "tabStats", emoji: "📊" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const portraitCache = new Map<SpeciesId, string>();
function portrait(id: SpeciesId): string {
  let url = portraitCache.get(id);
  if (!url) { url = speciesPortrait(id, 2); portraitCache.set(id, url); }
  return url;
}

export function ShopPanel({ game }: { game: Game }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>("fish");
  const synergyCount = game.derived.activeSynergies.length;
  return (
    <div className="ft-shop-inner">
      <nav className="ft-tabs">
        {TABS.map((item) => (
          <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            <span>{item.emoji}</span>
            {t(item.label)}
            {item.id === "synergy" && synergyCount > 0 && <i className="ft-badge">{synergyCount}</i>}
            {item.id === "tank" && game.canMoveTank() && <i className="ft-badge pulse">!</i>}
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
  const { t } = useI18n();
  const cap = game.derived.fishCap;
  const total = game.live.fishAlive;
  // Keep future species in the list as dark silhouettes so the full collection
  // remains discoverable without making locked fish purchasable.
  const visible = SPECIES_ORDER;
  return (
    <div className="ft-list">
      <div className="ft-list-note">{t("capacity", { current: total, cap })}</div>
      {visible.map((id) => <FishRow key={id} game={game} id={id} />)}
    </div>
  );
}

function FishRow({ game, id }: { game: Game; id: SpeciesId }) {
  const { t, speciesName, speciesBlurb, abilityLabel } = useI18n();
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
          <b>{speciesName(id, def.name)}</b>
          {owned > 0 && <span className="ft-owned">×{owned}</span>}
          {synergy && synergy > 1 && <span className="ft-syn">{formatMultiplier(synergy)}</span>}
        </header>
        <p>{speciesBlurb(id, def.blurb)}</p>
        <div className="ft-tags">
          <i>{formatNumber(throughput)}{t("perSecondShort")}</i>
          <i>{t("perBite", { value: formatNumber(def.baseValue) })}</i>
          {def.abilities.map((a) => <i key={a.kind} className="ability">{abilityLabel(a.kind, ABILITY_LABELS[a.kind])}</i>)}
        </div>
        {unlocked && (owned > 0 || school > 0) && (
          <button
            className="ft-school"
            onClick={() => game.buySchoolLevel(id)}
            disabled={game.state.coins < schoolPrice}
            title={t("breedingHint")}
          >
            <b>{t("breeding", { level: school })}</b>
            <span>
              {formatMultiplier(schoolMultiplier(school))} → {formatMultiplier(schoolMultiplier(school + 1))}
              {schoolToMilestone(school) <= 3 && <i className="ft-milestone"> {t("milestone", { count: schoolToMilestone(school) })}</i>}
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
          title={!unlocked ? t("locked") : full ? t("tankFull") : ""}
        >
          {unlocked ? <>
            <span>{formatNumber(cost)}</span>
            <small>{full ? t("tankFull") : t("buy")}</small>
          </> : <>
            <span>🔒</span>
            <small>TANK {def.tier + 1}</small>
          </>}
        </button>
        {owned > 0 && (
          <button
            className="ft-sell"
            onClick={() => game.sellFish(id)}
            title={t("sellHint")}
          >
            {t("sell", { value: formatNumber(game.sellRefund(id)) })}
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
  const { language, t, categoryLabel, extraText } = useI18n();
  const categories: UpgradeCategory[] = ["feed", "fish", "collect", "auto", "frenzy"];
  return (
    <div className="ft-list">
      {categories.map((category) => {
        const rows = UPGRADE_ORDER.filter((id) => UPGRADES[id].category === category)
          .filter((id) => UPGRADES[id].tier <= game.state.tankIndex + 1 || (game.state.upgrades[id] ?? 0) > 0);
        if (!rows.length) return null;
        return (
          <section key={category} className="ft-group">
            <h3>{categoryLabel(category, CATEGORY_LABELS[category])}</h3>
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
                      <b>{extraText(id, 0, upgrade.name)}</b>
                      {upgrade.maxLevel > 1 && (
                        <span className="ft-level">{level}/{upgrade.maxLevel}</span>
                      )}
                    </header>
                    <p>{language === "tr" && !maxed ? upgrade.detail(level) : extraText(id, 1, upgrade.blurb)}</p>
                    {!available && upgrade.requires?.upgrade && (
                      <p className="ft-req">
                        {t("required")}: {extraText(upgrade.requires.upgrade[0], 0, UPGRADES[upgrade.requires.upgrade[0]].name)} {t("level")}{upgrade.requires.upgrade[1]}
                      </p>
                    )}
                  </div>
                  <button
                    className="ft-buy"
                    onClick={() => game.buyUpgrade(id)}
                    disabled={maxed || !available || game.state.coins < cost}
                  >
                    {maxed ? <span>{t("max")}</span> : <>
                      <span>{formatNumber(cost)}</span>
                      <small>{t("get")}</small>
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
  const { t, extraText, speciesName } = useI18n();
  return (
    <div className="ft-list">
      <div className="ft-list-note">{t("decorNote")}</div>
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
              <header><b>{extraText(id, 0, decor.name)}</b></header>
              <p>{extraText(id, 1, decor.blurb)}</p>
              <div className="ft-tags">
                <i>
                  {effect.kind === "globalMul" && t("allProduction", { value: formatMultiplier(effect.mul) })}
                  {effect.kind === "coinValue" && t("collectedValue", { value: formatMultiplier(effect.mul) })}
                  {effect.kind === "speciesMul" && `${speciesName(effect.species, SPECIES[effect.species].name)} ${formatMultiplier(effect.mul)}`}
                  {effect.kind === "flag" && t("specialEffect")}
                </i>
              </div>
            </div>
            <button className="ft-buy" onClick={() => game.buyDecor(id)}
              disabled={owned || game.state.coins < decor.cost}>
              {owned ? <span>✓</span> : <>
                <span>{formatNumber(decor.cost)}</span>
                <small>{t("place")}</small>
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
  const { t, speciesName, extraText } = useI18n();
  const active = new Set(game.derived.activeSynergies);
  return (
    <div className="ft-list">
      <div className="ft-list-note">{t("synergyNote")}</div>
      {SYNERGIES.map((synergy) => {
        const on = active.has(synergy.id);
        return (
          <article key={synergy.id} className={`ft-card compact synergy${on ? " on" : ""}`}>
            <span className="ft-emoji">{synergy.emoji}</span>
            <div className="ft-card-main">
              <header>
                <b>{extraText(synergy.id, 0, synergy.name)}</b>
                {on && <span className="ft-owned live">{t("active")}</span>}
              </header>
              <p>{extraText(synergy.id, 1, synergy.blurb)}</p>
              <div className="ft-tags">
                {Object.entries(synergy.req.species ?? {}).map(([id, need]) => {
                  const have = game.fishCounts[id as SpeciesId] ?? 0;
                  return (
                    <i key={id} className={have >= (need ?? 0) ? "met" : ""}>
                      {speciesName(id as SpeciesId, SPECIES[id as SpeciesId].name)} {have}/{need}
                    </i>
                  );
                })}
                {(synergy.req.decor ?? []).map((id) => (
                  <i key={id} className={game.state.decor.includes(id) ? "met" : ""}>
                    {extraText(id, 0, DECOR[id].name)}
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
  const { t, tankText } = useI18n();
  const index = game.state.tankIndex;
  const tank = TANKS[index];
  const next = TANKS[index + 1];
  const progress = next ? Math.min(1, game.state.runCoins / tank.moveRequirement) : 1;
  const reward = game.moveTankReward();
  const can = game.canMoveTank();

  return (
    <div className="ft-list">
      <section className="ft-prestige">
        <h3>{tank.emoji} {tankText(tank.index, 0, tank.name)}</h3>
        <p>{tankText(tank.index, 2, tank.blurb)}</p>
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
                <small>{t("next")}</small>
                <b>{next.emoji} {tankText(next.index, 0, next.name)}</b>
                <span>{t("fishCapacity", { count: next.fishCap })}</span>
              </div>
              <div>
                <small>{t("reputationGain")}</small>
                <b className="rep">+{formatNumber(reward)}</b>
                <span>{t("permanent", { value: formatMultiplier(reputationMultiplier(game.state.reputation + reward)) })}</span>
              </div>
            </div>
            <button className="ft-move" disabled={!can} onClick={() => game.moveTank()}>
              {can ? t("move") : t("moneyMore", { value: formatNumber(tank.moveRequirement - game.state.runCoins) })}
            </button>
            <p className="ft-warn">
              {t("moveWarning")}
            </p>
          </>
        ) : (
          <p className="ft-warn">{t("lastTank")}</p>
        )}
      </section>

      <section className="ft-group">
        <h3>{t("tankChain")}</h3>
        {TANKS.map((tankItem) => (
          <article key={tankItem.index} className={`ft-card compact${tankItem.index === index ? " owned" : ""}${tankItem.index > index ? " locked" : ""}`}>
            <span className="ft-emoji">{tankItem.emoji}</span>
            <div className="ft-card-main">
              <header><b>{tankText(tankItem.index, 0, tankItem.name)}</b><span className="ft-level">{t("fishCount", { count: tankItem.fishCap })}</span></header>
              <p>{tankText(tankItem.index, 2, tankItem.blurb)}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────────

function StatsTab({ game }: { game: Game }) {
  const { language, t, stageName } = useI18n();
  const s = game.state.stats;
  const stages = game.state.fish.reduce<Record<string, number>>((acc, f) => {
    const name = STAGES[f.stage]?.name ?? "Yavru";
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});
  const labels = statLabels(language);
  const values = [formatNumber(game.state.allTimeCoins), formatNumber(game.state.runCoins),
    formatNumber(s.pelletsDropped), formatNumber(s.pelletsEaten),
    s.pelletsDropped > 0 ? formatPercent(s.pelletsEaten / s.pelletsDropped) : "—",
    formatNumber(s.bestCombo), formatNumber(s.frenzies), formatNumber(s.popCount), formatNumber(s.digs),
    formatNumber(s.devoured), formatNumber(s.mutations), formatDuration(s.playTime, language),
    formatNumber(game.state.allTimeReputation)];
  const rows: [string, string][] = labels.map((label, index) => [label, values[index]]);
  return (
    <div className="ft-list">
      <section className="ft-group">
        <h3>{t("records")}</h3>
        <div className="ft-stats">
          {rows.map(([label, value]) => (
            <div key={label}><small>{label}</small><b>{value}</b></div>
          ))}
        </div>
      </section>
      <section className="ft-group">
        <h3>{t("fishStages")}</h3>
        <div className="ft-stats">
          {STAGES.map((stage, index) => (
            <div key={stage.name}>
              <small>{stageName(index, stage.name)} ({formatMultiplier(stage.mul)})</small>
              <b>{stages[stage.name] ?? 0}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
