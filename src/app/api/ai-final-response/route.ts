import { NextResponse } from 'next/server';
import { getAiResponse } from '@/services/llm';

export async function POST(request: Request) {
  console.log('=== AI FINAL RESPONSE ROUTE CALLED ===');
  
  try {
    const body = await request.json();
    const { topic, originalTopic, gameHistory, difficulty, circleEnabled } = body;
    
    console.log('Request body received:', {
      topic,
      originalTopicProvided: !!originalTopic,
      gameHistoryCount: gameHistory?.length || 0,
      difficulty,
      circleEnabled
    });
    
    if (!topic || !originalTopic) {
      return NextResponse.json(
        { error: 'Topic and original topic are required' },
        { status: 400 }
      );
    }
    
    console.log('Using difficulty level:', difficulty);
    console.log('Circle mode enabled:', circleEnabled);
    
    try {
      // Get AI final response using our LLM service
      const response = await getAiResponse(
        topic,
        originalTopic,
        gameHistory || [],
        difficulty,
        circleEnabled || false,
        true // Is final round
      );
      
      console.log('AI final response generated successfully');
      return NextResponse.json({ response });
    } catch (error) {
      console.error('Error generating AI final response:', error);
            
      return NextResponse.json({ response: "Could not generate a final response. Please try again." });
    }
  } catch (error) {
    console.error('Error in ai-final-response route:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI final response' },
      { status: 500 }
    );
  }
} 