import { useState } from 'react';
import DocumentOCR from '../components/DocumentOCR';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';

const OCRTestPage = () => {
  const [extractedText, setExtractedText] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleTextExtracted = (text: string, conf?: number, time?: number) => {
    setExtractedText(text);
    setConfidence(conf || null);
    setProcessingTime(time || null);
    setError(null);
    
    toast({
      title: 'OCR Complete',
      description: `Extracted ${text.length} characters with ${conf ? (conf * 100).toFixed(1) : 'unknown'}% confidence`,
    });
  };

  const handleError = (error: Error) => {
    console.error('OCR Error:', error);
    setError(error.message);
    toast({
      title: 'OCR Failed',
      description: error.message,
      variant: 'destructive',
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(extractedText);
    toast({
      title: 'Copied!',
      description: 'Text copied to clipboard',
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="OCR Test Panel"
        subtitle="Test document OCR functionality with advanced text extraction"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Upload
          </CardTitle>
          <CardDescription>
            Upload images (JPEG, PNG, WebP) or PDF documents for OCR processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentOCR 
            onTextExtracted={handleTextExtracted}
            onError={handleError}
            supportedFormats={[
              'image/jpeg',
              'image/png',
              'image/webp',
              'application/pdf',
            ]}
          />
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {extractedText && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Extracted Text
                </CardTitle>
                <CardDescription className="mt-2 flex items-center gap-4">
                  {confidence !== null && (
                    <Badge variant={confidence > 0.8 ? 'default' : confidence > 0.6 ? 'secondary' : 'outline'}>
                      Confidence: {(confidence * 100).toFixed(1)}%
                    </Badge>
                  )}
                  {processingTime !== null && (
                    <Badge variant="outline">
                      Time: {(processingTime / 1000).toFixed(2)}s
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {extractedText.length} characters
                  </Badge>
                </CardDescription>
              </div>
              <Button onClick={copyToClipboard} size="sm" className="gap-2">
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md max-h-96 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono">{extractedText}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>OCR Processing Chain</CardTitle>
          <CardDescription>
            Multi-layered OCR approach for maximum accuracy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="mt-0.5">1</Badge>
              <div>
                <p className="font-semibold">Enhanced Tesseract OCR</p>
                <p className="text-sm text-muted-foreground">
                  Primary method: Advanced image preprocessing with multi-pass recognition
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5">2</Badge>
              <div>
                <p className="font-semibold">DeepSeek Vision OCR</p>
                <p className="text-sm text-muted-foreground">
                  Fallback: AI-powered vision model for complex documents
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5">3</Badge>
              <div>
                <p className="font-semibold">Google Gemini OCR</p>
                <p className="text-sm text-muted-foreground">
                  Tertiary: LLM-based extraction for structured data
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">4</Badge>
              <div>
                <p className="font-semibold">Google Cloud Vision API</p>
                <p className="text-sm text-muted-foreground">
                  Final fallback: Enterprise-grade OCR with 98%+ accuracy
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OCRTestPage;
