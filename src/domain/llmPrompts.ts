import { formatScoringCalibrationExamples } from './scoringCalibration';
import { formatSubjectCategoryPromptOptions } from './subjectCategories';
import { MAX_CONCEPT_WORDS } from './conceptRules';

export type LegacyAiGameHistoryItem = {
  topic: string;
  response: string;
  player: 'human' | 'ai';
};

export type AiResponsePromptNode = {
  id: string;
  topic: string;
  definition?: string;
  subjectCategory?: string;
  isCurrentSource?: boolean;
};

export const difficultyPrompts = {
  secondary: 'Use familiar high school level concepts and vocabulary. Prefer concepts commonly taught in secondary school or widely understood from everyday life. Do not use named theorems, conjectures, graduate mathematics, specialized academic terminology, obscure references, or research-level ideas. If the category is mathematics, use topics like symmetry, fractions, probability, triangles, graphs, prime numbers, or ratios rather than advanced named results.',
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
    The topic must be ${MAX_CONCEPT_WORDS} words or fewer. Prefer 1-3 words.
    Do not return a sentence, research question, subtitle, explanation, compound prompt, or multiple topics joined by "+", "/", or ":".
    Bad opening topic: "The hermeneutic significance of the Masoretic Text's qere/ketiv distinctions in interpreting paradoxical divine pronouncements in the Pentateuch + textual criticism"
    Good opening topics: "Textual criticism", "Masoretic Text", "Hermeneutics", "Pentateuch".
    
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
    
    Return only valid JSON with this exact shape:
    {
      "topic": "single topic name"
    }

    Do not include explanations, markdown, or any text outside the JSON object.`,
    userMessage: `Generate a unique and interesting ${params.difficulty}-level topic related to ${params.subcategory} (a type of ${params.category}) for the Glass Bead Game. The topic should be specific and not generic. Return only JSON.`,
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
  availableNodes?: AiResponsePromptNode[];
  gameHistory: LegacyAiGameHistoryItem[];
  difficulty: string;
  timestamp: string;
}): LlmPrompt {
  const { historyContext, responsesToAvoid } = getAiHistoryContext(params.gameHistory);
  const difficultyPrompt = difficultyPrompts[params.difficulty as keyof typeof difficultyPrompts];
  const sourceSelectionPrompt = getAiSourceSelectionPrompt(params.availableNodes || []);

  return {
    systemPrompt: `You are playing the Glass Bead Game, a game of conceptual connections. 
        
        Your task is to choose one or more source nodes from the board and give a brief, thoughtful response that creates
        an interesting conceptual connection. Your response will become the next topic in the game.
        
        Your response MUST be brief - ideally just a single word or short phrase (${MAX_CONCEPT_WORDS} words maximum).
        If your response would be more than ${MAX_CONCEPT_WORDS} words, choose a shorter established topic instead.
        This brevity is an essential part of the game. DO NOT provide explanations or elaborations.
        Your response must be a recognizable topic that could plausibly have a concise encyclopedia-style
        definition: a concept, term, object, event, work, practice, theory, place, or phenomenon.
        Use an established topic name. Do not coin a new phrase by combining evocative words.
        Avoid invented poetic phrases, private metaphors, vibes, or word-salad compounds, even if
        they sound beautiful or thematically appropriate.
        Before answering, silently ask: "Could a knowledgeable person look this up or define it
        without treating it as my own metaphor?" If not, choose a different topic.
        Bad invented responses: "exodus of memory", "stoic architecture", "algorithmic longing",
        "cathedral of silence".
        Better established responses: "oral tradition", "Stoicism", "Roman architecture",
        "memory palace", "Brutalism", "mnemonics".
        
        You must choose one or more source nodes for this move. Do not default to the most recent node.
        First scan the full board and choose the move you expect to receive the highest final score.
        A single excellent edge is often better than several merely plausible edges. Select multiple
        source nodes only when the same new topic makes each selected edge strong enough to overcome
        the multi-source penalty.
        Each selected source creates a separate edge to your new topic. Each edge is scored as semantic
        distance * relevance. If you select N source nodes, the turn score is round(sum(edgeScores) / sqrt(N)),
        so adding a source helps only if its additional edge raises that penalized final score.

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
        
        IMPORTANT: Your response MUST be valid JSON with this structure:
        {
          "selectedSourceNodeIds": ["one or more node ids from the available list"],
          "responseText": "your brief established topic",
          "topicValidityNote": "brief note explaining why this is a recognized topic"
        }

        Do not include any text before or after the JSON. Only return the JSON object.`,
    userMessage: `${historyContext}
        
        There is no required current topic. You have complete freedom to choose any one or more source nodes from the available list.
        ${sourceSelectionPrompt}
        
        Please choose source nodes and provide your brief response (${MAX_CONCEPT_WORDS} words maximum) at a ${params.difficulty} difficulty level. Be creative and avoid obvious connections or any responses that have been used before in this game.`,
  };
}

function getAiSourceSelectionPrompt(availableNodes: AiResponsePromptNode[]) {
  if (availableNodes.length === 0) return '';

  const nodeList = availableNodes.map(node => {
    const details = [
      `id: ${node.id}`,
      `topic: "${node.topic}"`,
      node.subjectCategory ? `subject: ${node.subjectCategory}` : '',
      node.definition ? `definition: ${node.definition}` : '',
    ].filter(Boolean);

    return `- ${details.join('; ')}`;
  }).join('\n');

  return `
        Available source nodes:
${nodeList}

        No source node is preselected for you. Choose freely from the full list based on the strongest final-scoring move you can make, not recency or UI selection. Compare one-source, two-source, and three-source options using round(sum(edgeScores) / sqrt(N)); use multiple sources only when the penalized combined score is likely higher than the best single-source move.
        Only choose node ids from this list.`;
}

export function buildEvaluationPrompt(params: {
  topic: string;
  response: string;
  difficulty: string;
}): LlmPrompt {
  const difficultyPrompt = evaluationDifficultyPrompts[
    params.difficulty as keyof typeof evaluationDifficultyPrompts
  ];
  const scoringCalibrationText = formatScoringCalibrationExamples();
  const subjectCategoryOptions = formatSubjectCategoryPromptOptions();
  const scoringCalibrationInstructions = [
    'Use the full 1-10 range for each score. Do not cluster most scores in the middle.',
    '',
    'Calibration anchors:',
    scoringCalibrationText,
    '',
    'Treat semantic distance and relevance as independent axes:',
    '- High semantic distance means the concepts come from remote domains or frames.',
    '- High relevance means the response creates a meaningful, defensible connection.',
    '- A distant but weakly connected response should have high distance and low relevance.',
    '- An obvious but very apt response should have low distance and high relevance.',
  ].join('\n');

  return {
    systemPrompt: `You are evaluating responses in the Glass Bead Game, a game of conceptual connections.
        
        ${difficultyPrompt}
        
        IMPORTANT: The player's response is intentionally brief - often just a single word or short phrase. 
        This is by design and should NOT be penalized. Brief responses are perfectly acceptable and should be 
        evaluated solely on the quality of the conceptual connection they create, not on their length or elaboration.
        
        ${scoringCalibrationInstructions}

        Evaluate the player's response to the given topic. Consider:
        
        1. Semantic Distance (1-10): How semantically remote yet meaningfully connected is the response to the topic? 
           - Higher scores for connections that span different domains of knowledge
           - Lower scores for obvious associations or closely related concepts
        
        2. Relevance (1-10): How relevant is the response as a meaningful connection, beyond simple word association?
           - Higher scores for responses that reveal structural parallels between seemingly unrelated concepts
           - Lower scores for connections that are superficial or rely only on word association
        
        Provide a thoughtful evaluation explaining the connection between the topic and response, 
        and why it deserves the scores you've assigned. Focus on the quality of the conceptual connection,
        not on the brevity of the response.  It should not be based on highly poetic analogies, but on the
        actual shapes of the two concepts.  Feel free to argue that it is weakly connected or not connected
        at all, like axolotl and mortgage rates.  Would this connection work equally well if either concept
        were replaced by a different concept from the same domain?
        
        Also classify the player's response into exactly one destination subject category.
        Allowed destinationSubjectCategory values: ${subjectCategoryOptions}.

        IMPORTANT: Your response MUST be valid JSON with the following structure:
        {
          "evaluation": "Your evaluation text here, explaining the connection and justifying the scores",
          "destinationSubjectCategory": "one allowed category id",
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
