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
      difficulty: body.difficulty,
      gameHistoryLength: body.gameHistory?.length || 0,
      circleEnabled: body.circleEnabled
    }));

    const { topic, gameHistory, difficulty = 'university', circleEnabled = false } = body;
    console.log('Using difficulty level:', difficulty);
    console.log('Circle mode enabled:', circleEnabled);

    if (!topic) {
      console.error('Topic is required but was not provided');
      return NextResponse.json(
        { error: 'Topic is required' },
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
    
    // Add retry logic with exponential backoff
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`API request attempt ${attempt + 1} of ${maxRetries}`);
        
        const aiResponse = await anthropic.messages.create({
          model: "claude-3-sonnet-20240229",
          max_tokens: 50,
          temperature: 0.9,
          system: `You are playing the Glass Bead Game, a game of conceptual connections. 
          
          Your task is to respond to a given topic with a brief, thoughtful response 
          (ideally just a few words) that:
          1. Has a semantic distance from the topic
          2. Fits well onto the topic, through similar concepts or associations
          
          Your response should be brief but profound - a single word or short phrase that 
          captures a concept related to the topic in an interesting way.
          
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
              
              Please provide your brief response to this topic at a ${difficulty} difficulty level. Be creative and avoid obvious connections or any responses that have been used before in this game.`
            }
          ],
        });
        
        // If we get here, the request was successful
        console.log('API request successful');
        
        // Extract the text content from the response
        const response = aiResponse.content[0].type === 'text' 
          ? aiResponse.content[0].text.trim() 
          : 'Failed to generate a response';
        
        console.log('AI response:', response);
        
        return NextResponse.json({ response });
      } catch (error: any) {
        console.error(`Attempt ${attempt + 1} failed:`, error.message);
        lastError = error;
        
        // Check if we should retry
        if (attempt < maxRetries - 1) {
          // Calculate backoff time: 1s, 2s, 4s, etc.
          const backoffTime = 1000 * Math.pow(2, attempt);
          console.log(`Retrying in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    // If we get here, all retries failed
    console.error('All retry attempts failed');
    
    // Generate a fallback response
    const fallbackResponse = generateFallbackResponse(topic);
    console.log('Using fallback response:', fallbackResponse);
    
    return NextResponse.json({ 
      response: fallbackResponse,
      error: 'Failed to generate AI response after multiple attempts'
    });
  } catch (error: any) {
    console.error('Error generating AI response:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to generate AI response';
    let statusCode = 500;
    
    if (error.status === 429) {
      errorMessage = 'Rate limit exceeded, please try again later';
      statusCode = 429;
    } else if (error.status === 504 || error.status === 503) {
      errorMessage = 'Service temporarily unavailable';
      statusCode = 503;
    }
    
    // Generate a fallback response with a generic topic if the original topic is not available
    const fallbackResponse = generateFallbackResponse('concept');
    
    return NextResponse.json(
      { response: fallbackResponse, error: errorMessage },
      { status: statusCode }
    );
  }
}

// Helper function to generate a fallback response if API calls fail
function generateFallbackResponse(topic: string): string {
  const fallbackResponses = [
    'Emergent patterns',
    'Structural resonance',
    'Recursive systems',
    'Adaptive complexity',
    'Harmonic oscillation',
    'Symmetry breaking',
    'Threshold effects',
    'Feedback loops',
    'Paradigm shifts',
    'Conceptual frameworks'
  ];
  
  // Generate a pseudo-random index based on the topic and current time
  const seed = topic.length + Date.now() % 100;
  const randomIndex = seed % fallbackResponses.length;
  
  return fallbackResponses[randomIndex];
} 