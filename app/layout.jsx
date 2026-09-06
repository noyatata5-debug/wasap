import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Wasap Daily Hub — Personal Workspace & Expense Control',
  description: 'Sleek all-in-one daily tasks, idea drafts, and expense management synchronized with WhatsApp & Supabase.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased selection:bg-[#2e96ff] selection:text-white">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

