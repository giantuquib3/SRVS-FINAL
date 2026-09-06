import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'SRVS — Syllabus Repository, Revision and Versioning System',
  description: 'Dynamic database-driven syllabus repository, revision tracking, and immutable versioning platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased bg-[#f8faf9] text-slate-800 selection:bg-[#005a36] selection:text-white">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="w-full border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} University of San Jose - Recoletos (USJ-R) — Syllabus Repository, Revision and Versioning System (SRVS).</p>
          <p className="text-[11px] text-slate-400 mt-1">Caritas et Scientia • Cebu City, Philippines</p>
        </footer>
      </body>
    </html>
  );
}
