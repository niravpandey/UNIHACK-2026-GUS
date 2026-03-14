import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowRight } from 'lucide-react'

import { AuthButton } from '@/components/auth-button'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { hasEnvVars } from '@/utils/env'

const points = [
  'Start from a topic and explore without losing context.',
  'Keep useful resources connected to the ideas that surfaced them.',
  'Move through the web with a simpler, calmer interface.',
]

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(86,110,214,0.14),transparent_42%)]" />

        <header className="border-b border-border/50">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-sm">
                <svg
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                  className="h-7 w-7"
                >
                  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path
                      d="M17 25 L31 18 M17 25 L29 33"
                      stroke="oklch(0.80 0.05 66.97 / 0.55)"
                      strokeWidth="2.4"
                    />
                    <circle
                      cx="17"
                      cy="25"
                      r="8"
                      fill="oklch(0.80 0.05 66.97 / 0.9)"
                      stroke="oklch(0.80 0.05 66.97 / 0.35)"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="31"
                      cy="18"
                      r="3.5"
                      fill="oklch(0.80 0.05 66.97 / 0.72)"
                      stroke="oklch(0.80 0.05 66.97 / 0.2)"
                      strokeWidth="1"
                    />
                    <circle
                      cx="29"
                      cy="33"
                      r="3.5"
                      fill="oklch(0.80 0.05 66.97 / 0.72)"
                      stroke="oklch(0.80 0.05 66.97 / 0.2)"
                      strokeWidth="1"
                    />
                  </g>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                  GraphSurf
                </p>
                <p className="text-sm text-muted-foreground">
                  A More Fun Way To Browse The Internet
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              {hasEnvVars ? (
                <Suspense
                  fallback={
                    <div className="h-9 w-28 rounded-md border border-border/70 bg-card" />
                  }
                >
                  <AuthButton />
                </Suspense>
              ) : null}
            </div>
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-12 sm:px-8">
          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-center">
            <div className="max-w-2xl space-y-6">
              <Badge
                variant="outline"
                className="border-accent/30 bg-card/70 uppercase tracking-[0.2em] text-accent"
              >
                Simple browsing
              </Badge>

              <div className="space-y-4">
                <h1 className="text-5xl font-semibold tracking-tight text-card-foreground sm:text-6xl">
                  Web browsing that is easier to follow.
                </h1>
                <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                  GraphSurf helps you search, discover, and navigate resources
                  through connected topics instead of disconnected tabs. It is
                  designed to keep the path clear while you explore.
                </p>
              </div>

              <div className="space-y-3">
                {points.map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 text-sm leading-6 text-muted-foreground"
                  >
                    <span className="mt-2 h-2 w-2 rounded-full bg-accent" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full px-6">
                  <Link href={hasEnvVars ? '/app' : '/'}>
                    {hasEnvVars ? 'Open GraphSurf' : 'GraphSurf'}
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>

            <Card className="border-border/70 bg-card/80 shadow-xl">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <p className="text-sm font-medium text-card-foreground">
                    Why GraphSurf
                  </p>
                  <div className="space-y-3 text-sm leading-7 text-muted-foreground">
                    <p>
                      Traditional browsing makes it easy to lose track of why a
                      page mattered.
                    </p>
                    <p>
                      GraphSurf keeps related ideas and resources connected, so
                      browsing feels more deliberate and less fragmented.
                    </p>
                    <p>
                      The goal is simple: make finding and following useful
                      information easier.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  )
}
