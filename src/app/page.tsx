import {redirect} from 'next/navigation';
import {getOptionalUser} from '../modules/auth/auth.service';

export default async function Home() {
  const user = await getOptionalUser();
  redirect(user ? '/schedule' : '/login');
}
