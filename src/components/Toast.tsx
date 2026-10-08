import { useEffect } from 'react';

export interface ToastMessage {
  /** Changes for every new message so the timer restarts. */
  id: number;
  text: string;
  onUndo?: () => void;
}

const SHOW_MS = 4000;

/**
 * Short confirmation at the top of the screen (the bottom is taken by the nav and rest timer).
 * The live region is always mounted so screen readers announce each new message.
 */
export default function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, SHOW_MS);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-40 px-3"
      role="status"
      aria-live="polite"
    >
      {message && (
        <div
          key={message.id}
          className="toast-in pointer-events-auto mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-900 py-2 pr-2 pl-4 text-sm text-white shadow-xl dark:bg-slate-800"
        >
          <p className="min-w-0 flex-1">{message.text}</p>
          {message.onUndo && (
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-xl px-3 font-semibold text-emerald-300 hover:bg-white/10"
              onClick={() => {
                message.onUndo!();
                onDismiss();
              }}
            >
              Undo
            </button>
          )}
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-xl text-white/60 hover:bg-white/10"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
