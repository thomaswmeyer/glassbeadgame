import Anthropic from '@anthropic-ai/sdk';
import { LLM_CONFIG } from '@/config/llm';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Difficulty level descriptions for the system prompt
export const difficultyPrompts = {
  secondary: "Your response should use vocabulary and concepts appropriate for high school students. Avoid specialized academic terminology.",
  university: "Your response can use undergraduate university level concepts and some specialized terminology that would be taught in college courses.",
  unlimited: "Your response can use advanced, specialized, and abstract concepts. Feel free to use graduate-level concepts, obscure references, and specialized terminology from any field."
};

export const evaluationDifficultyPrompts = {
  secondary: "Evaluate at a high school level. Use simple language and focus on basic connections between concepts.",
  university: "Evaluate at an undergraduate university level. You can use some specialized terminology and consider more nuanced connections.",
  unlimited: "Evaluate at an advanced level. Consider complex, abstract, and specialized connections between concepts."
};

// Helper function to implement retry logic with exponential backoff
async function callWithRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`API request attempt ${attempt + 1} of ${maxRetries}`);
      return await apiCall();
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
  
  // If we get here, all retries failed
  console.error('All retry attempts failed');
  throw lastError;
}

// Generate a topic for the game
export async function generateTopic(
  category: string,
  subcategory: string,
  difficulty: string,
  recentTopics: string[] = []
): Promise<string> {
  console.log('Preparing to make API request with model:', LLM_CONFIG.model);
  console.log('Temperature setting:', LLM_CONFIG.temperature.creative);
  
  // Create a timestamp to ensure different results each time
  const timestamp = new Date().toISOString();
  
  // Create a list of topics to explicitly avoid (recent topics)
  const topicsToAvoid = recentTopics.length > 0 
    ? `Avoid these recently used topics: ${recentTopics.join(', ')}.` 
    : '';
  
  try {
    const response = await callWithRetry(() => 
      anthropic.messages.create({
        model: LLM_CONFIG.model,
        max_tokens: 100,
        temperature: LLM_CONFIG.temperature.creative,
        system: `You are an assistant for the Glass Bead Game. Generate a single, specific topic for players to respond to. 
        
        The topic should be a single concept, idea, term, or work related to the category: ${category}, specifically in the area of ${subcategory}.
        
        ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts]}
        
        Be creative and varied in your suggestions. Avoid common or overused topics.
        ${topicsToAvoid}
        
        Current timestamp for seed variation: ${timestamp}
        
        Examples of good topics at different levels:
        - Secondary level: Clear, accessible concepts that high school students would understand
        - University level: More specialized concepts taught in undergraduate courses
        - Unlimited level: Advanced, specialized concepts that might be discussed in graduate seminars
        
        For ${subcategory} specifically, think of a unique and interesting concept that isn't commonly discussed.
        
        Provide ONLY the topic name without any explanation or additional text.`,
        messages: [
          {
            role: "user",
            content: `Generate a unique and interesting ${difficulty}-level topic related to ${subcategory} (a type of ${category}) for the Glass Bead Game. The topic should be specific and not generic.`
          }
        ],
      })
    );
    
    console.log('API request successful');
    
    // Extract the text content from the response
    const topic = response.content[0].type === 'text' 
      ? response.content[0].text.trim() 
      : 'Failed to generate a topic';
    
    return topic;
  } catch (error) {
    console.error('Error generating topic:', error);
    throw error;
  }
}

// Get a definition for a topic
export async function getDefinition(topic: string): Promise<string> {
  try {
    const response = await callWithRetry(() => 
      anthropic.messages.create({
        model: LLM_CONFIG.model,
        max_tokens: 250,
        temperature: LLM_CONFIG.temperature.factual,
        system: `You are a knowledgeable assistant providing concise definitions for concepts, terms, or topics. 
        
        When given a topic, provide a brief, clear definition that explains what it is in 2-3 sentences. 
        
        Your definition should be:
        1. Accurate and informative
        2. Concise (no more than 2-3 sentences)
        3. Accessible to a general audience
        4. Free of unnecessary jargon
        
        Provide ONLY the definition without any introductory phrases like "Here's a definition" or "This term refers to".`,
        messages: [
          {
            role: "user",
            content: `Please provide a concise definition for: "${topic}"`
          }
        ],
      })
    );
    
    // Extract the text content from the response
    const definition = response.content[0].type === 'text' 
      ? response.content[0].text.trim() 
      : 'Definition not available.';
    
    return definition;
  } catch (error) {
    console.error('Error fetching definition:', error);
    throw error;
  }
}

// Get an AI response to a topic
export async function getAiResponse(
  topic: string,
  originalTopic: string,
  gameHistory: any[],
  difficulty: string,
  circleEnabled: boolean,
  isFinalRound: boolean
): Promise<string> {
  console.log('Preparing to make API request with model:', LLM_CONFIG.model);
  console.log('Temperature setting:', LLM_CONFIG.temperature.creative);
  
  // Format game history for context
  let historyContext = '';
  let previousResponses: string[] = [];
  
  if (gameHistory && gameHistory.length > 0) {
    historyContext = 'Previous rounds:\n';
    gameHistory.slice(-5).forEach((item: any, index: number) => {
      historyContext += `Round ${gameHistory.length - 5 + index + 1}: Topic "${item.topic}" → ${item.player === 'human' ? 'Human' : 'AI'} responded "${item.response}"\n`;
      
      // Collect previous AI responses to avoid repetition
      if (item.player === 'ai') {
        previousResponses.push(item.response);
      }
    });
  }
  
  // Create a timestamp to ensure different results each time
  const timestamp = new Date().toISOString();
  
  // Create a list of responses to explicitly avoid
  const responsesToAvoid = previousResponses.length > 0 
    ? `Avoid these previously used responses: ${previousResponses.join(', ')}.` 
    : '';
  
  try {
    // For the final round with circle enabled, we need to inform the AI that it needs to connect back to the original topic
    if (isFinalRound && circleEnabled) {
      const response = await callWithRetry(() => 
        anthropic.messages.create({
          model: LLM_CONFIG.model,
          max_tokens: 100,
          temperature: LLM_CONFIG.temperature.creative,
          system: `You are playing the Glass Bead Game, a game of conceptual connections. 
          
          This is the FINAL ROUND of the game. Your task is to respond to the current topic with a brief, thoughtful response 
          that connects to BOTH:
          1. The current topic: "${topic}"
          2. The original starting topic: "${originalTopic}"
          
          Your response should be brief but profound - a single concept or short phrase that 
          creates a meaningful bridge between the current topic and the original topic.
          
          IMPORTANT GUIDELINES FOR CREATIVE CONNECTIONS:
          - Aim to make connections ACROSS DIFFERENT domains of knowledge (e.g., connecting science to art, history to mathematics, etc.)
          - Avoid simply providing scientific names, taxonomic classifications, or technical terms for the same object
          - Avoid providing specific subtypes, variants, or specialized versions of the same concept (e.g., don't respond with "chromesthesia" to "synesthesia")
          - Avoid connections that rely solely on specialized knowledge that only experts in one field would recognize
          - The best connections reveal surprising parallels between seemingly unrelated concepts
          
          ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts]}
          
          Be creative and varied in your responses. Avoid obvious associations and clichés. 
          Try to surprise the player with unexpected but meaningful connections.
          
          ${responsesToAvoid}
          
          Current timestamp for seed variation: ${timestamp}
          
          Consider multiple domains of knowledge when forming your response:
          - Arts and humanities
          - Science and technology
          - Social sciences
          - Natural world
          - Abstract concepts
          
          DO NOT explain your reasoning. ONLY provide the brief response itself.`,
          messages: [
            {
              role: "user",
              content: `${historyContext}
              
              Current topic: "${topic}"
              Original starting topic: "${originalTopic}"
              
              This is the FINAL ROUND. Please provide your brief response that connects to BOTH the current topic AND the original starting topic at a ${difficulty} difficulty level. Be creative and avoid obvious connections or any responses that have been used before in this game.`
            }
          ],
        })
      );
      
      // Extract the text content from the response
      const aiResponse = response.content[0].type === 'text' 
        ? response.content[0].text.trim() 
        : 'Failed to generate a response';
      
      return aiResponse;
    } else {
      // Regular round response
      const response = await callWithRetry(() => 
        anthropic.messages.create({
          model: LLM_CONFIG.model,
          max_tokens: 50,
          temperature: LLM_CONFIG.temperature.creative,
          system: `You are playing the Glass Bead Game, a game of conceptual connections. 
          
          Your task is to respond to a given topic with a brief, thoughtful response 
          (ideally just a few words) that:
          1. Has a semantic distance from the topic
          2. Fits well onto the topic, through similar concepts or associations
          
          Your response should be brief but profound - a single word or short phrase that 
          captures a concept related to the topic in an interesting way.
          
          IMPORTANT GUIDELINES FOR CREATIVE CONNECTIONS:
          - Aim to make connections ACROSS DIFFERENT domains of knowledge (e.g., connecting science to art, history to mathematics, etc.)
          - Avoid simply providing scientific names, taxonomic classifications, or technical terms for the same object
          - Avoid providing specific subtypes, variants, or specialized versions of the same concept (e.g., don't respond with "chromesthesia" to "synesthesia")
          - Avoid connections that rely solely on specialized knowledge that only experts in one field would recognize
          - The best connections reveal surprising parallels between seemingly unrelated concepts
          
          ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts]}
          
          Be creative and varied in your responses. Avoid obvious associations and clichés. 
          Try to surprise the player with unexpected but meaningful connections.
          
          ${responsesToAvoid}
          
          Current timestamp for seed variation: ${timestamp}
          
          Consider multiple domains of knowledge when forming your response:
          - Arts and humanities
          - Science and technology
          - Social sciences
          - Natural world
          - Abstract concepts
          
          DO NOT explain your reasoning. ONLY provide the brief response itself.`,
          messages: [
            {
              role: "user",
              content: `${historyContext}
              
              Current topic: "${topic}"
              
              Please provide your brief response to this topic at a ${difficulty} difficulty level. Be creative and avoid obvious connections or any responses that have been used before in this game.`
            }
          ],
        })
      );
      
      // Extract the text content from the response
      const aiResponse = response.content[0].type === 'text' 
        ? response.content[0].text.trim() 
        : 'Failed to generate a response';
      
      return aiResponse;
    }
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw error;
  }
}

// Evaluate a response
export async function evaluateResponse(
  topic: string,
  response: string,
  difficulty: string,
  originalTopic?: string,
  isFinalRound: boolean = false
): Promise<any> {
  console.log('Preparing to make API request with model:', LLM_CONFIG.model);
  
  try {
    if (isFinalRound && originalTopic) {
      // Final round evaluation with circle mode
      const aiResponse = await callWithRetry(() => 
        anthropic.messages.create({
          model: LLM_CONFIG.model,
          max_tokens: 1000,
          temperature: LLM_CONFIG.temperature.evaluation,
          system: `You are an expert evaluator for the Glass Bead Game, a game of conceptual connections.

          In this game, players take turns responding to concepts with related concepts, creating a chain of meaningful connections.
          
          This is the FINAL ROUND of the game, where the player must connect to BOTH:
          1. The current topic
          2. The original starting topic from the beginning of the game
          
          ${evaluationDifficultyPrompts[difficulty as keyof typeof evaluationDifficultyPrompts]}
          
          Your task is to evaluate the player's response based on:
          
          1. How well it connects to the CURRENT topic
          2. How well it connects back to the ORIGINAL topic
          
          Use the SAME criteria for both connections:
          
          - Semantic Distance (1-10): How semantically remote is the overall topic from the prompt? Higher scores for connections that are not obvious.
          - Similarity (1-10): How well do the ideas map onto each other? For example, stock market crash and flocking behavior.
          
          IMPORTANT SCORING GUIDELINES:
          - Scientific names, taxonomic classifications, or technical terms for the same object should NOT be considered a significant semantic leap. For example, "artichoke" → "Cynara scolymus" should receive a LOW semantic distance score (1-3).
          - Simple translations, synonyms, or alternative names for the same concept should receive a LOW semantic distance score (1-3).
          - Specific subtypes, variants, or specialized versions of the same concept should receive a VERY LOW semantic distance score (1-2). For example, "synesthesia" → "chromesthesia" (a specific type of synesthesia) should score very low on semantic distance.
          - Connections that rely solely on specialized knowledge within a SINGLE domain (e.g., "pica" → "kaolin" both within medical terminology) should receive a MODERATE semantic distance score (4-6).
          - High semantic distance scores (7-10) should be reserved for truly creative connections ACROSS DIFFERENT domains or conceptual frameworks (e.g., connecting a medical concept to architecture, or a historical event to a natural phenomenon).
          - Similarity scores should reflect how well the ideas actually map onto each other in terms of structure, function, or conceptual parallels.
          
          For the final evaluation, provide:
          
          1. A thoughtful evaluation of the connection to the current topic (150-200 words)
          2. A separate evaluation of how well the response connects back to the original topic (100-150 words)
          3. Numerical scores for BOTH connections:
             - Current Topic Connection:
               * Semantic Distance (1-10)
               * Similarity (1-10)
             - Original Topic Connection:
               * Semantic Distance (1-10)
               * Similarity (1-10)
          
          The final score should be calculated as follows:
          - Current Topic Score = Current Topic Semantic Distance + Current Topic Similarity (max 20 points)
          - Original Topic Score = Original Topic Semantic Distance + Original Topic Similarity (max 20 points)
          - Final Score = (Current Topic Score + Original Topic Score) / 2 (max 20 points)
          
          Format your response as a JSON object with the following structure:
          {
            "evaluation": "Your evaluation of the connection to the current topic...",
            "finalEvaluation": "Your evaluation of the connection to the original topic...",
            "scores": {
              "currentConnection": {
                "semanticDistance": X,
                "similarity": Y,
                "subtotal": X+Y
              },
              "originalConnection": {
                "semanticDistance": A,
                "similarity": B,
                "subtotal": A+B
              },
              "total": (X+Y+A+B)/2
            }
          }
          
          IMPORTANT: Your response must be valid JSON that can be parsed by JavaScript's JSON.parse().`,
          messages: [
            {
              role: "user",
              content: `Current topic: "${topic}"
              Original starting topic: "${originalTopic}"
              Player's response: "${response}"
              
              Please evaluate this final round response at a ${difficulty} difficulty level, considering both the connection to the current topic AND the connection back to the original topic using the same criteria for both.`
            }
          ],
        })
      );
      
      // Extract the text content from the response
      const evaluationText = aiResponse.content[0].type === 'text' 
        ? aiResponse.content[0].text.trim() 
        : '{"evaluation": "Failed to evaluate response.", "finalEvaluation": "Failed to evaluate connection to original topic.", "scores": {"currentConnection": {"semanticDistance": 5, "similarity": 5, "subtotal": 10}, "originalConnection": {"semanticDistance": 5, "similarity": 5, "subtotal": 10}, "total": 10}}';
      
      try {
        return JSON.parse(evaluationText);
      } catch (error) {
        console.error('Error parsing evaluation JSON:', error);
        console.error('Raw evaluation text:', evaluationText);
        
        // Fallback response with default values
        return {
          evaluation: "The response shows an interesting connection to the current topic.",
          finalEvaluation: "The response makes a thoughtful connection back to the original topic.",
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
      }
    } else {
      // Regular evaluation
      const aiResponse = await callWithRetry(() => 
        anthropic.messages.create({
          model: LLM_CONFIG.model,
          max_tokens: 1000,
          temperature: LLM_CONFIG.temperature.evaluation,
          system: `You are an expert evaluator for the Glass Bead Game, a game of conceptual connections.

          In this game, players take turns responding to concepts with related concepts, creating a chain of meaningful connections.
          
          ${evaluationDifficultyPrompts[difficulty as keyof typeof evaluationDifficultyPrompts]}
          
          Your task is to evaluate the player's response based on two criteria:
          
          1. Semantic Distance (1-10): How semantically remote is the overall topic from the prompt? Higher scores for connections that are not obvious.
          2. Similarity (1-10): How well do the ideas map onto each other? For example, stock market crash and flocking behavior.
          
          IMPORTANT SCORING GUIDELINES:
          - Scientific names, taxonomic classifications, or technical terms for the same object should NOT be considered a significant semantic leap. For example, "artichoke" → "Cynara scolymus" should receive a LOW semantic distance score (1-3).
          - Simple translations, synonyms, or alternative names for the same concept should receive a LOW semantic distance score (1-3).
          - Specific subtypes, variants, or specialized versions of the same concept should receive a VERY LOW semantic distance score (1-2). For example, "synesthesia" → "chromesthesia" (a specific type of synesthesia) should score very low on semantic distance.
          - Connections that rely solely on specialized knowledge within a SINGLE domain (e.g., "pica" → "kaolin" both within medical terminology) should receive a MODERATE semantic distance score (4-6).
          - High semantic distance scores (7-10) should be reserved for truly creative connections ACROSS DIFFERENT domains or conceptual frameworks (e.g., connecting a medical concept to architecture, or a historical event to a natural phenomenon).
          - Similarity scores should reflect how well the ideas actually map onto each other in terms of structure, function, or conceptual parallels.
          
          For the evaluation, provide:
          
          1. A thoughtful evaluation of the connection (150-200 words)
          2. Numerical scores for each criterion (1-10)
          
          Format your response as a JSON object with the following structure:
          {
            "evaluation": "Your evaluation text here...",
            "scores": {
              "semanticDistance": X,
              "relevanceQuality": Y,
              "total": Z
            }
          }
          
          The total score should be the sum of semanticDistance and relevanceQuality.
          
          IMPORTANT: Your response must be valid JSON that can be parsed by JavaScript's JSON.parse().`,
          messages: [
            {
              role: "user",
              content: `Topic: "${topic}"
              Player's response: "${response}"
              
              Please evaluate this response at a ${difficulty} difficulty level.`
            }
          ],
        })
      );
      
      // Extract the text content from the response
      const evaluationText = aiResponse.content[0].type === 'text' 
        ? aiResponse.content[0].text.trim() 
        : '{"evaluation": "Failed to evaluate response.", "scores": {"semanticDistance": 5, "relevanceQuality": 5, "total": 10}}';
      
      try {
        return JSON.parse(evaluationText);
      } catch (error) {
        console.error('Error parsing evaluation data:', error);
        console.error('Raw evaluation text:', evaluationText);
        
        // Attempt to extract scores using regex as a fallback
        const fallbackData = extractScoresFromText(evaluationText);
        if (fallbackData) {
          console.log('Used fallback parsing method');
          return fallbackData;
        }
        
        // Default fallback
        return {
          evaluation: "The response shows an interesting connection to the topic.",
          scores: {
            semanticDistance: 5,
            relevanceQuality: 5,
            total: 10
          }
        };
      }
    }
  } catch (error) {
    console.error('Error evaluating response:', error);
    throw error;
  }
}

// Helper function to extract scores from text if JSON parsing fails
function extractScoresFromText(text: string) {
  try {
    // Look for semantic distance score
    const semanticDistanceMatch = text.match(/semantic\s*distance\s*:?\s*(\d+)/i);
    // Look for similarity/relevance score
    const similarityMatch = text.match(/similarity|relevance\s*quality\s*:?\s*(\d+)/i);
    
    if (semanticDistanceMatch && similarityMatch) {
      const semanticDistance = parseInt(semanticDistanceMatch[1], 10);
      const relevanceQuality = parseInt(similarityMatch[1], 10);
      
      return {
        evaluation: text,
        scores: {
          semanticDistance,
          relevanceQuality,
          total: semanticDistance + relevanceQuality
        }
      };
    }
  } catch (e) {
    console.error('Error in fallback extraction:', e);
  }
  
  return null;
}

// Generate fallback responses for when the API fails
export function generateFallbackResponse(topic: string): string {
  const fallbackResponses = [
    'Emergent patterns',
    'Structural resonance',
    'Recursive systems',
    'Adaptive complexity',
    'Harmonic oscillation',
    'Symmetry breaking',
    'Threshold effects',
    'Feedback loops',
    'Paradigm shifts',
    'Conceptual frameworks'
  ];
  
  // Generate a pseudo-random index based on the topic and current time
  const seed = topic.length + Date.now() % 100;
  const randomIndex = seed % fallbackResponses.length;
  
  return fallbackResponses[randomIndex];
}

// Generate fallback topics for when the API fails
export function getFallbackTopic(difficulty: string, category: string, subcategory: string): string {
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

// Function to change the LLM model
export function setModel(model: string) {
  LLM_CONFIG.model = model;
  console.log(`LLM model changed to: ${model}`);
}

// Export the current model configuration for reference
export function getModelConfig() {
  return { ...LLM_CONFIG };
} 