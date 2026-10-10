import { describe, expect, it } from 'vitest';
import {
  ageOn,
  bmi,
  bmiClass,
  bmr,
  calorieAdvice,
  healthyWeightRange,
  kcalFor,
  type Profile,
} from '../shared/nutrition.js';
import { foodLogInputSchema, profileUpdateSchema } from '../shared/schemas.js';
import { searchFoods, seedFood } from '../server/foods.js';
import { seedFoods } from '../server/seed/foods.js';

const man: Profile = { sex: 'male', heightCm: 175, birthDate: '1996-01-01', activity: 'light' };
const TODAY = '2026-10-10';

describe('BMI (WHO, Asian action points)', () => {
  it('computes kg/m²', () => {
    expect(bmi(70, 175)).toBe(22.9);
    expect(bmi(90, 180)).toBe(27.8);
  });

  it('classifies at the 18.5 / 23 / 27.5 boundaries', () => {
    expect(bmiClass(18.4)).toBe('underweight');
    expect(bmiClass(18.5)).toBe('healthy');
    expect(bmiClass(22.9)).toBe('healthy');
    expect(bmiClass(23)).toBe('overweight');
    expect(bmiClass(27.4)).toBe('overweight');
    expect(bmiClass(27.5)).toBe('obese');
  });

  it('gives the healthy weight range for a height', () => {
    expect(healthyWeightRange(175)).toEqual({ min: 56.7, max: 70.1 });
  });
});

describe('energy', () => {
  it('matches the Mifflin-St Jeor equations', () => {
    // 10×70 + 6.25×175 − 5×30 + 5
    expect(bmr('male', 70, 175, 30)).toBe(1648.75);
    // 10×60 + 6.25×165 − 5×25 − 161
    expect(bmr('female', 60, 165, 25)).toBe(1345.25);
  });

  it('counts age in whole years', () => {
    expect(ageOn('1996-10-11', TODAY)).toBe(29);
    expect(ageOn('1996-10-10', TODAY)).toBe(30);
  });
});

describe('calorie advice', () => {
  it('lets a healthy-BMI user choose', () => {
    const keep = calorieAdvice(man, 68, TODAY, 'maintain')!;
    expect(keep).toMatchObject({ bmiClass: 'healthy', goal: 'maintain', recommended: false });
    expect(keep.target).toBe(keep.tdee);
    const gain = calorieAdvice(man, 68, TODAY, 'gain')!;
    expect(Math.abs(gain.target - keep.tdee * 1.1)).toBeLessThanOrEqual(10);
    const lose = calorieAdvice(man, 68, TODAY, 'lose')!;
    expect(lose.target).toBe(keep.tdee - 500);
  });

  it('recommends losing when overweight and a bigger deficit when obese, whatever the choice', () => {
    const over = calorieAdvice(man, 75, TODAY, 'gain')!;
    expect(over).toMatchObject({ bmiClass: 'overweight', goal: 'lose', recommended: true });
    expect(over.tdee - over.target).toBe(500);
    const obese = calorieAdvice({ ...man, activity: 'active' }, 90, TODAY, 'maintain')!;
    expect(obese).toMatchObject({ bmiClass: 'obese', goal: 'lose' });
    expect(obese.tdee - obese.target).toBe(750);
  });

  it('recommends gaining when underweight', () => {
    const under = calorieAdvice(man, 54, TODAY, 'lose')!;
    expect(under).toMatchObject({ bmiClass: 'underweight', goal: 'gain', recommended: true });
    expect(under.target).toBeGreaterThan(under.tdee);
  });

  it('never goes below the safe minimum', () => {
    const small: Profile = {
      sex: 'female',
      heightCm: 150,
      birthDate: '1960-01-01',
      activity: 'sedentary',
    };
    const a = calorieAdvice(small, 54, TODAY, 'lose')!;
    expect(a.bmiClass).toBe('overweight');
    expect(a.target).toBe(1200);
    expect(a.atFloor).toBe(true);
  });

  it('is not given to under-18s and flags extreme BMIs', () => {
    expect(calorieAdvice({ ...man, birthDate: '2010-01-01' }, 60, TODAY, 'maintain')).toBeNull();
    expect(calorieAdvice(man, 105, TODAY, 'lose')!.clinician).toBe(true);
    expect(calorieAdvice(man, 70, TODAY, 'lose')!.clinician).toBe(false);
  });
});

describe('food database', () => {
  it('has unique ids and sane values', () => {
    expect(new Set(seedFoods.map((f) => f.id)).size).toBe(seedFoods.length);
    for (const f of seedFoods) {
      expect(f.kcal).toBeGreaterThanOrEqual(0);
      expect(f.kcal).toBeLessThanOrEqual(900);
      for (const p of f.portions) expect(p.grams).toBeGreaterThan(0);
    }
  });

  it('keeps the published source values', () => {
    // FCT Bangladesh 2013: boiled white rice 111 kcal, boiled lentils 155 kcal per 100 g.
    expect(seedFood('bd-01_0041')?.kcal).toBe(111);
    expect(seedFood('bd-02_0015')?.kcal).toBe(155);
    // USDA SR Legacy 171477: roasted chicken breast 165 kcal.
    expect(seedFood('usda-171477')?.kcal).toBe(165);
  });

  it('finds foods by English or Bangla name, cooked before raw', () => {
    const bhat = searchFoods(seedFoods, 'bhat');
    expect(bhat.length).toBeGreaterThan(0);
    expect(bhat.every((f) => f.local.toLowerCase().includes('bhat'))).toBe(true);
    const rice = searchFoods(seedFoods, 'rice boiled');
    expect(rice[0].name).toMatch(/boiled/);
    expect(searchFoods(seedFoods, 'mosur dal')[0].name).toMatch(/Lentil/);
    expect(searchFoods(seedFoods, 'egg')[0].name).toMatch(/^Egg/);
    expect(searchFoods(seedFoods, ' ')).toEqual([]);
  });

  it('scales calories by weight', () => {
    expect(kcalFor(111, 158)).toBe(175);
  });
});

describe('validation', () => {
  it('rejects implausible profile values and unknown food ids', () => {
    expect(profileUpdateSchema.safeParse({ heightCm: 40 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ heightCm: 172, sex: 'male' }).success).toBe(true);
    const ok = { date: TODAY, foodId: 'bd-01_0041', grams: 158 };
    expect(foodLogInputSchema.safeParse(ok).success).toBe(true);
    expect(foodLogInputSchema.safeParse({ ...ok, foodId: 'x' }).success).toBe(false);
    expect(foodLogInputSchema.safeParse({ ...ok, grams: 0 }).success).toBe(false);
  });
});
