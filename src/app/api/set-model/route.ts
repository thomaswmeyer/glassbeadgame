import { NextResponse } from 'next/server';
import { LLM_CONFIG, updateModel } from '@/config/llm';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { model } = body;
    
    if (!model) {
      return NextResponse.json(
        { error: 'Model name is required' },
        { status: 400 }
      );
    }
    
    // Get the list of valid model keys from the LLM_CONFIG
    const validModels = Object.keys(LLM_CONFIG.models);
    
    if (!validModels.includes(model)) {
      return NextResponse.json(
        { error: `Invalid model name. Valid models are: ${validModels.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Update the model
    updateModel(model);
    
    // Return the current configuration
    return NextResponse.json({
      success: true,
      message: `Model changed to ${LLM_CONFIG.models[model as keyof typeof LLM_CONFIG.models].displayName}`,
      config: {
        model: LLM_CONFIG.model,
        provider: LLM_CONFIG.provider,
        displayName: LLM_CONFIG.models[model as keyof typeof LLM_CONFIG.models].displayName
      }
    });
  } catch (error) {
    console.error('Error setting model:', error);
    return NextResponse.json(
      { error: 'Failed to set model' },
      { status: 500 }
    );
  }
} 