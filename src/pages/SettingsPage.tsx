import { Link } from 'react-router-dom';
import { useLogout, useMe } from '../api/auth';

export default function SettingsPage() {
  const { data: user } = useMe();
  const logout = useLogout();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">More</h1>
      <div className="card">
        <p className="font-semibold">{user?.name}</p>
        <p className="text-sm text-slate-500">{user?.email}</p>
      </div>
      <Link to="/exercises" className="card block font-medium">
        Exercise library →
      </Link>
      <div className="card text-sm text-slate-500">Settings arrive in phase 7.</div>
      <button
        type="button"
        className="btn-ghost w-full"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
      >
        Log out
      </button>
    </section>
  );
}
