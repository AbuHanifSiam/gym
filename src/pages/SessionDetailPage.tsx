import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { weekdayNames } from '../../shared/schemas';
import { kgToDisplay, weekdayOf } from '../../shared/time';
import { useMe } from '../api/auth';
import { api } from '../api/client';
import { useExercises } from '../api/exercises';
import { useSessionDetail } from '../api/progress';
import { targetText } from '../components/today/ExerciseCard';
import { formatDuration, sessionStats } from '../workout/session';
import { deleteSession } from '../workout/sync';

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: s, isPending, isError } = useSessionDetail(id);
  const { data: exercises } = useExercises();
  const { data: me } = useMe();
  const units = me?.settings.units ?? 'kg';

  if (isPending) return <p className="text-slate-500">Loading…</p>;
  if (isError || !s)
    return (
      <p>
        Workout not found. <Link to="/progress?tab=history">Back to history</Link>
      </p>
    );

  const byId = new Map((exercises ?? []).map((e) => [e.id, e]));
  const stats = sessionStats(s);
  const duration = s.finishedAt
    ? formatDuration(new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime())
    : 'not finished';

  async function onDelete() {
    if (!confirm('Delete this workout from your history?')) return;
    try {
      await api(`/sessions/${s!.id}`, { method: 'DELETE' });
    } catch {
      alert("Couldn't delete. Check your connection and try again.");
      return;
    }
    deleteSession(s!.id); // also clears this phone's copy
    await qc.invalidateQueries({ queryKey: ['sessions'] });
    await qc.invalidateQueries({ queryKey: ['progress'] });
    navigate('/progress?tab=history', { replace: true });
  }

  return (
    <article className="space-y-4">
      <Link to="/progress?tab=history" className="inline-block py-2 text-sm text-emerald-600">
        ‹ History
      </Link>
      <header>
        <h1 className="text-2xl font-bold">
          {weekdayNames[weekdayOf(s.date)]}, {s.date}
        </h1>
        <p className="text-slate-500">
          {duration} · {stats.doneSets}/{stats.totalSets} sets
          {stats.volumeKg > 0 &&
            ` · ${Math.round(kgToDisplay(stats.volumeKg, units)).toLocaleString()} ${units} volume`}
        </p>
      </header>

      <ol className="space-y-2">
        {s.entries.map((e, i) => {
          const ex = byId.get(e.exerciseId);
          const timed = ex?.measure === 'time' || e.target.durationSec != null;
          const grip = ex?.variations.find((v) => v.key === e.variationKey);
          const done = e.sets.filter((x) => x.done);
          return (
            <li key={i} className="card">
              <div className="flex items-baseline justify-between gap-2">
                <Link
                  to={ex ? `/progress/exercise/${ex.id}` : '#'}
                  className="font-semibold text-emerald-700 dark:text-emerald-400"
                >
                  {ex?.name ?? 'Deleted exercise'}
                </Link>
                <span className="shrink-0 text-xs text-slate-500">
                  target {e.target.sets} × {targetText(e.target, timed)}
                </span>
              </div>
              {grip && <p className="text-sm text-slate-500">{grip.name}</p>}
              {done.length === 0 ? (
                <p className="mt-1 text-sm text-slate-400">Skipped</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {done.map((x) => (
                    <li
                      key={x.setNumber}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm tabular-nums dark:bg-slate-800"
                    >
                      {timed
                        ? `${x.durationSec ?? '–'} s`
                        : `${x.weight != null ? `${kgToDisplay(x.weight, units)} ${units} × ` : ''}${x.reps ?? '–'}`}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <button type="button" className="btn-ghost w-full text-red-600" onClick={onDelete}>
        Delete workout
      </button>
    </article>
  );
}
