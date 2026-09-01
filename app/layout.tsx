import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import { AuthProvider } from '@/components/AuthContext';
import './globals.css';

const playfair = Playfair_Display({
  variable: '--font-serif-src',
  subsets: ['latin'],
  weight: ['500', '600'],
});

const inter = Inter({
  variable: '--font-sans-src',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Mélange Patisserie OS',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
