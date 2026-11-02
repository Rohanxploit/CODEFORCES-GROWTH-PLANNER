import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Card, ErrorMessage, Field, Input } from '../components/ui';

function AuthShell({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>{children}</Card>
      <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{footer}</p>
    </main>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Log in"
      footer={
        <>
          New here? <Link to="/register" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Create an account</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {!!error && <ErrorMessage error={error} />}
        <Button type="submit" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const tooShort = password.length > 0 && password.length < 8;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return;
    setBusy(true);
    setError(null);
    try {
      await register(name, email, password);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      footer={
        <>
          Already have an account? <Link to="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Log in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="name">
          <Input id="name" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters." error={tooShort ? 'Password must be at least 8 characters' : null}>
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {!!error && <ErrorMessage error={error} />}
        <Button type="submit" className="w-full" loading={busy} disabled={!name || !email || password.length < 8}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
