/**
 * Active play is a bonus, not the economy. At ×16 the combo alone outweighed a full
 * tier of species and every other decision in the game rounded to noise next to
 * "click faster"; the genre keeps the active-vs-automatic gap in the low single digits.
 */
const COMBO_TIERS = [
  { at: 0, mul: 1 },
  { at: 5, mul: 1.4 },
  { at: 14, mul: 1.8 },
  { at: 30, mul: 2.4 },
  { at: 55, mul: 3.2 },
];
export const FRENZY_AT = 90;
/**
 * Without this the combo bar refills during the frenzy itself and the tank simply
 * never leaves it — which turns the game's biggest moment into its baseline.
 */
export const FRENZY_COOLDOWN = 25;

export function comboMultiplier(combo: number): number {
  let mul = 1;
  for (const tier of COMBO_TIERS) if (combo >= tier.at) mul = tier.mul;
  return mul;
}

export function comboTierProgress(combo: number): { mul: number; next: number; progress: number } {
  let index = 0;
  for (let i = 0; i < COMBO_TIERS.length; i++) if (combo >= COMBO_TIERS[i].at) index = i;
  const mul = COMBO_TIERS[index].mul;
  const from = COMBO_TIERS[index].at;
  const to = index + 1 < COMBO_TIERS.length ? COMBO_TIERS[index + 1].at : FRENZY_AT;
  return { mul, next: to, progress: Math.min(1, (combo - from) / Math.max(1, to - from)) };
}
