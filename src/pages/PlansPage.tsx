import { Link, useNavigate } from 'react-router-dom';
import { emptyWeek } from '../../shared/schemas';
import { useActivatePlan, useCreateDefaultPlan, useCreatePlan, usePlans } from '../api/plans';

export default function PlansPage() {
  const navigate = useNavigate();
  const { data: plans, isPending, isError } = usePlans();
  const create = useCreatePlan();
  const createDefault = useCreateDefaultPlan();
  const activate = useActivatePlan();

  async function newPlan() {
    const { plan } = await create.mutateAsync({ name: 'My plan', days: emptyWeek() });
    navigate(`/plan/${plan.id}`);
  }

  async function newDefault() {
    const { plan } = await createDefault.mutateAsync(undefined);
    navigate(`/plan/${plan.id}`);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Plans</h1>
        <button
          type="button"
          className="btn-primary min-h-11 px-4"
          onClick={newPlan}
          disabled={create.isPending}
        >
          + New
        </button>
      </div>

      {isPending && <p className="text-slate-500">Loading…</p>}
      {isError && <p className="text-red-600">Couldn't load plans.</p>}

      {plans?.length === 0 && (
        <div className="card space-y-3 text-center">
          <p>You don't have a plan yet.</p>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={newDefault}
            disabled={createDefault.isPending}
          >
            {createDefault.isPending ? 'Creating…' : 'Load "Beginner Month 1"'}
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {plans?.map((p) => (
          <li key={p.id} className="card flex items-center gap-3">
            <Link to={`/plan/${p.id}`} className="min-w-0 flex-1 py-1">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="text-sm text-slate-500">{p.trainingDays} training days / week</p>
            </Link>
            {p.isActive ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                Active
              </span>
            ) : (
              <button
                type="button"
                className="btn-ghost min-h-11 px-3 text-sm"
                onClick={() => activate.mutate(p.id)}
                disabled={activate.isPending}
              >
                Make active
              </button>
            )}
          </li>
        ))}
      </ul>

      {plans && plans.length > 0 && (
        <div className="pt-2 text-center">
          <button
            type="button"
            className="text-sm font-medium text-emerald-600 underline-offset-4 hover:underline"
            onClick={newDefault}
            disabled={createDefault.isPending}
          >
            Add a fresh copy of "Beginner Month 1"
          </button>
        </div>
      )}

      <Link to="/exercises" className="card block font-medium">
        Exercise library →
      </Link>
    </section>
  );
}
