import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { weekdayNames, type SettingsUpdate, type UserSettings } from '../../shared/schemas';
import { localDay } from '../../shared/time';
import { useLogout, useMe } from '../api/auth';
import { useUpdateSettings } from '../api/plans';

const restChoices = [30, 45, 60, 75, 90, 120, 150, 180];

function timezones(current: string): string[] {
  let list: string[];
  try {
    list = Intl.supportedValuesOf('timeZone');
  } catch {
    list = ['Asia/Dhaka', 'UTC'];
  }
  return list.includes(current) ? list : [current, ...list];
}

export default function SettingsPage() {
  const { data: user } = useMe();
  const logout = useLogout();
  const update = useUpdateSettings();
  const qc = useQueryClient();
  const [saved, setSaved] = useState('');
  const s = user?.settings;
  const zones = useMemo(() => timezones(s?.timezone ?? 'Asia/Dhaka'), [s?.timezone]);

  if (!user || !s) return null;

  function change(patch: SettingsUpdate, label: string) {
    setSaved('');
    update.mutate(patch, {
      onSuccess: () => {
        setSaved(`✓ ${label} saved`);
        // Dates, the calendar and charts depend on these settings.
        if ('timezone' in patch || 'weekStartDay' in patch) {
          qc.invalidateQueries({ queryKey: ['today'] });
          qc.invalidateQueries({ queryKey: ['progress'] });
        }
      },
      onError: () => setSaved("Couldn't save. Check your connection."),
    });
  }

  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = localDay(s.timezone);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">More</h1>

      <div className="card">
        <p className="font-semibold">{user.name}</p>
        <p className="text-sm text-slate-500">{user.email}</p>
      </div>

      <Link to="/exercises" className="card flex items-center justify-between font-medium">
        Exercise library <span aria-hidden>›</span>
      </Link>

      <Group title="Appearance">
        <Segmented<UserSettings['theme']>
          label="Theme"
          value={s.theme}
          options={[
            ['light', '☀️ Light'],
            ['dark', '🌙 Dark'],
            ['system', '📱 Auto'],
          ]}
          onChange={(theme) => change({ theme }, 'Theme')}
        />
      </Group>

      <Group title="Units">
        <Segmented<UserSettings['units']>
          label="Weight units"
          value={s.units}
          options={[
            ['kg', 'kg / cm'],
            ['lb', 'lb / in'],
          ]}
          onChange={(units) => change({ units }, 'Units')}
        />
        <p className="text-xs text-slate-500">
          Your data is stored in kg and cm, so you can switch any time without losing anything.
        </p>
      </Group>

      <Group title="Rest timer">
        <Select
          label="Normal rest"
          value={s.restTimerDefault}
          options={restChoices.map((v) => [v, `${v} seconds`])}
          onChange={(v) => change({ restTimerDefault: Number(v) }, 'Rest timer')}
        />
        <Select
          label="Long rest (squats, machines)"
          value={s.restTimerHeavy}
          options={restChoices.map((v) => [v, `${v} seconds`])}
          onChange={(v) => change({ restTimerHeavy: Number(v) }, 'Long rest timer')}
        />
      </Group>

      <Group title="Calendar">
        <Select
          label="Week starts on"
          value={s.weekStartDay}
          options={weekdayNames.map((n, i) => [i, n])}
          onChange={(v) => change({ weekStartDay: Number(v) }, 'Week start')}
        />
        <Select
          label="Timezone"
          value={s.timezone}
          options={zones.map((z) => [z, z.replace(/_/g, ' ')])}
          onChange={(v) => change({ timezone: String(v) }, 'Timezone')}
        />
        <p className="text-xs text-slate-500">
          Today is {weekdayNames[now.dayIndex]}, {now.date} in this timezone.
          {deviceZone && deviceZone !== s.timezone && (
            <>
              {' '}
              Your phone is set to {deviceZone}.{' '}
              <button
                type="button"
                className="font-semibold text-emerald-700 underline dark:text-emerald-400"
                onClick={() => change({ timezone: deviceZone }, 'Timezone')}
              >
                Use phone's timezone
              </button>
            </>
          )}
        </p>
      </Group>

      <Group title="Your data">
        <a href="/api/export" download className="btn-ghost w-full">
          ⬇ Export all my data (JSON)
        </a>
        <p className="text-xs text-slate-500">
          Exercises, plans, every workout and your body log, in one file. Keep it as a backup.
        </p>
      </Group>

      <p className="min-h-5 text-center text-sm text-slate-500" role="status" aria-live="polite">
        {saved}
      </p>

      <button
        type="button"
        className="btn-ghost w-full"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
      >
        Log out
      </button>
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="grid gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="radiogroup"
      aria-label={label}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => value !== v && onChange(v)}
          className={`min-h-11 rounded-lg text-sm font-semibold ${
            value === v ? 'bg-white shadow dark:bg-slate-950' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | number;
  options: [string | number, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
