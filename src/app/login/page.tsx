import Link from 'next/link';
import {redirect} from 'next/navigation';
import {LoginForm} from '../../components/auth/login-form';
import {getOptionalUser} from '../../modules/auth/auth.service';

export default async function LoginPage() {
  if (await getOptionalUser()) {
    redirect('/schedule');
  }

  return (
    <main className="auth-shell">
      <section aria-labelledby="login-heading" className="auth-panel">
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-emerald-700">
            Meeting Room Booking
          </p>
          <h1
            className="text-2xl font-semibold text-slate-950"
            id="login-heading"
          >
            Sign in
          </h1>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-slate-600">
          New here?{' '}
          <Link
            className="font-semibold text-blue-700 underline-offset-4 hover:underline"
            href="/register"
          >
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
