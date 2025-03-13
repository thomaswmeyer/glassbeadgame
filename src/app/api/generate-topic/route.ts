import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST() {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not defined');
    }

    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 100,
      temperature: 1,
      system: "You are an assistant for the Glass Bead Game. Generate a single, specific topic for players to respond to. The topic should be a single concept, idea, philosophical term, or work of art - for example: 'Homeostasis', 'Ontology', 'Beethoven's Fifth Symphony', 'The concept of time', or 'Plato's Cave'. Provide ONLY the topic name without any explanation or additional text.",
      messages: [
        {
          role: "user",
          content: "Generate a single, specific topic for the Glass Bead Game."
        }
      ],
    });

    // Extract the text content from the response
    const topic = response.content[0].type === 'text' 
      ? response.content[0].text.trim() 
      : 'Failed to generate a topic';

    return NextResponse.json({ topic });
  } catch (error) {
    console.error('Error generating topic:', error);
    return NextResponse.json(
      { error: 'Failed to generate topic' },
      { status: 500 }
    );
  }
} 