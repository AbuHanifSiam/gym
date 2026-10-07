import { adjustRest, stopRest, useRestTimer } from '../../workout/restTimer';
import { formatDuration } from '../../workout/session';

export default function RestTimerBar() {
  const t = useRestTimer();
  if (!t) return null;
  const pct = t.total > 0 ? (t.remaining / t.total) * 100 : 0;

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2"
      role="timer"
      aria-live="off"
      aria-label={`Rest ${t.remaining} seconds left`}
    >
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl bg-slate-900 text-white shadow-xl dark:bg-slate-800">
        <div
          className="h-1.5 bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
        <div className="flex items-center gap-2 p-2">
          <div className="min-w-0 flex-1 pl-2">
            <p className="text-xs tracking-wide text-white/60 uppercase">Rest</p>
            <p className="text-3xl font-bold tabular-nums">{formatDuration(t.remaining * 1000)}</p>
          </div>
          <button
            type="button"
            className="btn min-h-14 bg-white/10 px-4"
            onClick={() => adjustRest(-15)}
            aria-label="15 seconds less"
          >
            −15
          </button>
          <button
            type="button"
            className="btn min-h-14 bg-white/10 px-4"
            onClick={() => adjustRest(15)}
            aria-label="15 seconds more"
          >
            +15
          </button>
          <button type="button" className="btn min-h-14 bg-emerald-600 px-4" onClick={stopRest}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
