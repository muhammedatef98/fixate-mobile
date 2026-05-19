// Fixed-fallback fees used when the live values from
// `platform_settings` are not available (offline, pre-migration, etc.).
// Numbers are SAR and intentionally conservative so we never overcharge
// the customer if the dynamic lookup fails.

export const DEFAULT_INSPECTION_FEE_SAR = 30;
export const DEFAULT_RETURN_FEE_SAR = 20;

/**
 * The customer-facing cancellation fee when they reject the technician's
 * inspection quote. We charge the inspection fee always (the technician
 * already inspected the device) and additionally charge the return fee
 * for fulfillment modes where the device must be physically returned.
 */
export function computeCancellationFee(opts: {
  inspectionFee: number;
  returnFee: number;
  fulfillmentType?: 'mobile' | 'pickup' | 'personal_handoff';
}): { total: number; inspection: number; return: number } {
  const inspection = Math.max(0, Math.round(opts.inspectionFee));
  const needsReturn = opts.fulfillmentType === 'pickup';
  const ret = needsReturn ? Math.max(0, Math.round(opts.returnFee)) : 0;
  return { total: inspection + ret, inspection, return: ret };
}
