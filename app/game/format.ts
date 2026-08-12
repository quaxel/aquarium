// Number presentation for the HUD. Incremental games live and die on whether a
// glance at the coin counter tells you how rich you are, so short scale suffixes
// kick in early and the mantissa keeps three significant digits throughout.

const SUFFIXES = [
  "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No",
  "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc", "SpDc", "OcDc", "NoDc", "Vg",
];

export function formatNumber(value: number, forceDecimals = false): string {
  if (!Number.isFinite(value)) return "∞";
  const sign = value < 0 ? "-" : "";
  const n = Math.abs(value);
  if (n < 1000) {
    if (n === 0) return "0";
    if (n < 10 && (forceDecimals || n % 1 !== 0)) return sign + n.toFixed(n < 1 ? 2 : 1);
    return sign + Math.floor(n).toString();
  }
  const tier = Math.min(Math.floor(Math.log10(n) / 3), SUFFIXES.length - 1);
  const scaled = n / Math.pow(1000, tier);
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return sign + scaled.toFixed(digits) + SUFFIXES[tier];
}

/** Rates read better with a decimal even when small, e.g. "3.4/sn". */
export function formatRate(value: number): string {
  if (value === 0) return "0";
  if (value < 100) return formatNumber(value, true);
  return formatNumber(value);
}

export function formatMultiplier(value: number): string {
  if (value < 10) return `×${value.toFixed(2).replace(/\.?0+$/, "")}`;
  return `×${formatNumber(value)}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0sn";
  const s = Math.floor(seconds);
  if (s < 60) return `${s}sn`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}dk ${s % 60}sn`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa ${m % 60}dk`;
  return `${Math.floor(h / 24)}g ${h % 24}sa`;
}

export function formatPercent(value: number, digits = 0): string {
  return `%${(value * 100).toFixed(digits)}`;
}
