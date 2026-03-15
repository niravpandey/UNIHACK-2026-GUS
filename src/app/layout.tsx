import type { Metadata } from 'next'
import { Geist, Barlow_Condensed, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import NextTopLoader from 'nextjs-toploader'
import { Analytics } from '@vercel/analytics/react'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from "@/components/ui/sonner";
import './globals.css'
import ReactQueryProvider from '@/providers/ReactQueryProvider'

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'GRAPH SEARCH',
  description: 'The fastest way to build apps with Next.js and Supabase',
}

const geistSans = Geist({
  variable: '--font-geist-sans',
  display: 'swap',
  subsets: ['latin'],
})

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  weight: ["600", "700"],
  display: 'swap',
  subsets: ['latin'],
});

const jet = JetBrains_Mono({
  variable: "--font-jet",
  display: 'swap',
  subsets: ['latin'],
})

type RootLayoutProps = {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jet.variable} ${barlow.variable} ${geistSans.className}   antialiased`}>
        <NextTopLoader showSpinner={false} height={2} color="#2acf80" />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ReactQueryProvider>
            {children}
            <Analytics />
            <Toaster />
            <ReactQueryDevtools initialIsOpen={false} />
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
