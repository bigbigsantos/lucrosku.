import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'LucroSKU | Inteligência comercial', description: 'Descubra quanto realmente sobra em cada venda.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="pt-BR"><body>{children}</body></html>; }
