import { NextResponse } from 'next/server';
import { evaluateResponse } from '@/services/llm';

export async function POST(request: Request) {
  console.log('=== EVALUATE FINAL RESPONSE ROUTE CALLED ===');
  
  try {
    const body = await request.json();
    const { currentTopic, originalTopic, response, difficulty } = body;
    
    console.log('Request body received:', {
      currentTopic,
      originalTopic,
      responseLength: response?.length,
      difficulty
    });
    
    if (!currentTopic || !originalTopic || !response) {
      return NextResponse.json(
        { error: 'Current topic, original topic, and response are required' },
        { status: 400 }
      );
    }
    
    console.log('Using difficulty level:', difficulty);
    
    try {
      // Evaluate the final response using our LLM service
      const evaluationData = await evaluateResponse(
        currentTopic, 
        response, 
        difficulty,
        originalTopic,
        true // isFinalRound
      );
      
      console.log('Final evaluation completed successfully');
      return NextResponse.json(evaluationData);
    } catch (error) {
      console.error('Error evaluating final response:', error);
      
      // Provide a fallback evaluation
      const fallbackEvaluation = {
        evaluation: "I couldn't evaluate this response properly due to a technical issue. Here's a default score.",
        finalEvaluation: "I couldn't evaluate the connection to the original topic due to a technical issue.",
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
      };
      
      return NextResponse.json(fallbackEvaluation);
    }
  } catch (error) {
    console.error('Error in evaluate-final-response route:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate final response' },
      { status: 500 }
    );
  }
} 