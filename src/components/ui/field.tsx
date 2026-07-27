import type {ReactNode} from 'react';

type FieldProps = {
  children: ReactNode;
  error?: string;
  htmlFor: string;
  label: string;
};

export function Field({children, error, htmlFor, label}: FieldProps) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-slate-800" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p
          className="text-sm text-red-700"
          id={`${htmlFor}-error`}
          role="status"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
