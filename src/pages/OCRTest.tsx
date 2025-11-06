import { useState } from 'react';
import DocumentOCR from '../components/DocumentOCR';

const OCRTest = () => {
  const [extractedText, setExtractedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleTextExtracted = (text: string) => {
    setExtractedText(text);
    setError(null);
  };

  const handleError = (error: Error) => {
    console.error('OCR Error:', error);
    setError(error.message);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Document OCR Test</h1>
          <p className="text-gray-600">Upload a document or image to extract text using OCR</p>
        </header>

        <div className="bg-white rounded-lg shadow-md p-6">
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

          {error && (
            <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
              <h3 className="font-bold">Error</h3>
              <p>{error}</p>
            </div>
          )}

          {extractedText && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Extracted Text</h2>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(extractedText);
                    alert('Text copied to clipboard!');
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                >
                  Copy to Clipboard
                </button>
              </div>
              <div className="bg-gray-50 p-4 rounded border border-gray-200 font-mono text-sm overflow-auto max-h-96">
                {extractedText}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OCRTest;
