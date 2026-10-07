import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  categories,
  equipments,
  exerciseInputSchema,
  type Exercise,
  type ExerciseInput,
  type ExerciseImage,
  type Variation,
} from '../../shared/schemas';
import { ApiError } from '../api/client';
import { useExercise, useSaveExercise } from '../api/exercises';

interface FormState {
  name: string;
  category: ExerciseInput['category'];
  equipment: ExerciseInput['equipment'];
  measure: ExerciseInput['measure'];
  heavyRest: boolean;
  muscles: string;
  steps: string;
  variations: Variation[];
  images: ExerciseImage[];
  videoUrl: string;
}

function toForm(e?: Exercise): FormState {
  return {
    name: e?.name ?? '',
    category: e?.category ?? 'push',
    equipment: e?.equipment ?? 'machine',
    measure: e?.measure ?? 'reps',
    heavyRest: e?.heavyRest ?? false,
    muscles: e?.muscles.join(', ') ?? '',
    steps: e?.steps.join('\n') ?? '',
    variations: e?.variations ?? [],
    images: e?.images ?? [],
    videoUrl: e?.videoUrl ?? '',
  };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

export default function ExerciseFormPage() {
  const { id } = useParams();
  const { data: existing, isPending } = useExercise(id);
  if (id && isPending) return <p className="text-slate-500">Loading…</p>;
  // key resets the form state if the loaded exercise changes
  return <ExerciseForm key={existing?.id ?? 'new'} existing={existing} />;
}

function ExerciseForm({ existing }: { existing?: Exercise }) {
  const navigate = useNavigate();
  const save = useSaveExercise();
  const [f, setF] = useState<FormState>(() => toForm(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const setVar = (i: number, patch: Partial<Variation>) =>
    set(
      'variations',
      f.variations.map((v, j) => (j === i ? { ...v, ...patch } : v)),
    );

  const setImg = (i: number, patch: Partial<ExerciseImage>) =>
    set(
      'images',
      f.images.map((img, j) => (j === i ? { ...img, ...patch } : img)),
    );

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setMessage('');
    const parsed = exerciseInputSchema.safeParse({
      ...f,
      muscles: f.muscles
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
      steps: f.steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      variations: f.variations.map((v) => ({ ...v, key: v.key || slug(v.name) })),
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path.join('.')] ??= i.message;
      setErrors(errs);
      setMessage('Please fix the highlighted fields.');
      return;
    }
    setErrors({});
    try {
      const { exercise } = await save.mutateAsync({ id: existing?.id, input: parsed.data });
      navigate(`/exercises/${exercise.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setMessage(err.message);
      } else setMessage('Something went wrong');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Link
        to={existing ? `/exercises/${existing.id}` : '/exercises'}
        className="inline-block py-2 text-sm text-emerald-600"
      >
        ‹ Cancel
      </Link>
      <h1 className="text-2xl font-bold">{existing ? 'Edit exercise' : 'New exercise'}</h1>

      <Field label="Name" error={errors.name} id="name">
        <input
          id="name"
          className="input"
          value={f.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" id="category">
          <select
            id="category"
            className="input capitalize"
            value={f.category}
            onChange={(e) => set('category', e.target.value as FormState['category'])}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Equipment" id="equipment">
          <select
            id="equipment"
            className="input capitalize"
            value={f.equipment}
            onChange={(e) => set('equipment', e.target.value as FormState['equipment'])}
          >
            {equipments.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Track by" id="measure">
          <select
            id="measure"
            className="input"
            value={f.measure}
            onChange={(e) => set('measure', e.target.value as FormState['measure'])}
          >
            <option value="reps">Reps</option>
            <option value="time">Time (seconds)</option>
          </select>
        </Field>
        <label className="flex min-h-12 items-center gap-3 self-end">
          <input
            type="checkbox"
            className="size-6 accent-emerald-600"
            checked={f.heavyRest}
            onChange={(e) => set('heavyRest', e.target.checked)}
          />
          <span className="text-sm font-medium">Long rest</span>
        </label>
      </div>

      <Field label="Muscles worked (comma separated)" id="muscles" error={errors.muscles}>
        <input
          id="muscles"
          className="input"
          value={f.muscles}
          onChange={(e) => set('muscles', e.target.value)}
        />
      </Field>

      <Field label="How-to steps (one per line)" id="steps" error={errors.steps}>
        <textarea
          id="steps"
          rows={5}
          className="input py-3"
          value={f.steps}
          onChange={(e) => set('steps', e.target.value)}
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Grips & variations</legend>
        {errors.variations && <p className="text-sm text-red-600">{errors.variations}</p>}
        {f.variations.map((v, i) => (
          <div key={i} className="card space-y-2">
            <div className="flex gap-2">
              <input
                aria-label={`Variation ${i + 1} name`}
                className="input"
                placeholder="Name, e.g. Wide overhand"
                value={v.name}
                // Existing keys stay stable (plans refer to them); new ones get a key on save.
                onChange={(e) => setVar(i, { name: e.target.value })}
              />
              <button
                type="button"
                className="btn-ghost shrink-0 px-4 text-red-600"
                aria-label={`Remove variation ${v.name || i + 1}`}
                onClick={() =>
                  set(
                    'variations',
                    f.variations.filter((_, j) => j !== i),
                  )
                }
              >
                ✕
              </button>
            </div>
            {errors[`variations.${i}.name`] && (
              <p className="text-sm text-red-600">{errors[`variations.${i}.name`]}</p>
            )}
            <input
              aria-label={`Variation ${i + 1} hand position`}
              className="input"
              placeholder="Hand position"
              value={v.description}
              onChange={(e) => setVar(i, { description: e.target.value })}
            />
            <input
              aria-label={`Variation ${i + 1} works`}
              className="input"
              placeholder="What it works"
              value={v.works}
              onChange={(e) => setVar(i, { works: e.target.value })}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() =>
            set('variations', [...f.variations, { key: '', name: '', description: '', works: '' }])
          }
        >
          + Add variation
        </button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Photos (start, end, other angles)</legend>
        {f.images.map((img, i) => (
          <div key={i} className="card flex gap-3">
            {img.url ? (
              <img
                src={img.url}
                alt=""
                className="size-20 shrink-0 rounded-lg bg-white object-contain ring-1 ring-slate-200 dark:ring-slate-700"
              />
            ) : (
              <div className="size-20 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800" />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <input
                aria-label={`Photo ${i + 1} link`}
                type="url"
                className="input"
                placeholder="https://… image link"
                value={img.url}
                onChange={(e) => setImg(i, { url: e.target.value })}
              />
              {errors[`images.${i}.url`] && (
                <p className="text-sm text-red-600">{errors[`images.${i}.url`]}</p>
              )}
              <input
                aria-label={`Photo ${i + 1} caption`}
                className="input"
                placeholder="Caption, e.g. Side view"
                value={img.caption}
                onChange={(e) => setImg(i, { caption: e.target.value })}
              />
              <div className="flex gap-2">
                <select
                  aria-label={`Photo ${i + 1} grip`}
                  className="input"
                  value={img.variationKey}
                  onChange={(e) => setImg(i, { variationKey: e.target.value })}
                >
                  <option value="">All grips</option>
                  {f.variations
                    .filter((v) => v.key)
                    .map((v) => (
                      <option key={v.key} value={v.key}>
                        {v.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-4 text-red-600"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() =>
                    set(
                      'images',
                      f.images.filter((_, j) => j !== i),
                    )
                  }
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => set('images', [...f.images, { url: '', caption: '', variationKey: '' }])}
        >
          + Add photo
        </button>
      </fieldset>

      <Field label="YouTube link (optional)" id="videoUrl" error={errors.videoUrl}>
        <input
          id="videoUrl"
          type="url"
          className="input"
          value={f.videoUrl}
          onChange={(e) => set('videoUrl', e.target.value)}
        />
      </Field>

      {message && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {message}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
