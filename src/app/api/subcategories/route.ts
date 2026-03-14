import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ResourceResult = {
  title: string;
  url: string;
  source?: 'news' | 'web' | 'docs' | 'video';
  favicon?: string;
  snippet?: string;
};

function parseSubcategories(result: string) {
  let subcategories: string[];

  try {
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed)) {
      subcategories = parsed;
    } else if (parsed.subcategories) {
      subcategories = parsed.subcategories;
    } else {
      const values = Object.values(parsed);
      const flattened = values.flat().map(String);
      subcategories = flattened.slice(0, 7);
    }
  } catch {
    const match = result.match(/\[[\s\S]*?"[^"]+"\s*?\]/);
    if (match) {
      subcategories = JSON.parse(match[0]);
    } else {
      subcategories = result.split(',').map((s: string) => s.trim().replace(/"/g, ''));
    }
  }

  return subcategories.slice(0, 7).map((s: string) => s.trim()).filter(Boolean);
}

function getFaviconUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=512`;
  } catch {
    return undefined;
  }
}

function normaliseResource(
  result: Record<string, unknown>,
  fallbackSource: NonNullable<ResourceResult['source']>,
) : ResourceResult | null {
  const profile =
    result.profile && typeof result.profile === 'object'
      ? result.profile as Record<string, unknown>
      : undefined;
  const thumbnail =
    result.thumbnail && typeof result.thumbnail === 'object'
      ? result.thumbnail as Record<string, unknown>
      : undefined;
  const metaUrl =
    result.meta_url && typeof result.meta_url === 'object'
      ? result.meta_url as Record<string, unknown>
      : undefined;
  const url =
    typeof result.url === 'string'
      ? result.url
      : typeof profile?.url === 'string'
        ? profile.url
        : '';

  const title =
    typeof result.title === 'string'
      ? result.title
      : typeof result.meta_title === 'string'
        ? result.meta_title
        : url;

  if (!url || !title) {
    return null;
  }

  const favicon =
    typeof thumbnail?.src === 'string'
      ? thumbnail.src
      : typeof metaUrl?.favicon === 'string'
        ? metaUrl.favicon
        : getFaviconUrl(url);

  const snippet =
    typeof result.description === 'string'
      ? result.description
      : typeof result.page_age === 'string'
        ? result.page_age
        : undefined;

  return {
    title,
    url,
    source: fallbackSource,
    favicon,
    snippet,
  } satisfies ResourceResult;
}

async function fetchBraveResults(
  endpoint: string,
  category: string,
  fallbackSource: NonNullable<ResourceResult['source']>,
) {
  const apiKey = process.env.BRAVE_API_KEY;

  if (!apiKey) {
    return [];
  }

  const params = new URLSearchParams({
    q: category,
    count: '3',
  });

  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Brave request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const rawResults =
    payload?.results ??
    payload?.web?.results ??
    payload?.news?.results ??
    [];

  if (!Array.isArray(rawResults)) {
    return [];
  }

  return rawResults
    .map((result) => normaliseResource(result as Record<string, unknown>, fallbackSource))
    .filter((result): result is NonNullable<ReturnType<typeof normaliseResource>> => result !== null);
}

async function fetchResources(category: string) {
  const [newsResults, webResults] = await Promise.all([
    fetchBraveResults('https://api.search.brave.com/res/v1/news/search', category, 'news'),
    fetchBraveResults('https://api.search.brave.com/res/v1/web/search', category, 'web'),
  ]);

  const seenUrls = new Set<string>();

  return [...newsResults, ...webResults].filter((resource) => {
    if (seenUrls.has(resource.url)) {
      return false;
    }

    seenUrls.add(resource.url);
    return true;
  }).slice(0, 5);
}

export async function POST(request: Request) {
  try {
    const { category } = await request.json();

    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates subcategories for a given topic. Return exactly 6-7 subcategories as a JSON array of strings. Each subcategory should be a specific, meaningful subfield or area within the given category.',
        },
        {
          role: 'user',
          content: `Generate 6-7 subcategories for: "${category}". Return only a JSON array of strings, nothing else.`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const result = completion.choices[0]?.message?.content;
    
    if (!result) {
      return NextResponse.json({ error: 'No response from OpenAI' }, { status: 500 });
    }

    const subcategories = parseSubcategories(result);
    let resources: ResourceResult[] = [];

    try {
      resources = await fetchResources(category);
    } catch (resourceError) {
      console.error('Error fetching Brave resources:', resourceError);
    }

    return NextResponse.json({ subcategories, resources });
  } catch (error) {
    console.error('Error generating subcategories:', error);
    return NextResponse.json({ error: 'Failed to generate subcategories' }, { status: 500 });
  }
}
