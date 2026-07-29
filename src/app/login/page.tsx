import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AuthShell} from '../../components/auth/auth-shell';
import {LoginForm} from '../../components/auth/login-form';
import {getOptionalUser} from '../../modules/auth/auth.service';

export default async function LoginPage() {
  if (await getOptionalUser()) {
    redirect('/schedule');
  }

  return (
    <AuthShell heading="Увійдіть">
      <LoginForm />
      <p className="auth-footer">
        Вперше тут?{' '}
        <Link className="auth-link" href="/register">
          Створити обліковий запис
        </Link>
      </p>
    </AuthShell>
  );
}
