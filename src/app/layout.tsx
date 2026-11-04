import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Unsaid — Global Shell',
  description:
    'Global operations, finance, catalog, marketing, orders, contacts, and support workspace shell for ManageKube LLC — Unsaid.',
  openGraph: {
    title: 'Unsaid — Global Shell',
    description:
      'Global operations, finance, catalog, marketing, orders, contacts, and support workspace shell for ManageKube LLC — Unsaid.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Unsaid — Global Shell',
    description:
      'Global operations, finance, catalog, marketing, orders, contacts, and support workspace shell for ManageKube LLC — Unsaid.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      {/* eslint-disable @next/next/no-page-custom-font, @next/next/google-font-display */}
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      {/* eslint-enable @next/next/no-page-custom-font, @next/next/google-font-display */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
