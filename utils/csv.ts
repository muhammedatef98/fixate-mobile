/**
 * csv.ts — a small, dependency-free CSV parser + row mapper for the admin
 * import flow (§5). Handles quoted fields (commas, quotes, newlines inside
 * quotes) so a sheet exported from Excel/Google Sheets as CSV pastes cleanly.
 * Pure + testable.
 */

/** Parse CSV text into rows of string cells. Trailing blank lines ignored. */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  // flush last field/row if any content
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // drop fully-empty rows
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
};

/**
 * Map CSV rows to objects keyed by the (lower-cased, trimmed) header row.
 * Returns [] when there's no data beyond the header.
 */
export const csvToObjects = (text: string): Record<string, string>[] => {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? '').trim();
    });
    return obj;
  });
};
