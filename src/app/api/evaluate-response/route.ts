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
  console.log('=== EVALUATE RESPONSE ROUTE CALLED ===');
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
      topic: body.topic,
      responseLength: body.response?.length || 0,
      difficulty: body.difficulty
    }));

    const { topic, response, difficulty = 'university' } = body;
    console.log('Using difficulty level:', difficulty);

    if (!topic || !response) {
      console.error('Topic and response are required');
      return NextResponse.json(
        { error: 'Topic and response are required' },
        { status: 400 }
      );
    }

    console.log('Preparing to make API request with model: claude-3-opus-20240229');
    
    const aiResponse = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      temperature: 0.2,
      system: `You are an expert evaluator for the Glass Bead Game, a game of conceptual connections.

      In this game, players take turns responding to concepts with related concepts, creating a chain of meaningful connections.
      
      ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts]}
      
      Your task is to evaluate the player's response based on two criteria:
      
      1. Semantic Distance (1-10): How creative yet meaningful is the connection? Higher scores for connections that are not obvious but still meaningful.
      2. Relevance/Quality (1-10): How insightful and well-developed is the connection? Higher scores for responses that show depth of understanding.
      
      For the evaluation, provide:
      
      1. A thoughtful evaluation of the connection (150-200 words)
      2. Numerical scores for each criterion (1-10)
      
      Format your response as a JSON object with the following structure:
      {
        "evaluation": "Your evaluation text here...",
        "scores": {
          "semanticDistance": X,
          "relevanceQuality": Y,
          "total": Z
        }
      }
      
      The total score should be the sum of semanticDistance and relevanceQuality.
      
      IMPORTANT: Your response must be valid JSON that can be parsed by JavaScript's JSON.parse().`,
      messages: [
        {
          role: "user",
          content: `Topic: "${topic}"
          Player's response: "${response}"
          
          Please evaluate this response at a ${difficulty} difficulty level.`
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
      
      // Attempt to extract scores using regex as a fallback
      const semanticDistanceMatch = evaluationText.match(/semanticDistance"?\s*:\s*(\d+)/);
      const relevanceQualityMatch = evaluationText.match(/relevanceQuality"?\s*:\s*(\d+)/);
      const totalMatch = evaluationText.match(/total"?\s*:\s*(\d+)/);
      
      const semanticDistance = semanticDistanceMatch ? parseInt(semanticDistanceMatch[1]) : 5;
      const relevanceQuality = relevanceQualityMatch ? parseInt(relevanceQualityMatch[1]) : 5;
      const total = totalMatch ? parseInt(totalMatch[1]) : 10;
      
      // Extract evaluation text
      const evaluationMatch = evaluationText.match(/evaluation"?\s*:\s*"([^"]+)"/);
      const evaluation = evaluationMatch 
        ? evaluationMatch[1] 
        : "The response shows an interesting connection to the topic.";
      
      return NextResponse.json({
        evaluation,
        scores: {
          semanticDistance,
          relevanceQuality,
          total
        }
      });
    }
  } catch (error) {
    console.error('Error evaluating response:', error);
    
    return NextResponse.json(
      { error: 'Failed to evaluate response' },
      { status: 500 }
    );
  }
} 