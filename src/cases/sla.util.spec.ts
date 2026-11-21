import { computeSlaBand } from './sla.util';

describe('computeSlaBand', () => {
  const opened = new Date('2026-01-01T00:00:00Z');

  it('is On track early', () => {
    const now = new Date('2026-01-01T10:00:00Z'); // 10h of 48
    expect(computeSlaBand(opened, 48, 80, now)).toBe('On track');
  });

  it('is At risk past escalate percent', () => {
    const now = new Date('2026-01-02T15:00:00Z'); // 39h of 48 (>80%)
    expect(computeSlaBand(opened, 48, 80, now)).toBe('At risk');
  });

  it('is Breached past target', () => {
    const now = new Date('2026-01-04T00:00:00Z'); // 72h
    expect(computeSlaBand(opened, 48, 80, now)).toBe('Breached');
  });
});
