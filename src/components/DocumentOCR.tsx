import { useState, useRef, useEffect } from 'react';
import { OCRService } from '../lib/ocr-service';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker with local file for better compatibility
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface DocumentOCRProps {
  onTextExtracted?: (text: string, confidence?: number, processingTime?: number) => void;
  onError?: (error: Error) => void;
  supportedFormats?: string[];
}

const DEFAULT_SUPPORTED_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const DocumentOCR: React.FC<DocumentOCRProps> = ({
  onTextExtracted,
  onError,
  supportedFormats = DEFAULT_SUPPORTED_FORMATS,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedText, setExtractedText] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrService = useRef<OCRService>();

  useEffect(() => {
    // Initialize OCR service
    ocrService.current = OCRService.getInstance();

    // Clean up on unmount
    return () => {
      const cleanup = async () => {
        if (ocrService.current) {
          await ocrService.current.cleanup();
        }
      };
      cleanup();
    };
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    processFile(files[0]);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const processFile = async (file: File) => {
    if (!ocrService.current) {
      console.error('OCR service not initialized');
      return;
    }

    // Reset state
    setError(null);
    setExtractedText('');
    setConfidence(null);
    setProcessingTime(null);
    setIsProcessing(true);
    setProgress(0);

    try {
      // Validate file type
      if (!supportedFormats.includes(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}. Supported types: ${supportedFormats.join(', ')}`);
      }

      // Process the file
      const result = await ocrService.current.processFile(file);

      // Update state with results
      setExtractedText(result.text);
      setConfidence(result.confidence);
      setProcessingTime(result.processingTime);
      setProgress(100);

      // Notify parent component
      if (onTextExtracted) {
        onTextExtracted(result.text, result.confidence, result.processingTime);
      }

      console.log('OCR completed successfully', {
        characters: result.text.length,
        confidence: result.confidence,
        pages: result.pages,
        processingTime: result.processingTime,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error during OCR processing');
      console.error('OCR processing error:', error);
      setError(error.message);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="document-ocr-container">
      <div 
        className={`drop-zone ${isProcessing ? 'processing' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={triggerFileInput}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={supportedFormats.join(',')}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          disabled={isProcessing}
        />
        
        {isProcessing ? (
          <div className="processing-indicator">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            <p>Processing document... {progress}%</p>
          </div>
        ) : (
          <div className="upload-prompt">
            <p>Drag & drop a document here, or click to select</p>
            <p className="file-types">Supported formats: {supportedFormats.join(', ')}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}

      {extractedText && (
        <div className="extracted-text">
          <div className="results-header">
            <h3>Extracted Text:</h3>
            {confidence !== null && processingTime !== null && (
              <div className="ocr-stats">
                <div className="stat-item">
                  <span className="stat-label">Confidence:</span>
                  <span className={`stat-value ${confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low'}`}>
                    {(confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Processing Time:</span>
                  <span className="stat-value">{(processingTime / 1000).toFixed(1)}s</span>
                </div>
              </div>
            )}
          </div>
          <div className="text-content">
            {extractedText}
          </div>
        </div>
      )}

      <style>{`
        .document-ocr-container {
          max-width: 800px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .drop-zone {
          border: 2px dashed #ccc;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background-color: #f9f9f9;
          margin-bottom: 1.5rem;
        }
        
        .drop-zone:hover {
          border-color: #666;
          background-color: #f0f0f0;
        }
        
        .drop-zone.processing {
          border-color: #4CAF50;
          background-color: #e8f5e9;
        }
        
        .upload-prompt {
          color: #666;
        }
        
        .file-types {
          font-size: 0.9em;
          color: #888;
          margin-top: 0.5rem;
        }
        
        .processing-indicator {
          width: 100%;
        }
        
        .progress-bar {
          height: 8px;
          background-color: #4CAF50;
          border-radius: 4px;
          margin-bottom: 0.5rem;
          transition: width 0.3s ease;
        }
        
        .extracted-text {
          margin-top: 2rem;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .ocr-stats {
          display: flex;
          gap: 1rem;
          font-size: 0.9em;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .stat-label {
          color: #666;
          font-weight: 500;
        }

        .stat-value {
          font-weight: bold;
        }

        .stat-value.high {
          color: #4CAF50;
        }

        .stat-value.medium {
          color: #FF9800;
        }

        .stat-value.low {
          color: #f44336;
        }

        .text-content {
          background-color: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 1rem;
          max-height: 400px;
          overflow-y: auto;
          white-space: pre-wrap;
          font-family: 'Courier New', Courier, monospace;
        }
        
        .error-message {
          color: #d32f2f;
          background-color: #fde0e0;
          border-left: 4px solid #d32f2f;
          padding: 1rem;
          margin: 1rem 0;
          border-radius: 4px;
        }
        
        h3 {
          margin-top: 0;
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default DocumentOCR;
