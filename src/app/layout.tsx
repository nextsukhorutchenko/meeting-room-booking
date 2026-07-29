import type {Metadata} from 'next';
import './styles/manifest.css';

export const metadata: Metadata = {
  title: 'Roomwork — Бронювання переговорних',
  description: 'Бронюйте переговорні та керуйте своїм розкладом.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
