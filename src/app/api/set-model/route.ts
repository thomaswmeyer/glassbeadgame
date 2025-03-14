import { NextResponse } from 'next/server';
import { setModel, getModelConfig } from '@/services/llm';
import { updateModel } from '@/config/llm';

export async function POST(request: Request) {
  console.log('=== SET MODEL ROUTE CALLED ===');
  
  try {
    const { model } = await request.json();
    
    if (!model) {
      return NextResponse.json(
        { error: 'Model name is required' },
        { status: 400 }
      );
    }
    
    console.log('Requested model change to:', model);
    
    // Check if the model is valid
    const validModels = ['sonnet', 'haiku', 'opus', 'deepseek_coder', 'deepseek_lite', 'deepseek_v2'];
    if (!validModels.includes(model)) {
      return NextResponse.json(
        { error: `Invalid model name. Must be one of: ${validModels.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Update the model
    const newModelId = updateModel(model as any); // Using 'any' as a temporary workaround
    setModel(newModelId);
    
    // Get the current configuration
    const currentConfig = getModelConfig();
    
    console.log('Model changed successfully to:', newModelId);
    return NextResponse.json({ 
      success: true, 
      model: newModelId,
      config: currentConfig
    });
  } catch (error) {
    console.error('Error in set-model route:', error);
    return NextResponse.json(
      { error: 'Failed to set model' },
      { status: 500 }
    );
  }
} 