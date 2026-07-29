import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AuthShell} from '../../components/auth/auth-shell';
import {RegisterForm} from '../../components/auth/register-form';
import {getOptionalUser} from '../../modules/auth/auth.service';

export default async function RegisterPage() {
  if (await getOptionalUser()) {
    redirect('/schedule');
  }

  return (
    <AuthShell heading="Створіть обліковий запис">
      <RegisterForm />
      <p className="auth-footer">
        Уже маєте обліковий запис?{' '}
        <Link className="auth-link" href="/login">
          Увійти
        </Link>
      </p>
    </AuthShell>
  );
}
