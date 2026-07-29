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
        setError('Не вдалося вийти. Спробуйте ще раз.');
        return;
      }
      window.location.assign('/login');
    } catch {
      setError('Не вдалося вийти. Спробуйте ще раз.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="logout-control">
      {error ? (
        <p className="logout-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        aria-label="Вийти"
        className="logout-button"
        onClick={handleLogout}
        pending={pending}
        type="button"
      >
        <LogOut aria-hidden="true" className="size-4" />
        <span className="logout-label">Вийти</span>
      </Button>
    </div>
  );
}
