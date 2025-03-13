import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not defined');
    }

    const { topic } = await request.json();

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 250,
      temperature: 0.7,
      system: `You are a knowledgeable assistant providing concise definitions for concepts, terms, or topics. 
      
      When given a topic, provide a brief, clear definition that explains what it is in 2-3 sentences. 
      
      Your definition should be:
      1. Accurate and informative
      2. Concise (no more than 2-3 sentences)
      3. Accessible to a general audience
      4. Free of unnecessary jargon
      
      Provide ONLY the definition without any introductory phrases like "Here's a definition" or "This term refers to".`,
      messages: [
        {
          role: "user",
          content: `Please provide a concise definition for: "${topic}"`
        }
      ],
    });

    // Extract the text content from the response
    const definition = response.content[0].type === 'text' 
      ? response.content[0].text.trim() 
      : 'Definition not available.';

    return NextResponse.json({ definition });
  } catch (error) {
    console.error('Error fetching definition:', error);
    return NextResponse.json(
      { error: 'Failed to fetch definition', definition: 'Definition not available at this time.' },
      { status: 500 }
    );
  }
} 