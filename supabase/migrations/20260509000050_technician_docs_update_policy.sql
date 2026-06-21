CREATE POLICY "Technicians update own docs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'technician-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'technician-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
