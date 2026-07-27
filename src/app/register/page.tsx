import Link from 'next/link';
import {redirect} from 'next/navigation';
import {RegisterForm} from '../../components/auth/register-form';
import {getOptionalUser} from '../../modules/auth/auth.service';

export default async function RegisterPage() {
  if (await getOptionalUser()) {
    redirect('/schedule');
  }

  return (
    <main className="auth-shell">
      <section
        aria-labelledby="register-heading"
        className="auth-panel"
      >
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-emerald-700">
            Meeting Room Booking
          </p>
          <h1
            className="text-2xl font-semibold text-slate-950"
            id="register-heading"
          >
            Create your account
          </h1>
        </div>
        <RegisterForm />
        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            className="font-semibold text-blue-700 underline-offset-4 hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
