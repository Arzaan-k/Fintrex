// CONFIDENCE SCORING SYSTEM
// Determines accuracy and review requirements for extracted invoice data

import { FIELD_WEIGHTS, CONFIDENCE_THRESHOLDS } from './invoice-prompts';

export interface FieldConfidence {
  field: string;
  value: any;
  confidence: number;
  validationStatus: 'valid' | 'invalid' | 'unverified' | 'missing';
  reason?: string;
  severity?: 'critical' | 'warning' | 'info';
}

export interface ConfidenceReport {
  overall_confidence: number;
  field_scores: FieldConfidence[];
  weighted_score: number;
  should_auto_approve: boolean;
  needs_review: boolean;
  review_reason?: string;
  critical_issues: string[];
  warnings: string[];
}

/**
 * Calculate overall confidence score for extracted invoice data
 */
export function calculateInvoiceConfidence(
  extractedData: any,
  validationResults: any
): ConfidenceReport {
  const field_scores: FieldConfidence[] = [];

  // Extract confidence scores from AI response
  const aiConfidence = extractedData.confidence_scores || {};

  // GSTIN fields (critical)
  field_scores.push({
    field: 'vendor_gstin',
    value: extractedData.vendor?.gstin,
    confidence: aiConfidence.vendor_gstin || 0.5,
    validationStatus: validationResults.vendor_gstin_valid ? 'valid' : 'invalid',
    severity: 'critical',
    reason: validationResults.vendor_gstin_valid
      ? 'GSTIN format and checksum valid'
      : 'Invalid GSTIN format or checksum'
  });

  if (extractedData.customer?.gstin) {
    field_scores.push({
      field: 'customer_gstin',
      value: extractedData.customer.gstin,
      confidence: aiConfidence.customer_gstin || 0.5,
      validationStatus: validationResults.customer_gstin_valid ? 'valid' : 'invalid',
      severity: 'critical'
    });
  }

  // Tax calculations (critical)
  field_scores.push({
    field: 'tax_calculations',
    value: extractedData.tax_summary,
    confidence: aiConfidence.tax_calculations || 0.5,
    validationStatus: validationResults.tax_calculation_accurate ? 'valid' : 'invalid',
    severity: 'critical',
    reason: validationResults.tax_calculation_accurate
      ? 'Tax calculations verified accurate'
      : `Tax mismatch: ${validationResults.tax_mismatch_amount || 'unknown'}`
  });

  // Line items
  field_scores.push({
    field: 'line_items',
    value: extractedData.line_items,
    confidence: aiConfidence.line_items || 0.5,
    validationStatus: validationResults.line_items_complete ? 'valid' : 'invalid',
    severity: 'warning',
    reason: `${extractedData.line_items?.length || 0} items extracted`
  });

  // Grand total
  field_scores.push({
    field: 'grand_total',
    value: extractedData.tax_summary?.grand_total,
    confidence: aiConfidence.grand_total || 0.5,
    validationStatus: extractedData.tax_summary?.grand_total > 0 ? 'valid' : 'invalid',
    severity: 'critical'
  });

  // Invoice number
  field_scores.push({
    field: 'invoice_number',
    value: extractedData.invoice_number,
    confidence: aiConfidence.invoice_number || 0.5,
    validationStatus: extractedData.invoice_number ? 'valid' : 'missing',
    severity: 'warning'
  });

  // Invoice date
  field_scores.push({
    field: 'invoice_date',
    value: extractedData.invoice_date,
    confidence: aiConfidence.invoice_date || 0.5,
    validationStatus: validationResults.date_logic_valid ? 'valid' : 'invalid',
    severity: 'warning'
  });

  // HSN codes
  field_scores.push({
    field: 'hsn_codes',
    value: extractedData.line_items?.map((item: any) => item.hsn_sac_code),
    confidence: aiConfidence.hsn_codes || 0.5,
    validationStatus: validationResults.hsn_codes_valid ? 'valid' : 'invalid',
    severity: 'info'
  });

  // Calculate weighted confidence
  const weighted_score = calculateWeightedScore(field_scores);

  // Determine if auto-approve or needs review
  const critical_issues = field_scores
    .filter(f => f.severity === 'critical' && f.validationStatus === 'invalid')
    .map(f => `${f.field}: ${f.reason || 'validation failed'}`);

  const warnings = field_scores
    .filter(f => f.severity === 'warning' && f.validationStatus === 'invalid')
    .map(f => `${f.field}: ${f.reason || 'validation failed'}`);

  const should_auto_approve =
    weighted_score >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE &&
    critical_issues.length === 0;

  const needs_review =
    weighted_score < CONFIDENCE_THRESHOLDS.AUTO_APPROVE ||
    critical_issues.length > 0 ||
    warnings.length > 2;

  let review_reason: string | undefined;
  if (needs_review) {
    if (critical_issues.length > 0) {
      review_reason = `Critical validation failures: ${critical_issues.join(', ')}`;
    } else if (weighted_score < CONFIDENCE_THRESHOLDS.AUTO_APPROVE) {
      review_reason = `Low confidence: ${(weighted_score * 100).toFixed(1)}% (threshold: ${CONFIDENCE_THRESHOLDS.AUTO_APPROVE * 100}%)`;
    } else if (warnings.length > 2) {
      review_reason = `Multiple warnings: ${warnings.length} issues found`;
    }
  }

  return {
    overall_confidence: aiConfidence.overall || weighted_score,
    field_scores,
    weighted_score,
    should_auto_approve,
    needs_review,
    review_reason,
    critical_issues,
    warnings
  };
}

/**
 * Calculate weighted confidence score based on field importance
 */
function calculateWeightedScore(field_scores: FieldConfidence[]): number {
  let weighted_sum = 0;
  let total_weight = 0;

  for (const field of field_scores) {
    const weight = FIELD_WEIGHTS[field.field as keyof typeof FIELD_WEIGHTS] || 0.05;

    // Penalize invalid fields heavily
    let adjusted_confidence = field.confidence;
    if (field.validationStatus === 'invalid') {
      adjusted_confidence = Math.min(field.confidence, 0.7);
    } else if (field.validationStatus === 'missing') {
      adjusted_confidence = 0.5;
    }

    weighted_sum += adjusted_confidence * weight;
    total_weight += weight;
  }

  return total_weight > 0 ? weighted_sum / total_weight : 0;
}

/**
 * Analyze specific field for confidence
 */
export function analyzeFieldConfidence(
  fieldName: string,
  extractedValue: any,
  validationResult: any
): FieldConfidence {
  let confidence = 0.5;
  let validationStatus: 'valid' | 'invalid' | 'unverified' | 'missing' = 'unverified';
  let reason: string | undefined;
  let severity: 'critical' | 'warning' | 'info' = 'info';

  // Determine severity based on field importance
  const criticalFields = ['vendor_gstin', 'customer_gstin', 'grand_total', 'tax_calculations'];
  const warningFields = ['invoice_number', 'invoice_date', 'line_items'];

  if (criticalFields.includes(fieldName)) {
    severity = 'critical';
  } else if (warningFields.includes(fieldName)) {
    severity = 'warning';
  }

  // Check if value exists
  if (!extractedValue || extractedValue === '' || extractedValue === null) {
    validationStatus = 'missing';
    confidence = 0;
    reason = 'Field not extracted';
    return { field: fieldName, value: extractedValue, confidence, validationStatus, reason, severity };
  }

  // Field-specific validation
  switch (fieldName) {
    case 'vendor_gstin':
    case 'customer_gstin':
      if (validationResult?.format_valid && validationResult?.checksum_valid) {
        validationStatus = 'valid';
        confidence = 1.0;
        reason = 'GSTIN format and checksum verified';
      } else {
        validationStatus = 'invalid';
        confidence = 0.3;
        reason = 'Invalid GSTIN format or checksum';
      }
      break;

    case 'grand_total':
      if (typeof extractedValue === 'number' && extractedValue > 0) {
        if (validationResult?.calculation_accurate) {
          validationStatus = 'valid';
          confidence = 1.0;
          reason = 'Amount verified against subtotal + taxes';
        } else {
          validationStatus = 'invalid';
          confidence = 0.6;
          reason = 'Amount does not match calculated total';
        }
      } else {
        validationStatus = 'invalid';
        confidence = 0.2;
        reason = 'Invalid amount';
      }
      break;

    case 'tax_calculations':
      if (validationResult?.cgst_equals_sgst && validationResult?.tax_logic_valid) {
        validationStatus = 'valid';
        confidence = 1.0;
        reason = 'Tax calculations verified';
      } else {
        validationStatus = 'invalid';
        confidence = 0.5;
        reason = validationResult?.error_message || 'Tax calculation mismatch';
      }
      break;

    case 'line_items':
      const itemCount = Array.isArray(extractedValue) ? extractedValue.length : 0;
      if (itemCount > 0) {
        const completeItems = extractedValue.filter((item: any) =>
          item.description && item.quantity && item.rate
        ).length;
        confidence = completeItems / itemCount;
        validationStatus = confidence > 0.9 ? 'valid' : 'invalid';
        reason = `${completeItems}/${itemCount} items complete`;
      } else {
        validationStatus = 'missing';
        confidence = 0;
        reason = 'No line items extracted';
      }
      break;

    case 'invoice_date':
      if (validationResult?.date_format_valid && validationResult?.date_logic_valid) {
        validationStatus = 'valid';
        confidence = 1.0;
        reason = 'Date format and logic validated';
      } else {
        validationStatus = 'invalid';
        confidence = 0.4;
        reason = 'Invalid date format or logic';
      }
      break;

    default:
      // Generic field
      if (extractedValue) {
        validationStatus = 'unverified';
        confidence = 0.8;
        reason = 'Field extracted, not validated';
      }
  }

  return { field: fieldName, value: extractedValue, confidence, validationStatus, reason, severity };
}

/**
 * Determine if document should be escalated to human review
 */
export function shouldEscalateToHuman(
  confidenceReport: ConfidenceReport,
  extractedData: any
): { escalate: boolean; reason: string; priority: 'high' | 'medium' | 'low' } {
  // High priority escalation
  if (confidenceReport.critical_issues.length > 0) {
    return {
      escalate: true,
      reason: `Critical validation failures: ${confidenceReport.critical_issues.join('; ')}`,
      priority: 'high'
    };
  }

  // Medium priority escalation
  if (confidenceReport.weighted_score < CONFIDENCE_THRESHOLDS.NEEDS_REVIEW) {
    return {
      escalate: true,
      reason: `Low confidence score: ${(confidenceReport.weighted_score * 100).toFixed(1)}%`,
      priority: 'medium'
    };
  }

  // Medium priority escalation - high value transactions
  const grand_total = extractedData.tax_summary?.grand_total || 0;
  if (grand_total > 100000 && confidenceReport.weighted_score < 0.95) {
    return {
      escalate: true,
      reason: `High-value transaction (₹${grand_total.toLocaleString('en-IN')}) needs verification`,
      priority: 'medium'
    };
  }

  // Low priority escalation - multiple warnings
  if (confidenceReport.warnings.length > 3) {
    return {
      escalate: true,
      reason: `Multiple warnings (${confidenceReport.warnings.length})`,
      priority: 'low'
    };
  }

  // No escalation needed
  return {
    escalate: false,
    reason: 'All validations passed',
    priority: 'low'
  };
}

/**
 * Generate confidence summary for display
 */
export function generateConfidenceSummary(report: ConfidenceReport): string {
  const percentage = (report.weighted_score * 100).toFixed(1);

  if (report.should_auto_approve) {
    return `✅ High confidence (${percentage}%) - Auto-approved`;
  } else if (report.critical_issues.length > 0) {
    return `❌ Critical issues found - Review required`;
  } else if (report.weighted_score < CONFIDENCE_THRESHOLDS.NEEDS_REVIEW) {
    return `⚠️ Low confidence (${percentage}%) - Review required`;
  } else {
    return `⏳ Moderate confidence (${percentage}%) - Review recommended`;
  }
}

/**
 * Get color coding for confidence level
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE) {
    return 'green';
  } else if (confidence >= CONFIDENCE_THRESHOLDS.NEEDS_REVIEW) {
    return 'yellow';
  } else {
    return 'red';
  }
}

/**
 * Calculate confidence improvement suggestions
 */
export function suggestImprovements(report: ConfidenceReport): string[] {
  const suggestions: string[] = [];

  // Check for specific issues
  for (const field of report.field_scores) {
    if (field.confidence < CONFIDENCE_THRESHOLDS.CRITICAL_FIELD && field.severity === 'critical') {
      if (field.field.includes('gstin')) {
        suggestions.push(`Verify ${field.field} manually - appears unclear in document`);
      } else if (field.field === 'tax_calculations') {
        suggestions.push('Verify tax calculations - totals may not match');
      } else if (field.field === 'grand_total') {
        suggestions.push('Verify final amount - extraction confidence low');
      }
    }
  }

  // Generic suggestions based on confidence
  if (report.weighted_score < 0.85) {
    suggestions.push('Consider re-scanning document with better quality image');
  }

  if (report.warnings.length > 3) {
    suggestions.push('Multiple fields have issues - manual review recommended');
  }

  return suggestions;
}
