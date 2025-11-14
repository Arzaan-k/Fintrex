// REVIEW QUEUE DASHBOARD
// Human-in-the-loop review interface for low-confidence extractions
// Features: Side-by-side view, field-level validation, correction tracking

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, Clock, FileText, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { ReviewItemEditor } from '@/components/review/ReviewItemEditor';

interface ReviewQueueItem {
  id: string;
  document_id: string;
  client_id: string;
  accountant_id: string;
  extracted_data: any;
  original_ocr_text: string;
  overall_confidence: number;
  weighted_confidence: number;
  field_confidence_scores: Record<string, number>;
  validation_errors: any[];
  validation_warnings: any[];
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'escalated';
  priority: 'high' | 'medium' | 'low';
  assigned_to: string | null;
  assigned_at: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  corrected_data: any;
  correction_summary: any;
  escalation_reason: string | null;
  review_reason: string;
  created_at: string;
  updated_at: string;
  metadata: any;
  // Joined data
  document?: {
    file_name: string;
    file_path: string;
    document_type: string;
  };
  client?: {
    business_name: string;
  };
}

interface QueueSummary {
  total_pending: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  assigned_to_me: number;
  avg_review_time_minutes: number;
}

export default function ReviewQueue() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null);
  const [summary, setSummary] = useState<QueueSummary>({
    total_pending: 0,
    high_priority: 0,
    medium_priority: 0,
    low_priority: 0,
    assigned_to_me: 0,
    avg_review_time_minutes: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'in_review' | 'completed'>('pending');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  // Fetch queue summary
  const fetchSummary = async () => {
    if (!user) return;

    try {
      // Get summary from helper function
      const { data: summaryData, error } = await supabase
        .rpc('get_review_queue_summary', { accountant_uuid: user.id });

      if (error) throw error;

      // Calculate summary
      const summary: QueueSummary = {
        total_pending: 0,
        high_priority: 0,
        medium_priority: 0,
        low_priority: 0,
        assigned_to_me: 0,
        avg_review_time_minutes: 0
      };

      summaryData?.forEach((row: any) => {
        if (row.status === 'pending') {
          summary.total_pending += Number(row.count);
          if (row.priority === 'high') summary.high_priority += Number(row.count);
          if (row.priority === 'medium') summary.medium_priority += Number(row.count);
          if (row.priority === 'low') summary.low_priority += Number(row.count);
        }
      });

      // Get items assigned to me
      const { data: myItems } = await supabase
        .from('review_queue')
        .select('id')
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'in_review']);

      summary.assigned_to_me = myItems?.length || 0;

      // Calculate average review time
      const { data: metrics } = await supabase
        .from('extraction_metrics')
        .select('review_time_minutes')
        .not('review_time_minutes', 'is', null)
        .limit(100);

      if (metrics && metrics.length > 0) {
        const total = metrics.reduce((sum, m) => sum + (m.review_time_minutes || 0), 0);
        summary.avg_review_time_minutes = Math.round(total / metrics.length);
      }

      setSummary(summary);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  // Fetch review queue items
  const fetchItems = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('review_queue')
        .select(`
          *,
          document:documents!inner(file_name, file_path),
          client:clients!inner(client_name)
        `)
        .eq('accountant_id', user.id)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      // Apply status filter
      if (activeTab === 'pending') {
        query = query.eq('status', 'pending');
      } else if (activeTab === 'in_review') {
        query = query.eq('status', 'in_review');
      } else if (activeTab === 'completed') {
        query = query.in('status', ['approved', 'rejected']);
      }

      // Apply priority filter
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setItems(data || []);
    } catch (error) {
      console.error('Error fetching review queue:', error);
      toast({
        title: 'Error',
        description: 'Failed to load review queue',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Assign item to current user
  const assignToMe = async (itemId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('review_queue')
        .update({
          assigned_to: user.id,
          assigned_at: new Date().toISOString(),
          status: 'in_review'
        })
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: 'Assigned',
        description: 'Item assigned to you for review'
      });

      fetchItems();
      fetchSummary();
    } catch (error) {
      console.error('Error assigning item:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign item',
        variant: 'destructive'
      });
    }
  };

  // Handle review completion
  const handleReviewComplete = async (
    itemId: string,
    action: 'approve' | 'reject',
    correctedData?: any,
    notes?: string
  ) => {
    try {
      const reviewData: any = {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewer_notes: notes
      };

      if (correctedData) {
        reviewData.corrected_data = correctedData;
        reviewData.correction_summary = {
          fields_corrected: Object.keys(correctedData).length,
          corrected_at: new Date().toISOString()
        };
      }

      const { error } = await supabase
        .from('review_queue')
        .update(reviewData)
        .eq('id', itemId);

      if (error) throw error;

      // If approved, update the document status
      if (action === 'approve') {
        const item = items.find(i => i.id === itemId);
        if (item) {
          await supabase
            .from('documents')
            .update({
              needs_review: false,
              reviewed_at: new Date().toISOString(),
              reviewer_id: user?.id,
              review_status: 'approved'
            })
            .eq('id', item.document_id);
        }
      }

      toast({
        title: action === 'approve' ? 'Approved' : 'Rejected',
        description: `Document ${action === 'approve' ? 'approved' : 'rejected'} successfully`
      });

      setSelectedItem(null);
      fetchItems();
      fetchSummary();
    } catch (error) {
      console.error('Error completing review:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete review',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    fetchItems();
    fetchSummary();
  }, [user, activeTab, priorityFilter]);

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Please sign in to access the review queue.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Review Queue</h1>
        <p className="text-muted-foreground">
          Review and verify documents that need manual verification
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_pending}</div>
            <p className="text-xs text-muted-foreground">
              {summary.assigned_to_me} assigned to you
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.high_priority}</div>
            <p className="text-xs text-muted-foreground">
              Critical validation issues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Medium Priority</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.medium_priority}</div>
            <p className="text-xs text-muted-foreground">
              Low confidence scores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Review Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avg_review_time_minutes}m</div>
            <p className="text-xs text-muted-foreground">
              Per document
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Queue Items</CardTitle>
            <CardDescription>
              {items.length} items found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="in_review">Active</TabsTrigger>
                <TabsTrigger value="completed">Done</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Priority Filter */}
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                variant={priorityFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setPriorityFilter('all')}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={priorityFilter === 'high' ? 'destructive' : 'outline'}
                onClick={() => setPriorityFilter('high')}
              >
                High
              </Button>
              <Button
                size="sm"
                variant={priorityFilter === 'medium' ? 'default' : 'outline'}
                onClick={() => setPriorityFilter('medium')}
              >
                Medium
              </Button>
              <Button
                size="sm"
                variant={priorityFilter === 'low' ? 'outline' : 'outline'}
                onClick={() => setPriorityFilter('low')}
              >
                Low
              </Button>
            </div>

            <Separator className="my-4" />

            {/* Queue Items List */}
            <ScrollArea className="h-[600px] pr-4">
              {loading ? (
                <div className="text-center text-muted-foreground py-8">
                  Loading...
                </div>
              ) : items.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No items to review</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <Card
                      key={item.id}
                      className={`cursor-pointer transition-colors ${
                        selectedItem?.id === item.id
                          ? 'border-primary bg-accent'
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => setSelectedItem(item)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {item.document?.file_name || 'Unknown'}
                            </span>
                          </div>
                          <Badge
                            variant={
                              item.priority === 'high'
                                ? 'destructive'
                                : item.priority === 'medium'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {item.priority}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Client:</span>
                            <span className="font-medium">
                              {item.client?.business_name || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Confidence:</span>
                            <span
                              className={`font-medium ${
                                item.weighted_confidence >= 0.95
                                  ? 'text-green-600'
                                  : item.weighted_confidence >= 0.85
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {(item.weighted_confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <Badge variant="outline" className="text-xs">
                              {item.status}
                            </Badge>
                          </div>
                        </div>

                        {item.review_reason && (
                          <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs">
                            {item.review_reason}
                          </div>
                        )}

                        {item.status === 'pending' && !item.assigned_to && (
                          <Button
                            size="sm"
                            className="w-full mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              assignToMe(item.id);
                            }}
                          >
                            Assign to Me
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Review Editor */}
        <Card className="lg:col-span-2">
          {selectedItem ? (
            <ReviewItemEditor
              item={selectedItem}
              onComplete={handleReviewComplete}
              onCancel={() => setSelectedItem(null)}
            />
          ) : (
            <CardContent className="flex items-center justify-center h-[700px]">
              <div className="text-center text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No item selected</p>
                <p className="text-sm">Select an item from the queue to review</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
