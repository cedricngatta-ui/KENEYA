import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/components/providers/LanguageProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const runtime = 'edge';

export const viewport: Viewport = {
    themeColor: '#FF6F00',
};

export const metadata: Metadata = {
    title: 'KENEYA',
    description: 'Plateforme KENEYA - Gestion et détection des alertes d\'épidémie de la ville d\'Abidjan.',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'KENEYA',
    },
    formatDetection: {
        telephone: false,
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="fr" suppressHydrationWarning>
            <body className={`${inter.variable} font-sans bg-slate-50 text-slate-900 antialiased`}>
                <LanguageProvider>
                    {children}
                </LanguageProvider>
            </body>
        </html>
    );
}
