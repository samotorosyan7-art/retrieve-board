import type { Metadata } from 'next';
import { StoreProvider } from '@/components/store';
import { Toasts } from '@/components/Toasts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Retrieve · Legal Practice Management',
};

// Apply the cached theme before first paint to avoid a flash.
const themeScript = `try{if(localStorage.getItem('retrieve_theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <StoreProvider>
          {children}
          <Toasts />
        </StoreProvider>
      </body>
    </html>
  );
}
