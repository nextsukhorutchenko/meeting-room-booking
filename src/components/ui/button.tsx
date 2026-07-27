'use client';

import {LoaderCircle} from 'lucide-react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pending?: boolean;
};

export function Button({
  children,
  className = '',
  disabled,
  pending = false,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={pending}
      className={[
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md',
        'bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white',
        'transition-colors hover:bg-blue-800 focus-visible:outline-2',
        'focus-visible:outline-offset-2 focus-visible:outline-blue-700',
        'disabled:cursor-not-allowed disabled:bg-slate-400',
        className,
      ].join(' ')}
      disabled={disabled || pending}
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : null}
      {children}
    </button>
  );
}
