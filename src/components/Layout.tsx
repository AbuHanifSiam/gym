import { Suspense, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import RestTimerBar from './today/RestTimerBar';

const tabs = [
  { to: '/', label: 'Today', icon: '🏋️', end: true },
  { to: '/plan', label: 'Plan', icon: '🗓️' },
  { to: '/progress', label: 'Progress', icon: '📈' },
  { to: '/body', label: 'Body', icon: '⚖️' },
  { to: '/settings', label: 'More', icon: '⋯' },
];

const titles: [RegExp, string][] = [
  [/^\/$/, 'Today'],
  [/^\/plan/, 'Plan'],
  [/^\/exercises/, 'Exercises'],
  [/^\/progress/, 'Progress'],
  [/^\/body/, 'Body'],
  [/^\/settings/, 'Settings'],
];

/** Gives each screen its own tab title, which screen readers announce on navigation. */
function usePageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = titles.find(([re]) => re.test(pathname))?.[1];
    document.title = t ? `${t} · Gym Tracker` : 'Gym Tracker';
  }, [pathname]);
}

export default function Layout() {
  usePageTitle();
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <main className="flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
        <Suspense fallback={<p className="pt-8 text-center text-slate-500">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <RestTimerBar />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                    isActive
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`
                }
              >
                <span aria-hidden className="text-xl leading-none">
                  {t.icon}
                </span>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
