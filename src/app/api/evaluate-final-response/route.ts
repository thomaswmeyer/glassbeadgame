import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: Request) {
  console.log('=== EVALUATE FINAL RESPONSE ROUTE CALLED ===');
  console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);
  console.log('API Key length:', process.env.ANTHROPIC_API_KEY?.length);
  console.log('API Key first 10 chars:', process.env.ANTHROPIC_API_KEY?.substring(0, 10));
  console.log('API Key last 10 chars:', process.env.ANTHROPIC_API_KEY?.substring(process.env.ANTHROPIC_API_KEY.length - 10));
  
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not defined');
      throw new Error('ANTHROPIC_API_KEY is not defined');
    }

    const { currentTopic, originalTopic, response } = await request.json();
    console.log('Request body received:', { currentTopic, originalTopic, response });

    if (!currentTopic || !originalTopic || !response) {
      console.error('Missing required parameters:', { currentTopic, originalTopic, response });
      return NextResponse.json(
        { error: 'Current topic, original topic, and response are required' },
        { status: 400 }
      );
    }

    console.log('Evaluating connection to current topic...');
    // First evaluate the connection to the current topic
    const currentTopicEvaluation = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 500,
      temperature: 0.5,
      system: `You are an evaluator for the Glass Bead Game. You will score player responses 
      based on two criteria:
          
      1. Semantic Distance (1-10): How far the response has moved from the current topic.  Completely
         different areas are preferred over obvious connections.
      
      2. Relevance and Quality (1-10): How closely the response maps onto the existing topic.
      
      The player's response will be brief (a few words or a short phrase). Evaluate it based 
      on the quality of the connection made, not on length or elaboration.
      
      Keep your evaluation brief and focused. Provide a score for each criterion with a 1-2 sentence explanation for each score. 
      The total score will be the sum of these two values.`,
      messages: [
        {
          role: "user",
          content: `Original topic: "${currentTopic}"
          
          Player response: "${response}"
          
          Please evaluate this brief response.`
        }
      ],
    });

    // Extract the text content from the response
    const evaluation = currentTopicEvaluation.content[0].type === 'text' 
      ? currentTopicEvaluation.content[0].text 
      : 'Failed to evaluate the response';

    // Extract scores using regex
    const semanticDistanceMatch = evaluation?.match(/Semantic Distance:?\s*(\d+)/i);
    const relevanceQualityMatch = evaluation?.match(/Relevance and Quality:?\s*(\d+)/i);

    const semanticDistanceScore = semanticDistanceMatch ? parseInt(semanticDistanceMatch[1]) : 5;
    const relevanceQualityScore = relevanceQualityMatch ? parseInt(relevanceQualityMatch[1]) : 5;
    
    console.log('Evaluating connection to original topic...');
    // Now evaluate the connection back to the original topic
    const originalTopicEvaluation = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 500,
      temperature: 0.5,
      system: `You are an evaluator for the Glass Bead Game. In the final round, players must connect their response
      back to the original starting topic of the game. You will evaluate how well the player's response connects
      to the original topic on a scale of 1-10.
      
      The player's response will be brief (a few words or a short phrase). Evaluate it based 
      on the quality of the connection made, not on length or elaboration.
      
      Keep your evaluation brief and focused. Provide a score with a 2-3 sentence explanation.`,
      messages: [
        {
          role: "user",
          content: `Original starting topic: "${originalTopic}"
          Current topic: "${currentTopic}"
          Player response: "${response}"
          
          Please evaluate how well this response connects back to the original starting topic "${originalTopic}".`
        }
      ],
    });

    // Extract the text content from the response
    const finalEvaluation = originalTopicEvaluation.content[0].type === 'text' 
      ? originalTopicEvaluation.content[0].text 
      : 'Failed to evaluate the connection to the original topic';

    // Extract original topic connection score using regex
    const originalTopicScoreMatch = finalEvaluation?.match(/score:?\s*(\d+)/i) || finalEvaluation?.match(/(\d+)\/10/i);
    const originalTopicScore = originalTopicScoreMatch ? parseInt(originalTopicScoreMatch[1]) : 5;
    
    console.log('Scores:', {
      semanticDistance: semanticDistanceScore,
      relevanceQuality: relevanceQualityScore,
      originalTopicConnection: originalTopicScore
    });
    
    // Calculate final score as average of current topic total and original topic connection
    const currentTopicTotal = semanticDistanceScore + relevanceQualityScore;
    const finalScore = Math.round((currentTopicTotal + originalTopicScore) / 1.5); // Weighted slightly toward current topic
    
    console.log('Final score:', finalScore);

    return NextResponse.json({
      evaluation,
      finalEvaluation,
      scores: {
        semanticDistance: semanticDistanceScore,
        relevanceQuality: relevanceQualityScore,
        total: finalScore
      }
    });
  } catch (error) {
    console.error('Error evaluating final response:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate final response' },
      { status: 500 }
    );
  }
} 