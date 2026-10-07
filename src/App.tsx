import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useMe } from './api/auth';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Placeholder from './pages/Placeholder';
import SettingsPage from './pages/SettingsPage';

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
          <Route index element={<Placeholder title="Today" phase={4} />} />
          <Route path="/plan" element={<Placeholder title="Plan" phase={3} />} />
          <Route path="/exercises" element={<Placeholder title="Exercises" phase={2} />} />
          <Route path="/exercises/:id" element={<Placeholder title="Exercise" phase={2} />} />
          <Route path="/progress" element={<Placeholder title="Progress" phase={5} />} />
          <Route path="/body" element={<Placeholder title="Body log" phase={6} />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
