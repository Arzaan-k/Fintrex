// ClientBalanceSheet.tsx - Component to display balance sheet for a client
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatINR, formatIndianNumber } from '@/lib/financial';
import { Download, RefreshCw } from 'lucide-react';

interface BalanceSheetData {
  id?: string;
  client_id: string;
  as_of_date: string;
  status: 'draft' | 'reviewed' | 'final';
  data: {
    assets: {
      current: { [key: string]: number };
      nonCurrent: { [key: string]: number };
    };
    liabilities: {
      current: { [key: string]: number };
      nonCurrent: { [key: string]: number };
    };
    equity: { [key: string]: number };
  };
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  generated_at?: string;
}

interface ClientBalanceSheetProps {
  clientId: string;
  clientName: string;
}

export default function ClientBalanceSheet({ clientId, clientName }: ClientBalanceSheetProps) {
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) {
      fetchBalanceSheet();
    }
  }, [clientId]);

  const fetchBalanceSheet = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('balance_sheets')
        .select('*')
        .eq('client_id', clientId)
        .eq('as_of_date', today)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setBalanceSheet(data || null);
    } catch (err) {
      console.error('Error fetching balance sheet:', err);
      setError('Failed to load balance sheet');
    } finally {
      setLoading(false);
    }
  };

  const generateBalanceSheet = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      // Call the database function to generate/update balance sheet
      const { error: rpcError } = await supabase.rpc('update_client_balance_sheet', {
        p_client_id: clientId
      });

      if (rpcError) {
        throw rpcError;
      }

      // Fetch the newly generated balance sheet
      await fetchBalanceSheet();
    } catch (err) {
      console.error('Error generating balance sheet:', err);
      setError('Failed to generate balance sheet');
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (newStatus: 'draft' | 'reviewed' | 'final') => {
    if (!balanceSheet?.id) return;

    try {
      const { error } = await supabase
        .from('balance_sheets')
        .update({ status: newStatus })
        .eq('id', balanceSheet.id);

      if (error) throw error;

      setBalanceSheet(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err) {
      console.error('Error updating balance sheet status:', err);
      setError('Failed to update balance sheet status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-500">
          <p>{error}</p>
          <Button onClick={fetchBalanceSheet} variant="outline" className="mt-4">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Balance Sheet</h2>
            <p className="text-muted-foreground">{clientName}</p>
            <p className="text-sm text-muted-foreground">
              As of {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {balanceSheet ? (
              <>
                <Badge variant={
                  balanceSheet.status === 'draft' ? 'outline' :
                  balanceSheet.status === 'reviewed' ? 'secondary' : 'default'
                }>
                  {balanceSheet.status.charAt(0).toUpperCase() + balanceSheet.status.slice(1)}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => updateStatus('reviewed')}
                  disabled={balanceSheet.status === 'reviewed' || balanceSheet.status === 'final'}
                >
                  Mark as Reviewed
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => updateStatus('final')}
                  disabled={balanceSheet.status === 'final'}
                >
                  Finalize
                </Button>
                <Button size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </>
            ) : (
              <Button 
                onClick={generateBalanceSheet} 
                disabled={generating}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Generating...' : 'Generate Balance Sheet'}
              </Button>
            )}
          </div>
        </div>

        {balanceSheet ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Assets */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">ASSETS</h3>
              </div>

              {/* Current Assets */}
              <div>
                <h4 className="font-medium text-sm mb-2 text-muted-foreground">Current Assets</h4>
                <div className="space-y-2">
                  {Object.entries(balanceSheet.data.assets.current).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1">
                      <span>{key}</span>
                      <span>{formatINR(value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-medium border-t border-muted mt-1">
                    <span>Total Current Assets</span>
                    <span>{formatINR(Object.values(balanceSheet.data.assets.current).reduce((sum, val) => sum + val, 0))}</span>
                  </div>
                </div>
              </div>

              {/* Non-Current Assets */}
              {Object.keys(balanceSheet.data.assets.nonCurrent).length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Non-Current Assets</h4>
                  <div className="space-y-2">
                    {Object.entries(balanceSheet.data.assets.nonCurrent).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-1">
                        <span>{key}</span>
                        <span>{formatINR(value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-medium border-t border-muted mt-1">
                      <span>Total Non-Current Assets</span>
                      <span>{formatINR(Object.values(balanceSheet.data.assets.nonCurrent).reduce((sum, val) => sum + val, 0))}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-2">
                <div className="flex justify-between py-2 font-bold text-lg">
                  <span>TOTAL ASSETS</span>
                  <span>{formatIndianNumber(balanceSheet.total_assets)}</span>
                </div>
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">LIABILITIES & EQUITY</h3>
              </div>

              {/* Current Liabilities */}
              <div>
                <h4 className="font-medium text-sm mb-2 text-muted-foreground">Current Liabilities</h4>
                <div className="space-y-2">
                  {Object.entries(balanceSheet.data.liabilities.current).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1">
                      <span>{key}</span>
                      <span>{formatINR(value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-medium border-t border-muted mt-1">
                    <span>Total Current Liabilities</span>
                    <span>{formatINR(Object.values(balanceSheet.data.liabilities.current).reduce((sum, val) => sum + val, 0))}</span>
                  </div>
                </div>
              </div>

              {/* Non-Current Liabilities */}
              {Object.keys(balanceSheet.data.liabilities.nonCurrent).length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Non-Current Liabilities</h4>
                  <div className="space-y-2">
                    {Object.entries(balanceSheet.data.liabilities.nonCurrent).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-1">
                        <span>{key}</span>
                        <span>{formatINR(value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-medium border-t border-muted mt-1">
                      <span>Total Non-Current Liabilities</span>
                      <span>{formatINR(Object.values(balanceSheet.data.liabilities.nonCurrent).reduce((sum, val) => sum + val, 0))}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Equity */}
              <div>
                <h4 className="font-medium text-sm mb-2 text-muted-foreground">Equity</h4>
                <div className="space-y-2">
                  {Object.entries(balanceSheet.data.equity).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1">
                      <span>{key}</span>
                      <span>{formatINR(value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-medium border-t border-muted mt-1">
                    <span>Total Equity</span>
                    <span>{formatINR(Object.values(balanceSheet.data.equity).reduce((sum, val) => sum + val, 0))}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-2">
                <div className="flex justify-between py-2 font-bold text-lg">
                  <span>TOTAL LIABILITIES & EQUITY</span>
                  <span>{formatIndianNumber(balanceSheet.total_liabilities + balanceSheet.total_equity)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No balance sheet generated yet for today.</p>
            <Button 
              onClick={generateBalanceSheet} 
              disabled={generating}
              className="flex items-center gap-2 mx-auto"
            >
              <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating...' : 'Generate Balance Sheet'}
            </Button>
          </div>
        )}

        {/* Balance Check */}
        {balanceSheet && Math.abs(balanceSheet.total_assets - (balanceSheet.total_liabilities + balanceSheet.total_equity)) > 0.01 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-medium">
              ⚠️ Balance Sheet mismatch: Assets and Liabilities+Equity do not balance
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}