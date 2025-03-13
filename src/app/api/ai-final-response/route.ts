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

// Difficulty level descriptions for the system prompt
const difficultyPrompts = {
  secondary: "Your response should use vocabulary and concepts appropriate for high school students. Avoid specialized academic terminology.",
  university: "Your response can use undergraduate university level concepts and some specialized terminology that would be taught in college courses.",
  unlimited: "Your response can use advanced, specialized, and abstract concepts. Feel free to use graduate-level concepts, obscure references, and specialized terminology from any field."
};

export async function POST(request: Request) {
  console.log('=== AI FINAL RESPONSE ROUTE CALLED ===');
  
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
      originalTopic: body.originalTopic,
      difficulty: body.difficulty,
      gameHistoryLength: body.gameHistory?.length || 0,
      circleEnabled: body.circleEnabled
    }));

    const { topic, originalTopic, gameHistory, difficulty = 'university', circleEnabled = true } = body;
    console.log('Using difficulty level:', difficulty);
    console.log('Circle mode enabled:', circleEnabled);

    // If circle mode is disabled, use the regular AI response endpoint
    if (!circleEnabled) {
      console.log('Circle mode is disabled, redirecting to regular AI response endpoint');
      
      // Create a new request body without the originalTopic
      const regularRequestBody = {
        topic,
        gameHistory,
        difficulty
      };
      
      // Call the regular AI response endpoint
      const regularResponse = await fetch('/api/ai-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(regularRequestBody),
      });
      
      if (!regularResponse.ok) {
        throw new Error('Failed to get regular AI response');
      }
      
      return regularResponse;
    }

    if (!topic || !originalTopic) {
      console.error('Current topic and original topic are required but not provided');
      return NextResponse.json(
        { error: 'Current topic and original topic are required' },
        { status: 400 }
      );
    }

    // Format game history for context
    let historyContext = '';
    let previousResponses: string[] = [];
    
    if (gameHistory && gameHistory.length > 0) {
      historyContext = 'Previous rounds:\n';
      gameHistory.slice(-5).forEach((item: GameHistoryItem, index: number) => {
        historyContext += `Round ${gameHistory.length - 5 + index + 1}: Topic "${item.topic}" → ${item.player === 'human' ? 'Human' : 'AI'} responded "${item.response}"\n`;
        
        // Collect previous AI responses to avoid repetition
        if (item.player === 'ai') {
          previousResponses.push(item.response);
        }
      });
    }
    
    // Create a timestamp to ensure different results each time
    const timestamp = new Date().toISOString();
    
    // Create a list of responses to explicitly avoid
    const responsesToAvoid = previousResponses.length > 0 
      ? `Avoid these previously used responses: ${previousResponses.join(', ')}.` 
      : '';

    console.log('Preparing to make API request with model: claude-3-sonnet-20240229');
    console.log('Temperature setting:', 0.9);
    
    const aiResponse = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 100,
      temperature: 0.9,
      system: `You are playing the Glass Bead Game, a game of conceptual connections. 
      
      This is the FINAL ROUND of the game. Your task is to respond to the current topic with a brief, thoughtful response 
      that connects to BOTH:
      1. The current topic: "${topic}"
      2. The original starting topic: "${originalTopic}"
      
      Your response should be brief but profound - a single concept or short phrase that 
      creates a meaningful bridge between the current topic and the original topic.
      
      IMPORTANT GUIDELINES FOR CREATIVE CONNECTIONS:
      - Aim to make connections ACROSS DIFFERENT domains of knowledge (e.g., connecting science to art, history to mathematics, etc.)
      - Avoid simply providing scientific names, taxonomic classifications, or technical terms for the same object
      - Avoid providing specific subtypes, variants, or specialized versions of the same concept (e.g., don't respond with "chromesthesia" to "synesthesia")
      - Avoid connections that rely solely on specialized knowledge that only experts in one field would recognize
      - The best connections reveal surprising parallels between seemingly unrelated concepts
      
      ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts]}
      
      Be creative and varied in your responses. Avoid obvious associations and clichés. 
      Try to surprise the player with unexpected but meaningful connections.
      
      ${responsesToAvoid}
      
      Current timestamp for seed variation: ${timestamp}
      
      Consider multiple domains of knowledge when forming your response:
      - Arts and humanities
      - Science and technology
      - Social sciences
      - Natural world
      - Abstract concepts
      
      DO NOT explain your reasoning. ONLY provide the brief response itself.`,
      messages: [
        {
          role: "user",
          content: `${historyContext}
          
          Current topic: "${topic}"
          Original starting topic: "${originalTopic}"
          
          This is the FINAL ROUND. Please provide your brief response that connects to BOTH the current topic AND the original starting topic at a ${difficulty} difficulty level. Be creative and avoid obvious connections or any responses that have been used before in this game.`
        }
      ],
    });
    
    console.log('API request successful');

    // Extract the text content from the response
    const response = aiResponse.content[0].type === 'text' 
      ? aiResponse.content[0].text.trim() 
      : '';
    
    console.log('Extracted response:', response);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('=== AI FINAL RESPONSE ERROR ===');
    console.error('Error generating AI final response:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate AI final response' },
      { status: 500 }
    );
  }
} 