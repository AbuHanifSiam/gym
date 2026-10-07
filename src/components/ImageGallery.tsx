import { useEffect, useRef, useState } from 'react';
import type { ExerciseImage } from '../../shared/schemas';

/** Swipeable photo strip; tap a photo to view it full screen. */
export default function ImageGallery({
  images,
  size = 'large',
}: {
  images: ExerciseImage[];
  size?: 'large' | 'small';
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  const large = size === 'large';

  return (
    <>
      <ul
        className={`-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 ${large ? '' : 'mt-2'}`}
        aria-label="Photos"
      >
        {images.map((img, i) => (
          <li key={img.url + i} className={`shrink-0 snap-start ${large ? 'w-[78%]' : 'w-32'}`}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="block w-full overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 dark:ring-slate-800"
              aria-label={`Enlarge photo: ${img.caption || `photo ${i + 1}`}`}
            >
              <img
                src={img.url}
                alt={img.caption}
                loading="lazy"
                className={`w-full object-contain ${large ? 'aspect-[4/3]' : 'aspect-square'}`}
              />
            </button>
            {img.caption && (
              <p
                className={`mt-1 text-slate-600 first-letter:uppercase dark:text-slate-400 ${large ? 'text-sm' : 'text-xs'}`}
              >
                {img.caption}
              </p>
            )}
          </li>
        ))}
      </ul>
      {open !== null && (
        <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: ExerciseImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const img = images[index];
  const go = (d: number) => onIndex((index + d + images.length) % images.length);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto max-h-dvh w-full max-w-xl bg-transparent p-4 backdrop:bg-black/85"
      aria-label="Photo viewer"
    >
      <img src={img.url} alt={img.caption} className="w-full rounded-xl bg-white object-contain" />
      <p className="mt-3 text-center text-white first-letter:uppercase">
        {img.caption}{' '}
        <span className="text-white/60">
          ({index + 1}/{images.length})
        </span>
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" className="btn bg-white/15 text-white" onClick={() => go(-1)}>
          ‹ Prev
        </button>
        <button type="button" className="btn bg-white text-slate-900" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn bg-white/15 text-white" onClick={() => go(1)}>
          Next ›
        </button>
      </div>
    </dialog>
  );
}
