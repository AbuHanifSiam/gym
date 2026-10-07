import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useMe } from './api/auth';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import ExerciseDetailPage from './pages/ExerciseDetailPage';
import ExerciseFormPage from './pages/ExerciseFormPage';
import ExerciseProgressPage from './pages/ExerciseProgressPage';
import ExercisesPage from './pages/ExercisesPage';
import Placeholder from './pages/Placeholder';
import PlanBuilderPage from './pages/PlanBuilderPage';
import PlansPage from './pages/PlansPage';
import ProgressPage from './pages/ProgressPage';
import SessionDetailPage from './pages/SessionDetailPage';
import SettingsPage from './pages/SettingsPage';
import TodayPage from './pages/TodayPage';

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
          <Route path="/body" element={<Placeholder title="Body log" phase={6} />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
