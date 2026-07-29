import type {ReactNode} from 'react';
import {redirect} from 'next/navigation';
import {AppShell} from '../../components/app/app-shell';
import {getOptionalUser} from '../../modules/auth/auth.service';

export default async function AuthenticatedLayout({
  children,
}: Readonly<{children: ReactNode}>) {
  const user = await getOptionalUser();
  if (!user) {
    redirect('/login');
  }

  return <AppShell user={{name: user.name}}>{children}</AppShell>;
}
