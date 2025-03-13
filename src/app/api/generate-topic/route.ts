import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Store recently generated topics to avoid repetition (in-memory cache)
// This will reset when the server restarts
let recentTopics: string[] = [];
const MAX_RECENT_TOPICS = 50;

// Expanded list of topic categories with subcategories for more variety
const topicCategories = {
  "scientific": {
    name: "scientific concept",
    subcategories: [
      "physics", "biology", "chemistry", "astronomy", "neuroscience", 
      "ecology", "genetics", "quantum mechanics", "thermodynamics", "evolution"
    ]
  },
  "philosophical": {
    name: "philosophical idea",
    subcategories: [
      "epistemology", "metaphysics", "ethics", "aesthetics", "logic", 
      "existentialism", "phenomenology", "stoicism", "empiricism", "rationalism"
    ]
  },
  "literary": {
    name: "literary work or concept",
    subcategories: [
      "novel", "poetry", "drama", "literary theory", "narrative technique", 
      "mythology", "folklore", "literary movement", "character archetype", "symbolism"
    ]
  },
  "historical": {
    name: "historical event or period",
    subcategories: [
      "ancient history", "medieval period", "renaissance", "industrial revolution", 
      "world wars", "cold war", "decolonization", "civil rights movement", "ancient civilizations", "revolutions"
    ]
  },
  "mathematical": {
    name: "mathematical principle",
    subcategories: [
      "geometry", "algebra", "calculus", "number theory", "topology", 
      "statistics", "probability", "game theory", "set theory", "fractals"
    ]
  },
  "artistic": {
    name: "artistic movement or concept",
    subcategories: [
      "impressionism", "cubism", "surrealism", "abstract expressionism", "renaissance art", 
      "baroque", "modernism", "postmodernism", "romanticism", "color theory"
    ]
  },
  "psychological": {
    name: "psychological theory or concept",
    subcategories: [
      "cognitive psychology", "behaviorism", "psychoanalysis", "developmental psychology", 
      "social psychology", "memory", "perception", "consciousness", "emotion", "personality"
    ]
  },
  "technological": {
    name: "technological innovation or concept",
    subcategories: [
      "artificial intelligence", "internet", "biotechnology", "renewable energy", 
      "space exploration", "nanotechnology", "robotics", "cryptography", "virtual reality", "telecommunications"
    ]
  },
  "cultural": {
    name: "cultural phenomenon or concept",
    subcategories: [
      "rituals", "traditions", "language", "identity", "globalization", 
      "diaspora", "subcultures", "cultural hybridization", "media influence", "popular culture"
    ]
  },
  "natural": {
    name: "natural process or phenomenon",
    subcategories: [
      "weather patterns", "geological formations", "ecosystems", "animal behavior", 
      "plant adaptations", "natural selection", "symbiotic relationships", "migration", "seasons", "biodiversity"
    ]
  },
  "social": {
    name: "social construct or theory",
    subcategories: [
      "gender", "race", "class", "family structures", "education systems", 
      "social movements", "urbanization", "community formation", "social networks", "institutions"
    ]
  },
  "political": {
    name: "political theory or system",
    subcategories: [
      "democracy", "authoritarianism", "liberalism", "conservatism", "socialism", 
      "anarchism", "federalism", "nationalism", "international relations", "governance"
    ]
  },
  "economic": {
    name: "economic concept or system",
    subcategories: [
      "capitalism", "market structures", "labor theory", "monetary policy", "trade", 
      "development economics", "behavioral economics", "inequality", "public goods", "economic cycles"
    ]
  },
  "musical": {
    name: "musical composition or concept",
    subcategories: [
      "classical", "jazz", "folk", "electronic", "world music", 
      "harmony", "rhythm", "melody", "musical notation", "instrumentation"
    ]
  },
  "architectural": {
    name: "architectural style or concept",
    subcategories: [
      "gothic", "modernist", "brutalist", "art deco", "classical", 
      "sustainable design", "urban planning", "landscape architecture", "interior design", "vernacular architecture"
    ]
  },
  "linguistic": {
    name: "linguistic concept",
    subcategories: [
      "syntax", "semantics", "phonology", "etymology", "sociolinguistics", 
      "historical linguistics", "pragmatics", "language acquisition", "translation theory", "computational linguistics"
    ]
  },
  "religious": {
    name: "religious concept or tradition",
    subcategories: [
      "theology", "mysticism", "ritual practices", "sacred texts", "religious symbolism", 
      "comparative religion", "religious history", "spirituality", "religious ethics", "eschatology"
    ]
  },
  "anthropological": {
    name: "anthropological concept",
    subcategories: [
      "kinship systems", "cultural practices", "material culture", "ethnography", 
      "human evolution", "archaeological methods", "cultural relativism", "social structures", "ritual analysis", "origin myths"
    ]
  }
};

// Difficulty level descriptions for the system prompt
const difficultyPrompts = {
  secondary: "The topic should be appropriate for high school students, using concepts and vocabulary that would be taught in secondary education. Avoid specialized academic terminology.",
  university: "The topic should be at an undergraduate university level, using concepts that would be taught in college courses. Some specialized terminology is acceptable.",
  unlimited: "The topic can be advanced, specialized, and abstract. Feel free to use graduate-level concepts, obscure references, and specialized terminology from any field."
};

export async function POST(request: Request) {
  console.log('=== GENERATE TOPIC ROUTE CALLED ===');
  console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);
  
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not defined');
      throw new Error('ANTHROPIC_API_KEY is not defined');
    }
    
    // Parse request body to get difficulty level
    const body = await request.json();
    const difficulty = body.difficulty || 'university'; // Default to university level
    console.log('Requested difficulty level:', difficulty);

    // Select a random category and subcategory
    const categoryKeys = Object.keys(topicCategories);
    const randomCategoryKey = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
    const category = topicCategories[randomCategoryKey as keyof typeof topicCategories];
    
    const randomSubcategory = category.subcategories[Math.floor(Math.random() * category.subcategories.length)];
    
    console.log('Selected random category:', category.name);
    console.log('Selected random subcategory:', randomSubcategory);

    // Create a timestamp to ensure different results each time
    const timestamp = new Date().toISOString();
    
    // Create a list of topics to explicitly avoid (recent topics)
    const topicsToAvoid = recentTopics.length > 0 
      ? `Avoid these recently used topics: ${recentTopics.join(', ')}.` 
      : '';

    console.log('Preparing to make API request with model: claude-3-sonnet-20240229');
    console.log('Temperature setting:', 0.9);
    
    // Add retry logic with exponential backoff
    const maxRetries = 3;
    let lastError;
    let topic = '';
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`API request attempt ${attempt + 1} of ${maxRetries}`);
        console.log('Making API request to Anthropic...');
        
        const response = await anthropic.messages.create({
          model: "claude-3-sonnet-20240229",
          max_tokens: 100,
          temperature: 0.9,
          system: `You are an assistant for the Glass Bead Game. Generate a single, specific topic for players to respond to. 
          
          The topic should be a single concept, idea, term, or work related to the category: ${category.name}, specifically in the area of ${randomSubcategory}.
          
          ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts]}
          
          Be creative and varied in your suggestions. Avoid common or overused topics.
          ${topicsToAvoid}
          
          Current timestamp for seed variation: ${timestamp}
          
          Examples of good topics at different levels:
          - Secondary level: Clear, accessible concepts that high school students would understand
          - University level: More specialized concepts taught in undergraduate courses
          - Unlimited level: Advanced, specialized concepts that might be discussed in graduate seminars
          
          For ${randomSubcategory} specifically, think of a unique and interesting concept that isn't commonly discussed.
          
          Provide ONLY the topic name without any explanation or additional text.`,
          messages: [
            {
              role: "user",
              content: `Generate a unique and interesting ${difficulty}-level topic related to ${randomSubcategory} (a type of ${category.name}) for the Glass Bead Game. The topic should be specific and not generic.`
            }
          ],
        });
        
        console.log('API request successful');

        // Extract the text content from the response
        topic = response.content[0].type === 'text' 
          ? response.content[0].text.trim() 
          : 'Failed to generate a topic';
        
        console.log('Extracted topic:', topic);
        
        // If we get here, the request was successful
        break;
      } catch (error: any) {
        console.error(`Attempt ${attempt + 1} failed:`, error.message);
        lastError = error;
        
        // Check if we should retry
        if (attempt < maxRetries - 1) {
          // Calculate backoff time: 1s, 2s, 4s, etc.
          const backoffTime = 1000 * Math.pow(2, attempt);
          console.log(`Retrying in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    // If all retries failed, use a fallback topic
    if (!topic) {
      console.error('All retry attempts failed, using fallback topic');
      topic = getFallbackTopic(difficulty || 'university', 'general', 'concept');
    }

    // Add to recent topics and maintain max size
    recentTopics.push(topic);
    if (recentTopics.length > MAX_RECENT_TOPICS) {
      recentTopics.shift();
    }
    
    console.log('Recent topics count:', recentTopics.length);
    
    return NextResponse.json({ topic });
  } catch (error: any) {
    console.error('Error generating topic:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to generate topic';
    let statusCode = 500;
    
    if (error.status === 429) {
      errorMessage = 'Rate limit exceeded, please try again later';
      statusCode = 429;
    } else if (error.status === 504 || error.status === 503) {
      errorMessage = 'Service temporarily unavailable';
      statusCode = 503;
    }
    
    // Use a default difficulty level for the fallback topic
    const defaultDifficulty = 'university';
    
    // Generate a fallback topic
    const fallbackTopic = getFallbackTopic(defaultDifficulty, 'general', 'concept');
    
    return NextResponse.json(
      { topic: fallbackTopic, error: errorMessage },
      { status: statusCode }
    );
  }
}

// Helper function to generate a fallback topic if API calls fail
function getFallbackTopic(difficulty: string, category: string, subcategory: string): string {
  const fallbackTopics = {
    secondary: [
      'Photosynthesis', 'Democracy', 'Gravity', 'Renaissance', 'Ecosystem',
      'Metaphor', 'Momentum', 'Adaptation', 'Harmony', 'Revolution'
    ],
    university: [
      'Game Theory', 'Cognitive Dissonance', 'Paradigm Shift', 'Emergence',
      'Dialectic', 'Entropy', 'Phenomenology', 'Symbiosis', 'Hermeneutics'
    ],
    unlimited: [
      'Apophenia', 'Liminality', 'Hyperobject', 'Rhizome', 'Autopoiesis',
      'Simulacra', 'Epistemic Injustice', 'Heterotopia', 'Panpsychism'
    ]
  };
  
  const difficultyLevel = difficulty as keyof typeof fallbackTopics;
  const topicList = fallbackTopics[difficultyLevel] || fallbackTopics.university;
  
  // Generate a pseudo-random index based on current time
  const randomIndex = Math.floor(Date.now() % topicList.length);
  return topicList[randomIndex];
} 