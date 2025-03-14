import Anthropic from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';
import { LLM_CONFIG, currentModelConfig } from '@/config/llm';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Initialize DeepSeek client using OpenAI SDK
const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: LLM_CONFIG.endpoints.deepseek,
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

// Function to get the current model configuration
export function getModelConfig() {
  return {
    model: currentModelConfig.model,
    provider: currentModelConfig.provider,
    temperature: LLM_CONFIG.temperature
  };
}

// Helper function to convert Anthropic-style messages to DeepSeek/OpenAI format
function convertToOpenAIMessages(systemPrompt: string, userMessages: { role: string, content: string }[]) {
  const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = [
    { role: 'system', content: systemPrompt }
  ];
  
  userMessages.forEach(msg => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  });
  
  return messages;
}

// Add a wrapper function for DeepSeek API calls with detailed logging
async function callDeepSeekAPI(params: any) {
  // Log the complete request details
  console.log('=== DEEPSEEK API REQUEST DETAILS ===');
  console.log('Base URL:', LLM_CONFIG.endpoints.deepseek);
  console.log('API Key (first 5 chars):', process.env.DEEPSEEK_API_KEY ? process.env.DEEPSEEK_API_KEY.substring(0, 5) + '...' : 'undefined');
  console.log('Model:', params.model);
  console.log('Request params:', JSON.stringify({
    ...params,
    // Don't log the full messages content to keep logs cleaner
    messages: params.messages ? `[${params.messages.length} messages]` : undefined
  }, null, 2));
  
  try {
    const response = await deepseekClient.chat.completions.create(params);
    console.log('DeepSeek API request successful');
    return response;
  } catch (error: any) {
    console.error('=== DEEPSEEK API ERROR ===');
    console.error('Error status:', error.status);
    console.error('Error message:', error.message);
    console.error('Error details:', error.response?.data || 'No detailed error data');
    console.error('Error headers:', error.response?.headers || 'No headers');
    throw error;
  }
}

// Generate a topic for the game
export async function generateTopic(
  category: string,
  subcategory: string,
  difficulty: string,
  recentTopics: string[] = []
): Promise<string> {
  // Log current model configuration to help debug provider issues
  console.log('=== GENERATE TOPIC API CALL ===');
  console.log('Current model config:', JSON.stringify(currentModelConfig));
  
  // Create a timestamp to ensure different results each time
  const timestamp = new Date().toISOString();
  
  // Create a list of topics to explicitly avoid (recent topics)
  const topicsToAvoid = recentTopics.length > 0 
    ? `Avoid these recently used topics: ${recentTopics.join(', ')}.` 
    : '';
  
  // System prompt for topic generation
  const systemPrompt = `You are an assistant for the Glass Bead Game. Generate a single, specific topic for players to respond to. 
    
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
    
    Provide ONLY the topic name without any explanation or additional text.`;
  
  // User message for topic generation
  const userMessage = `Generate a unique and interesting ${difficulty}-level topic related to ${subcategory} (a type of ${category}) for the Glass Bead Game. The topic should be specific and not generic.`;
  
  // Always use the current provider from currentModelConfig
  // This ensures we're using the most up-to-date provider setting
  if (currentModelConfig.provider === 'anthropic') {
    // Use Anthropic API
    console.log('Using Anthropic API with model:', currentModelConfig.model);
    const response = await callWithRetry(() => 
      anthropic.messages.create({
        model: currentModelConfig.model,
        max_tokens: 100,
        temperature: LLM_CONFIG.temperature.creative,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userMessage
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
  } else if (currentModelConfig.provider === 'deepseek') {
    // Use DeepSeek API
    console.log('Using DeepSeek API with model:', currentModelConfig.model);
    const messages = convertToOpenAIMessages(systemPrompt, [
      { role: 'user', content: userMessage }
    ]);
    
    // Log the full messages for debugging
    console.log('DeepSeek request messages:', JSON.stringify(messages, null, 2));
    
    const response = await callWithRetry(() => 
      callDeepSeekAPI({
        model: currentModelConfig.model,
        messages: messages as any,
        max_tokens: 100,
        temperature: LLM_CONFIG.temperature.creative,
      })
    );
    
    console.log('API request successful');
    
    // Extract the text content from the response
    const topic = response.choices?.[0]?.message?.content?.trim() || 'Failed to generate a topic';
    
    return topic;
  } else {
    throw new Error(`Unsupported provider: ${currentModelConfig.provider}`);
  }
}

// Get a definition for a topic
export async function getDefinition(topic: string): Promise<string> {
  // Log current model configuration to help debug provider issues
  console.log('=== GET DEFINITION API CALL ===');
  console.log('Current model config:', JSON.stringify(currentModelConfig));
  
  // System prompt for definition
  const systemPrompt = `You are a knowledgeable assistant providing concise definitions for concepts, terms, or topics. 
    
    When given a topic, provide a brief, clear definition that explains what it is in 2-3 sentences. 
    
    Your definition should be:
    1. Accurate and informative
    2. Concise (no more than 2-3 sentences)
    3. Accessible to a general audience
    4. Free of unnecessary jargon
    
    Provide ONLY the definition without any introductory phrases like "Here's a definition" or "This term refers to".`;
  
  // User message for definition
  const userMessage = `Please provide a concise definition for: "${topic}"`;
  
  try {
    // Always use the current provider from currentModelConfig
    if (currentModelConfig.provider === 'anthropic') {
      // Use Anthropic API
      console.log('Using Anthropic API with model:', currentModelConfig.model);
      const response = await callWithRetry(() => 
        anthropic.messages.create({
          model: currentModelConfig.model,
          max_tokens: 250,
          temperature: LLM_CONFIG.temperature.factual,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: userMessage
            }
          ],
        })
      );
      
      // Extract the text content from the response
      const definition = response.content[0].type === 'text' 
        ? response.content[0].text.trim() 
        : 'Definition not available.';
      
      return definition;
    } else if (currentModelConfig.provider === 'deepseek') {
      // Use DeepSeek API
      console.log('Using DeepSeek API with model:', currentModelConfig.model);
      const messages = convertToOpenAIMessages(systemPrompt, [
        { role: 'user', content: userMessage }
      ]);
      
      // Log the full messages for debugging
      console.log('DeepSeek request messages:', JSON.stringify(messages, null, 2));
      
      const response = await callWithRetry(() => 
        callDeepSeekAPI({
          model: currentModelConfig.model,
          messages: messages as any,
          max_tokens: 250,
          temperature: LLM_CONFIG.temperature.factual,
        })
      );
      
      // Extract the text content from the response
      const definition = response.choices?.[0]?.message?.content?.trim() || 'Definition not available.';
      
      return definition;
    } else {
      throw new Error(`Unsupported provider: ${currentModelConfig.provider}`);
    }
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
  // Log current model configuration to help debug provider issues
  console.log('=== GET AI RESPONSE API CALL ===');
  console.log('Current model config:', JSON.stringify(currentModelConfig));
  
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
      // System prompt for final round with circle enabled
      const systemPrompt = `You are playing the Glass Bead Game, a game of conceptual connections. 
        
        This is the FINAL ROUND of the game. Your task is to respond to the current topic with a brief, thoughtful response 
        that connects to BOTH:
        1. The current topic: "${topic}"
        2. The original starting topic: "${originalTopic}"
        
        Your response MUST be brief - ideally just a single word or short phrase (1-5 words maximum).
        This brevity is an essential part of the game. DO NOT provide explanations or elaborations.
        
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
        
        DO NOT explain your reasoning. ONLY provide the brief response itself - a single word or short phrase.`;
      
      // User message for final round with circle enabled
      const userMessage = `${historyContext}
        
        Current topic: "${topic}"
        Original starting topic: "${originalTopic}"
        
        This is the FINAL ROUND. Please provide your brief response (1-5 words maximum) that connects to BOTH the current topic AND the original starting topic at a ${difficulty} difficulty level. Be creative and avoid obvious connections or any responses that have been used before in this game.`;
      
      if (currentModelConfig.provider === 'anthropic') {
        // Use Anthropic API
        const response = await callWithRetry(() => 
          anthropic.messages.create({
            model: currentModelConfig.model,
            max_tokens: 100,
            temperature: LLM_CONFIG.temperature.creative,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: userMessage
              }
            ],
          })
        );
        
        // Extract the text content from the response
        const aiResponse = response.content[0].type === 'text' 
          ? response.content[0].text.trim() 
          : 'Connection not found';
        
        return aiResponse;
      } else if (currentModelConfig.provider === 'deepseek') {
        // Use DeepSeek API
        const messages = convertToOpenAIMessages(systemPrompt, [
          { role: 'user', content: userMessage }
        ]);
        
        const response = await callWithRetry(() => 
          callDeepSeekAPI({
            model: currentModelConfig.model,
            messages: messages as any,
            max_tokens: 100,
            temperature: LLM_CONFIG.temperature.creative,
          })
        );
        
        // Extract the text content from the response
        const aiResponse = response.choices?.[0]?.message?.content?.trim() || 'Connection not found';
        
        return aiResponse;
      } else {
        throw new Error(`Unsupported provider: ${currentModelConfig.provider}`);
      }
    } else {
      // Regular round
      // System prompt for regular round
      const systemPrompt = `You are playing the Glass Bead Game, a game of conceptual connections. 
        
        Your task is to respond to the current topic with a brief, thoughtful response that creates 
        an interesting conceptual connection. Your response will become the next topic in the game.
        
        Your response MUST be brief - ideally just a single word or short phrase (1-5 words maximum).
        This brevity is an essential part of the game. DO NOT provide explanations or elaborations.
        
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
        
        DO NOT explain your reasoning. ONLY provide the brief response itself - a single word or short phrase.`;
      
      // User message for regular round
      const userMessage = `${historyContext}
        
        Current topic: "${topic}"
        
        Please provide your brief response (1-5 words maximum) to this topic at a ${difficulty} difficulty level. Be creative and avoid obvious connections or any responses that have been used before in this game.`;
      
      if (currentModelConfig.provider === 'anthropic') {
        // Use Anthropic API
        const response = await callWithRetry(() => 
          anthropic.messages.create({
            model: currentModelConfig.model,
            max_tokens: 100,
            temperature: LLM_CONFIG.temperature.creative,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: userMessage
              }
            ],
          })
        );
        
        // Extract the text content from the response
        const aiResponse = response.content[0].type === 'text' 
          ? response.content[0].text.trim() 
          : 'Connection not found';
        
        return aiResponse;
      } else if (currentModelConfig.provider === 'deepseek') {
        // Use DeepSeek API
        const messages = convertToOpenAIMessages(systemPrompt, [
          { role: 'user', content: userMessage }
        ]);
        
        const response = await callWithRetry(() => 
          callDeepSeekAPI({
            model: currentModelConfig.model,
            messages: messages as any,
            max_tokens: 100,
            temperature: LLM_CONFIG.temperature.creative,
          })
        );
        
        // Extract the text content from the response
        const aiResponse = response.choices?.[0]?.message?.content?.trim() || 'Connection not found';
        
        return aiResponse;
      } else {
        throw new Error(`Unsupported provider: ${currentModelConfig.provider}`);
      }
    }
  } catch (error) {
    console.error('Error getting AI response:', error);
    throw error;
  }
}

// Evaluate a response
export async function evaluateResponse(
  topic: string,
  response: string,
  difficulty: string,
  originalTopic?: string,
  isFinalRound?: boolean
): Promise<any> {
  // Log current model configuration to help debug provider issues
  console.log('=== EVALUATE RESPONSE API CALL ===');
  console.log('Current model config:', JSON.stringify(currentModelConfig));
  
  try {
    if (isFinalRound && originalTopic) {
      // Final round evaluation with circle back to original topic
      // System prompt for final round evaluation
      const systemPrompt = `You are evaluating responses in the Glass Bead Game, a game of conceptual connections.
        
        This is the FINAL ROUND evaluation. You need to evaluate how well the player's response connects to BOTH:
        1. The current topic
        2. The original starting topic
        
        ${evaluationDifficultyPrompts[difficulty as keyof typeof evaluationDifficultyPrompts]}
        
        IMPORTANT: The player's response is intentionally brief - often just a single word or short phrase. 
        This is by design and should NOT be penalized. Brief responses are perfectly acceptable and should be 
        evaluated solely on the quality of the conceptual connection they create, not on their length or elaboration.
        
        Provide your evaluation in the following format:
        
        First, evaluate the connection between the response and the CURRENT topic. Consider:
        - How semantically remote yet meaningfully connected is the response to the current topic? (1-10)
        - How well do the ideas map onto each other in terms of similarity of structure or function? (1-10)
        
        Then, evaluate the connection between the response and the ORIGINAL topic. Consider:
        - How semantically remote yet meaningfully connected is the response to the original topic? (1-10)
        - How well do the ideas map onto each other in terms of similarity of structure or function? (1-10)
        
        The final score will be the average of these two connections.
        
        IMPORTANT: Your response MUST be valid JSON with the following structure:
        {
          "evaluation": "Your evaluation of the connection to the current topic",
          "finalEvaluation": "Your evaluation of the connection to the original topic",
          "scores": {
            "currentConnection": {
              "semanticDistance": X, // 1-10 score for semantic distance to current topic
              "similarity": Y, // 1-10 score for similarity to current topic
              "subtotal": X+Y // Sum of the two scores (max 20)
            },
            "originalConnection": {
              "semanticDistance": X, // 1-10 score for semantic distance to original topic
              "similarity": Y, // 1-10 score for similarity to original topic
              "subtotal": X+Y // Sum of the two scores (max 20)
            },
            "total": Z // Average of the two subtotals (max 20)
          }
        }
        
        Do not include any text before or after the JSON. Only return the JSON object.`;
      
      // User message for final round evaluation
      const userMessage = `Current topic: "${topic}"
        Original starting topic: "${originalTopic}"
        Player's response: "${response}"
        
        Please evaluate how well this response connects to BOTH the current topic AND the original starting topic.`;
      
      // Always use the current provider from currentModelConfig
      if (currentModelConfig.provider === 'anthropic') {
        // Use Anthropic API
        console.log('Using Anthropic API with model:', currentModelConfig.model);
        const result = await callWithRetry(() => 
          anthropic.messages.create({
            model: currentModelConfig.model,
            max_tokens: LLM_CONFIG.maxTokens.evaluation,
            temperature: LLM_CONFIG.temperature.evaluation,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: userMessage
              }
            ],
          })
        );
        
        // Extract the text content from the response
        const evaluationText = result.content[0].type === 'text' 
          ? result.content[0].text.trim() 
          : '{}';
        
        // Parse the JSON response
        try {
          // First try to parse the entire response as JSON
          try {
            const evaluationData = JSON.parse(evaluationText);
            console.log('Evaluation data parsed successfully as direct JSON');
            return evaluationData;
          } catch (directParseError) {
            // If direct parsing fails, try to extract JSON using regex
            console.log('Direct JSON parsing failed, trying regex extraction');
            
            // Find JSON in the response - look for the most complete JSON object
            const jsonMatch = evaluationText.match(/(\{[\s\S]*\})/g);
            
            if (!jsonMatch || jsonMatch.length === 0) {
              console.error('No JSON object found in the response');
              console.error('Raw evaluation text:', evaluationText);
              throw new Error('No JSON object found in the response');
            }
            
            // Find the longest JSON match (most likely to be complete)
            let jsonString = jsonMatch[0];
            if (jsonMatch.length > 1) {
              jsonString = jsonMatch.reduce((longest: string, current: string) => 
                current.length > longest.length ? current : longest, jsonMatch[0]);
              console.log(`Found ${jsonMatch.length} JSON objects, using the longest one`);
            }
            
            // Add debugging output
            console.log('Raw evaluation text:', evaluationText);
            console.log('Extracted JSON string:', jsonString);
            
            // Try to fix common JSON issues
            // Replace single quotes with double quotes
            let fixedJsonString = jsonString.replace(/'/g, '"');
            // Fix unquoted property names
            fixedJsonString = fixedJsonString.replace(/(\w+):/g, '"$1":');
            
            console.log('Fixed JSON string:', fixedJsonString);
            
            const evaluationData = JSON.parse(fixedJsonString);
            console.log('Evaluation data parsed successfully after fixes');
            
            return evaluationData;
          }
        } catch (parseError) {
          console.error('Error parsing evaluation JSON:', parseError);
          // Add debugging output for the error case
          console.error('Raw evaluation text that caused the error:');
          console.error(evaluationText);
          
          // Return a fallback evaluation object
          return {
            evaluation: "Error parsing the evaluation. The response could not be properly evaluated.",
            finalEvaluation: "Error parsing the evaluation.",
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
      } else if (currentModelConfig.provider === 'deepseek') {
        // Use DeepSeek API
        console.log('Using DeepSeek API with model:', currentModelConfig.model);
        const messages = convertToOpenAIMessages(systemPrompt, [
          { role: 'user', content: userMessage }
        ]);
        
        // Create a properly typed response format object
        const responseFormat = { type: "json_object" as const };
        
        const result = await callWithRetry(() => 
          callDeepSeekAPI({
            model: currentModelConfig.model,
            messages: messages as any,
            max_tokens: LLM_CONFIG.maxTokens.evaluation,
            temperature: LLM_CONFIG.temperature.evaluation,
            response_format: responseFormat
          })
        );
        
        // Extract the text content from the response
        const evaluationText = result.choices?.[0]?.message?.content?.trim() || '{}';
        
        // Parse the JSON response
        try {
          // First try to parse the entire response as JSON
          try {
            const evaluationData = JSON.parse(evaluationText);
            console.log('Evaluation data parsed successfully as direct JSON');
            return evaluationData;
          } catch (directParseError) {
            // If direct parsing fails, try to extract JSON using regex
            console.log('Direct JSON parsing failed, trying regex extraction');
            
            // Find JSON in the response
            const jsonMatch = evaluationText.match(/(\{[\s\S]*\})/g);
            
            if (!jsonMatch || jsonMatch.length === 0) {
              console.error('No JSON object found in the response');
              console.error('Raw evaluation text:', evaluationText);
              throw new Error('No JSON object found in the response');
            }
            
            // Find the longest JSON match (most likely to be complete)
            let jsonString = jsonMatch[0];
            if (jsonMatch.length > 1) {
              jsonString = jsonMatch.reduce((longest: string, current: string) => 
                current.length > longest.length ? current : longest, jsonMatch[0]);
              console.log(`Found ${jsonMatch.length} JSON objects, using the longest one`);
            }
            
            // Add debugging output
            console.log('Raw evaluation text:', evaluationText);
            console.log('Extracted JSON string:', jsonString);
            
            const evaluationData = JSON.parse(jsonString);
            console.log('Evaluation data parsed successfully');
            
            return evaluationData;
          }
        } catch (parseError) {
          console.error('Error parsing evaluation JSON:', parseError);
          // Add debugging output for the error case
          console.error('Raw evaluation text that caused the error:');
          console.error(evaluationText);
          
          // Return a fallback evaluation object
          return {
            evaluation: "Error parsing the evaluation. The response could not be properly evaluated.",
            finalEvaluation: "Error parsing the evaluation.",
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
        throw new Error(`Unsupported provider: ${currentModelConfig.provider}`);
      }
    } else {
      // Regular round evaluation
      // System prompt for regular evaluation
      const systemPrompt = `You are evaluating responses in the Glass Bead Game, a game of conceptual connections.
        
        ${evaluationDifficultyPrompts[difficulty as keyof typeof evaluationDifficultyPrompts]}
        
        IMPORTANT: The player's response is intentionally brief - often just a single word or short phrase. 
        This is by design and should NOT be penalized. Brief responses are perfectly acceptable and should be 
        evaluated solely on the quality of the conceptual connection they create, not on their length or elaboration.
        
        Evaluate the player's response to the given topic. Consider:
        
        1. Semantic Distance (1-10): How semantically remote yet meaningfully connected is the response to the topic? 
           - Higher scores for connections that span different domains of knowledge
           - Lower scores for obvious associations or closely related concepts
        
        2. Similarity (1-10): How well do the ideas map onto each other in terms of similarity of structure or function?
           - Higher scores for responses that reveal structural parallels between seemingly unrelated concepts
           - Lower scores for connections that are superficial or rely only on word association
        
        Provide a thoughtful evaluation explaining the connection between the topic and response, 
        and why it deserves the scores you've assigned. Focus on the quality of the conceptual connection,
        not on the brevity of the response.
        
        IMPORTANT: Your response MUST be valid JSON with the following structure:
        {
          "evaluation": "Your evaluation text here, explaining the connection and justifying the scores",
          "scores": {
            "semanticDistance": X, // 1-10 score
            "relevanceQuality": Y, // 1-10 score
            "total": Z // Sum of the two scores (max 20)
          }
        }
        
        Do not include any text before or after the JSON. Only return the JSON object.`;
      
      // User message for regular evaluation
      const userMessage = `Topic: "${topic}"
        Player's response: "${response}"
        
        Please evaluate how well this response connects to the topic.`;
      
      // Always use the current provider from currentModelConfig
      if (currentModelConfig.provider === 'anthropic') {
        // Use Anthropic API
        console.log('Using Anthropic API with model:', currentModelConfig.model);
        const result = await callWithRetry(() => 
          anthropic.messages.create({
            model: currentModelConfig.model,
            max_tokens: LLM_CONFIG.maxTokens.evaluation,
            temperature: LLM_CONFIG.temperature.evaluation,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: userMessage
              }
            ],
          })
        );
        
        // Extract the text content from the response
        const evaluationText = result.content[0].type === 'text' 
          ? result.content[0].text.trim() 
          : '{}';
        
        // Parse the JSON response
        try {
          // First try to parse the entire response as JSON
          try {
            const evaluationData = JSON.parse(evaluationText);
            console.log('Evaluation data parsed successfully as direct JSON');
            return evaluationData;
          } catch (directParseError) {
            // If direct parsing fails, try to extract JSON using regex
            console.log('Direct JSON parsing failed, trying regex extraction');
            
            // Find JSON in the response
            const jsonMatch = evaluationText.match(/(\{[\s\S]*\})/g);
            
            if (!jsonMatch || jsonMatch.length === 0) {
              console.error('No JSON object found in the response');
              console.error('Raw evaluation text:', evaluationText);
              throw new Error('No JSON object found in the response');
            }
            
            // Find the longest JSON match (most likely to be complete)
            let jsonString = jsonMatch[0];
            if (jsonMatch.length > 1) {
              jsonString = jsonMatch.reduce((longest: string, current: string) => 
                current.length > longest.length ? current : longest, jsonMatch[0]);
              console.log(`Found ${jsonMatch.length} JSON objects, using the longest one`);
            }
            
            // Add debugging output
            console.log('Raw evaluation text:', evaluationText);
            console.log('Extracted JSON string:', jsonString);
            
            // Try to fix common JSON issues
            // Replace single quotes with double quotes
            let fixedJsonString = jsonString.replace(/'/g, '"');
            // Fix unquoted property names
            fixedJsonString = fixedJsonString.replace(/(\w+):/g, '"$1":');
            
            console.log('Fixed JSON string:', fixedJsonString);
            
            const evaluationData = JSON.parse(fixedJsonString);
            console.log('Evaluation data parsed successfully after fixes');
            
            return evaluationData;
          }
        } catch (parseError) {
          console.error('Error parsing evaluation JSON:', parseError);
          // Add debugging output for the error case
          console.error('Raw evaluation text that caused the error:');
          console.error(evaluationText);
          
          // Return a fallback evaluation object
          return {
            evaluation: "Error parsing the evaluation. The response could not be properly evaluated.",
            scores: {
              semanticDistance: 5,
              relevanceQuality: 5,
              total: 10
            }
          };
        }
      } else if (currentModelConfig.provider === 'deepseek') {
        // Use DeepSeek API
        console.log('Using DeepSeek API with model:', currentModelConfig.model);
        const messages = convertToOpenAIMessages(systemPrompt, [
          { role: 'user', content: userMessage }
        ]);
        
        // Create a properly typed response format object
        const responseFormat = { type: "json_object" as const };
        
        const result = await callWithRetry(() => 
          callDeepSeekAPI({
            model: currentModelConfig.model,
            messages: messages as any,
            max_tokens: LLM_CONFIG.maxTokens.evaluation,
            temperature: LLM_CONFIG.temperature.evaluation,
            response_format: responseFormat
          })
        );
        
        // Extract the text content from the response
        const evaluationText = result.choices?.[0]?.message?.content?.trim() || '{}';
        
        // Parse the JSON response
        try {
          // First try to parse the entire response as JSON
          try {
            const evaluationData = JSON.parse(evaluationText);
            console.log('Evaluation data parsed successfully as direct JSON');
            return evaluationData;
          } catch (directParseError) {
            // If direct parsing fails, try to extract JSON using regex
            console.log('Direct JSON parsing failed, trying regex extraction');
            
            // Find JSON in the response
            const jsonMatch = evaluationText.match(/(\{[\s\S]*\})/g);
            
            if (!jsonMatch || jsonMatch.length === 0) {
              console.error('No JSON object found in the response');
              console.error('Raw evaluation text:', evaluationText);
              throw new Error('No JSON object found in the response');
            }
            
            // Find the longest JSON match (most likely to be complete)
            let jsonString = jsonMatch[0];
            if (jsonMatch.length > 1) {
              jsonString = jsonMatch.reduce((longest: string, current: string) => 
                current.length > longest.length ? current : longest, jsonMatch[0]);
              console.log(`Found ${jsonMatch.length} JSON objects, using the longest one`);
            }
            
            // Add debugging output
            console.log('Raw evaluation text:', evaluationText);
            console.log('Extracted JSON string:', jsonString);
            
            const evaluationData = JSON.parse(jsonString);
            console.log('Evaluation data parsed successfully');
            
            return evaluationData;
          }
        } catch (parseError) {
          console.error('Error parsing evaluation JSON:', parseError);
          // Add debugging output for the error case
          console.error('Raw evaluation text that caused the error:');
          console.error(evaluationText);
          
          // Return a fallback evaluation object
          return {
            evaluation: "Error parsing the evaluation. The response could not be properly evaluated.",
            scores: {
              semanticDistance: 5,
              relevanceQuality: 5,
              total: 10
            }
          };
        }
      } else {
        throw new Error(`Unsupported provider: ${currentModelConfig.provider}`);
      }
    }
  } catch (error) {
    console.error('Error evaluating response:', error);
    throw error;
  }
} 