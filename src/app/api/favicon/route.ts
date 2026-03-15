import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const pageUrl = request.nextUrl.searchParams.get('url');
  const iconUrl = request.nextUrl.searchParams.get('icon');

  if (!pageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  let parsedPageUrl: URL;

  try {
    parsedPageUrl = new URL(pageUrl);
  } catch {
    return new NextResponse('Invalid url parameter', { status: 400 });
  }

  const candidates: string[] = [];

  if (iconUrl) {
    try {
      candidates.push(new URL(iconUrl, parsedPageUrl).toString());
    } catch {
      // Ignore invalid icon URLs from upstream payloads.
    }
  }

  candidates.push(new URL('/favicon.ico', parsedPageUrl).toString());
  candidates.push(
    `https://www.google.com/s2/favicons?domain=${parsedPageUrl.hostname}&sz=128`,
  );

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: {
          'Accept': 'image/*,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 favicon-proxy',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get('content-type') ?? '';

      if (!contentType.startsWith('image/')) {
        continue;
      }

      const bytes = await response.arrayBuffer();

      if (bytes.byteLength === 0) {
        continue;
      }

      return new NextResponse(bytes, {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          'Content-Type': contentType,
        },
      });
    } catch {
      // Try the next candidate.
    }
  }

  return new NextResponse(null, { status: 404 });
}
