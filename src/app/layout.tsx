import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'SRVS — Syllabus Repository, Revision and Versioning System',
  description: 'Syllabus repository, revision tracking, and versioning for the University of San Jose - Recoletos.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white print:hidden">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} University of San Jose - Recoletos · SRVS</p>
            <Link href="/docs" className="hover:text-slate-700">
              API documentation
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
