import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// List of topic categories to ensure variety
const topicCategories = [
  "scientific concept",
  "philosophical idea",
  "literary work",
  "historical event",
  "mathematical principle",
  "artistic movement",
  "psychological theory",
  "technological innovation",
  "cultural phenomenon",
  "natural process",
  "social construct",
  "political theory",
  "economic concept",
  "musical composition",
  "architectural style"
];

// Difficulty level descriptions for the system prompt
const difficultyPrompts = {
  secondary: "The topic should be appropriate for high school students, using concepts and vocabulary that would be taught in secondary education. Avoid specialized academic terminology.",
  university: "The topic should be at an undergraduate university level, using concepts that would be taught in college courses. Some specialized terminology is acceptable.",
  unlimited: "The topic can be advanced, specialized, and abstract. Feel free to use graduate-level concepts, obscure references, and specialized terminology from any field."
};

export async function POST(request: Request) {
  console.log('=== GENERATE TOPIC ROUTE CALLED ===');
  console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);
  console.log('API Key length:', process.env.ANTHROPIC_API_KEY?.length);
  console.log('API Key first 10 chars:', process.env.ANTHROPIC_API_KEY?.substring(0, 10));
  console.log('API Key last 10 chars:', process.env.ANTHROPIC_API_KEY?.substring(process.env.ANTHROPIC_API_KEY.length - 10));
  
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not defined');
      throw new Error('ANTHROPIC_API_KEY is not defined');
    }
    
    // Parse request body to get difficulty level
    const body = await request.json();
    const difficulty = body.difficulty || 'university'; // Default to university level
    console.log('Requested difficulty level:', difficulty);

    // Select a random category to focus on
    const randomCategory = topicCategories[Math.floor(Math.random() * topicCategories.length)];
    console.log('Selected random category:', randomCategory);

    console.log('Preparing to make API request with model: claude-3-opus-20240229');
    console.log('Temperature setting:', 0.9);
    
    try {
      console.log('Making API request to Anthropic...');
      const response = await anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 100,
        temperature: 0.9,
        system: `You are an assistant for the Glass Bead Game. Generate a single, specific topic for players to respond to. 
        
        The topic should be a single concept, idea, term, or work related to the category: ${randomCategory}.
        
        ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts]}
        
        Be creative and varied in your suggestions. Avoid common or overused topics like "Samsara", "Entropy", or "Duality".
        
        Examples of good topics might include:
        - For scientific concepts: 'Quantum Entanglement', 'Neuroplasticity', 'Symbiosis'
        - For philosophical ideas: 'Categorical Imperative', 'Tabula Rasa', 'Perspectivism'
        - For literary works: 'One Hundred Years of Solitude', 'The Waste Land', 'Moby Dick'
        
        Provide ONLY the topic name without any explanation or additional text.`,
        messages: [
          {
            role: "user",
            content: `Generate a unique and interesting ${difficulty}-level topic related to ${randomCategory} for the Glass Bead Game.`
          }
        ],
      });
      
      console.log('API request successful');
      console.log('Response received:', JSON.stringify(response, null, 2));

      // Extract the text content from the response
      const topic = response.content[0].type === 'text' 
        ? response.content[0].text.trim() 
        : 'Failed to generate a topic';
      
      console.log('Extracted topic:', topic);

      return NextResponse.json({ topic });
    } catch (apiError: any) {
      console.error('=== API REQUEST ERROR ===');
      console.error('Error making API request:', apiError);
      
      if (apiError.response) {
        console.error('Error response status:', apiError.response.status);
        console.error('Error response data:', JSON.stringify(apiError.response.data));
      } else if (apiError.request) {
        console.error('Error request:', apiError.request);
      } else {
        console.error('Error message:', apiError.message);
      }
      
      if (apiError.status) {
        console.error('Error status:', apiError.status);
      }
      
      if (apiError.headers) {
        console.error('Error headers:', JSON.stringify(apiError.headers));
      }
      
      if (apiError.error) {
        console.error('Error details:', JSON.stringify(apiError.error));
      }
      
      throw apiError;
    }
  } catch (error) {
    console.error('=== GENERATE TOPIC ERROR ===');
    console.error('Error generating topic:', error);
    return NextResponse.json(
      { error: 'Failed to generate topic' },
      { status: 500 }
    );
  }
} 