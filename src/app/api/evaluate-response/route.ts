import { NextResponse } from 'next/server';
import { evaluateResponse } from '@/services/llm';

export async function POST(request: Request) {
  console.log('=== EVALUATE RESPONSE ROUTE CALLED ===');
  
  try {
    const body = await request.json();
    const { topic, response, difficulty } = body;
    
    console.log('Request body received:', {
      topic,
      responseLength: response?.length,
      difficulty
    });
    
    if (!topic || !response) {
      return NextResponse.json(
        { error: 'Topic and response are required' },
        { status: 400 }
      );
    }
    
    console.log('Using difficulty level:', difficulty);
    
    try {
      // Evaluate the response using our LLM service
      const evaluationData = await evaluateResponse(topic, response, difficulty);
      console.log('Evaluation completed successfully');
      
      return NextResponse.json(evaluationData);
    } catch (error) {
      console.error('Error evaluating response:', error);
      
      // Provide a fallback evaluation
      const fallbackEvaluation = {
        evaluation: "I couldn't evaluate this response properly due to a technical issue. Here's a default score.",
        scores: {
          semanticDistance: 5,
          relevanceQuality: 5,
          total: 10
        }
      };
      
      return NextResponse.json(fallbackEvaluation);
    }
  } catch (error) {
    console.error('Error in evaluate-response route:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate response' },
      { status: 500 }
    );
  }
} 