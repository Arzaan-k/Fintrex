-- Migration: Improved Balance Sheet Generation
-- Adds functions to automatically calculate account balances from journal entries

-- Create function to calculate account balances
CREATE OR REPLACE FUNCTION public.calculate_account_balances(p_client_id UUID, p_as_of_date DATE)
RETURNS TABLE (
  account_name TEXT,
  account_type TEXT,
  balance NUMERIC(15,2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jli.account_name,
    coa.account_type,
    SUM(jli.debit_amount - jli.credit_amount) as balance
  FROM public.journal_line_items jli
  JOIN public.journal_entries je ON jli.entry_id = je.id
  LEFT JOIN public.chart_of_accounts coa ON jli.account_id = coa.id
  WHERE je.client_id = p_client_id 
    AND je.entry_date <= p_as_of_date
    AND je.status = 'posted'
  GROUP BY jli.account_name, coa.account_type
  HAVING SUM(jli.debit_amount - jli.credit_amount) != 0
  ORDER BY jli.account_name;
END;
$$;

-- Create function to generate balance sheet data
CREATE OR REPLACE FUNCTION public.generate_balance_sheet_data(p_client_id UUID, p_as_of_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  balance_sheet_data JSONB := '{}';
  account RECORD;
BEGIN
  -- Initialize balance sheet structure
  balance_sheet_data := jsonb_build_object(
    'assets', jsonb_build_object(
      'current', '{}',
      'nonCurrent', '{}'
    ),
    'liabilities', jsonb_build_object(
      'current', '{}',
      'nonCurrent', '{}'
    ),
    'equity', '{}'
  );

  -- Process each account balance
  FOR account IN 
    SELECT * FROM public.calculate_account_balances(p_client_id, p_as_of_date)
  LOOP
    -- Map accounts to balance sheet categories
    CASE 
      WHEN account.account_name IN ('Cash', 'Bank Accounts', 'Debtors', 'Inventory', 'GST Input', 'Prepaid Expenses') THEN
        -- Current Assets
        balance_sheet_data := jsonb_set(
          balance_sheet_data,
          '{assets,current,' || account.account_name || '}',
          to_jsonb(ABS(account.balance))
        );
        
      WHEN account.account_name IN ('Plant & Machinery', 'Furniture & Fixtures', 'Land & Buildings', 'Investments') THEN
        -- Non-Current Assets
        balance_sheet_data := jsonb_set(
          balance_sheet_data,
          '{assets,nonCurrent,' || account.account_name || '}',
          to_jsonb(ABS(account.balance))
        );
        
      WHEN account.account_name IN ('Creditors', 'Bank Overdraft', 'GST Output', 'Accrued Expenses') THEN
        -- Current Liabilities
        balance_sheet_data := jsonb_set(
          balance_sheet_data,
          '{liabilities,current,' || account.account_name || '}',
          to_jsonb(ABS(account.balance))
        );
        
      WHEN account.account_name IN ('Loans', 'Mortgages', 'Long-term Borrowings') THEN
        -- Non-Current Liabilities
        balance_sheet_data := jsonb_set(
          balance_sheet_data,
          '{liabilities,nonCurrent,' || account.account_name || '}',
          to_jsonb(ABS(account.balance))
        );
        
      WHEN account.account_name IN ('Share Capital', 'Retained Earnings', 'Reserves') THEN
        -- Equity
        balance_sheet_data := jsonb_set(
          balance_sheet_data,
          '{equity,' || account.account_name || '}',
          to_jsonb(ABS(account.balance))
        );
        
      ELSE
        -- Default to current assets for positive balances, current liabilities for negative
        IF account.balance > 0 THEN
          balance_sheet_data := jsonb_set(
            balance_sheet_data,
            '{assets,current,' || account.account_name || '}',
            to_jsonb(ABS(account.balance))
          );
        ELSE
          balance_sheet_data := jsonb_set(
            balance_sheet_data,
            '{liabilities,current,' || account.account_name || '}',
            to_jsonb(ABS(account.balance))
          );
        END IF;
    END CASE;
  END LOOP;

  RETURN balance_sheet_data;
END;
$$;

-- Create function to automatically update balance sheet
CREATE OR REPLACE FUNCTION public.update_client_balance_sheet(p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bs_data JSONB;
  total_assets NUMERIC(15,2);
  total_liabilities NUMERIC(15,2);
  total_equity NUMERIC(15,2);
  today DATE := CURRENT_DATE;
  existing_bs UUID;
BEGIN
  -- Generate balance sheet data
  bs_data := public.generate_balance_sheet_data(p_client_id, today);
  
  -- Calculate totals
  SELECT 
    COALESCE(SUM(value::NUMERIC), 0) INTO total_assets
  FROM jsonb_each(bs_data->'assets'->'current')
  UNION ALL
  SELECT 
    COALESCE(SUM(value::NUMERIC), 0)
  FROM jsonb_each(bs_data->'assets'->'nonCurrent');
  
  SELECT 
    COALESCE(SUM(value::NUMERIC), 0) INTO total_liabilities
  FROM jsonb_each(bs_data->'liabilities'->'current')
  UNION ALL
  SELECT 
    COALESCE(SUM(value::NUMERIC), 0)
  FROM jsonb_each(bs_data->'liabilities'->'nonCurrent');
  
  SELECT 
    COALESCE(SUM(value::NUMERIC), 0) INTO total_equity
  FROM jsonb_each(bs_data->'equity');

  -- Check if balance sheet already exists for today
  SELECT id INTO existing_bs
  FROM public.balance_sheets
  WHERE client_id = p_client_id AND as_of_date = today
  LIMIT 1;

  IF existing_bs IS NOT NULL THEN
    -- Update existing balance sheet
    UPDATE public.balance_sheets
    SET 
      data = bs_data,
      total_assets = total_assets,
      total_liabilities = total_liabilities,
      total_equity = total_equity,
      generated_at = NOW(),
      status = 'draft'
    WHERE id = existing_bs;
  ELSE
    -- Create new balance sheet
    INSERT INTO public.balance_sheets (
      client_id,
      as_of_date,
      data,
      total_assets,
      total_liabilities,
      total_equity,
      status
    ) VALUES (
      p_client_id,
      today,
      bs_data,
      total_assets,
      total_liabilities,
      total_equity,
      'draft'
    );
  END IF;
END;
$$;

-- Create trigger function to automatically update balance sheet on journal entry changes
CREATE OR REPLACE FUNCTION public.auto_update_balance_sheet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Schedule balance sheet update (in a real implementation, this would use a queue)
  -- For now, we'll just log that an update is needed
  RAISE NOTICE 'Balance sheet update needed for client %', 
    COALESCE(NEW.client_id, OLD.client_id);
  
  RETURN NEW;
END;
$$;

-- Create triggers to automatically update balance sheets
DROP TRIGGER IF EXISTS update_balance_sheet_on_journal_entry ON public.journal_entries;
CREATE TRIGGER update_balance_sheet_on_journal_entry
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_balance_sheet();

DROP TRIGGER IF EXISTS update_balance_sheet_on_journal_line_item ON public.journal_line_items;
CREATE TRIGGER update_balance_sheet_on_journal_line_item
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_balance_sheet();

-- Add comment to explain the function
COMMENT ON FUNCTION public.update_client_balance_sheet(UUID) IS 
'Automatically generates or updates a client''s balance sheet based on current journal entries';