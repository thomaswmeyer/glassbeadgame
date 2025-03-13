import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface GameHistoryItem {
  topic: string;
  response: string;
  evaluation: string;
  scores: {
    semanticDistance: number;
    relevanceQuality: number;
    total: number;
  };
  player: 'human' | 'ai';
}

export async function POST(request: Request) {
  console.log('=== AI RESPONSE ROUTE CALLED ===');
  console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);
  console.log('API Key length:', process.env.ANTHROPIC_API_KEY?.length);
  console.log('API Key first 10 chars:', process.env.ANTHROPIC_API_KEY?.substring(0, 10));
  console.log('API Key last 10 chars:', process.env.ANTHROPIC_API_KEY?.substring(process.env.ANTHROPIC_API_KEY.length - 10));
  
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not defined');
      throw new Error('ANTHROPIC_API_KEY is not defined');
    }

    // Parse request body
    const body = await request.json();
    console.log('Request body received:', JSON.stringify({
      topic: body.topic,
      gameHistoryLength: body.gameHistory?.length || 0
    }));

    const { topic, gameHistory } = body;

    if (!topic) {
      console.error('Topic is required but was not provided');
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }

    // Format game history for context
    let historyContext = '';
    if (gameHistory && gameHistory.length > 0) {
      historyContext = 'Previous rounds:\n';
      gameHistory.slice(-5).forEach((item: GameHistoryItem, index: number) => {
        historyContext += `Round ${gameHistory.length - 5 + index + 1}: Topic "${item.topic}" → ${item.player === 'human' ? 'Human' : 'AI'} responded "${item.response}"\n`;
      });
    }

    console.log('Preparing to make API request with model: claude-3-opus-20240229');
    console.log('Temperature setting:', 0.9);
    
    const aiResponse = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 50,
      temperature: 0.9,
      system: `You are playing the Glass Bead Game, a game of conceptual connections. 
      
      Your task is to respond to a given topic with a brief, thoughtful response (ideally just a few words) that:
      1. Creates a meaningful connection to the topic
      2. Shows semantic distance (not too obvious, not too random)
      3. Demonstrates depth and insight
      
      Your response should be brief but profound - a single word or short phrase that captures a concept related to the topic in an interesting way.
      
      Be creative and varied in your responses. Avoid obvious associations and clichés. Try to surprise the player with unexpected but meaningful connections.
      
      DO NOT explain your reasoning. ONLY provide the brief response itself.`,
      messages: [
        {
          role: "user",
          content: `${historyContext}
          
          Current topic: "${topic}"
          
          Please provide your brief response to this topic. Be creative and avoid obvious connections.`
        }
      ],
    });
    
    console.log('API request successful');
    console.log('Response received:', JSON.stringify(aiResponse, null, 2));

    // Extract the text content from the response
    const response = aiResponse.content[0].type === 'text' 
      ? aiResponse.content[0].text.trim() 
      : '';
    
    console.log('Extracted response:', response);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('=== AI RESPONSE ERROR ===');
    console.error('Error generating AI response:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate AI response' },
      { status: 500 }
    );
  }
} 