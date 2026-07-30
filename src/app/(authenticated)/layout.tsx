import type {ReactNode} from 'react';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {AppShell} from '../../components/app/app-shell';
import {
  authReturnToHeader,
  loginPathForReturnTo,
} from '../../lib/auth/return-routing';
import {getOptionalUser} from '../../modules/auth/auth.service';

export default async function AuthenticatedLayout({
  children,
}: Readonly<{children: ReactNode}>) {
  const user = await getOptionalUser();
  if (!user) {
    const requestHeaders = await headers();
    redirect(loginPathForReturnTo(requestHeaders.get(authReturnToHeader)));
  }

  return <AppShell user={{name: user.name}}>{children}</AppShell>;
}
