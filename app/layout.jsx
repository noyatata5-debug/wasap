import './globals.css';

export const metadata = {
  title: 'Daily Workspace',
  description: 'Daily tasks and expenses tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
