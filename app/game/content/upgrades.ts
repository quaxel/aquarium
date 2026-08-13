import type { Upgrade, UpgradeId } from "../types";

// Every upgrade has to change something you can see in the water. "+%20 gelir" is
// banned: a level either drops more pellets, moves the fish differently, adds a
// machine to the tank, or changes how the frenzy behaves.
//
// ── Pricing ──────────────────────────────────────────────────────────────────
// `share` is the level-1 price as a multiple of the tank's **total output** — every
// fish counted, at its growth stage and breeding level (see `tankOutput` in game.ts).
//
// Three wrong anchors were tried first, and each failed in its own instructive way:
//
//   Absolute numbers. Income multiplies ~200× per tank while upgrades are re-bought
//   every run, so a fixed price can only ever be right for one tier. Measured: all 26
//   upgrades reached max level on 0.4% of a run's income and none of them was a
//   decision any more.
//
//   The tank's bar. Right for a run's *total* income, badly wrong for its start — the
//   bar jumps 200× the instant you move tanks while you begin the new run with no
//   coins and one goldfish. Upgrades went unaffordable early and trivial late, which
//   is exactly backwards.
//
//   The best fish you own. Every run opens with a single goldfish, so the whole board
//   cost a few hundred coins for the first minutes and got maxed out before the
//   roster ever improved — measured, 26/26 maxed in four of seven tanks.
//
// Summing the tank fixes all three: the price climbs continuously as you buy fish,
// level them and let them grow, and it resets with the roster when you move tanks.
//
// No share goes below 0.01. Below that the first level was so cheap that "buy the
// cheapest upgrade" beat every other purchase in the game — measured, that funnelled
// 82% of all spending into upgrades and starved both the roster and the breeding
// programme.

// The anchor arrives already in coins — see `Game.upgradeAnchor`.

export const UPGRADES: Record<UpgradeId, Upgrade> = {
  // ── Besleme ────────────────────────────────────────────────────────────────
  doubleFeed: {
    id: "doubleFeed", name: "Çift Yem", emoji: "✌️", category: "feed",
    share: 0.02, costGrowth: 2.6, maxLevel: 4, tier: 0,
    blurb: "Tek tıklamada bir yem daha düşer.",
    detail: (l) => `Tıklama başına ${1 + l} → ${2 + l} yem`,
  },
  scatterFeed: {
    id: "scatterFeed", name: "Serpme", emoji: "🌾", category: "feed",
    share: 0.05, costGrowth: 3, maxLevel: 3, tier: 3,
    blurb: "Avuç dolusu yem, geniş bir yayla suya saçılır.",
    detail: (l) => `+2 yem ve daha geniş dağılım (seviye ${l + 1})`,
    requires: { upgrade: ["doubleFeed", 2] },
  },
  feedSpeed: {
    id: "feedSpeed", name: "Hızlı El", emoji: "⚡", category: "feed",
    share: 0.014, costGrowth: 2.2, maxLevel: 6, tier: 0,
    blurb: "İki serpme arasındaki bekleme kısalır — combo daha hızlı tırmanır.",
    detail: (l) => `Serpme aralığı %${Math.round((1 - Math.pow(0.87, l + 1)) * 100)} daha kısa`,
  },
  sinkSlow: {
    id: "sinkSlow", name: "Yüzen Yem", emoji: "🫧", category: "feed",
    share: 0.012, costGrowth: 2, maxLevel: 5, tier: 1,
    blurb: "Yem daha yavaş batar; balıkların yetişme şansı artar.",
    detail: (l) => `Batma hızı %${Math.round((1 - Math.pow(0.84, l + 1)) * 100)} daha yavaş`,
  },

  // ── Balıklar ───────────────────────────────────────────────────────────────
  hungryFish: {
    id: "hungryFish", name: "Aç Balık", emoji: "😤", category: "fish",
    share: 0.01, costGrowth: 2, maxLevel: 8, tier: 0,
    blurb: "Balık yemi gördüğü an üzerine saldırır.",
    detail: (l) => `Algı menzili ve atılma hızı ×${(1 + (l + 1) * 0.18).toFixed(2)}`,
  },
  wideMouth: {
    id: "wideMouth", name: "Geniş Ağız", emoji: "😮", category: "fish",
    share: 0.016, costGrowth: 2.2, maxLevel: 6, tier: 1,
    blurb: "Çiğneme süresi düşer, sıradaki lokmaya daha çabuk geçilir.",
    detail: (l) => `Çiğneme %${Math.round((1 - Math.pow(0.88, l + 1)) * 100)} daha kısa`,
  },
  metabolism: {
    id: "metabolism", name: "Metabolizma", emoji: "🏊", category: "fish",
    share: 0.013, costGrowth: 2, maxLevel: 6, tier: 1,
    blurb: "Bütün tank hızlanır. Kalabalıkta gözle görülür bir fark.",
    detail: (l) => `Yüzme hızı ×${(1 + (l + 1) * 0.13).toFixed(2)}`,
  },
  heater: {
    id: "heater", name: "Isıtıcı", emoji: "🌡️", category: "fish",
    share: 0.012, costGrowth: 2.2, maxLevel: 5, tier: 2,
    blurb: "Sıcak su: daha hızlı sindirim, daha hızlı büyüme.",
    detail: (l) => `Büyüme ×${(1 + (l + 1) * 0.2).toFixed(2)}, çiğneme %${Math.round((1 - Math.pow(0.93, l + 1)) * 100)} kısa`,
  },
  growthHormone: {
    id: "growthHormone", name: "Büyüme Takviyesi", emoji: "💉", category: "fish",
    share: 0.014, costGrowth: 2.3, maxLevel: 6, tier: 2,
    blurb: "Balıklar kademe atlamak için daha az lokmaya ihtiyaç duyar.",
    detail: (l) => `Kazanılan XP ×${(1 + (l + 1) * 0.3).toFixed(2)}`,
  },
  breeding: {
    id: "breeding", name: "Üreme Programı", emoji: "🥚", category: "fish",
    share: 0.03, costGrowth: 2.6, maxLevel: 5, tier: 4,
    blurb: "Tank dolana kadar balıklar kendi kendine çoğalır.",
    detail: (l) => `Her ${Math.round(150 / (l + 1))} saniyede bir yavru`,
  },

  // ── Toplama ────────────────────────────────────────────────────────────────
  coinMagnet: {
    id: "coinMagnet", name: "Para Mıknatısı", emoji: "🧲", category: "collect",
    share: 0.012, costGrowth: 2, maxLevel: 6, tier: 1,
    blurb: "İmlecin çevresindeki paralar kendiliğinden cebe girer.",
    detail: (l) => `Mıknatıs yarıçapı ${(0.7 + (l + 1) * 0.55).toFixed(1)} birim`,
  },
  freshCatch: {
    id: "freshCatch", name: "Taze Toplama", emoji: "👆", category: "collect",
    share: 0.01, costGrowth: 2, maxLevel: 5, tier: 1,
    blurb: "Elle tıklanan para daha çok eder — tembelliğin bedeli var.",
    detail: (l) => `Elle toplamada +%${(l + 1) * 18} değer`,
  },
  glassPolish: {
    id: "glassPolish", name: "Otomatik Kasa", emoji: "🏦", category: "collect",
    share: 0.015, costGrowth: 2.2, maxLevel: 4, tier: 2,
    blurb: "Toplanmayan paralar daha erken kasaya düşer.",
    detail: (l) => `Otomatik toplama ${Math.max(1.2, 5 - (l + 1) * 1).toFixed(1)} saniyede`,
  },
  goldenPoop: {
    id: "goldenPoop", name: "Altın Sindirim", emoji: "💩", category: "collect",
    share: 0.012, costGrowth: 2.3, maxLevel: 5, tier: 2,
    blurb: "Balıklar ara sıra sikke yerine külçe bırakır.",
    detail: (l) => `Her lokmada %${(l + 1) * 3} altın sikke şansı (×9 değer)`,
  },
  bubbleCollector: {
    id: "bubbleCollector", name: "Baloncuk Toplayıcı", emoji: "🎈", category: "collect",
    share: 0.016, costGrowth: 2.4, maxLevel: 4, tier: 2,
    blurb: "Yükselen baloncuklar para taşımaya başlar.",
    detail: (l) => `Baloncuk geliri ×${(l + 1) * 1.4} ve daha sık`,
  },
  airStone: {
    id: "airStone", name: "Hava Taşı", emoji: "💨", category: "collect",
    share: 0.016, costGrowth: 2.1, maxLevel: 5, tier: 3,
    blurb: "Daha çok baloncuk: hem manzara hem gelir.",
    detail: (l) => `Baloncuk yoğunluğu ×${(1 + (l + 1) * 0.5).toFixed(1)}`,
    requires: { upgrade: ["bubbleCollector", 1] },
  },

  // ── Otomasyon ──────────────────────────────────────────────────────────────
  autoFeeder: {
    id: "autoFeeder", name: "Otomatik Yemlik", emoji: "🤖", category: "auto",
    share: 0.03, costGrowth: 1, maxLevel: 1, tier: 2,
    blurb: "tak... tak... tak... Artık yem kendi kendine düşüyor.",
    detail: () => "Otomatik beslemeyi açar",
  },
  feederRate: {
    id: "feederRate", name: "Yemlik Hızı", emoji: "⏱️", category: "auto",
    share: 0.012, costGrowth: 1.9, maxLevel: 10, tier: 2,
    blurb: "Yemlik daha sık bırakır.",
    detail: (l) => `Saniyede ${(0.55 * Math.pow(1.2, l + 1)).toFixed(2)} serpme`,
    requires: { upgrade: ["autoFeeder", 1] },
  },
  feederSpread: {
    id: "feederSpread", name: "Yemlik Ağzı", emoji: "🕳️", category: "auto",
    share: 0.02, costGrowth: 2.4, maxLevel: 5, tier: 3,
    blurb: "Tek seferde daha çok yem, tankın her yerine.",
    detail: (l) => `Serpme başına +${l + 1} yem`,
    requires: { upgrade: ["autoFeeder", 1] },
  },
  smartFeeder: {
    id: "smartFeeder", name: "Akıllı Yemlik", emoji: "🧠", category: "auto",
    share: 0.05, costGrowth: 1, maxLevel: 1, tier: 4,
    blurb: "Yemlik artık boş suya değil, en aç balığın burnuna nişan alıyor.",
    detail: () => "Yemler doğrudan boştaki balıklara düşer",
    requires: { upgrade: ["feederRate", 4] },
  },
  filter: {
    id: "filter", name: "Filtre", emoji: "🌀", category: "auto",
    share: 0.013, costGrowth: 2, maxLevel: 6, tier: 2,
    blurb: "Çürüyen yemin bıraktığı kiri sürekli temizler.",
    detail: (l) => `Saniyede %${((l + 1) * 1.2).toFixed(1)} kir temizler`,
  },
  // ── Çılgınlık ──────────────────────────────────────────────────────────────
  comboGrace: {
    id: "comboGrace", name: "Combo Toleransı", emoji: "⏳", category: "frenzy",
    share: 0.014, costGrowth: 2.1, maxLevel: 6, tier: 2,
    blurb: "Combo sayacı daha geç sıfırlanır.",
    detail: (l) => `Combo penceresi ${(1.9 + (l + 1) * 0.32).toFixed(2)} saniye`,
  },
  comboRamp: {
    id: "comboRamp", name: "Combo Rampası", emoji: "📈", category: "frenzy",
    share: 0.014, costGrowth: 2.3, maxLevel: 6, tier: 3,
    blurb: "Her lokma combo sayacını daha çok ilerletir.",
    detail: (l) => `Lokma başına ×${(1 + (l + 1) * 0.2).toFixed(2)} combo`,
  },
  frenzyLength: {
    id: "frenzyLength", name: "Uzun Frenzy", emoji: "🕒", category: "frenzy",
    share: 0.018, costGrowth: 2.4, maxLevel: 6, tier: 3,
    blurb: "Çılgınlık daha uzun sürer.",
    detail: (l) => `Frenzy süresi ${20 + (l + 1) * 5} saniye`,
  },
  frenzyPower: {
    id: "frenzyPower", name: "Frenzy Gücü", emoji: "🔥", category: "frenzy",
    share: 0.03, costGrowth: 2.6, maxLevel: 6, tier: 4,
    blurb: "Çılgınlık sırasındaki çarpan yükselir.",
    detail: (l) => `Frenzy çarpanı ×${(6 * (1 + (l + 1) * 0.35)).toFixed(1)}`,
  },
};

export const UPGRADE_ORDER: UpgradeId[] = [
  "doubleFeed", "feedSpeed", "hungryFish", "sinkSlow", "wideMouth", "metabolism",
  "freshCatch", "coinMagnet", "heater", "growthHormone", "filter", "goldenPoop",
  "glassPolish", "autoFeeder", "feederRate", "bubbleCollector", "comboGrace",
  "airStone", "scatterFeed", "feederSpread", "comboRamp", "frenzyLength",
  "frenzyPower", "breeding", "smartFeeder",
];

export const CATEGORY_LABELS: Record<Upgrade["category"], string> = {
  feed: "Besleme",
  fish: "Balıklar",
  collect: "Toplama",
  auto: "Otomasyon",
  frenzy: "Çılgınlık",
  tank: "Tank",
};

export function upgradeCost(id: UpgradeId, level: number, anchor: number): number {
  const u = UPGRADES[id];
  return Math.ceil(u.share * anchor * Math.pow(u.costGrowth, level));
}
