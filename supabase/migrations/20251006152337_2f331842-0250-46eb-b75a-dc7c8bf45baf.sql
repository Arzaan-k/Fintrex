-- Create custom types
CREATE TYPE public.app_role AS ENUM ('admin', 'accountant', 'client');
CREATE TYPE public.document_status AS ENUM ('pending', 'processing', 'completed', 'rejected');
CREATE TYPE public.client_status AS ENUM ('active', 'kyc_pending', 'inactive');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT,
  phone_number TEXT NOT NULL,
  gst_number TEXT,
  pan_number TEXT,
  status client_status DEFAULT 'kyc_pending',
  total_documents INTEGER DEFAULT 0,
  completed_documents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  status document_status DEFAULT 'pending',
  uploaded_via TEXT DEFAULT 'dashboard',
  extracted_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create financial_records table
CREATE TABLE public.financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('income', 'expense', 'asset', 'liability')),
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  category TEXT,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone_number'
  );
  
  -- Assign default role as accountant
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'accountant');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for clients
CREATE POLICY "Accountants can view their clients"
  ON public.clients FOR SELECT
  USING (auth.uid() = accountant_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() = accountant_id);

CREATE POLICY "Accountants can update their clients"
  ON public.clients FOR UPDATE
  USING (auth.uid() = accountant_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can delete their clients"
  ON public.clients FOR DELETE
  USING (auth.uid() = accountant_id OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for documents
CREATE POLICY "Users can view documents of their clients"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = documents.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can upload documents for their clients"
  ON public.documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = documents.client_id
      AND clients.accountant_id = auth.uid()
    )
  );

CREATE POLICY "Users can update documents of their clients"
  ON public.documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = documents.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can delete documents of their clients"
  ON public.documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = documents.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for financial_records
CREATE POLICY "Users can view financial records of their clients"
  ON public.financial_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = financial_records.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can create financial records for their clients"
  ON public.financial_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = financial_records.client_id
      AND clients.accountant_id = auth.uid()
    )
  );

CREATE POLICY "Users can update financial records of their clients"
  ON public.financial_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = financial_records.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can delete financial records of their clients"
  ON public.financial_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = financial_records.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false);

-- Storage policies
CREATE POLICY "Users can view documents of their clients"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their uploaded documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their uploaded documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

-- Create indexes for better performance
CREATE INDEX idx_clients_accountant_id ON public.clients(accountant_id);
CREATE INDEX idx_documents_client_id ON public.documents(client_id);
CREATE INDEX idx_financial_records_client_id ON public.financial_records(client_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);