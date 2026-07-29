import type {ReactElement, ReactNode} from 'react';

export type AuthShellProps = {
  children: ReactNode;
  heading: string;
};

export function AuthShell({children, heading}: AuthShellProps): ReactElement {
  return (
    <main className="auth-shell">
      <section aria-labelledby="auth-heading" className="auth-panel">
        <div className="auth-heading-group">
          <p className="auth-brand">Roomwork</p>
          <p className="auth-descriptor">Бронювання переговорних</p>
          <h1 id="auth-heading">{heading}</h1>
        </div>
        {children}
      </section>
    </main>
  );
}
