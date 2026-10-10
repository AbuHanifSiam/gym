// Body-mass index, energy needs and calorie targets.
//
// Every constant below comes from a primary source; see `nutritionSources` (also shown in the app).

export const sexes = ['male', 'female'] as const;
export type Sex = (typeof sexes)[number];

export const goals = ['lose', 'maintain', 'gain'] as const;
export type Goal = (typeof goals)[number];

export const activityLevels = ['sedentary', 'light', 'active', 'vigorous'] as const;
export type ActivityLevel = (typeof activityLevels)[number];

/**
 * Physical activity level (PAL = total energy expenditure / BMR).
 * FAO/WHO/UNU 2004, Table 5.3: sedentary/light 1.40–1.69, active 1.70–1.99, vigorous 2.00–2.40.
 * "sedentary" uses the bottom of the first band, the rest use each band's midpoint.
 */
export const activityInfo: Record<ActivityLevel, { pal: number; label: string; hint: string }> = {
  sedentary: { pal: 1.4, label: 'Sedentary', hint: 'Desk work, little walking, no exercise' },
  light: {
    pal: 1.55,
    label: 'Lightly active',
    hint: 'Desk work plus some walking or light exercise',
  },
  active: { pal: 1.85, label: 'Active', hint: 'On your feet most of the day, or train ~1 h daily' },
  vigorous: {
    pal: 2.2,
    label: 'Very active',
    hint: 'Heavy manual work, or hard training 2 h daily',
  },
};

// ---------- BMI ----------

export type BmiClass = 'underweight' | 'healthy' | 'overweight' | 'obese';

/** kg / m², one decimal. */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/**
 * WHO cut-offs with the public-health action points for Asian populations
 * (WHO Expert Consultation, Lancet 2004;363:157–63): 18.5, 23, 27.5.
 */
export const BMI_CUTS = { under: 18.5, over: 23, obese: 27.5 } as const;

export function bmiClass(value: number): BmiClass {
  if (value < BMI_CUTS.under) return 'underweight';
  if (value < BMI_CUTS.over) return 'healthy';
  if (value < BMI_CUTS.obese) return 'overweight';
  return 'obese';
}

/** Weight range (kg) that gives a healthy BMI at this height. */
export function healthyWeightRange(heightCm: number): { min: number; max: number } {
  const m2 = (heightCm / 100) ** 2;
  return {
    min: Math.round(BMI_CUTS.under * m2 * 10) / 10,
    max: Math.round((BMI_CUTS.over - 0.1) * m2 * 10) / 10,
  };
}

/**
 * Outside this range a generic calculator is not appropriate: WHO grades BMI < 17 as moderate or
 * severe thinness, and 32.5 is the next Asian action point (Lancet 2004).
 */
export function needsClinician(value: number): boolean {
  return value < 17 || value >= 32.5;
}

// ---------- Energy ----------

/** Whole years between a YYYY-MM-DD birth date and `today`. */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Mifflin-St Jeor resting energy expenditure, kcal/day (Am J Clin Nutr 1990;51:241–7). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/**
 * Lowest daily intake for an unsupervised weight-loss diet: the bottom of the 2013 AHA/ACC/TOS
 * ranges (1200–1500 kcal women, 1500–1800 kcal men; Jensen et al., Circulation 2014;129:S102).
 */
export const CALORIE_FLOOR: Record<Sex, number> = { female: 1200, male: 1500 };

/** 2013 AHA/ACC/TOS guideline: an energy deficit of 500 or 750 kcal/day. */
export const DEFICIT = { standard: 500, obese: 750 } as const;

/**
 * Surplus for gaining weight: 10–20% above maintenance (Iraki et al., Sports 2019;7:154).
 * 10% for a lean gain at a healthy BMI, 15% (midpoint) when underweight.
 */
export const SURPLUS = { healthy: 0.1, underweight: 0.15 } as const;

export interface Profile {
  sex: Sex;
  heightCm: number;
  birthDate: string;
  activity: ActivityLevel;
}

export interface CalorieAdvice {
  bmi: number;
  bmiClass: BmiClass;
  healthyRange: { min: number; max: number };
  /** The goal the target was computed for: forced by BMI, or the user's choice when healthy. */
  goal: Goal;
  /** True when the goal comes from BMI instead of the user's choice. */
  recommended: boolean;
  bmr: number;
  tdee: number;
  target: number;
  /** Target raised to the safe minimum (deficit would go below it). */
  atFloor: boolean;
  clinician: boolean;
}

const round10 = (n: number) => Math.round(n / 10) * 10;

/**
 * Daily calorie target. Overweight/obese → lose, underweight → gain, healthy → the user's choice.
 * Returns null for anyone under 18: adult equations and BMI cut-offs don't apply to children.
 */
export function calorieAdvice(
  profile: Profile,
  weightKg: number,
  today: string,
  chosenGoal: Goal,
): CalorieAdvice | null {
  const age = ageOn(profile.birthDate, today);
  if (age < 18) return null;
  const value = bmi(weightKg, profile.heightCm);
  const cls = bmiClass(value);
  const goal: Goal = cls === 'underweight' ? 'gain' : cls === 'healthy' ? chosenGoal : 'lose';
  const base = bmr(profile.sex, weightKg, profile.heightCm, age);
  const tdee = base * activityInfo[profile.activity].pal;

  let target = tdee;
  let atFloor = false;
  if (goal === 'lose') {
    target = tdee - (cls === 'obese' ? DEFICIT.obese : DEFICIT.standard);
    const floor = CALORIE_FLOOR[profile.sex];
    if (target < floor) {
      target = floor;
      atFloor = true;
    }
  } else if (goal === 'gain') {
    target = tdee * (1 + (cls === 'underweight' ? SURPLUS.underweight : SURPLUS.healthy));
  }

  return {
    bmi: value,
    bmiClass: cls,
    healthyRange: healthyWeightRange(profile.heightCm),
    goal,
    recommended: cls !== 'healthy',
    bmr: Math.round(base),
    tdee: round10(tdee),
    target: round10(target),
    atFloor,
    clinician: needsClinician(value),
  };
}

// ---------- Foods ----------

export interface FoodPortion {
  label: string;
  grams: number;
}

/** Nutrients per 100 g (edible portion). null = not analysed in the source. */
export interface FoodSeed {
  id: string;
  name: string;
  /** Bangla name (transliterated) for Bangladeshi foods. */
  local: string;
  group: string;
  source: 'bd' | 'usda' | 'custom';
  kcal: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fibre: number | null;
  portions: FoodPortion[];
}

export function kcalFor(kcalPer100g: number, grams: number): number {
  return Math.round((kcalPer100g * grams) / 100);
}

export function gramsOf(per100g: number | null, grams: number): number | null {
  return per100g == null ? null : Math.round((per100g * grams) / 10) / 10;
}

export const foodSourceLabel: Record<FoodSeed['source'], string> = {
  bd: 'Food Composition Table for Bangladesh (2013)',
  usda: 'USDA FoodData Central (SR Legacy)',
  custom: 'Added by you',
};

export const nutritionSources = [
  {
    use: 'BMI categories (Asian action points 23 and 27.5)',
    cite: 'WHO Expert Consultation. Appropriate body-mass index for Asian populations. Lancet 2004;363:157–63.',
    url: 'https://doi.org/10.1016/S0140-6736(03)15268-3',
  },
  {
    use: 'Resting energy (BMR)',
    cite: 'Mifflin MD, St Jeor ST, et al. A new predictive equation for resting energy expenditure. Am J Clin Nutr 1990;51:241–7.',
    url: 'https://doi.org/10.1093/ajcn/51.2.241',
  },
  {
    use: 'Activity multipliers (PAL)',
    cite: 'FAO/WHO/UNU. Human energy requirements. FAO Food and Nutrition Technical Report Series 1, 2004 (Table 5.3).',
    url: 'https://www.fao.org/4/y5686e/y5686e07.htm',
  },
  {
    use: 'Weight loss: 500–750 kcal/day deficit, minimum intake',
    cite: 'Jensen MD, et al. 2013 AHA/ACC/TOS Guideline for the Management of Overweight and Obesity in Adults. Circulation 2014;129(25 Suppl 2):S102–38.',
    url: 'https://doi.org/10.1161/01.cir.0000437739.71477.ee',
  },
  {
    use: 'Weight gain: 10–20% surplus',
    cite: 'Iraki J, Fitschen P, Espinar S, Helms E. Nutrition Recommendations for Bodybuilders in the Off-Season: A Narrative Review. Sports 2019;7(7):154.',
    url: 'https://doi.org/10.3390/sports7070154',
  },
  {
    use: 'Bangladeshi food values',
    cite: 'Shaheen N, et al. Food Composition Table for Bangladesh. INFS, University of Dhaka, 2013 (FAO/INFOODS).',
    url: 'https://www.fao.org/infoods/infoods/tables-and-databases/asia/en/',
  },
  {
    use: 'Other food values and portion weights',
    cite: 'U.S. Department of Agriculture. FoodData Central, SR Legacy, 2018.',
    url: 'https://fdc.nal.usda.gov/',
  },
] as const;
