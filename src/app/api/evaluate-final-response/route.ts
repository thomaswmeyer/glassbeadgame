import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Difficulty level descriptions for the system prompt
const difficultyPrompts = {
  secondary: "Evaluate at a high school level. Use simple language and focus on basic connections between concepts.",
  university: "Evaluate at an undergraduate university level. You can use some specialized terminology and consider more nuanced connections.",
  unlimited: "Evaluate at an advanced level. Consider complex, abstract, and specialized connections between concepts."
};

export async function POST(request: Request) {
  console.log('=== EVALUATE FINAL RESPONSE ROUTE CALLED ===');
  console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);
  
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not defined');
      throw new Error('ANTHROPIC_API_KEY is not defined');
    }

    // Parse request body
    const body = await request.json();
    console.log('Request body received:', JSON.stringify({
      currentTopic: body.currentTopic,
      originalTopic: body.originalTopic,
      responseLength: body.response?.length || 0,
      difficulty: body.difficulty
    }));

    const { currentTopic, originalTopic, response, difficulty = 'university' } = body;
    console.log('Using difficulty level:', difficulty);

    if (!currentTopic || !originalTopic || !response) {
      console.error('Current topic, original topic, and response are required');
      return NextResponse.json(
        { error: 'Current topic, original topic, and response are required' },
        { status: 400 }
      );
    }

    console.log('Preparing to make API request with model: claude-3-sonnet-20240229');
    
    const aiResponse = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1000,
      temperature: 0.2,
      system: `You are an expert evaluator for the Glass Bead Game, a game of conceptual connections.

      In this game, players take turns responding to concepts with related concepts, creating a chain of meaningful connections.
      
      This is the FINAL ROUND of the game, where the player must connect to BOTH:
      1. The current topic
      2. The original starting topic from the beginning of the game
      
      ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts]}
      
      Your task is to evaluate the player's response based on:
      
      1. How well it connects to the CURRENT topic
      2. How well it connects back to the ORIGINAL topic
      
      Use the SAME criteria for both connections:
      
      - Semantic Distance (1-10): How semantically remote is the overall topic from the prompt? Higher scores for connections that are not obvious.
      - Similarity (1-10): How well do the ideas map onto each other? For example, stock market crash and flocking behavior.
      
      IMPORTANT SCORING GUIDELINES:
      - Scientific names, taxonomic classifications, or technical terms for the same object should NOT be considered a significant semantic leap. For example, "artichoke" → "Cynara scolymus" should receive a LOW semantic distance score (1-3).
      - Simple translations, synonyms, or alternative names for the same concept should receive a LOW semantic distance score (1-3).
      - Specific subtypes, variants, or specialized versions of the same concept should receive a VERY LOW semantic distance score (1-2). For example, "synesthesia" → "chromesthesia" (a specific type of synesthesia) should score very low on semantic distance.
      - Connections that rely solely on specialized knowledge within a SINGLE domain (e.g., "pica" → "kaolin" both within medical terminology) should receive a MODERATE semantic distance score (4-6).
      - High semantic distance scores (7-10) should be reserved for truly creative connections ACROSS DIFFERENT domains or conceptual frameworks (e.g., connecting a medical concept to architecture, or a historical event to a natural phenomenon).
      - Similarity scores should reflect how well the ideas actually map onto each other in terms of structure, function, or conceptual parallels.
      
      For the final evaluation, provide:
      
      1. A thoughtful evaluation of the connection to the current topic (150-200 words)
      2. A separate evaluation of how well the response connects back to the original topic (100-150 words)
      3. Numerical scores for BOTH connections:
         - Current Topic Connection:
           * Semantic Distance (1-10)
           * Similarity (1-10)
         - Original Topic Connection:
           * Semantic Distance (1-10)
           * Similarity (1-10)
      
      The final score should be calculated as follows:
      - Current Topic Score = Current Topic Semantic Distance + Current Topic Similarity (max 20 points)
      - Original Topic Score = Original Topic Semantic Distance + Original Topic Similarity (max 20 points)
      - Final Score = (Current Topic Score + Original Topic Score) / 2 (max 20 points)
      
      Format your response as a JSON object with the following structure:
      {
        "evaluation": "Your evaluation of the connection to the current topic...",
        "finalEvaluation": "Your evaluation of the connection to the original topic...",
        "scores": {
          "currentConnection": {
            "semanticDistance": X,
            "similarity": Y,
            "subtotal": X+Y
          },
          "originalConnection": {
            "semanticDistance": A,
            "similarity": B,
            "subtotal": A+B
          },
          "total": (X+Y+A+B)/2
        }
      }
      
      IMPORTANT: Your response must be valid JSON that can be parsed by JavaScript's JSON.parse().`,
      messages: [
        {
          role: "user",
          content: `Current topic: "${currentTopic}"
          Original starting topic: "${originalTopic}"
          Player's response: "${response}"
          
          Please evaluate this final round response at a ${difficulty} difficulty level, considering both the connection to the current topic AND the connection back to the original topic using the same criteria for both.`
        }
      ],
    });
    
    console.log('API request successful');
    
    // Extract the text content from the response
    const evaluationText = aiResponse.content[0].type === 'text' 
      ? aiResponse.content[0].text 
      : '';
    
    // Parse the JSON response
    try {
      const evaluationData = JSON.parse(evaluationText);
      console.log('Evaluation data parsed successfully');
      return NextResponse.json(evaluationData);
    } catch (error) {
      console.error('Error parsing evaluation JSON:', error);
      console.error('Raw evaluation text:', evaluationText);
      
      // Fallback response with default values
      return NextResponse.json({
        evaluation: "The response shows an interesting connection to the current topic.",
        finalEvaluation: "The response makes a thoughtful connection back to the original topic.",
        scores: {
          currentConnection: {
            semanticDistance: 5,
            similarity: 5,
            subtotal: 10
          },
          originalConnection: {
            semanticDistance: 5,
            similarity: 5,
            subtotal: 10
          },
          total: 10
        }
      });
    }
  } catch (error) {
    console.error('Error evaluating final response:', error);
    
    return NextResponse.json(
      { error: 'Failed to evaluate response' },
      { status: 500 }
    );
  }
} 