/** Per-exercise actions for today only: reorder, swap for another exercise, or skip. */
export default function EntryActions({
  name,
  canMoveUp,
  canMoveDown,
  onMove,
  onReplace,
  onSkip,
}: {
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onReplace: () => void;
  onSkip: () => void;
}) {
  const btn = 'btn-ghost min-h-11 px-2 text-sm';
  return (
    <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={`Change ${name} for today`}>
      <button
        type="button"
        className={btn}
        disabled={!canMoveUp}
        onClick={() => onMove(-1)}
        aria-label={`Move ${name} up`}
      >
        ↑ Up
      </button>
      <button
        type="button"
        className={btn}
        disabled={!canMoveDown}
        onClick={() => onMove(1)}
        aria-label={`Move ${name} down`}
      >
        ↓ Down
      </button>
      <button type="button" className={btn} onClick={onReplace} aria-label={`Swap ${name}`}>
        ⇄ Swap
      </button>
      <button
        type="button"
        className={`${btn} text-red-600`}
        onClick={onSkip}
        aria-label={`Skip ${name} today`}
      >
        ✕ Skip
      </button>
    </div>
  );
}
