// Custom hook to fetch and manage balance sheet data
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BalanceSheetData {
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

export const useBalanceSheet = (clientId: string | null, date?: string) => {
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;

    const fetchBalanceSheet = async () => {
      try {
        setLoading(true);
        
        // Determine the date to query for
        const queryDate = date || new Date().toISOString().split('T')[0];
        
        // Fetch balance sheet for the client and date
        const { data, error } = await supabase
          .from('balance_sheets')
          .select('*')
          .eq('client_id', clientId)
          .eq('as_of_date', queryDate)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No balance sheet found for this date
            setBalanceSheet(null);
          } else {
            throw error;
          }
        } else {
          setBalanceSheet(data);
        }
      } catch (err) {
        console.error('Error fetching balance sheet:', err);
        setError('Failed to load balance sheet data');
      } finally {
        setLoading(false);
      }
    };

    fetchBalanceSheet();
  }, [clientId, date]);

  const generateBalanceSheet = async (asOfDate?: Date) => {
    if (!clientId) return;

    try {
      setLoading(true);
      
      const targetDate = asOfDate || new Date();
      const dateString = targetDate.toISOString().split('T')[0];
      
      // Call the database function to generate/update balance sheet
      const { error: rpcError } = await supabase.rpc('update_client_balance_sheet', {
        p_client_id: clientId
      });

      if (rpcError) {
        throw rpcError;
      }

      // Fetch the newly generated balance sheet
      const { data, error: fetchError } = await supabase
        .from('balance_sheets')
        .select('*')
        .eq('client_id', clientId)
        .eq('as_of_date', dateString)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      setBalanceSheet(data);
      return data;
    } catch (err) {
      console.error('Error generating balance sheet:', err);
      setError('Failed to generate balance sheet');
      return null;
    } finally {
      setLoading(false);
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
      return true;
    } catch (err) {
      console.error('Error updating balance sheet status:', err);
      setError('Failed to update balance sheet status');
      return false;
    }
  };

  return {
    balanceSheet,
    loading,
    error,
    generateBalanceSheet,
    updateStatus
  };
};