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

    console.log('Preparing to make API request with model: claude-3-opus-20240229');
    
    const aiResponse = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      temperature: 0.2,
      system: `You are an expert evaluator for the Glass Bead Game, a game of conceptual connections.

      In this game, players take turns responding to concepts with related concepts, creating a chain of meaningful connections.
      
      This is the FINAL ROUND of the game, where the player must connect to BOTH:
      1. The current topic
      2. The original starting topic from the beginning of the game
      
      ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts]}
      
      Your task is to evaluate the player's response based on:
      
      1. How well it connects to the CURRENT topic (semantic distance and relevance/quality)
      2. How well it connects back to the ORIGINAL topic
      
      For the final evaluation, provide:
      
      1. A thoughtful evaluation of the connection to the current topic (150-200 words)
      2. A separate evaluation of how well the response connects back to the original topic (100-150 words)
      3. Numerical scores:
         - Semantic Distance (1-10): How creative yet meaningful is the connection to the current topic? (Higher is better)
         - Relevance/Quality (1-10): How insightful and well-developed is the connection to the current topic? (Higher is better)
         - Original Topic Connection (1-10): How well does it connect back to the original topic? (Higher is better)
      
      The total score should be out of 20 points, with 10 points for the current topic connection (semantic distance + relevance/quality) and 10 points for the original topic connection.
      
      Format your response as a JSON object with the following structure:
      {
        "evaluation": "Your evaluation of the connection to the current topic...",
        "finalEvaluation": "Your evaluation of the connection to the original topic...",
        "scores": {
          "semanticDistance": X,
          "relevanceQuality": Y,
          "total": Z
        }
      }
      
      The total score should be the sum of:
      - semanticDistance (max 5 points)
      - relevanceQuality (max 5 points)
      - Original topic connection (max 10 points)
      
      IMPORTANT: Your response must be valid JSON that can be parsed by JavaScript's JSON.parse().`,
      messages: [
        {
          role: "user",
          content: `Current topic: "${currentTopic}"
          Original starting topic: "${originalTopic}"
          Player's response: "${response}"
          
          Please evaluate this final round response at a ${difficulty} difficulty level, considering both the connection to the current topic AND the connection back to the original topic.`
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
      
      // Extract evaluation text sections
      const evaluationMatch = evaluationText.match(/evaluation"?\s*:\s*"([^"]+)"/);
      const finalEvaluationMatch = evaluationText.match(/finalEvaluation"?\s*:\s*"([^"]+)"/);
      
      const evaluation = evaluationMatch 
        ? evaluationMatch[1] 
        : "The response shows an interesting connection to the current topic.";
      
      const finalEvaluation = finalEvaluationMatch
        ? finalEvaluationMatch[1]
        : "The response makes a thoughtful connection back to the original topic.";
      
      return NextResponse.json({
        evaluation,
        finalEvaluation,
        scores: {
          semanticDistance,
          relevanceQuality,
          total
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