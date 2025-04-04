import { NextResponse } from 'next/server';
import { currentModelConfig, LLM_CONFIG, updateModel } from '@/config/llm';
import { generateTopic } from '@/services/llm';

export async function POST(request: Request) {
  try {
    // Check if we're in production mode
    if (LLM_CONFIG.production.isProduction) {
      return NextResponse.json(
        { 
          error: 'Model selection is disabled in production mode',
          config: {
            model: currentModelConfig.model,
            provider: currentModelConfig.provider,
            displayName: LLM_CONFIG.models[LLM_CONFIG.production.defaultModel as keyof typeof LLM_CONFIG.models].displayName
          }
        },
        { status: 403 }
      );
    }
    
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
    
    console.log(`Model updated to: ${model}`);
    
    // For DeepSeek models, perform a test request to verify the API is working
    let testResult = null;
    let testError = null;
    
    if (currentModelConfig.provider === 'deepseek') {
      try {
        console.log('Performing test request to DeepSeek API...');
        // Use a simple test request to verify the API is working
        const testCategory = 'test';
        const testSubcategory = 'verification';
        const testDifficulty = 'university';
        
        // We don't actually need the result, just to verify the API call works
        await generateTopic(testCategory, testSubcategory, testDifficulty);
        
        testResult = 'DeepSeek API test successful';
        console.log(testResult);
      } catch (error: any) {
        testError = {
          message: error.message,
          status: error.status,
          details: error.response?.data || 'No detailed error data'
        };
        console.error('DeepSeek API test failed:', testError);
        
        // We don't throw the error here, we just log it and include it in the response
        // This allows the UI to show the error but still switch to the model
      }
    }
    
    // Return the current configuration
    return NextResponse.json({
      success: true,
      message: `Model changed to ${LLM_CONFIG.models[model as keyof typeof LLM_CONFIG.models].displayName}`,
      config: {
        model: currentModelConfig.model,
        provider: currentModelConfig.provider,
        displayName: LLM_CONFIG.models[model as keyof typeof LLM_CONFIG.models].displayName
      },
      testResult,
      testError
    });
  } catch (error: any) {
    console.error('Error setting model:', error);
    return NextResponse.json(
      { 
        error: 'Failed to set model',
        details: error.message
      },
      { status: 500 }
    );
  }
} 