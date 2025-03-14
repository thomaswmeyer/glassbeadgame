import { NextResponse } from 'next/server';
import { generateTopic } from '@/services/llm';

// Categories and subcategories for topic generation
const categories = [
  {
    name: "philosophical concept",
    subcategories: [
      "epistemology", "metaphysics", "ethics", "aesthetics", 
      "logic", "political philosophy", "philosophy of mind",
      "philosophy of language", "existentialism", "phenomenology"
    ]
  },
  {
    name: "scientific concept",
    subcategories: [
      "physics", "biology", "chemistry", "astronomy", 
      "neuroscience", "ecology", "quantum mechanics",
      "evolutionary biology", "genetics", "thermodynamics"
    ]
  },
  {
    name: "mathematical concept",
    subcategories: [
      "geometry", "algebra", "calculus", "number theory", 
      "topology", "statistics", "game theory", "set theory",
      "combinatorics", "differential equations"
    ]
  },
  {
    name: "artistic concept or movement",
    subcategories: [
      "visual arts", "music", "literature", "film", 
      "architecture", "dance", "theater", "poetry",
      "sculpture", "performance art"
    ]
  },
  {
    name: "historical event or period",
    subcategories: [
      "ancient history", "medieval period", "renaissance", 
      "industrial revolution", "world wars", "cold war",
      "decolonization", "civil rights movements", 
      "information age", "cultural revolutions"
    ]
  },
  {
    name: "psychological concept",
    subcategories: [
      "cognitive psychology", "developmental psychology", 
      "social psychology", "clinical psychology", 
      "behavioral psychology", "neuropsychology",
      "personality theory", "perception", "memory", "emotion"
    ]
  },
  {
    name: "sociological concept",
    subcategories: [
      "social structures", "cultural norms", "institutions", 
      "social movements", "inequality", "urbanization",
      "globalization", "social identity", "deviance", "social change"
    ]
  },
  {
    name: "technological concept or system",
    subcategories: [
      "artificial intelligence", "internet", "robotics", 
      "biotechnology", "renewable energy", "space exploration",
      "virtual reality", "cybersecurity", "nanotechnology", "blockchain"
    ]
  },
  {
    name: "religious or spiritual concept",
    subcategories: [
      "world religions", "mysticism", "theology", "rituals", 
      "sacred texts", "religious institutions", "spirituality",
      "religious ethics", "mythology", "religious symbolism"
    ]
  },
  {
    name: "economic concept or system",
    subcategories: [
      "microeconomics", "macroeconomics", "market structures", 
      "monetary policy", "fiscal policy", "international trade",
      "labor economics", "development economics", "behavioral economics", "economic history"
    ]
  }
];

// Store recent topics to avoid repetition
let recentTopics: string[] = [];
const MAX_RECENT_TOPICS = 20;

export async function POST(request: Request) {
  console.log('=== GENERATE TOPIC ROUTE CALLED ===');
  
  try {
    const { difficulty } = await request.json();
    console.log('Requested difficulty level:', difficulty);
    
    // Select a random category and subcategory
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const randomSubcategory = randomCategory.subcategories[
      Math.floor(Math.random() * randomCategory.subcategories.length)
    ];
    
    console.log('Selected random category:', randomCategory.name);
    console.log('Selected random subcategory:', randomSubcategory);
    
    // Generate a topic using our LLM service
    const topic = await generateTopic(
      randomCategory.name,
      randomSubcategory,
      difficulty,
      recentTopics
    );
    
    // Add to recent topics and maintain max length
    recentTopics.push(topic);
    if (recentTopics.length > MAX_RECENT_TOPICS) {
      recentTopics.shift();
    }
    
    console.log('Extracted topic:', topic);
    console.log('Recent topics count:', recentTopics.length);
    
    return NextResponse.json({ topic });
  } catch (error) {
    console.error('Error generating topic:', error);
    return NextResponse.json(
      { error: 'Failed to generate topic. Please try again or check API connectivity.' },
      { status: 500 }
    );
  }
} 