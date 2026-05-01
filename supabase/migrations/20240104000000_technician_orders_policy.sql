-- Allow technicians to view available orders (pending status, no technician assigned)
CREATE POLICY "Technicians can view available orders"
  ON orders FOR SELECT
  USING (status = 'pending' AND technician_id IS NULL);
