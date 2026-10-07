import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { loginSchema, registerSchema } from '../../shared/schemas';
import { useAuthConfig, useLogin, useRegister } from '../api/auth';
import { ApiError } from '../api/client';

type Mode = 'login' | 'register';

export default function AuthPage({ mode }: { mode: Mode }) {
  const isRegister = mode === 'register';
  const login = useLogin();
  const register = useRegister();
  const { data: config } = useAuthConfig();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const pending = login.isPending || register.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    const parsed = (isRegister ? registerSchema : loginSchema).safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setFields(errs);
      return;
    }
    setFields({});
    try {
      if (isRegister) await register.mutateAsync(parsed.data as typeof form);
      else await login.mutateAsync(parsed.data);
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setMessage(err.message);
      } else setMessage('Something went wrong');
    }
  }

  const field = (name: keyof typeof form, label: string, type: string, autoComplete: string) => (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        type={type}
        autoComplete={autoComplete}
        className="input"
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        aria-invalid={!!fields[name]}
        aria-describedby={fields[name] ? `${name}-err` : undefined}
      />
      {fields[name] && (
        <p id={`${name}-err`} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {fields[name]}
        </p>
      )}
    </div>
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold">Gym Tracker</h1>
      <p className="mb-8 text-slate-500">{isRegister ? 'Create your account' : 'Welcome back'}</p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {isRegister && field('name', 'Name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        {field(
          'password',
          'Password',
          'password',
          isRegister ? 'new-password' : 'current-password',
        )}
        {message && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {message}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
        </button>
      </form>
      {isRegister ? (
        <p className="mt-6 text-center text-sm">
          Have an account?{' '}
          <Link to="/login" className="font-semibold text-emerald-700 dark:text-emerald-400">
            Log in
          </Link>
        </p>
      ) : (
        config?.registrationOpen && (
          <p className="mt-6 text-center text-sm">
            New here?{' '}
            <Link to="/register" className="font-semibold text-emerald-700 dark:text-emerald-400">
              Create an account
            </Link>
          </p>
        )
      )}
    </div>
  );
}
