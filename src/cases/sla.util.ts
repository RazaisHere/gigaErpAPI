export type SlaBand = 'On track' | 'At risk' | 'Breached';

export function computeSlaBand(
  openedAt: Date,
  targetHours: number,
  escalateAtPercent: number,
  now: Date = new Date(),
): SlaBand {
  const elapsedMs = now.getTime() - openedAt.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  if (elapsedHours >= targetHours) return 'Breached';
  const riskAt = (targetHours * escalateAtPercent) / 100;
  if (elapsedHours >= riskAt) return 'At risk';
  return 'On track';
}
