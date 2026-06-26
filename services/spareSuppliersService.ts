import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export interface SpareSupplier {
  id: string;
  name: string;
  whatsapp_number: string;
  specialty: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SupplierInput {
  name: string;
  whatsapp_number: string;
  specialty?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

/** Active suppliers only — the technician-facing list. */
export const listActiveSuppliers = async (): Promise<SpareSupplier[]> => {
  try {
    const { data, error } = await supabase
      .from('spare_parts_suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as SpareSupplier[];
  } catch (e) {
    logger.warn('listActiveSuppliers failed', e);
    return [];
  }
};

/** All suppliers (admin) — includes inactive. */
export const listAllSuppliers = async (): Promise<SpareSupplier[]> => {
  try {
    const { data, error } = await supabase
      .from('spare_parts_suppliers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as SpareSupplier[];
  } catch (e) {
    logger.warn('listAllSuppliers failed', e);
    return [];
  }
};

export const createSupplier = async (input: SupplierInput): Promise<SpareSupplier> => {
  const { data, error } = await supabase
    .from('spare_parts_suppliers')
    .insert({
      name: input.name.trim(),
      whatsapp_number: input.whatsapp_number.trim(),
      specialty: input.specialty?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SpareSupplier;
};

export const updateSupplier = async (
  id: string,
  input: Partial<SupplierInput>
): Promise<SpareSupplier> => {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.whatsapp_number !== undefined) patch.whatsapp_number = input.whatsapp_number.trim();
  if (input.specialty !== undefined) patch.specialty = input.specialty?.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  const { data, error } = await supabase
    .from('spare_parts_suppliers')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as SpareSupplier;
};

export const deleteSupplier = async (id: string): Promise<void> => {
  const { error } = await supabase.from('spare_parts_suppliers').delete().eq('id', id);
  if (error) throw error;
};
