import { describe, expect, it } from 'vitest';
import { bodyLogInputSchema } from '../shared/schemas.js';
import { cmToDisplay, displayToCm, displayToKg, kgToDisplay } from '../shared/time.js';

describe('body log validation', () => {
  it('accepts weight only, or measurements only', () => {
    expect(bodyLogInputSchema.parse({ date: '2026-10-07', weight: 72.5 })).toMatchObject({
      weight: 72.5,
      measurements: { chest: null, waist: null, arm: null, thigh: null },
    });
    expect(
      bodyLogInputSchema.safeParse({
        date: '2026-10-07',
        measurements: { waist: 82, chest: null, arm: null, thigh: null },
      }).success,
    ).toBe(true);
  });

  it('rejects an empty entry and bad dates', () => {
    expect(bodyLogInputSchema.safeParse({ date: '2026-10-07' }).success).toBe(false);
    expect(bodyLogInputSchema.safeParse({ date: '07/10/2026', weight: 70 }).success).toBe(false);
  });
});

describe('length units', () => {
  it('round-trips inches', () => {
    expect(cmToDisplay(2.54, 'lb')).toBe(1);
    expect(cmToDisplay(displayToCm(15, 'lb'), 'lb')).toBe(15);
    expect(cmToDisplay(40, 'kg')).toBe(40);
  });

  it('round-trips body weight in lb', () => {
    expect(kgToDisplay(displayToKg(165.4, 'lb'), 'lb')).toBe(165.4);
  });
});
