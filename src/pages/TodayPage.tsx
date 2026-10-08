import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  orderedDays,
  weekdayNames,
  type Exercise,
  type TodayResponse,
  type WorkoutSession,
} from '../../shared/schemas';
import { kgToDisplay } from '../../shared/time';
import { useMe } from '../api/auth';
import { useLastPerformance, useToday } from '../api/today';
import EntryActions from '../components/today/EntryActions';
import ExerciseCard from '../components/today/ExerciseCard';
import Toast, { type ToastMessage } from '../components/Toast';
import ExercisePicker from '../components/today/ExercisePicker';
import IntensityChip from '../components/IntensityChip';
import { startRest, stopRest } from '../workout/restTimer';
import {
  addEntry,
  addSet,
  buildSession,
  completeSet,
  formatDuration,
  isLastOpenSet,
  moveEntry,
  newSessionId,
  patchSet,
  removeEntry,
  removeLastSet,
  replaceEntry,
  sessionStats,
  setVariation,
} from '../workout/session';
import {
  deleteSession,
  preferLocal,
  rememberServerSession,
  saveSession,
  useSyncStatus,
} from '../workout/sync';

export default function TodayPage() {
  const [picked, setPicked] = useState<number | null>(null);
  const { data, isPending, isError, refetch } = useToday(picked);
  const { data: me } = useMe();

  if (isPending) return <p className="pt-8 text-center text-slate-500">Loading today's workout…</p>;
  if (isError || !data)
    return (
      <div className="card mt-8 space-y-3 text-center">
        <p>Couldn't load today's workout.</p>
        <button type="button" className="btn-primary w-full" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );

  const t = data.data;
  const weekStart = me?.settings.weekStartDay ?? 6;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-slate-500">
          {weekdayNames[t.todayIndex]}, {t.date}
          {data.offline && ' · offline copy'}
        </p>
        <h1 className="text-2xl font-bold">
          {t.dayIndex === t.todayIndex ? 'Today' : weekdayNames[t.dayIndex]}
          {t.day?.type === 'train' && t.day.label && (
            <span className="text-slate-500"> · {t.day.label}</span>
          )}
        </h1>
      </header>

      {t.plan && (
        <DayPicker
          days={orderedDays(t.plan.days, weekStart)}
          todayIndex={t.todayIndex}
          selected={t.dayIndex}
          onSelect={(d) => setPicked(d === t.todayIndex ? null : d)}
        />
      )}

      {!t.plan ? (
        <div className="card space-y-3 text-center">
          <p>You don't have an active plan.</p>
          <Link to="/plan" className="btn-primary w-full">
            Set up a plan
          </Link>
        </div>
      ) : (
        <Workout
          key={`${t.date}-${t.dayIndex}`}
          today={t}
          units={me?.settings.units ?? 'kg'}
          restDefault={me?.settings.restTimerDefault ?? 60}
          restHeavy={me?.settings.restTimerHeavy ?? 90}
        />
      )}
    </div>
  );
}

function DayPicker({
  days,
  todayIndex,
  selected,
  onSelect,
}: {
  days: NonNullable<TodayResponse['plan']>['days'];
  todayIndex: number;
  selected: number;
  onSelect: (dayIndex: number) => void;
}) {
  return (
    <div
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-1"
      role="group"
      aria-label="Pick a day"
    >
      {days.map((d) => {
        const active = d.dayIndex === selected;
        return (
          <button
            key={d.dayIndex}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(d.dayIndex)}
            className={`relative flex min-h-14 min-w-12 shrink-0 flex-col items-center justify-center rounded-xl px-2 text-xs font-semibold ${
              active
                ? 'bg-emerald-700 text-white'
                : 'bg-white ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:ring-slate-800'
            }`}
          >
            <span>{weekdayNames[d.dayIndex].slice(0, 3)}</span>
            <span
              className={`text-[10px] font-normal ${active ? 'text-white/80' : 'text-slate-500'}`}
            >
              {d.type === 'rest' ? 'rest' : d.intensity === 'hard' ? 'hard' : 'mod'}
            </span>
            {d.dayIndex === todayIndex && (
              <span
                className={`absolute top-1 right-1 size-1.5 rounded-full ${active ? 'bg-white' : 'bg-emerald-500'}`}
                aria-label="today"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function Workout({
  today,
  units,
  restDefault,
  restHeavy,
}: {
  today: TodayResponse;
  units: 'kg' | 'lb';
  restDefault: number;
  restHeavy: number;
}) {
  const [session, setSession] = useState<WorkoutSession | null>(() => {
    if (today.session) rememberServerSession(today.session);
    return preferLocal(today.session, today.date, today.dayIndex);
  });
  const ref = useRef(session);
  const [openIdx, setOpenIdx] = useState<number | null>(() =>
    session ? firstOpenEntry(session) : null,
  );
  // Today's list before Start, so exercises can be swapped, skipped or reordered first.
  const [draft, setDraft] = useState<WorkoutSession | null>(() =>
    today.day?.type === 'train'
      ? buildSession({ planId: today.plan?.id ?? null, date: today.date, day: today.day })
      : null,
  );
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState<{ replaceIdx: number | null } | null>(null);
  // Exercises picked today that the server didn't send with this day.
  const [picked, setPicked] = useState<Exercise[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const exercises = new Map([...today.exercises, ...picked].map((e) => [e.id, e]));
  const listRef = useRef<HTMLOListElement>(null);

  function commit(next: WorkoutSession | null) {
    if (next) {
      next = { ...next, rev: (ref.current?.rev ?? 0) + 1, updatedAt: new Date().toISOString() };
      saveSession(next);
    }
    ref.current = next;
    setSession(next);
  }

  const current = session ?? draft;
  const known = new Set(today.exercises.map((e) => e.id));
  const newIds = [
    ...new Set(current?.entries.map((e) => e.exerciseId).filter((id) => !known.has(id))),
  ];
  const { data: extraLast } = useLastPerformance(newIds, session?.id);
  const last = { ...extraLast, ...today.last };

  /**
   * Applies a list change to the running workout, or to the draft before Start. With a
   * message, confirms it in a toast that can undo the change.
   */
  function change(fn: (s: WorkoutSession) => WorkoutSession, message?: string) {
    const running = ref.current != null;
    const before = ref.current ?? draft;
    if (!before) return;
    if (running) commit(fn(before));
    else setDraft(fn(before));
    if (message) {
      setToast({
        id: (toast?.id ?? 0) + 1,
        text: message,
        onUndo: () => {
          if (running) {
            if (ref.current) commit({ ...before, finishedAt: ref.current.finishedAt });
          } else setDraft(before);
          setOpenIdx(null);
        },
      });
    }
  }

  /** Asks before throwing away sets already logged for an entry. */
  function okToDrop(ei: number, question: string) {
    const logged = current!.entries[ei].sets.filter((x) => x.done).length;
    if (logged === 0) return true;
    return confirm(
      `${question} The ${logged} set${logged > 1 ? 's' : ''} you logged will be removed.`,
    );
  }

  function move(ei: number, dir: -1 | 1) {
    change((s) => moveEntry(s, ei, dir));
    if (openIdx === ei) setOpenIdx(ei + dir);
    else if (openIdx === ei + dir) setOpenIdx(ei);
  }

  function skip(ei: number) {
    const name = exercises.get(current!.entries[ei].exerciseId)?.name ?? 'this exercise';
    if (!okToDrop(ei, `Skip ${name} today?`)) return;
    change((s) => removeEntry(s, ei), `Skipped ${name} for today`);
    if (openIdx === ei) setOpenIdx(null);
    else if (openIdx != null && openIdx > ei) setOpenIdx(openIdx - 1);
  }

  function pick(ex: Exercise) {
    const at = picker?.replaceIdx ?? null;
    if (at != null && !okToDrop(at, `Swap to ${ex.name}?`)) return;
    if (!known.has(ex.id)) setPicked((p) => [...p.filter((x) => x.id !== ex.id), ex]);
    const was = at != null ? exercises.get(current!.entries[at].exerciseId)?.name : undefined;
    change(
      (s) => (at != null ? replaceEntry(s, at, ex) : addEntry(s, ex)),
      at == null
        ? `Added ${ex.name}`
        : was
          ? `Swapped ${was} for ${ex.name}`
          : `Swapped in ${ex.name}`,
    );
    setPicker(null);
  }

  const pickerEl = picker && current && (
    <ExercisePicker
      title={picker.replaceIdx != null ? 'Swap exercise' : 'Add exercise'}
      preferCategory={
        picker.replaceIdx != null
          ? exercises.get(current.entries[picker.replaceIdx]?.exerciseId)?.category
          : undefined
      }
      inWorkout={new Set(current.entries.map((e) => e.exerciseId))}
      onPick={pick}
      onClose={() => setPicker(null)}
    />
  );

  const actionsFor = (ei: number, count: number, name: string) => (
    <EntryActions
      name={name}
      canMoveUp={ei > 0}
      canMoveDown={ei < count - 1}
      onMove={(dir) => move(ei, dir)}
      onReplace={() => setPicker({ replaceIdx: ei })}
      onSkip={() => skip(ei)}
    />
  );

  const editBar = (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-slate-500">
        {editing ? 'Changes apply to today only. Your plan stays the same.' : ''}
      </p>
      <button
        type="button"
        className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold ${
          editing ? 'bg-emerald-700 text-white' : 'text-emerald-700 dark:text-emerald-400'
        }`}
        aria-pressed={editing}
        onClick={() => setEditing((v) => !v)}
      >
        {editing ? 'Done' : '✎ Edit exercises'}
      </button>
    </div>
  );

  const addButton = (
    <button
      type="button"
      className="btn-ghost w-full"
      onClick={() => setPicker({ replaceIdx: null })}
    >
      + Add exercise
    </button>
  );

  // Scroll the newly opened exercise into view.
  useEffect(() => {
    if (openIdx == null) return;
    const el = listRef.current?.children[openIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [openIdx]);

  if (!session) {
    if (!today.day || today.day.type === 'rest' || !draft) return <RestDay />;
    const day = today.day;
    return (
      <div className="space-y-4">
        {day.intensity && (
          <div className="flex items-center gap-2 text-sm">
            <IntensityChip value={day.intensity} />
            <span className="text-slate-500">
              {day.intensity === 'hard'
                ? 'Heavier weight: last 2 reps tough but clean.'
                : 'About 70% of your hard-day weight.'}
            </span>
          </div>
        )}
        {editBar}
        <ol className="card space-y-1.5">
          {draft.entries.length === 0 && (
            <li className="text-sm text-slate-500">No exercises today. Add one to start.</li>
          )}
          {draft.entries.map((entry, i) => {
            const ex = exercises.get(entry.exerciseId);
            const grip = ex?.variations.find((v) => v.key === entry.variationKey);
            return (
              <li
                key={`${i}-${entry.exerciseId}`}
                className={
                  editing
                    ? 'space-y-2 border-b border-slate-200 pb-3 last:border-0 last:pb-0 dark:border-slate-800'
                    : ''
                }
              >
                <div className="flex gap-3 text-sm">
                  <span className="w-5 shrink-0 text-right text-slate-500">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    {ex?.name ?? 'Unknown'}
                    {grip && (
                      <span className="text-emerald-700 dark:text-emerald-400"> · {grip.name}</span>
                    )}
                  </span>
                </div>
                {editing && actionsFor(i, draft.entries.length, ex?.name ?? 'exercise')}
              </li>
            );
          })}
        </ol>
        {editing && addButton}
        <button
          type="button"
          className="btn-primary min-h-16 w-full text-lg"
          disabled={draft.entries.length === 0}
          onClick={() => {
            const now = new Date().toISOString();
            commit({ ...draft, id: newSessionId(), startedAt: now, updatedAt: now, rev: 0 });
            setEditing(false);
            setOpenIdx(0);
          }}
        >
          Start workout
        </button>
        {pickerEl}
        <Toast message={toast} onDismiss={dismissToast} />
      </div>
    );
  }

  const stats = sessionStats(session);
  const finished = session.finishedAt != null;
  const pct = stats.totalSets ? Math.round((stats.doneSets / stats.totalSets) * 100) : 0;

  function toggleSet(ei: number, si: number) {
    const s = ref.current!;
    const set = s.entries[ei].sets[si];
    const ex = exercises.get(s.entries[ei].exerciseId);
    const timed = ex?.measure === 'time' || s.entries[ei].target.durationSec != null;
    if (set.done) {
      commit(patchSet(s, ei, si, { done: false }));
      return;
    }
    const lastOne = isLastOpenSet(s, ei, si);
    const next = completeSet(s, ei, si, last[s.entries[ei].exerciseId], timed);
    commit(next);
    if (!finished && !lastOne) startRest(ex?.heavyRest ? restHeavy : restDefault);
    if (lastOne) stopRest();
    // Exercise complete: move on to the next unfinished one.
    const entry = next.entries[ei];
    if (entry.sets.every((x) => x.done)) setOpenIdx(firstOpenEntry(next, ei));
  }

  function finish() {
    const left = stats.totalSets - stats.doneSets;
    if (left > 0 && !confirm(`${left} set${left > 1 ? 's' : ''} not done. Finish anyway?`)) return;
    stopRest();
    commit({ ...ref.current!, finishedAt: new Date().toISOString() });
    setOpenIdx(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function discard() {
    if (!confirm('Discard this workout? Everything you logged in it will be deleted.')) return;
    stopRest();
    deleteSession(ref.current!.id);
    ref.current = null;
    setSession(null);
  }

  return (
    <div className="space-y-4">
      {finished ? (
        <Summary session={session} units={units} />
      ) : (
        <div className="card space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">
              {stats.doneSets}/{stats.totalSets} sets · {stats.doneExercises}/
              {session.entries.length} exercises
            </span>
            <Elapsed from={session.startedAt} />
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Workout progress"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <SyncBadge />
        </div>
      )}

      {!finished && editBar}

      <ol ref={listRef} className="space-y-2">
        {session.entries.map((entry, ei) => (
          <ExerciseCard
            key={`${ei}-${entry.exerciseId}`}
            index={ei}
            entry={entry}
            exercise={exercises.get(entry.exerciseId)}
            last={last[entry.exerciseId]}
            units={units}
            open={openIdx === ei}
            onToggleOpen={() => setOpenIdx(openIdx === ei ? null : ei)}
            onSetChange={(si, patch) => commit(patchSet(ref.current!, ei, si, patch))}
            onSetToggle={(si) => toggleSet(ei, si)}
            onAddSet={() => commit(addSet(ref.current!, ei))}
            onRemoveSet={() => commit(removeLastSet(ref.current!, ei))}
            onVariation={(key) => commit(setVariation(ref.current!, ei, key))}
            actions={
              editing && !finished
                ? actionsFor(
                    ei,
                    session.entries.length,
                    exercises.get(entry.exerciseId)?.name ?? 'exercise',
                  )
                : undefined
            }
          />
        ))}
      </ol>

      {editing && !finished && addButton}
      {pickerEl}
      <Toast message={toast} onDismiss={dismissToast} />

      {!finished && (
        <button type="button" className="btn-primary min-h-16 w-full text-lg" onClick={finish}>
          Finish workout
        </button>
      )}
      {finished && (
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => commit({ ...ref.current!, finishedAt: null })}
        >
          Reopen workout
        </button>
      )}
      <button
        type="button"
        className="mx-auto block min-h-11 text-sm text-red-600 underline-offset-4 hover:underline"
        onClick={discard}
      >
        Discard workout
      </button>
    </div>
  );
}

function firstOpenEntry(s: WorkoutSession, after = -1): number | null {
  const n = s.entries.length;
  for (let k = 1; k <= n; k++) {
    const i = (after + k) % n;
    if (s.entries[i].sets.some((x) => !x.done)) return i;
  }
  return null;
}

function Elapsed({ from }: { from: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-lg font-bold tabular-nums" aria-label="Workout duration">
      {formatDuration(now - new Date(from).getTime())}
    </span>
  );
}

function SyncBadge() {
  const status = useSyncStatus();
  const text = {
    idle: '',
    saving: 'Saving…',
    saved: '✓ Saved',
    offline: 'Offline · saved on this phone, will sync',
    error: 'Not synced yet · will retry',
  }[status];
  if (!text) return null;
  return (
    <p
      className={`text-xs ${status === 'offline' || status === 'error' ? 'text-amber-600' : 'text-slate-500'}`}
      role="status"
    >
      {text}
    </p>
  );
}

function Summary({ session, units }: { session: WorkoutSession; units: 'kg' | 'lb' }) {
  const stats = sessionStats(session);
  const duration = new Date(session.finishedAt!).getTime() - new Date(session.startedAt).getTime();
  return (
    <div className="card space-y-3 bg-emerald-700 text-white ring-0 dark:bg-emerald-700">
      <p className="text-xl font-bold">Workout done 💪</p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-xs text-white/70 uppercase">Time</dt>
          <dd className="text-xl font-bold tabular-nums">{formatDuration(duration)}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/70 uppercase">Sets</dt>
          <dd className="text-xl font-bold tabular-nums">
            {stats.doneSets}/{stats.totalSets}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/70 uppercase">Volume</dt>
          <dd className="text-xl font-bold tabular-nums">
            {Math.round(kgToDisplay(stats.volumeKg, units)).toLocaleString()}
            <span className="text-sm font-normal"> {units}</span>
          </dd>
        </div>
      </dl>
      <SyncBadge />
    </div>
  );
}

function RestDay() {
  return (
    <div className="card space-y-3">
      <p className="text-xl font-bold">Rest day 🌿</p>
      <p className="text-slate-600 dark:text-slate-300">
        Recovery is when your muscles grow. Keep it light today:
      </p>
      <ul className="space-y-2">
        <li>🚶 Walk 20–30 minutes</li>
        <li>🧘 Stretch for 5–10 minutes</li>
        <li>😴 Sleep 7–9 hours</li>
        <li>💧 Drink plenty of water</li>
      </ul>
      <p className="text-sm text-slate-500">
        Missed a workout? Pick another day above to do it today.
      </p>
    </div>
  );
}
