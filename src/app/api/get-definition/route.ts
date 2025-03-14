import { NextResponse } from 'next/server';
import { getDefinition } from '@/services/llm';

export async function POST(request: Request) {
  console.log('=== GET DEFINITION ROUTE CALLED ===');
  
  try {
    const { topic } = await request.json();
    
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }
    
    console.log('Requested definition for topic:', topic);
    
    try {
      // Get definition using our LLM service
      const definition = await getDefinition(topic);
      console.log('Definition generated successfully');
      
      return NextResponse.json({ definition });
    } catch (error) {
      console.error('Error getting definition:', error);
      
      // Provide a simple fallback definition
      return NextResponse.json({ 
        definition: `${topic} is a concept that could not be defined at this time due to a technical issue.` 
      });
    }
  } catch (error) {
    console.error('Error in get-definition route:', error);
    return NextResponse.json(
      { error: 'Failed to get definition' },
      { status: 500 }
    );
  }
} 