const KG_PER_LB = 0.45359237; // exact by definition

// Drops binary floating-point noise (0.30000000000000004 → 0.3).
const clean = (x: number): number => Number(x.toFixed(9));

const round2 = (x: number): number => Math.round(x * 100) / 100;

export function roundToStep(value: number, step: number): number {
  return clean(Math.round(clean(value / step)) * step);
}

export function floorToStep(value: number, step: number): number {
  return clean(Math.floor(clean(value / step)) * step);
}

export function kgToLb(kg: number): number {
  return round2(kg / KG_PER_LB);
}

export function lbToKg(lb: number): number {
  return round2(lb * KG_PER_LB);
}
