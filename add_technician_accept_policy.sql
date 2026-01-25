-- Allow technicians to accept available orders (update pending orders with null technician_id)
CREATE POLICY "Technicians can accept available orders"
  ON orders FOR UPDATE
  USING (status = 'pending' AND technician_id IS NULL);
