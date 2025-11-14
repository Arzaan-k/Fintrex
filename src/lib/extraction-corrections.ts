// EXTRACTION CORRECTIONS TRACKING
// Learning system that tracks manual corrections to improve future extractions

import { supabase } from '@/integrations/supabase/client';

export interface ExtractionCorrection {
  id?: string;
  document_id: string;
  review_queue_id?: string;
  field_name: string;
  extracted_value: string | null;
  corrected_value: string;
  correction_type: 'format' | 'value' | 'missing' | 'extra' | 'classification';
  corrected_by: string;
  corrected_at?: string;
  notes?: string;
  confidence_before?: number;
  confidence_after?: number;
}

/**
 * Save a batch of corrections for a document
 */
export async function saveExtractionCorrections(
  corrections: ExtractionCorrection[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('extraction_corrections')
      .insert(corrections);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error saving extraction corrections:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Save extraction metrics for analytics
 */
export async function saveExtractionMetrics(metrics: {
  document_id: string;
  extraction_time: string;
  processing_time_ms: number;
  ocr_provider: string;
  extraction_method: string;
  overall_confidence: number;
  fields_extracted: number;
  fields_validated: number;
  needed_review: boolean;
  review_time_minutes?: number;
  correction_count: number;
  auto_approved: boolean;
  final_status: 'approved' | 'rejected' | 'pending';
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('extraction_metrics')
      .insert(metrics);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error saving extraction metrics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get correction patterns for a specific field
 * Helps identify common extraction mistakes
 */
export async function getCorrectionPatternsForField(
  fieldName: string,
  limit: number = 50
): Promise<{
  success: boolean;
  patterns?: Array<{
    extracted_value: string;
    corrected_value: string;
    frequency: number;
    correction_type: string;
  }>;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('extraction_corrections')
      .select('extracted_value, corrected_value, correction_type')
      .eq('field_name', fieldName)
      .order('corrected_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Group by extracted_value -> corrected_value pairs
    const patternMap = new Map<string, {
      extracted_value: string;
      corrected_value: string;
      frequency: number;
      correction_type: string;
    }>();

    data?.forEach((correction) => {
      const key = `${correction.extracted_value}|${correction.corrected_value}`;
      if (patternMap.has(key)) {
        patternMap.get(key)!.frequency++;
      } else {
        patternMap.set(key, {
          extracted_value: correction.extracted_value || '',
          corrected_value: correction.corrected_value,
          frequency: 1,
          correction_type: correction.correction_type
        });
      }
    });

    const patterns = Array.from(patternMap.values())
      .sort((a, b) => b.frequency - a.frequency);

    return { success: true, patterns };
  } catch (error) {
    console.error('Error fetching correction patterns:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get most common correction types across all fields
 */
export async function getCommonCorrectionTypes(): Promise<{
  success: boolean;
  data?: Array<{
    field_name: string;
    correction_type: string;
    count: number;
  }>;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .rpc('get_common_corrections');

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching common correction types:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get accuracy metrics for document type
 */
export async function getAccuracyMetrics(
  documentType?: string
): Promise<{
  success: boolean;
  metrics?: {
    total_documents: number;
    avg_confidence: number;
    auto_approval_rate: number;
    avg_corrections_per_document: number;
    avg_review_time_minutes: number;
    common_problem_fields: string[];
  };
  error?: string;
}> {
  try {
    let query = supabase.from('extraction_metrics').select('*');

    if (documentType) {
      // Join with documents table to filter by type
      const { data: metrics, error } = await supabase
        .from('extraction_metrics')
        .select('*, document:documents!inner(document_type)')
        .eq('document.document_type', documentType);

      if (error) throw error;
      return calculateMetrics(metrics || []);
    } else {
      const { data: metrics, error } = await query;
      if (error) throw error;
      return calculateMetrics(metrics || []);
    }
  } catch (error) {
    console.error('Error fetching accuracy metrics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Helper to calculate aggregated metrics
 */
function calculateMetrics(metricsData: any[]): {
  success: boolean;
  metrics: {
    total_documents: number;
    avg_confidence: number;
    auto_approval_rate: number;
    avg_corrections_per_document: number;
    avg_review_time_minutes: number;
    common_problem_fields: string[];
  };
} {
  const total = metricsData.length;

  const avgConfidence = total > 0
    ? metricsData.reduce((sum, m) => sum + (m.overall_confidence || 0), 0) / total
    : 0;

  const autoApprovedCount = metricsData.filter(m => m.auto_approved).length;
  const autoApprovalRate = total > 0 ? autoApprovedCount / total : 0;

  const avgCorrections = total > 0
    ? metricsData.reduce((sum, m) => sum + (m.correction_count || 0), 0) / total
    : 0;

  const reviewedMetrics = metricsData.filter(m => m.review_time_minutes != null);
  const avgReviewTime = reviewedMetrics.length > 0
    ? reviewedMetrics.reduce((sum, m) => sum + (m.review_time_minutes || 0), 0) / reviewedMetrics.length
    : 0;

  return {
    success: true,
    metrics: {
      total_documents: total,
      avg_confidence: parseFloat(avgConfidence.toFixed(3)),
      auto_approval_rate: parseFloat(autoApprovalRate.toFixed(3)),
      avg_corrections_per_document: parseFloat(avgCorrections.toFixed(2)),
      avg_review_time_minutes: parseFloat(avgReviewTime.toFixed(1)),
      common_problem_fields: [] // Would need to join with corrections table
    }
  };
}

/**
 * Build correction suggestion based on historical patterns
 * Returns suggested corrections if extraction value matches known pattern
 */
export async function suggestCorrection(
  fieldName: string,
  extractedValue: string
): Promise<{
  hasSuggestion: boolean;
  suggestedValue?: string;
  confidence?: number;
  reason?: string;
}> {
  try {
    const { success, patterns } = await getCorrectionPatternsForField(fieldName, 100);

    if (!success || !patterns) {
      return { hasSuggestion: false };
    }

    // Find exact match
    const exactMatch = patterns.find(p => p.extracted_value === extractedValue);
    if (exactMatch && exactMatch.frequency >= 3) {
      return {
        hasSuggestion: true,
        suggestedValue: exactMatch.corrected_value,
        confidence: Math.min(0.95, 0.5 + (exactMatch.frequency * 0.1)),
        reason: `This value has been corrected ${exactMatch.frequency} times before`
      };
    }

    // Find fuzzy match (e.g., case-insensitive, trimmed)
    const fuzzyMatch = patterns.find(p =>
      p.extracted_value?.toLowerCase().trim() === extractedValue?.toLowerCase().trim()
    );
    if (fuzzyMatch && fuzzyMatch.frequency >= 2) {
      return {
        hasSuggestion: true,
        suggestedValue: fuzzyMatch.corrected_value,
        confidence: 0.7,
        reason: `Similar value corrected ${fuzzyMatch.frequency} times`
      };
    }

    return { hasSuggestion: false };
  } catch (error) {
    console.error('Error suggesting correction:', error);
    return { hasSuggestion: false };
  }
}

/**
 * Generate learning insights report
 */
export async function generateLearningInsights(): Promise<{
  success: boolean;
  insights?: {
    total_corrections: number;
    most_problematic_fields: Array<{ field: string; error_count: number }>;
    improvement_over_time: Array<{ period: string; avg_confidence: number }>;
    correction_type_distribution: Record<string, number>;
  };
  error?: string;
}> {
  try {
    // Get all corrections
    const { data: corrections, error: correctionsError } = await supabase
      .from('extraction_corrections')
      .select('field_name, correction_type, corrected_at');

    if (correctionsError) throw correctionsError;

    // Get metrics over time
    const { data: metrics, error: metricsError } = await supabase
      .from('extraction_metrics')
      .select('overall_confidence, extraction_time')
      .order('extraction_time', { ascending: true })
      .limit(1000);

    if (metricsError) throw metricsError;

    // Calculate most problematic fields
    const fieldCounts = new Map<string, number>();
    corrections?.forEach((c) => {
      fieldCounts.set(c.field_name, (fieldCounts.get(c.field_name) || 0) + 1);
    });

    const mostProblematicFields = Array.from(fieldCounts.entries())
      .map(([field, error_count]) => ({ field, error_count }))
      .sort((a, b) => b.error_count - a.error_count)
      .slice(0, 10);

    // Calculate correction type distribution
    const correctionTypes: Record<string, number> = {};
    corrections?.forEach((c) => {
      correctionTypes[c.correction_type] = (correctionTypes[c.correction_type] || 0) + 1;
    });

    // Calculate improvement over time (weekly averages)
    const weeklyMetrics = new Map<string, { sum: number; count: number }>();
    metrics?.forEach((m) => {
      const week = new Date(m.extraction_time).toISOString().slice(0, 10); // Group by day for now
      if (!weeklyMetrics.has(week)) {
        weeklyMetrics.set(week, { sum: 0, count: 0 });
      }
      const weekData = weeklyMetrics.get(week)!;
      weekData.sum += m.overall_confidence || 0;
      weekData.count += 1;
    });

    const improvement_over_time = Array.from(weeklyMetrics.entries())
      .map(([period, data]) => ({
        period,
        avg_confidence: data.sum / data.count
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      success: true,
      insights: {
        total_corrections: corrections?.length || 0,
        most_problematic_fields: mostProblematicFields,
        improvement_over_time,
        correction_type_distribution: correctionTypes
      }
    };
  } catch (error) {
    console.error('Error generating learning insights:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
