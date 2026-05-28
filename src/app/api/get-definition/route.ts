import { NextResponse } from 'next/server';
import { getDefinition } from '@/services/llm';

const MAX_DEFINITION_CACHE_ENTRIES = 100;
const definitionCache = new Map<string, string>();

function normalizeTopic(topic: string) {
  return topic.trim().toLowerCase();
}

function cacheDefinition(topic: string, definition: string) {
  if (definitionCache.size >= MAX_DEFINITION_CACHE_ENTRIES) {
    const oldestKey = definitionCache.keys().next().value;
    if (oldestKey) {
      definitionCache.delete(oldestKey);
    }
  }

  definitionCache.set(normalizeTopic(topic), definition);
}

export async function POST(request: Request) {
  console.log('=== GET DEFINITION ROUTE CALLED ===');
  
  try {
    const { topic, modelKey } = await request.json();
    
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }
    
    console.log('Requested definition for topic:', topic);

    const cachedDefinition = definitionCache.get(normalizeTopic(topic));
    if (cachedDefinition) {
      console.log('Definition served from cache');
      return NextResponse.json({ definition: cachedDefinition, cached: true });
    }
    
    try {
      // Get definition using our LLM service
      const definition = await getDefinition(topic, modelKey);
      cacheDefinition(topic, definition);
      console.log('Definition generated successfully');
      
      return NextResponse.json({ definition, cached: false });
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
