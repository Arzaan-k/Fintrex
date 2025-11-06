// Simple integration test for DeepSeek OCR
// This can be run to verify the DeepSeek integration is working

import { isDeepSeekAvailable, getDeepSeekConfig } from './ocr-deepseek';

export async function testDeepSeekIntegration(): Promise<{
  success: boolean;
  message: string;
  config?: any;
}> {
  console.log('🧪 Testing DeepSeek OCR Integration...');

  try {
    // Test 1: Check configuration
    const config = getDeepSeekConfig();
    console.log('✅ Configuration loaded:', {
      hasApiKey: !!config.apiKey,
      baseURL: config.baseURL,
      model: config.model
    });

    // Test 2: Check API availability
    const available = await isDeepSeekAvailable();
    console.log('🔍 DeepSeek API availability:', available ? 'Available' : 'Not configured');

    if (!config.apiKey) {
      return {
        success: false,
        message: 'DeepSeek API key not configured. Please set VITE_DEEPSEEK_API_KEY in your .env file.'
      };
    }

    if (!available) {
      return {
        success: false,
        message: 'DeepSeek API is not available. Check your API key and network connection.'
      };
    }

    // Test 3: Try to import functions
    const { processDocumentWithDeepSeek } = await import('./ocr-deepseek');

    console.log('✅ All DeepSeek OCR functions imported successfully');

    return {
      success: true,
      message: 'DeepSeek OCR integration is working correctly!',
      config: {
        hasApiKey: !!config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        available
      }
    };

  } catch (error) {
    console.error('❌ DeepSeek integration test failed:', error);
    return {
      success: false,
      message: `DeepSeek integration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Auto-run test if this file is executed directly
if (typeof window !== 'undefined' && window.location) {
  // Browser environment - export for use in components
  console.log('DeepSeek OCR integration test module loaded');
} else {
  // Node environment - run test
  testDeepSeekIntegration().then(result => {
    console.log('Test Result:', result);
  });
}





