import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not defined');
    }

    const { topic, response } = await request.json();

    if (!topic || !response) {
      return NextResponse.json(
        { error: 'Topic and response are required' },
        { status: 400 }
      );
    }

    const evaluationResponse = await anthropic.messages.create({
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
          content: `Original topic: "${topic}"
          
          Player response: "${response}"
          
          Please evaluate this brief response.`
        }
      ],
    });

    // Extract the text content from the response
    const evaluation = evaluationResponse.content[0].type === 'text' 
      ? evaluationResponse.content[0].text 
      : 'Failed to evaluate the response';

    // Extract scores using regex
    const semanticDistanceMatch = evaluation?.match(/Semantic Distance:?\s*(\d+)/i);
    const relevanceQualityMatch = evaluation?.match(/Relevance and Quality:?\s*(\d+)/i);

    const semanticDistanceScore = semanticDistanceMatch ? parseInt(semanticDistanceMatch[1]) : 5;
    const relevanceQualityScore = relevanceQualityMatch ? parseInt(relevanceQualityMatch[1]) : 5;
    const totalScore = semanticDistanceScore + relevanceQualityScore;

    return NextResponse.json({
      evaluation,
      scores: {
        semanticDistance: semanticDistanceScore,
        relevanceQuality: relevanceQualityScore,
        total: totalScore
      }
    });
  } catch (error) {
    console.error('Error evaluating response:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate response' },
      { status: 500 }
    );
  }
} 