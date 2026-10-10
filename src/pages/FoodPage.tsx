import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { foodSourceLabel, gramsOf, kcalFor, type FoodSeed } from '../../shared/nutrition';
import { meals, type FoodLogEntry } from '../../shared/schemas';
import { ApiError } from '../api/client';
import {
  useAddCustomFood,
  useAddFoodLog,
  useCalorieAdvice,
  useDeleteFoodLog,
  useFoodLog,
  useFoodSearch,
} from '../api/nutrition';
import { goalText } from '../components/nutrition/CalorieCard';
import SourcesNote from '../components/nutrition/SourcesNote';

type Meal = (typeof meals)[number];
const mealLabel: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/** Breakfast before 11, lunch before 16, dinner from 19, otherwise snack. */
function mealNow(): Meal {
  const h = new Date().getHours();
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 19 || h < 4) return 'dinner';
  return 'snack';
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function FoodPage() {
  const { advice, today } = useCalorieAdvice();
  const { data: entries } = useFoodLog(today);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<FoodSeed | null>(null);
  const [addingOwn, setAddingOwn] = useState(false);
  const q = useDebounced(query, 250);
  const search = useFoodSearch(q);

  const eaten = (entries ?? []).reduce((s, e) => s + e.kcal, 0);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Food</h1>

      <DayTotal eaten={eaten} target={advice?.target ?? null} goal={advice?.goal} />

      {picked ? (
        <FoodDetail food={picked} date={today} onClose={() => setPicked(null)} />
      ) : addingOwn ? (
        <CustomFoodForm
          initialName={query}
          onDone={(food) => {
            setAddingOwn(false);
            if (food) setPicked(food);
          }}
        />
      ) : (
        <section className="card space-y-3" aria-labelledby="food-search">
          <h2 id="food-search" className="font-semibold">
            What did you eat?
          </h2>
          <input
            className="input"
            type="search"
            placeholder="e.g. bhat, dal, egg, rui, banana"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search foods"
            autoComplete="off"
          />
          {q.trim().length >= 2 && (
            <ResultList
              foods={search.data ?? []}
              loading={search.isFetching && !search.data}
              onPick={setPicked}
            />
          )}
          <button
            type="button"
            className="text-sm font-semibold text-emerald-700 underline dark:text-emerald-400"
            onClick={() => setAddingOwn(true)}
          >
            Can't find it? Add your own food (from a packet label)
          </button>
        </section>
      )}

      <DayLog date={today} entries={entries ?? []} />

      <div className="card">
        <SourcesNote />
      </div>
    </section>
  );
}

function DayTotal({
  eaten,
  target,
  goal,
}: {
  eaten: number;
  target: number | null;
  goal?: keyof typeof goalText;
}) {
  if (target == null) {
    return (
      <div className="card text-sm">
        <p>
          <span className="text-2xl font-bold tabular-nums">{eaten}</span> kcal eaten today
        </p>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          <Link
            to="/body"
            className="font-semibold text-emerald-700 underline dark:text-emerald-400"
          >
            Set up your body details
          </Link>{' '}
          to get a daily calorie target.
        </p>
      </div>
    );
  }
  const left = target - eaten;
  const pct = Math.min(100, (eaten / target) * 100);
  const over = left < 0;
  return (
    <div className="card space-y-2" aria-live="polite">
      <div className="flex items-end justify-between">
        <p>
          <span className="text-3xl font-bold tabular-nums">{eaten}</span>
          <span className="text-slate-500"> / {target} kcal</span>
        </p>
        <p
          className={`text-sm font-semibold ${over ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}
        >
          {over ? `${-left} over` : `${left} left`}
        </p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {goal && <p className="text-xs text-slate-500">Goal: {goalText[goal]}</p>}
    </div>
  );
}

function ResultList({
  foods,
  loading,
  onPick,
}: {
  foods: FoodSeed[];
  loading: boolean;
  onPick: (f: FoodSeed) => void;
}) {
  if (loading) return <p className="text-sm text-slate-500">Searching…</p>;
  if (!foods.length) return <p className="text-sm text-slate-500">No matching food.</p>;
  return (
    <ul className="-mx-2 max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
      {foods.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => onPick(f)}
          >
            <span className="min-w-0">
              <span className="block font-medium">{f.name}</span>
              {f.local && <span className="block truncate text-xs text-slate-500">{f.local}</span>}
            </span>
            <span className="shrink-0 text-right text-sm tabular-nums">
              {f.kcal}
              <span className="block text-[10px] text-slate-500">kcal/100 g</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Shows calories for an amount. Nothing is logged until "Add to today". */
function FoodDetail({
  food,
  date,
  onClose,
}: {
  food: FoodSeed;
  date: string;
  onClose: () => void;
}) {
  const add = useAddFoodLog();
  // Portion index into food.portions; -1 = grams.
  const [portion, setPortion] = useState(food.portions.length ? 0 : -1);
  const [amount, setAmount] = useState(food.portions.length ? '1' : '100');
  const [meal, setMeal] = useState<Meal>(mealNow);
  const [error, setError] = useState('');

  const n = Number(amount);
  const valid = n > 0 && n <= (portion === -1 ? 5000 : 50);
  const grams = valid
    ? Math.round((portion === -1 ? n : n * food.portions[portion].grams) * 10) / 10
    : 0;
  const portionText = portion === -1 ? `${grams} g` : `${n} × ${food.portions[portion].label}`;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || grams > 5000) return setError('Enter an amount.');
    setError('');
    add.mutate(
      { date, foodId: food.id, grams, portion: portionText, meal },
      {
        onSuccess: onClose,
        onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't add."),
      },
    );
  }

  const macro = (label: string, per100: number | null) =>
    per100 == null ? null : (
      <div>
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="font-semibold tabular-nums">{gramsOf(per100, grams)} g</dd>
      </div>
    );

  return (
    <form className="card space-y-3" onSubmit={submit}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{food.name}</h2>
          {food.local && <p className="text-xs text-slate-500">{food.local}</p>}
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-slate-500 underline"
          onClick={onClose}
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-[6rem_1fr] gap-2">
        <label>
          <span className="sr-only">Amount</span>
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Unit</span>
          <select
            className="input"
            value={portion}
            onChange={(e) => {
              const p = Number(e.target.value);
              setPortion(p);
              setAmount(p === -1 ? String(grams || 100) : '1');
            }}
          >
            {food.portions.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label} ({p.grams} g)
              </option>
            ))}
            <option value={-1}>grams</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
        <p className="text-3xl font-bold tabular-nums">
          {valid ? kcalFor(food.kcal, grams) : '–'}{' '}
          <span className="text-base font-semibold">kcal</span>
        </p>
        {valid && (
          <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
            {macro('Protein', food.protein)}
            {macro('Carbs', food.carbs)}
            {macro('Fat', food.fat)}
          </dl>
        )}
        <p className="mt-2 text-xs text-slate-500">
          {food.kcal} kcal per 100 g{food.source === 'bd' ? ' (edible part)' : ''} ·{' '}
          {foodSourceLabel[food.source]}
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Meal</span>
        <select className="input" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
          {meals.map((m) => (
            <option key={m} value={m}>
              {mealLabel[m]}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={!valid || add.isPending}>
        + Add to today
      </button>
    </form>
  );
}

function DayLog({ date, entries }: { date: string; entries: FoodLogEntry[] }) {
  const del = useDeleteFoodLog(date);
  if (!entries.length) {
    return <p className="text-center text-sm text-slate-500">Nothing logged today yet.</p>;
  }
  return (
    <section className="space-y-3" aria-label="Today's food">
      {meals.map((m) => {
        const list = entries.filter((e) => e.meal === m);
        if (!list.length) return null;
        return (
          <div key={m} className="card">
            <h2 className="mb-1 flex justify-between text-sm font-semibold">
              {mealLabel[m]}
              <span className="tabular-nums text-slate-500">
                {list.reduce((s, e) => s + e.kcal, 0)} kcal
              </span>
            </h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{e.name}</span>
                    <span className="block text-xs text-slate-500">{e.portion}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums">{e.kcal}</span>
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label={`Remove ${e.name}`}
                      onClick={() => del.mutate(e.id)}
                      disabled={del.isPending}
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function CustomFoodForm({
  initialName,
  onDone,
}: {
  initialName: string;
  onDone: (food: FoodSeed | null) => void;
}) {
  const add = useAddCustomFood();
  const [name, setName] = useState(initialName);
  const [kcal, setKcal] = useState('');
  const [serving, setServing] = useState('');
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const k = Number(kcal);
    const s = Number(serving);
    if (!name.trim() || !kcal || !(k >= 0) || k > 900) {
      return setError('Enter a name and kcal per 100 g (0–900).');
    }
    setError('');
    add.mutate(
      {
        name,
        kcal: k,
        protein: null,
        fat: null,
        carbs: null,
        fibre: null,
        portions: s > 0 ? [{ label: '1 serving', grams: s }] : [],
      },
      {
        onSuccess: ({ food }) => onDone(food),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't save."),
      },
    );
  }

  return (
    <form className="card space-y-3" onSubmit={submit} noValidate>
      <h2 className="font-semibold">Add your own food</h2>
      <p className="text-xs text-slate-500">
        Copy the numbers from the nutrition label on the packet.
      </p>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Energy per 100 g (kcal)</span>
        <input
          className="input"
          inputMode="decimal"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Serving size in grams (optional)</span>
        <input
          className="input"
          inputMode="decimal"
          value={serving}
          onChange={(e) => setServing(e.target.value)}
        />
      </label>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={add.isPending}>
          Save food
        </button>
        <button type="button" className="btn-ghost" onClick={() => onDone(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
