import { NextResponse } from 'next/server';
import { subjectCategories } from '@/domain/subjectCategories';
import { generateTopic } from '@/services/llm';

// Store recent topics to avoid repetition
const recentTopics: string[] = [];
const MAX_RECENT_TOPICS = 20;

export async function POST(request: Request) {
  console.log('=== GENERATE TOPIC ROUTE CALLED ===');
  
  try {
    const { difficulty, modelKey } = await request.json();
    console.log('Requested difficulty level:', difficulty);
    
    // Select a random category and subcategory
    const randomCategory = subjectCategories[Math.floor(Math.random() * subjectCategories.length)];
    const randomSubcategory = randomCategory.subcategories[
      Math.floor(Math.random() * randomCategory.subcategories.length)
    ];
    
    console.log('Selected random category:', randomCategory.promptName);
    console.log('Selected random subcategory:', randomSubcategory);
    
    // Generate a topic using our LLM service
    const topic = await generateTopic(
      randomCategory.promptName,
      randomSubcategory,
      difficulty,
      recentTopics,
      modelKey
    );
    
    // Add to recent topics and maintain max length
    recentTopics.push(topic);
    if (recentTopics.length > MAX_RECENT_TOPICS) {
      recentTopics.shift();
    }
    
    console.log('Extracted topic:', topic);
    console.log('Recent topics count:', recentTopics.length);
    
    return NextResponse.json({
      topic,
      subjectCategory: randomCategory.id,
    });
  } catch (error) {
    console.error('Error generating topic:', error);
    return NextResponse.json(
      { error: 'Failed to generate topic. Please try again or check API connectivity.' },
      { status: 500 }
    );
  }
}
