// REVIEW ITEM EDITOR
// Side-by-side document viewer and field editor with validation highlighting

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { saveExtractionCorrections } from '@/lib/extraction-corrections';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Eye,
  Edit,
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface ReviewItemEditorProps {
  item: any;
  onComplete: (
    itemId: string,
    action: 'approve' | 'reject',
    correctedData?: any,
    notes?: string
  ) => void;
  onCancel: () => void;
}

export function ReviewItemEditor({ item, onComplete, onCancel }: ReviewItemEditorProps) {
  const [user, setUser] = useState<User | null>(null);
  const [editedData, setEditedData] = useState<any>(item.extracted_data);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1.0);
  const [activeTab, setActiveTab] = useState<'basic' | 'vendor' | 'customer' | 'items' | 'tax'>(
    'basic'
  );
  const [corrections, setCorrections] = useState<Record<string, any>>({});
  const [savingCorrections, setSavingCorrections] = useState(false);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  // Fetch document image URL
  useEffect(() => {
    const fetchDocumentUrl = async () => {
      if (!item.document?.file_path) return;

      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(item.document.file_path);

      setDocumentUrl(data.publicUrl);
    };

    fetchDocumentUrl();
  }, [item]);

  // Track field changes for corrections
  const handleFieldChange = (section: string, field: string, value: any) => {
    const originalValue = getNestedValue(item.extracted_data, `${section}.${field}`);
    const newValue = value;

    // Update edited data
    setEditedData((prev: any) => {
      const updated = { ...prev };
      if (section) {
        updated[section] = { ...updated[section], [field]: newValue };
      } else {
        updated[field] = newValue;
      }
      return updated;
    });

    // Track correction
    if (originalValue !== newValue) {
      setCorrections((prev) => ({
        ...prev,
        [`${section}.${field}`]: {
          original: originalValue,
          corrected: newValue,
          field_name: field,
          section
        }
      }));
    } else {
      // Remove correction if value reverted to original
      setCorrections((prev) => {
        const updated = { ...prev };
        delete updated[`${section}.${field}`];
        return updated;
      });
    }
  };

  // Get nested value from object
  const getNestedValue = (obj: any, path: string): any => {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.95) return 'text-green-600';
    if (confidence >= 0.85) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get confidence badge variant
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.95) return 'default';
    if (confidence >= 0.85) return 'secondary';
    return 'destructive';
  };

  // Check if field has validation error
  const hasValidationError = (fieldPath: string): boolean => {
    return item.validation_errors?.some((error: any) =>
      error.field === fieldPath || error.field_path === fieldPath
    );
  };

  // Get validation error message
  const getValidationError = (fieldPath: string): string | null => {
    const error = item.validation_errors?.find((error: any) =>
      error.field === fieldPath || error.field_path === fieldPath
    );
    return error?.message || error?.error || null;
  };

  // Handle approve
  const handleApprove = async () => {
    if (!user) return;

    setSavingCorrections(true);

    try {
      // Save corrections to learning system
      if (Object.keys(corrections).length > 0) {
        const correctionRecords = Object.entries(corrections).map(([path, correction]: [string, any]) => {
          // Determine correction type
          let correctionType: 'format' | 'value' | 'missing' | 'extra' | 'classification' = 'value';
          if (correction.original === null || correction.original === '') {
            correctionType = 'missing';
          } else if (typeof correction.original === typeof correction.corrected) {
            correctionType = 'format';
          }

          return {
            document_id: item.document_id,
            review_queue_id: item.id,
            field_name: path,
            extracted_value: String(correction.original || ''),
            corrected_value: String(correction.corrected),
            correction_type: correctionType,
            corrected_by: user.id,
            confidence_before: item.field_confidence_scores?.[correction.field_name] || null,
            confidence_after: 1.0, // After manual review, confidence is 100%
            notes: reviewerNotes
          };
        });

        const { success, error } = await saveExtractionCorrections(correctionRecords);

        if (!success) {
          console.error('Failed to save corrections:', error);
          toast({
            title: 'Warning',
            description: 'Corrections not saved to learning system, but review will continue',
            variant: 'destructive'
          });
        }
      }

      // Complete the review
      if (Object.keys(corrections).length > 0) {
        onComplete(item.id, 'approve', editedData, reviewerNotes);
      } else {
        onComplete(item.id, 'approve', undefined, reviewerNotes);
      }
    } catch (error) {
      console.error('Error during approval:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete review',
        variant: 'destructive'
      });
    } finally {
      setSavingCorrections(false);
    }
  };

  // Handle reject
  const handleReject = () => {
    if (!reviewerNotes.trim()) {
      toast({
        title: 'Notes Required',
        description: 'Please provide notes explaining the rejection',
        variant: 'destructive'
      });
      return;
    }
    onComplete(item.id, 'reject', undefined, reviewerNotes);
  };

  // Reset changes
  const handleReset = () => {
    setEditedData(item.extracted_data);
    setCorrections({});
    setReviewerNotes('');
  };

  return (
    <CardContent className="p-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 h-[700px]">
        {/* Left: Document Image */}
        <div className="border-r p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Original Document
            </h3>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => setImageScale((s) => Math.max(0.5, s - 0.1))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setImageScale((s) => Math.min(2, s + 0.1))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => setImageScale(1)}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[600px] rounded-md border bg-muted/50">
            {documentUrl ? (
              <div className="p-4 flex justify-center">
                <img
                  src={documentUrl}
                  alt="Document"
                  style={{ transform: `scale(${imageScale})`, transformOrigin: 'top center' }}
                  className="max-w-full h-auto transition-transform"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-16 w-16 mx-auto mb-2 opacity-50" />
                  <p>Document preview not available</p>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: Extracted Data Editor */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Extracted Data
            </h3>
            <Badge variant={getConfidenceBadge(item.weighted_confidence)}>
              {(item.weighted_confidence * 100).toFixed(1)}% confidence
            </Badge>
          </div>

          {/* Validation Errors Alert */}
          {item.validation_errors && item.validation_errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{item.validation_errors.length} validation errors:</strong>
                <ul className="list-disc list-inside mt-2 text-sm">
                  {item.validation_errors.slice(0, 3).map((error: any, i: number) => (
                    <li key={i}>{error.message || error.error}</li>
                  ))}
                  {item.validation_errors.length > 3 && (
                    <li>... and {item.validation_errors.length - 3} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Validation Warnings */}
          {item.validation_warnings && item.validation_warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{item.validation_warnings.length} warnings</strong>
              </AlertDescription>
            </Alert>
          )}

          {/* Corrections Summary */}
          {Object.keys(corrections).length > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>{Object.keys(corrections).length} fields corrected</strong>
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="vendor">Vendor</TabsTrigger>
              <TabsTrigger value="customer">Customer</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="tax">Tax</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] mt-4">
              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input
                    value={editedData.invoice_number || ''}
                    onChange={(e) => handleFieldChange('', 'invoice_number', e.target.value)}
                    className={hasValidationError('invoice_number') ? 'border-red-500' : ''}
                  />
                  {hasValidationError('invoice_number') && (
                    <p className="text-xs text-red-600">{getValidationError('invoice_number')}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Confidence:{' '}
                    <span className={getConfidenceColor(item.field_confidence_scores?.invoice_number || 0)}>
                      {((item.field_confidence_scores?.invoice_number || 0) * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={editedData.invoice_date || ''}
                    onChange={(e) => handleFieldChange('', 'invoice_date', e.target.value)}
                    className={hasValidationError('invoice_date') ? 'border-red-500' : ''}
                  />
                  {hasValidationError('invoice_date') && (
                    <p className="text-xs text-red-600">{getValidationError('invoice_date')}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Confidence:{' '}
                    <span className={getConfidenceColor(item.field_confidence_scores?.invoice_date || 0)}>
                      {((item.field_confidence_scores?.invoice_date || 0) * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={editedData.due_date || ''}
                    onChange={(e) => handleFieldChange('', 'due_date', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Invoice Type</Label>
                  <select
                    value={editedData.invoice_type || 'tax_invoice'}
                    onChange={(e) => handleFieldChange('', 'invoice_type', e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="tax_invoice">Tax Invoice</option>
                    <option value="bill_of_supply">Bill of Supply</option>
                    <option value="credit_note">Credit Note</option>
                    <option value="debit_note">Debit Note</option>
                  </select>
                </div>
              </TabsContent>

              {/* Vendor Tab */}
              <TabsContent value="vendor" className="space-y-4">
                <div className="space-y-2">
                  <Label>Legal Name</Label>
                  <Input
                    value={editedData.vendor?.legal_name || ''}
                    onChange={(e) => handleFieldChange('vendor', 'legal_name', e.target.value)}
                    className={hasValidationError('vendor.legal_name') ? 'border-red-500' : ''}
                  />
                  {hasValidationError('vendor.legal_name') && (
                    <p className="text-xs text-red-600">{getValidationError('vendor.legal_name')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input
                    value={editedData.vendor?.gstin || ''}
                    onChange={(e) => handleFieldChange('vendor', 'gstin', e.target.value.toUpperCase())}
                    className={hasValidationError('vendor.gstin') ? 'border-red-500' : ''}
                    placeholder="27ABCDE1234F1Z5"
                  />
                  {hasValidationError('vendor.gstin') && (
                    <p className="text-xs text-red-600">{getValidationError('vendor.gstin')}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Confidence:{' '}
                    <span className={getConfidenceColor(item.field_confidence_scores?.vendor_gstin || 0)}>
                      {((item.field_confidence_scores?.vendor_gstin || 0) * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    value={editedData.vendor?.address || ''}
                    onChange={(e) => handleFieldChange('vendor', 'address', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      value={editedData.vendor?.state || ''}
                      onChange={(e) => handleFieldChange('vendor', 'state', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State Code</Label>
                    <Input
                      value={editedData.vendor?.state_code || ''}
                      onChange={(e) => handleFieldChange('vendor', 'state_code', e.target.value)}
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pincode</Label>
                    <Input
                      value={editedData.vendor?.pincode || ''}
                      onChange={(e) => handleFieldChange('vendor', 'pincode', e.target.value)}
                      maxLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editedData.vendor?.phone || ''}
                      onChange={(e) => handleFieldChange('vendor', 'phone', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editedData.vendor?.email || ''}
                    onChange={(e) => handleFieldChange('vendor', 'email', e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* Customer Tab */}
              <TabsContent value="customer" className="space-y-4">
                <div className="space-y-2">
                  <Label>Legal Name</Label>
                  <Input
                    value={editedData.customer?.legal_name || ''}
                    onChange={(e) => handleFieldChange('customer', 'legal_name', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>GSTIN (optional for B2C)</Label>
                  <Input
                    value={editedData.customer?.gstin || ''}
                    onChange={(e) => handleFieldChange('customer', 'gstin', e.target.value.toUpperCase())}
                    className={hasValidationError('customer.gstin') ? 'border-red-500' : ''}
                    placeholder="27XYZAB5678G1Z9"
                  />
                  {hasValidationError('customer.gstin') && (
                    <p className="text-xs text-red-600">{getValidationError('customer.gstin')}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Confidence:{' '}
                    <span className={getConfidenceColor(item.field_confidence_scores?.customer_gstin || 0)}>
                      {((item.field_confidence_scores?.customer_gstin || 0) * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    value={editedData.customer?.address || ''}
                    onChange={(e) => handleFieldChange('customer', 'address', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      value={editedData.customer?.state || ''}
                      onChange={(e) => handleFieldChange('customer', 'state', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State Code</Label>
                    <Input
                      value={editedData.customer?.state_code || ''}
                      onChange={(e) => handleFieldChange('customer', 'state_code', e.target.value)}
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input
                    value={editedData.customer?.pincode || ''}
                    onChange={(e) => handleFieldChange('customer', 'pincode', e.target.value)}
                    maxLength={6}
                  />
                </div>
              </TabsContent>

              {/* Line Items Tab */}
              <TabsContent value="items" className="space-y-4">
                <div className="text-sm font-medium">
                  {editedData.line_items?.length || 0} items extracted
                </div>
                {editedData.line_items?.map((item: any, index: number) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-sm">Item {index + 1}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={item.description || ''}
                          onChange={(e) => {
                            const updated = [...editedData.line_items];
                            updated[index] = { ...updated[index], description: e.target.value };
                            setEditedData({ ...editedData, line_items: updated });
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>HSN/SAC Code</Label>
                          <Input
                            value={item.hsn_sac_code || ''}
                            onChange={(e) => {
                              const updated = [...editedData.line_items];
                              updated[index] = { ...updated[index], hsn_sac_code: e.target.value };
                              setEditedData({ ...editedData, line_items: updated });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => {
                              const updated = [...editedData.line_items];
                              updated[index] = { ...updated[index], quantity: parseFloat(e.target.value) };
                              setEditedData({ ...editedData, line_items: updated });
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Rate</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.rate || ''}
                            onChange={(e) => {
                              const updated = [...editedData.line_items];
                              updated[index] = { ...updated[index], rate: parseFloat(e.target.value) };
                              setEditedData({ ...editedData, line_items: updated });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Taxable Amount</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.taxable_amount || ''}
                            onChange={(e) => {
                              const updated = [...editedData.line_items];
                              updated[index] = { ...updated[index], taxable_amount: parseFloat(e.target.value) };
                              setEditedData({ ...editedData, line_items: updated });
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>GST %</Label>
                          <Input
                            type="number"
                            value={item.gst_rate || ''}
                            onChange={(e) => {
                              const updated = [...editedData.line_items];
                              updated[index] = { ...updated[index], gst_rate: parseInt(e.target.value) };
                              setEditedData({ ...editedData, line_items: updated });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CGST</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.cgst_amount || ''}
                            onChange={(e) => {
                              const updated = [...editedData.line_items];
                              updated[index] = { ...updated[index], cgst_amount: parseFloat(e.target.value) };
                              setEditedData({ ...editedData, line_items: updated });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SGST</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.sgst_amount || ''}
                            onChange={(e) => {
                              const updated = [...editedData.line_items];
                              updated[index] = { ...updated[index], sgst_amount: parseFloat(e.target.value) };
                              setEditedData({ ...editedData, line_items: updated });
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Tax Summary Tab */}
              <TabsContent value="tax" className="space-y-4">
                <div className="space-y-2">
                  <Label>Subtotal (before tax)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.tax_summary?.subtotal || ''}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        tax_summary: { ...editedData.tax_summary, subtotal: parseFloat(e.target.value) }
                      })
                    }
                    className={hasValidationError('tax_summary.subtotal') ? 'border-red-500' : ''}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total CGST</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editedData.tax_summary?.total_cgst || ''}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          tax_summary: { ...editedData.tax_summary, total_cgst: parseFloat(e.target.value) }
                        })
                      }
                      className={hasValidationError('tax_summary.total_cgst') ? 'border-red-500' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total SGST</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editedData.tax_summary?.total_sgst || ''}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          tax_summary: { ...editedData.tax_summary, total_sgst: parseFloat(e.target.value) }
                        })
                      }
                      className={hasValidationError('tax_summary.total_sgst') ? 'border-red-500' : ''}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Total IGST (for inter-state)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.tax_summary?.total_igst || ''}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        tax_summary: { ...editedData.tax_summary, total_igst: parseFloat(e.target.value) }
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Grand Total</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.tax_summary?.grand_total || ''}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        tax_summary: { ...editedData.tax_summary, grand_total: parseFloat(e.target.value) }
                      })
                    }
                    className={hasValidationError('tax_summary.grand_total') ? 'border-red-500' : ''}
                  />
                  <p className="text-xs text-muted-foreground">
                    Confidence:{' '}
                    <span className={getConfidenceColor(item.field_confidence_scores?.grand_total || 0)}>
                      {((item.field_confidence_scores?.grand_total || 0) * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>

                {hasValidationError('tax_calculation') && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{getValidationError('tax_calculation')}</AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <Separator />

          {/* Reviewer Notes */}
          <div className="space-y-2">
            <Label>Reviewer Notes</Label>
            <Textarea
              placeholder="Add notes about corrections or issues..."
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              className="flex-1"
              disabled={savingCorrections}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              variant="default"
              onClick={handleApprove}
              className="flex-1"
              disabled={savingCorrections}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {savingCorrections ? 'Saving...' : 'Approve'}
            </Button>
          </div>
        </div>
      </div>
    </CardContent>
  );
}
