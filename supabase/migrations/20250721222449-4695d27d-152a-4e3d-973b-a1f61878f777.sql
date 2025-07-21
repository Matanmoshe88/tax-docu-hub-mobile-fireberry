-- Create storage bucket for signatures
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true) 
ON CONFLICT (id) DO NOTHING;

-- Create policies for signature uploads
CREATE POLICY "Anyone can view signatures" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'signatures');

CREATE POLICY "Anyone can upload signatures" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Anyone can update signatures" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'signatures');

CREATE POLICY "Anyone can delete signatures" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'signatures');