'use client';

import {LogOut} from 'lucide-react';
import {useState} from 'react';
import {Button} from '../ui/button';

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleLogout() {
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/auth/logout', {method: 'POST'});
      if (!response.ok) {
        setError('Unable to log out');
        return;
      }
      window.location.assign('/login');
    } catch {
      setError('Unable to log out');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
        onClick={handleLogout}
        pending={pending}
        type="button"
      >
        <LogOut aria-hidden="true" className="size-4" />
        Log out
      </Button>
    </div>
  );
}
