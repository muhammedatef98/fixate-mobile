import { parseCsv, csvToObjects } from '../utils/csv';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with commas and quotes', () => {
    expect(parseCsv('name,note\n"Smith, John","said ""hi"""')).toEqual([
      ['name', 'note'],
      ['Smith, John', 'said "hi"'],
    ]);
  });

  it('handles newlines inside quotes and skips blank lines', () => {
    expect(parseCsv('a\n"line1\nline2"\n\n')).toEqual([['a'], ['line1\nline2']]);
  });
});

describe('csvToObjects', () => {
  it('maps by lower-cased headers', () => {
    const out = csvToObjects('Device_Type,Price\nphone,280');
    expect(out).toEqual([{ device_type: 'phone', price: '280' }]);
  });

  it('returns [] with only a header', () => {
    expect(csvToObjects('device_type,price')).toEqual([]);
  });
});
