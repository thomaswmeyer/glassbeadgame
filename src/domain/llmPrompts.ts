export type LegacyAiGameHistoryItem = {
  topic: string;
  response: string;
  player: 'human' | 'ai';
};

export const difficultyPrompts = {
  secondary: 'Use vocabulary and concepts appropriate for high school students. Avoid specialized academic terminology and obscure references.',
  undergrad: 'Use concepts appropriate for a broadly educated undergraduate student. Favor recognizable survey-course ideas, canonical works, and standard concepts. Avoid niche graduate-level mathematics, highly specialized technical terms, and obscure research terminology.',
  university: 'Use concepts appropriate for a broadly educated undergraduate student. Favor recognizable survey-course ideas, canonical works, and standard concepts. Avoid niche graduate-level mathematics, highly specialized technical terms, and obscure research terminology.',
  grad: 'Use graduate-level concepts that may be specialized, but should still be recognizable within a field and not gratuitously obscure.',
  unlimited: 'Use advanced, specialized, and abstract concepts freely. Obscure references, research-level terminology, and highly technical concepts are acceptable.',
};

export const evaluationDifficultyPrompts = {
  secondary: 'Evaluate at a high school level. Use simple language and focus on basic connections between concepts.',
  undergrad: 'Evaluate at an undergraduate level. Use accessible academic language and consider nuanced connections without requiring graduate-level specialization.',
  university: 'Evaluate at an undergraduate level. Use accessible academic language and consider nuanced connections without requiring graduate-level specialization.',
  grad: 'Evaluate at a graduate level. Specialized terminology and field-specific nuance are acceptable when relevant.',
  unlimited: 'Evaluate at an advanced level. Consider complex, abstract, obscure, and specialized connections between concepts.',
};

export type LlmPrompt = {
  systemPrompt: string;
  userMessage: string;
};

export function buildGenerateTopicPrompt(params: {
  category: string;
  subcategory: string;
  difficulty: string;
  recentTopics?: string[];
  timestamp: string;
}): LlmPrompt {
  const topicsToAvoid = params.recentTopics?.length
    ? `Avoid these recently used topics: ${params.recentTopics.join(', ')}.`
    : '';

  return {
    systemPrompt: `You are an assistant for the Glass Bead Game. Generate a single, specific topic for players to respond to. 
    
    The topic should be a single concept, idea, term, or work related to the category: ${params.category}, specifically in the area of ${params.subcategory}.
    
    ${difficultyPrompts[params.difficulty as keyof typeof difficultyPrompts]}
    
    Be creative and varied in your suggestions. Avoid common or overused topics.
    ${topicsToAvoid}
    
    Current timestamp for seed variation: ${params.timestamp}
    
    Examples of good topics at different levels:
    - Secondary level: Clear, accessible concepts that high school students would understand
    - Undergrad level: Recognizable college-level concepts from survey and upper-division courses
    - Grad level: Specialized concepts that may appear in graduate seminars
    - Unlimited level: Research-level, obscure, or highly technical concepts
    
    For ${params.subcategory} specifically, think of a unique and interesting concept that isn't commonly discussed.
    
    Provide ONLY the topic name without any explanation or additional text.`,
    userMessage: `Generate a unique and interesting ${params.difficulty}-level topic related to ${params.subcategory} (a type of ${params.category}) for the Glass Bead Game. The topic should be specific and not generic.`,
  };
}

export function buildDefinitionPrompt(topic: string): LlmPrompt {
  return {
    systemPrompt: `You are a knowledgeable assistant providing concise definitions for concepts, terms, or topics. 
    
    When given a topic, provide a brief, clear definition that explains what it is in 1-2 complete sentences.
    
    Your definition should be:
    1. Accurate and informative
    2. Concise (no more than 80 words)
    3. Accessible to a general audience
    4. Free of unnecessary jargon
    5. Written as complete sentences, never ending mid-thought
    
    Provide ONLY the definition without any introductory phrases like "Here's a definition" or "This term refers to".`,
    userMessage: `Please provide a concise definition for: "${topic}"`,
  };
}

export function buildAiResponsePrompt(params: {
  topic: string;
  originalTopic: string;
  gameHistory: LegacyAiGameHistoryItem[];
  difficulty: string;
  circleEnabled: boolean;
  isFinalRound: boolean;
  timestamp: string;
}): LlmPrompt {
  const { historyContext, responsesToAvoid } = getAiHistoryContext(params.gameHistory);
  const difficultyPrompt = difficultyPrompts[params.difficulty as keyof typeof difficultyPrompts];

  if (params.isFinalRound && params.circleEnabled) {
    return {
      systemPrompt: `You are playing the Glass Bead Game, a game of conceptual connections. 
        
        This is the FINAL ROUND of the game. Your task is to respond to the current topic with a brief, thoughtful response 
        that connects to BOTH:
        1. The current topic: "${params.topic}"
        2. The original starting topic: "${params.originalTopic}"
        
        Your response MUST be brief - ideally just a single word or short phrase (1-5 words maximum).
        This brevity is an essential part of the game. DO NOT provide explanations or elaborations.
        
        IMPORTANT GUIDELINES FOR CREATIVE CONNECTIONS:
        - Aim to make connections ACROSS DIFFERENT domains of knowledge (e.g., connecting science to art, history to mathematics, etc.)
        - Avoid simply providing scientific names, taxonomic classifications, or technical terms for the same object
        - Avoid providing specific subtypes, variants, or specialized versions of the same concept (e.g., don't respond with "chromesthesia" to "synesthesia")
        - Avoid connections that rely solely on specialized knowledge that only experts in one field would recognize
        - The best connections reveal surprising parallels between seemingly unrelated concepts
        
        ${difficultyPrompt}
        
        Be creative and varied in your responses. Avoid obvious associations and clichés. 
        Try to surprise the player with unexpected but meaningful connections.
        
        ${responsesToAvoid}
        
        Current timestamp for seed variation: ${params.timestamp}
        
        Consider multiple domains of knowledge when forming your response:
        - Arts and humanities
        - Science and technology
        - Social sciences
        - Natural world
        - Abstract concepts
        
        DO NOT explain your reasoning. ONLY provide the brief response itself - a single word or short phrase.`,
      userMessage: `${historyContext}
        
        Current topic: "${params.topic}"
        Original starting topic: "${params.originalTopic}"
        
        This is the FINAL ROUND. Please provide your brief response (1-5 words maximum) that connects to BOTH the current topic AND the original starting topic at a ${params.difficulty} difficulty level. Be creative and avoid obvious connections or any responses that have been used before in this game.`,
    };
  }

  return {
    systemPrompt: `You are playing the Glass Bead Game, a game of conceptual connections. 
        
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
        
        ${difficultyPrompt}
        
        Be creative and varied in your responses. Avoid obvious associations and clichés. 
        Try to surprise the player with unexpected but meaningful connections.
        
        ${responsesToAvoid}
        
        Current timestamp for seed variation: ${params.timestamp}
        
        Consider multiple domains of knowledge when forming your response:
        - Arts and humanities
        - Science and technology
        - Social sciences
        - Natural world
        - Abstract concepts
        
        DO NOT explain your reasoning. ONLY provide the brief response itself - a single word or short phrase.`,
    userMessage: `${historyContext}
        
        Current topic: "${params.topic}"
        
        Please provide your brief response (1-5 words maximum) to this topic at a ${params.difficulty} difficulty level. Be creative and avoid obvious connections or any responses that have been used before in this game.`,
  };
}

export function buildEvaluationPrompt(params: {
  topic: string;
  response: string;
  difficulty: string;
  originalTopic?: string;
  isFinalRound?: boolean;
}): LlmPrompt {
  const difficultyPrompt = evaluationDifficultyPrompts[
    params.difficulty as keyof typeof evaluationDifficultyPrompts
  ];

  if (params.isFinalRound && params.originalTopic) {
    return {
      systemPrompt: `You are evaluating responses in the Glass Bead Game, a game of conceptual connections.
        
        This is the FINAL ROUND evaluation. You need to evaluate how well the player's response connects to BOTH:
        1. The current topic
        2. The original starting topic
        
        ${difficultyPrompt}
        
        IMPORTANT: The player's response is intentionally brief - often just a single word or short phrase. 
        This is by design and should NOT be penalized. Brief responses are perfectly acceptable and should be 
        evaluated solely on the quality of the conceptual connection they create, not on their length or elaboration.
        
        Provide your evaluation in the following format:
        
        First, evaluate the connection between the response and the CURRENT topic. Consider:
        - How semantically remote yet meaningfully connected is the response to the current topic? (1-10)
        - How relevant is the response as a meaningful connection, beyond simple word association? (1-10)
        
        Then, evaluate the connection between the response and the ORIGINAL topic. Consider:
        - How semantically remote yet meaningfully connected is the response to the original topic? (1-10)
        - How relevant is the response as a meaningful connection, beyond simple word association? (1-10)
        
        Each connection subtotal is semantic distance multiplied by relevance. The final score will be
        the average of these two connection subtotals.
        
        IMPORTANT: Your response MUST be valid JSON with the following structure:
        {
          "evaluation": "Your evaluation of the connection to the current topic",
          "finalEvaluation": "Your evaluation of the connection to the original topic",
          "scores": {
            "currentConnection": {
              "semanticDistance": X, // 1-10 score for semantic distance to current topic
              "relevance": Y, // 1-10 score for relevance to current topic
              "subtotal": X*Y // Product of the two scores (max 100)
            },
            "originalConnection": {
              "semanticDistance": X, // 1-10 score for semantic distance to original topic
              "relevance": Y, // 1-10 score for relevance to original topic
              "subtotal": X*Y // Product of the two scores (max 100)
            },
            "total": Z // Average of the two subtotals (max 100)
          }
        }
        
        Do not include any text before or after the JSON. Only return the JSON object.`,
      userMessage: `Current topic: "${params.topic}"
        Original starting topic: "${params.originalTopic}"
        Player's response: "${params.response}"
        
        Please evaluate how well this response connects to BOTH the current topic AND the original starting topic.`,
    };
  }

  return {
    systemPrompt: `You are evaluating responses in the Glass Bead Game, a game of conceptual connections.
        
        ${difficultyPrompt}
        
        IMPORTANT: The player's response is intentionally brief - often just a single word or short phrase. 
        This is by design and should NOT be penalized. Brief responses are perfectly acceptable and should be 
        evaluated solely on the quality of the conceptual connection they create, not on their length or elaboration.
        
        Evaluate the player's response to the given topic. Consider:
        
        1. Semantic Distance (1-10): How semantically remote yet meaningfully connected is the response to the topic? 
           - Higher scores for connections that span different domains of knowledge
           - Lower scores for obvious associations or closely related concepts
        
        2. Relevance (1-10): How relevant is the response as a meaningful connection, beyond simple word association?
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
            "total": Z // Product of the two scores (max 100)
          }
        }
        
        Do not include any text before or after the JSON. Only return the JSON object.`,
    userMessage: `Topic: "${params.topic}"
        Player's response: "${params.response}"
        
        Please evaluate how well this response connects to the topic.`,
  };
}

function getAiHistoryContext(gameHistory: LegacyAiGameHistoryItem[]) {
  let historyContext = '';
  const previousResponses: string[] = [];

  if (gameHistory.length > 0) {
    historyContext = 'Previous rounds:\n';
    gameHistory.slice(-5).forEach((item, index) => {
      historyContext += `Round ${gameHistory.length - 5 + index + 1}: Topic "${item.topic}" → ${item.player === 'human' ? 'Human' : 'AI'} responded "${item.response}"\n`;

      if (item.player === 'ai') {
        previousResponses.push(item.response);
      }
    });
  }

  return {
    historyContext,
    responsesToAvoid: previousResponses.length > 0
      ? `Avoid these previously used responses: ${previousResponses.join(', ')}.`
      : '',
  };
}
