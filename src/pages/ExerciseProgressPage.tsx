import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ExercisePoint, PersonalRecord } from '../../shared/progress';
import { kgToDisplay } from '../../shared/time';
import { useMe } from '../api/auth';
import { useExerciseProgress } from '../api/progress';
import TrendChart, { shortDate } from '../components/TrendChart';

type MetricId = 'topWeight' | 'est1rm' | 'bestReps' | 'volume' | 'bestDuration';

interface Metric {
  id: MetricId;
  label: string;
  /** Converts the stored value for display (kg -> user units where relevant). */
  unit: (units: string) => string;
  weighted: boolean;
}

const metrics: Metric[] = [
  { id: 'topWeight', label: 'Top weight', unit: (u) => u, weighted: true },
  { id: 'est1rm', label: 'Est. 1-rep max', unit: (u) => u, weighted: true },
  { id: 'bestReps', label: 'Best reps', unit: () => 'reps', weighted: false },
  { id: 'volume', label: 'Volume', unit: (u) => u, weighted: true },
  { id: 'bestDuration', label: 'Longest hold', unit: () => 's', weighted: false },
];

export default function ExerciseProgressPage() {
  const { id } = useParams();
  const { data, isPending, isError } = useExerciseProgress(id);
  const { data: me } = useMe();
  const units = me?.settings.units ?? 'kg';
  const [picked, setPicked] = useState<MetricId | null>(null);

  if (isPending) return <p className="text-slate-500">Loading…</p>;
  if (isError || !data)
    return (
      <p>
        Couldn't load this exercise. <Link to="/progress?tab=exercises">Back</Link>
      </p>
    );

  const { exercise, points, prs } = data;
  const timed = exercise.measure === 'time';
  const available = metrics.filter((m) =>
    points.some((p) => p[m.id] != null && (p[m.id] as number) > 0),
  );
  const metric =
    available.find((m) => m.id === picked) ??
    available.find((m) => m.id === (timed ? 'bestDuration' : 'topWeight')) ??
    available[0];

  const show = (m: Metric, v: number) => (m.weighted ? kgToDisplay(v, units) : v);
  const series = metric
    ? points
        .filter((p) => p[metric.id] != null)
        .map((p) => ({ date: p.date, value: show(metric, p[metric.id] as number) }))
    : [];

  const grip = (key: string) => exercise.variations.find((v) => v.key === key)?.name;

  return (
    <article className="space-y-4">
      <Link to="/progress?tab=exercises" className="inline-block py-2 text-sm text-emerald-600">
        ‹ Progress
      </Link>
      <h1 className="text-2xl font-bold">{exercise.name}</h1>

      {points.length === 0 ? (
        <div className="card text-center text-slate-500">
          No completed sets yet. Your progress shows up here after your first workout.
        </div>
      ) : (
        <>
          <section aria-labelledby="prs">
            <h2 id="prs" className="mb-2 font-semibold">
              Personal records
            </h2>
            <dl className="grid grid-cols-2 gap-2">
              {!timed && (
                <PrTile
                  label="Heaviest"
                  pr={prs.heaviest}
                  format={(r) =>
                    `${kgToDisplay(r.value, units)} ${units}${r.reps ? ` × ${r.reps}` : ''}`
                  }
                />
              )}
              {!timed && (
                <PrTile
                  label="Est. 1-rep max"
                  pr={prs.est1rm}
                  format={(r) => `${kgToDisplay(r.value, units)} ${units}`}
                />
              )}
              {!timed && (
                <PrTile label="Most reps" pr={prs.mostReps} format={(r) => `${r.value}`} />
              )}
              {!timed && (
                <PrTile
                  label="Best volume"
                  pr={prs.volume}
                  format={(r) =>
                    `${Math.round(kgToDisplay(r.value, units)).toLocaleString()} ${units}`
                  }
                />
              )}
              {(timed || prs.longest) && (
                <PrTile label="Longest hold" pr={prs.longest} format={(r) => `${r.value} s`} />
              )}
            </dl>
          </section>

          {metric && (
            <section className="card space-y-3" aria-labelledby="chart-title">
              <div
                className="-mx-1 flex gap-1.5 overflow-x-auto px-1"
                role="group"
                aria-label="Metric"
              >
                {available.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={m.id === metric.id}
                    onClick={() => setPicked(m.id)}
                    className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-medium ${
                      m.id === metric.id
                        ? 'bg-emerald-600 text-white'
                        : 'ring-1 ring-slate-300 dark:ring-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <h2 id="chart-title" className="font-semibold">
                {metric.label}{' '}
                <span className="font-normal text-slate-500">({metric.unit(units)})</span>
              </h2>
              {series.length < 2 ? (
                <p className="text-sm text-slate-500">
                  One workout logged so far: {series[0]?.value} {metric.unit(units)}. The chart
                  appears after your second.
                </p>
              ) : (
                <TrendChart
                  data={series}
                  unit={metric.unit(units)}
                  label={`${metric.label} over time`}
                  decimals={metric.weighted}
                />
              )}
            </section>
          )}

          <section aria-labelledby="sessions-title">
            <h2 id="sessions-title" className="mb-2 font-semibold">
              Workouts
            </h2>
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Date
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Sets
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {[...points].reverse().map((p) => (
                    <tr key={p.sessionId + p.variationKey}>
                      <td className="px-4 py-2 align-top whitespace-nowrap">
                        <Link
                          to={`/progress/session/${p.sessionId}`}
                          className="font-medium text-emerald-700 dark:text-emerald-400"
                        >
                          {shortDate(p.date)}
                        </Link>
                        {grip(p.variationKey) && (
                          <span className="block text-xs text-slate-500">
                            {grip(p.variationKey)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 tabular-nums">{setsText(p, units, timed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </article>
  );
}

function setsText(p: ExercisePoint, units: 'kg' | 'lb', timed: boolean): string {
  return p.sets
    .map((s) =>
      timed
        ? `${s.durationSec ?? '–'}s`
        : `${s.weight != null ? `${kgToDisplay(s.weight, units)}×` : ''}${s.reps ?? '–'}`,
    )
    .join(', ');
}

function PrTile({
  label,
  pr,
  format,
}: {
  label: string;
  pr: PersonalRecord | null;
  format: (pr: PersonalRecord) => string;
}) {
  return (
    <div className="card">
      <dt className="text-xs font-semibold text-slate-500 uppercase">🏆 {label}</dt>
      <dd className="mt-1">
        {pr ? (
          <>
            <span className="block text-xl font-bold tabular-nums">{format(pr)}</span>
            <span className="text-xs text-slate-500">{shortDate(pr.date)}</span>
          </>
        ) : (
          <span className="text-slate-400">–</span>
        )}
      </dd>
    </div>
  );
}
