import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import ToasterWrapper from '@/components/ToasterWrapper'

export const metadata: Metadata = {
  title: 'Momentum AI',
  description: 'Momentum AI is an execution workspace that helps teams turn projects, tasks, and collaborative documents into finished work.',
  icons: {
    icon: [
      { url: '/brand/logo-32.png?v=3', sizes: '32x32', type: 'image/png' },
      { url: '/brand/logo.ico?v=3', type: 'image/x-icon' },
    ],
    apple: [{ url: '/brand/logo-180.png?v=3', sizes: '180x180', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          '--font-manrope': "'Manrope'",
          '--font-space-grotesk': "'Space Grotesk'",
          '--font-inter': "'Inter'",
          '--font-newsreader': "'Newsreader'",
        } as React.CSSProperties}
      >
        <ThemeProvider>
          {children}
          <ToasterWrapper />
        </ThemeProvider>
      </body>
    </html>
  )
}
