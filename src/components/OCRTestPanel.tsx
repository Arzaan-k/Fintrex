import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, TestTube, CheckCircle, XCircle } from 'lucide-react';
import { testTesseractLive, createTestImage } from '@/lib/ocr-test-live';
import { processDocumentWithDeepSeek, isDeepSeekAvailable } from '@/lib/ocr-deepseek';
import { testDeepSeekIntegration } from '@/lib/test-deepseek-integration';
import { OCRTestSimple } from './OCRTestSimple';

interface TestResult {
  success: boolean;
  results?: any;
  error?: string;
  processingTime?: number;
  method?: string;
}

export function OCRTestPanel() {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [deepSeekAvailable, setDeepSeekAvailable] = useState<boolean | null>(null);
  const [deepSeekStatus, setDeepSeekStatus] = useState<string>('Checking...');
  const [showSimpleTests, setShowSimpleTests] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check DeepSeek availability on component mount
  React.useEffect(() => {
    const checkDeepSeek = async () => {
      try {
        const result = await testDeepSeekIntegration();
        setDeepSeekAvailable(result.success);
        setDeepSeekStatus(result.message);
      } catch (error) {
        setDeepSeekAvailable(false);
        setDeepSeekStatus('Integration test failed');
      }
    };
    checkDeepSeek();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await runTest(file, 'tesseract');
  };

  const handleDeepSeekTest = async (file: File) => {
    await runTest(file, 'deepseek');
  };

  const runTest = async (file: File, method: 'tesseract' | 'deepseek' = 'tesseract') => {
    setIsTesting(true);
    setProgress(0);
    setTestResult(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      let result: TestResult;

      if (method === 'deepseek') {
        // Test with DeepSeek
        console.log('🧠 Testing with DeepSeek OCR...');
        const deepSeekResult = await processDocumentWithDeepSeek(file, file.name, true);

        result = {
          success: true,
          results: deepSeekResult,
          processingTime: deepSeekResult.ocrResult.processingTime,
          method: 'deepseek'
        };
      } else {
        // Test with Tesseract
        console.log('🔍 Testing with Tesseract OCR...');
        const tesseractResult = await testTesseractLive(file);

        result = {
          ...tesseractResult,
          method: 'tesseract'
        };
      }

      clearInterval(progressInterval);
      setProgress(100);
      setTestResult(result);

    } catch (error) {
      console.error('Test failed:', error);
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        method: method
      });
    } finally {
      setIsTesting(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const handleCreateTestImage = async () => {
    try {
      const testFile = await createTestImage();
      await runTest(testFile);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create test image'
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Advanced OCR Test Panel
        </CardTitle>
        <CardDescription>
          Test advanced OCR implementations: Tesseract (offline) and DeepSeek Vision (AI-powered)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isTesting}
            variant="outline"
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Image
          </Button>

          <Button
            onClick={handleCreateTestImage}
            disabled={isTesting}
            variant="outline"
            className="flex-1"
          >
            <TestTube className="h-4 w-4 mr-2" />
            Test with Sample
          </Button>
        </div>

        {/* DeepSeek Status */}
        <div className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
          <div className={`w-2 h-2 rounded-full ${
            deepSeekAvailable === true ? 'bg-green-500' :
            deepSeekAvailable === false ? 'bg-red-500' : 'bg-yellow-500'
          }`} />
          <div className="flex-1">
            <div className="font-medium">DeepSeek OCR Status</div>
            <div className="text-xs text-gray-600">{deepSeekStatus}</div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {isTesting && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Processing...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {testResult && (
          <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className="font-medium">
                {testResult.success ? 'OCR Test Successful!' : 'OCR Test Failed'}
              </AlertDescription>
            </div>

            <div className="mt-3 space-y-2 text-sm">
              {testResult.success && testResult.results && (
                <>
                  <div><strong>Method:</strong> {testResult.method === 'deepseek' ? 'DeepSeek Vision OCR' : 'Tesseract OCR'}</div>
                  <div><strong>Document Type:</strong> {testResult.results.documentType}</div>
                  <div><strong>OCR Confidence:</strong> {(testResult.results.ocrResult.confidence * 100).toFixed(1)}%</div>
                  <div><strong>Processing Time:</strong> {testResult.processingTime}ms</div>
                  <div><strong>Text Length:</strong> {testResult.results.ocrResult.text.length} characters</div>
                  {testResult.method === 'deepseek' && testResult.results.ocrResult.metadata && (
                    <div><strong>Tokens Used:</strong> {testResult.results.ocrResult.metadata.tokens}</div>
                  )}
                  <div>
                    <strong>OCR Text Preview:</strong>
                    <div className="mt-1 p-2 bg-gray-100 rounded text-xs font-mono max-h-20 overflow-y-auto">
                      {testResult.results.ocrResult.text.substring(0, 200)}...
                    </div>
                  </div>
                </>
              )}

              {testResult.error && (
                <>
                  <div><strong>Method:</strong> {testResult.method === 'deepseek' ? 'DeepSeek Vision OCR' : 'Tesseract OCR'}</div>
                  <div><strong>Error:</strong> {testResult.error}</div>
                </>
              )}
            </div>
          </Alert>
        )}

        <div className="text-xs text-gray-500">
          <p><strong>Note:</strong> Test both OCR methods - Tesseract (offline, fast) and DeepSeek Vision (AI-powered, high accuracy).
          DeepSeek requires API key configuration. First run may take longer as models initialize.</p>
        </div>

        {/* Simple Tests Toggle */}
        <div className="pt-4 border-t">
          <Button
            onClick={() => setShowSimpleTests(!showSimpleTests)}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            {showSimpleTests ? 'Hide' : 'Show'} Basic Diagnostic Tests
          </Button>

          {showSimpleTests && (
            <div className="mt-4">
              <OCRTestSimple />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
