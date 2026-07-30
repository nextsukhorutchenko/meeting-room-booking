import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AuthShell} from '../../components/auth/auth-shell';
import {LoginForm} from '../../components/auth/login-form';
import {safeReturnTo} from '../../lib/i18n/ui-errors';
import {getOptionalUser} from '../../modules/auth/auth.service';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{returnTo?: string | string[]}>;
}) {
  const parameters = await searchParams;
  const returnTo = Array.isArray(parameters.returnTo) ?
    parameters.returnTo[0] ?? null :
    parameters.returnTo ?? null;
  if (await getOptionalUser()) {
    redirect(safeReturnTo(returnTo));
  }

  return (
    <AuthShell heading="Увійдіть">
      <LoginForm returnTo={returnTo} />
      <p className="auth-footer">
        Вперше тут?{' '}
        <Link className="auth-link" href="/register">
          Створити обліковий запис
        </Link>
      </p>
    </AuthShell>
  );
}
