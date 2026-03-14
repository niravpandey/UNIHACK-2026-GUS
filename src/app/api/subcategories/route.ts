import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    subcategories = subcategories.slice(0, 7).map((s: string) => s.trim());

    return NextResponse.json({ subcategories });
  } catch (error) {
    console.error('Error generating subcategories:', error);
    return NextResponse.json({ error: 'Failed to generate subcategories' }, { status: 500 });
  }
}