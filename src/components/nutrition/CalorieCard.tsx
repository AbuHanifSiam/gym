import { useState, type FormEvent } from 'react';
import {
  activityInfo,
  activityLevels,
  BMI_CUTS,
  goals,
  type ActivityLevel,
  type BmiClass,
  type Goal,
  type Sex,
} from '../../../shared/nutrition';
import type { UserProfile } from '../../../shared/schemas';
import { cmToDisplay, displayToCm, kgToDisplay, lengthUnit } from '../../../shared/time';
import { useMe } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useCalorieAdvice, useUpdateProfile } from '../../api/nutrition';
import SourcesNote from './SourcesNote';

const classText: Record<BmiClass, { label: string; tone: string }> = {
  underweight: { label: 'Underweight', tone: 'text-sky-700 dark:text-sky-400' },
  healthy: { label: 'Healthy weight', tone: 'text-emerald-700 dark:text-emerald-400' },
  overweight: { label: 'Overweight', tone: 'text-amber-700 dark:text-amber-400' },
  obese: { label: 'Obese', tone: 'text-red-700 dark:text-red-400' },
};

export const goalText: Record<Goal, string> = {
  lose: 'Lose weight',
  maintain: 'Keep my weight',
  gain: 'Gain weight',
};

/** BMI, what it means, and the daily calorie target (Body page). */
export default function CalorieCard() {
  const { data: me } = useMe();
  const { advice, missing, today } = useCalorieAdvice();
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  if (!me) return null;
  const units = me.settings.units;
  const profileMissing = missing.filter((m) => m !== 'weight');

  if (editing || profileMissing.length > 0) {
    return (
      <ProfileForm
        profile={me.profile}
        units={units}
        today={today}
        intro={
          profileMissing.length > 0
            ? `To show your BMI and daily calories, add your ${profileMissing.join(', ')}.`
            : undefined
        }
        onDone={() => setEditing(false)}
        onCancel={profileMissing.length > 0 ? undefined : () => setEditing(false)}
      />
    );
  }

  if (!advice) {
    return (
      <section className="card text-sm text-slate-600 dark:text-slate-400">
        {missing.includes('weight') ? (
          <p>Log your weight below to see your BMI and daily calories.</p>
        ) : (
          <p>
            BMI and calorie targets here are for adults (18+). For children and teens, growth charts
            are used instead. Please ask a doctor.
          </p>
        )}
        <button
          type="button"
          className="mt-2 font-semibold text-emerald-700 underline dark:text-emerald-400"
          onClick={() => setEditing(true)}
        >
          Edit my details
        </button>
      </section>
    );
  }

  const cls = classText[advice.bmiClass];
  const range = advice.healthyRange;
  const delta = advice.target - advice.tdee;

  return (
    <section className="card space-y-4" aria-labelledby="bmi-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="bmi-title" className="text-xs font-semibold text-slate-500 uppercase">
            BMI
          </h2>
          <p>
            <span className="text-3xl font-bold tabular-nums">{advice.bmi}</span>{' '}
            <span className={`font-semibold ${cls.tone}`}>{cls.label}</span>
          </p>
          <p className="text-xs text-slate-500">
            Healthy for your height: {kgToDisplay(range.min, units)}–{kgToDisplay(range.max, units)}{' '}
            {units}
          </p>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-emerald-700 underline dark:text-emerald-400"
          onClick={() => setEditing(true)}
        >
          Edit details
        </button>
      </div>

      <BmiScale value={advice.bmi} />

      {advice.clinician && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          At this BMI, please plan weight changes with a doctor or dietitian. The numbers below are
          only a rough starting point.
        </p>
      )}

      <div className="space-y-2">
        {advice.recommended ? (
          <p className="text-sm">
            Recommended: <strong>{goalText[advice.goal]}</strong>
            {advice.bmiClass === 'underweight'
              ? ' to reach a healthy BMI.'
              : ` to bring your BMI under ${BMI_CUTS.over}.`}
          </p>
        ) : (
          <div>
            <p className="mb-2 text-sm">Your BMI is healthy. What would you like to do?</p>
            <div
              className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
              role="radiogroup"
              aria-label="Goal"
            >
              {goals.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={advice.goal === g}
                  onClick={() => advice.goal !== g && update.mutate({ goal: g })}
                  className={`min-h-11 rounded-lg text-sm font-semibold ${
                    advice.goal === g
                      ? 'bg-white shadow dark:bg-slate-950'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {g === 'lose' ? 'Lose' : g === 'gain' ? 'Gain' : 'Keep'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950">
          <p className="text-xs font-semibold text-emerald-800 uppercase dark:text-emerald-300">
            Eat about
          </p>
          <p className="text-3xl font-bold text-emerald-900 tabular-nums dark:text-emerald-100">
            {advice.target.toLocaleString()}{' '}
            <span className="text-base font-semibold">kcal / day</span>
          </p>
          <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80">
            {delta === 0
              ? 'Same as you burn, to keep your weight.'
              : delta < 0
                ? `${-delta} kcal less than you burn.`
                : `${delta} kcal more than you burn.`}
          </p>
        </div>

        {advice.atFloor && (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Raised to the safe minimum of {advice.target} kcal. Going lower should only be done with
            medical supervision. Moving more is the safer way to lose faster.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Resting burn (BMR)</dt>
            <dd className="font-semibold tabular-nums">{advice.bmr} kcal</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">
              Daily burn ({activityInfo[me.profile.activity].label.toLowerCase()})
            </dt>
            <dd className="font-semibold tabular-nums">{advice.tdee} kcal</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-500">
          These are estimates: real needs differ by about ±10% from person to person. Weigh yourself
          weekly; if your weight isn't moving as planned after 2–3 weeks, adjust by 100–200 kcal.
        </p>
      </div>

      <SourcesNote />
    </section>
  );
}

function BmiScale({ value }: { value: number }) {
  // 15–35 shown; the marker clamps at the ends.
  const lo = 15;
  const hi = 35;
  const pct = (v: number) => ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 100;
  return (
    <div aria-hidden className="pt-1">
      <div className="relative h-2.5 overflow-hidden rounded-full">
        <div
          className="absolute inset-y-0 left-0 bg-sky-400"
          style={{ width: `${pct(BMI_CUTS.under)}%` }}
        />
        <div
          className="absolute inset-y-0 bg-emerald-500"
          style={{
            left: `${pct(BMI_CUTS.under)}%`,
            width: `${pct(BMI_CUTS.over) - pct(BMI_CUTS.under)}%`,
          }}
        />
        <div
          className="absolute inset-y-0 bg-amber-400"
          style={{
            left: `${pct(BMI_CUTS.over)}%`,
            width: `${pct(BMI_CUTS.obese) - pct(BMI_CUTS.over)}%`,
          }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-red-500"
          style={{ left: `${pct(BMI_CUTS.obese)}%` }}
        />
      </div>
      <div className="relative h-3">
        <div
          className="absolute -top-1 h-0 w-0 -translate-x-1/2 border-x-[6px] border-b-[8px] border-x-transparent border-b-slate-900 dark:border-b-white"
          style={{ left: `${pct(value)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 tabular-nums">
        <span>{lo}</span>
        <span>{BMI_CUTS.under}</span>
        <span>{BMI_CUTS.over}</span>
        <span>{BMI_CUTS.obese}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}

function ProfileForm({
  profile,
  units,
  today,
  intro,
  onDone,
  onCancel,
}: {
  profile: UserProfile;
  units: 'kg' | 'lb';
  today: string;
  intro?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const update = useUpdateProfile();
  const [sex, setSex] = useState<Sex | null>(profile.sex);
  const [height, setHeight] = useState(
    profile.heightCm ? String(cmToDisplay(profile.heightCm, units)) : '',
  );
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '');
  const [activity, setActivity] = useState<ActivityLevel>(profile.activity);
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const h = Number(height);
    if (!sex || !height || !birthDate || !(h > 0)) {
      setError('Please fill in every field.');
      return;
    }
    setError('');
    update.mutate(
      { sex, heightCm: Math.round(displayToCm(h, units) * 10) / 10, birthDate, activity },
      {
        onSuccess: onDone,
        onError: (err) =>
          setError(
            err instanceof ApiError
              ? (Object.values(err.fields)[0] ?? err.message)
              : "Couldn't save.",
          ),
      },
    );
  }

  return (
    <form className="card space-y-3" onSubmit={submit} noValidate>
      <h2 className="font-semibold">Your details</h2>
      {intro && <p className="text-sm text-slate-600 dark:text-slate-400">{intro}</p>}
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Sex</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['male', 'female'] as const).map((s) => (
            <label
              key={s}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 dark:border-slate-700"
            >
              <input type="radio" name="sex" checked={sex === s} onChange={() => setSex(s)} />
              {s === 'male' ? 'Male' : 'Female'}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Used only in the energy formula.</p>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Height ({lengthUnit(units)})</span>
        <input
          className="input"
          inputMode="decimal"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder={units === 'kg' ? 'e.g. 170' : 'e.g. 67'}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Date of birth</span>
        <input
          className="input"
          type="date"
          max={today}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Activity level</span>
        <select
          className="input"
          value={activity}
          onChange={(e) => setActivity(e.target.value as ActivityLevel)}
        >
          {activityLevels.map((a) => (
            <option key={a} value={a}>
              {activityInfo[a].label}: {activityInfo[a].hint}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={update.isPending}>
          Save
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
