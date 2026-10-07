import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDeleteExercise, useExercise } from '../api/exercises';
import ImageGallery from '../components/ImageGallery';

function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

export default function ExerciseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: e, isPending, isError } = useExercise(id);
  const del = useDeleteExercise();

  if (isPending) return <p className="text-slate-500">Loading…</p>;
  if (isError || !e)
    return (
      <p>
        Exercise not found. <Link to="/exercises">Back to library</Link>
      </p>
    );

  const embed = e.videoUrl ? youtubeEmbed(e.videoUrl) : null;
  const variationKeys = new Set(e.variations.map((v) => v.key));
  // Photos tied to a grip show under that grip; the rest go in the top gallery.
  const generalImages = e.images.filter((i) => !variationKeys.has(i.variationKey));
  const shown = generalImages.length ? generalImages : e.images;
  const youtubeSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${e.name} proper form beginner`,
  )}`;

  async function onDelete() {
    if (!confirm(`Delete "${e!.name}"? This can't be undone.`)) return;
    await del.mutateAsync(e!.id);
    navigate('/exercises', { replace: true });
  }

  return (
    <article className="space-y-4">
      <Link to="/exercises" className="inline-block py-2 text-sm text-emerald-600">
        ‹ Library
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{e.name}</h1>
        <p className="text-slate-500 capitalize">
          {e.category} · {e.equipment} · {e.measure === 'time' ? 'timed' : 'reps'}
          {e.heavyRest && ' · long rest'}
        </p>
        {e.muscles.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {e.muscles.map((m) => (
              <li
                key={m}
                className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              >
                {m}
              </li>
            ))}
          </ul>
        )}
      </header>

      <ImageGallery images={shown} />

      {e.steps.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">How to</h2>
          <ol className="list-decimal space-y-1.5 pl-5">
            {e.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      {e.variations.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">Grips & variations</h2>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {e.variations.map((v) => (
              <li key={v.key} className="py-2.5">
                <p className="font-medium">{v.name}</p>
                {v.description && <p className="text-sm">{v.description}</p>}
                {v.works && <p className="text-sm text-slate-500">Works: {v.works}</p>}
                <ImageGallery
                  images={e.images.filter((i) => i.variationKey === v.key)}
                  size="small"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <a href={youtubeSearch} target="_blank" rel="noreferrer" className="btn-ghost w-full">
        ▶ Find form videos on YouTube
      </a>

      {embed ? (
        <div className="aspect-video overflow-hidden rounded-2xl">
          <iframe
            src={embed}
            title={`${e.name} video`}
            className="h-full w-full"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : (
        e.videoUrl && (
          <a href={e.videoUrl} target="_blank" rel="noreferrer" className="btn-ghost w-full">
            Watch video ↗
          </a>
        )
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Link to={`/exercises/${e.id}/edit`} className="btn-primary">
          Edit
        </Link>
        <button
          type="button"
          className="btn-ghost text-red-600"
          onClick={onDelete}
          disabled={del.isPending}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
