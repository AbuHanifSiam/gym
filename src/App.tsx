import { lazy } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useMe } from './api/auth';
import { useTheme } from './theme';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import TodayPage from './pages/TodayPage';

// Today and login load first; other screens (charts, drag-and-drop) load when opened.
const BodyPage = lazy(() => import('./pages/BodyPage'));
const ExerciseDetailPage = lazy(() => import('./pages/ExerciseDetailPage'));
const ExerciseFormPage = lazy(() => import('./pages/ExerciseFormPage'));
const FoodPage = lazy(() => import('./pages/FoodPage'));
const ExercisesPage = lazy(() => import('./pages/ExercisesPage'));
const PlanBuilderPage = lazy(() => import('./pages/PlanBuilderPage'));
const PlansPage = lazy(() => import('./pages/PlansPage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const SessionDetailPage = lazy(() => import('./pages/SessionDetailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ExerciseProgressPage = lazy(() => import('./pages/ExerciseProgressPage'));

function RequireAuth() {
  const { data: user, isPending, isError } = useMe();
  if (isPending) return <FullScreenMessage text="Loading…" />;
  if (isError) return <FullScreenMessage text="Can't reach the server. Pull to refresh." />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function GuestOnly() {
  const { data: user, isPending } = useMe();
  if (isPending) return <FullScreenMessage text="Loading…" />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

function FullScreenMessage({ text }: { text: string }) {
  return <div className="grid min-h-dvh place-items-center p-6 text-slate-500">{text}</div>;
}

export default function App() {
  const { data: me } = useMe();
  useTheme(me?.settings.theme);
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="/plan" element={<PlansPage />} />
          <Route path="/plan/:id" element={<PlanBuilderPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/exercises/new" element={<ExerciseFormPage />} />
          <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
          <Route path="/exercises/:id/edit" element={<ExerciseFormPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/progress/exercise/:id" element={<ExerciseProgressPage />} />
          <Route path="/progress/session/:id" element={<SessionDetailPage />} />
          <Route path="/body" element={<BodyPage />} />
          <Route path="/food" element={<FoodPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
