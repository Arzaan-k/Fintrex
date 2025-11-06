import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TestTube, Play, CheckCircle, XCircle } from 'lucide-react';
import { testTesseractBasic, testTesseractWithImage, isTesseractAvailable } from '@/lib/ocr-tesseract-simple';

export function OCRTestSimple() {
  const [isTesting, setIsTesting] = useState(false);
  const [tesseractAvailable, setTesseractAvailable] = useState<boolean | null>(null);
  const [testResults, setTestResults] = useState<{
    basicTest?: { success: boolean; result?: string; error?: string };
    imageTest?: { success: boolean; result?: string; error?: string };
  }>({});

  // Check Tesseract availability on mount
  React.useEffect(() => {
    const available = isTesseractAvailable();
    setTesseractAvailable(available);
    console.log('Tesseract.js available:', available);
  }, []);

  const runBasicTest = async () => {
    setIsTesting(true);
    try {
      const result = await testTesseractBasic();
      setTestResults(prev => ({
        ...prev,
        basicTest: {
          success: result.success,
          result: result.text,
          error: result.error
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        basicTest: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setIsTesting(false);
    }
  };

  const runImageTest = async () => {
    setIsTesting(true);
    try {
      const result = await testTesseractWithImage();
      setTestResults(prev => ({
        ...prev,
        imageTest: {
          success: result.success,
          result: result.text,
          error: result.error
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        imageTest: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          OCR Basic Tests
        </CardTitle>
        <CardDescription>
          Test basic OCR functionality to isolate issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tesseract Status */}
        <div className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
          <div className={`w-2 h-2 rounded-full ${
            tesseractAvailable === true ? 'bg-green-500' :
            tesseractAvailable === false ? 'bg-red-500' : 'bg-yellow-500'
          }`} />
          <span>
            Tesseract.js: {
              tesseractAvailable === true ? 'Available' :
              tesseractAvailable === false ? 'Not Loaded' : 'Checking...'
            }
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={runBasicTest}
            disabled={isTesting || tesseractAvailable !== true}
            variant="outline"
            className="flex-1"
          >
            <Play className="h-4 w-4 mr-2" />
            Test Basic OCR
          </Button>

          <Button
            onClick={runImageTest}
            disabled={isTesting || tesseractAvailable !== true}
            variant="outline"
            className="flex-1"
          >
            <Play className="h-4 w-4 mr-2" />
            Test Image OCR
          </Button>
        </div>

        {testResults.basicTest && (
          <Alert className={testResults.basicTest.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <div className="flex items-center gap-2">
              {testResults.basicTest.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className="font-medium">
                Basic OCR Test {testResults.basicTest.success ? 'Passed' : 'Failed'}
              </AlertDescription>
            </div>
            <div className="mt-2 text-sm">
              {testResults.basicTest.success && testResults.basicTest.result && (
                <div>Result: "{testResults.basicTest.result}"</div>
              )}
              {testResults.basicTest.error && (
                <div>Error: {testResults.basicTest.error}</div>
              )}
            </div>
          </Alert>
        )}

        {testResults.imageTest && (
          <Alert className={testResults.imageTest.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <div className="flex items-center gap-2">
              {testResults.imageTest.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className="font-medium">
                Image OCR Test {testResults.imageTest.success ? 'Passed' : 'Failed'}
              </AlertDescription>
            </div>
            <div className="mt-2 text-sm">
              {testResults.imageTest.success && testResults.imageTest.result && (
                <div>OCR Result: "{testResults.imageTest.result}"</div>
              )}
              {testResults.imageTest.error && (
                <div>Error: {testResults.imageTest.error}</div>
              )}
            </div>
          </Alert>
        )}

        <div className="text-xs text-gray-500">
          <p><strong>Note:</strong> These tests help isolate OCR issues. If basic OCR fails, check console for Tesseract.js errors. If file processing fails, check canvas/canvas-to-blob support.</p>
        </div>
      </CardContent>
    </Card>
  );
}
