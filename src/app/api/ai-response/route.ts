import { NextResponse } from 'next/server';
import { getAiResponse } from '@/services/llm';

export async function POST(request: Request) {
  console.log('=== AI RESPONSE ROUTE CALLED ===');
  
  try {
    const body = await request.json();
    const {
      topic,
      gameHistory,
      difficulty,
      availableNodes,
      selectedSourceNodeIds,
      sourceSelectionMode,
    } = body;
    
    console.log('Request body received:', {
      topic,
      gameHistoryCount: gameHistory?.length || 0,
      difficulty,
    });
    
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }
    
    console.log('Using difficulty level:', difficulty);
    
    try {
      // Get AI response using our LLM service
      const response = await getAiResponse(
        topic,
        gameHistory || [],
        difficulty,
        availableNodes || [],
        selectedSourceNodeIds || [],
        sourceSelectionMode || 'suggested'
      );
      
      console.log('AI response generated successfully');
      return NextResponse.json({ response });
    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Generate a fallback response using the imported function
      return NextResponse.json({ response: "Could not generate a response. Please try again." });
    }
  } catch (error) {
    console.error('Error in ai-response route:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI response' },
      { status: 500 }
    );
  }
}
