import { NextResponse } from 'next/server';
import { getAiResponse, generateFallbackResponse } from '@/services/llm';

export async function POST(request: Request) {
  console.log('=== AI RESPONSE ROUTE CALLED ===');
  
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
        originalTopic || '',
        gameHistory || [],
        difficulty,
        circleEnabled || false,
        false // Not final round
      );
      
      console.log('AI response generated successfully');
      return NextResponse.json({ response });
    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Generate a fallback response using the imported function
      const fallbackResponse = generateFallbackResponse(topic);
      console.log('Using fallback response:', fallbackResponse);
      
      return NextResponse.json({ response: fallbackResponse });
    }
  } catch (error) {
    console.error('Error in ai-response route:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI response' },
      { status: 500 }
    );
  }
} 