import './globals.css';

export const metadata = {
  title: 'Wasap Daily Hub — Personal Workspace & Expense Control',
  description: 'Sleek all-in-one daily tasks, idea drafts, and expense management synchronized with WhatsApp & Supabase.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="dark">
      <body className="bg-[#090d16] text-slate-100 min-h-screen antialiased selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}

