import {
  validateEmail,
  validatePhone,
  validatePassword,
  validatePrice,
  validateAddress,
  validateName,
  validateDescription,
  validateFileSize,
  validateImageType,
  sanitizeInput,
  validateCoordinates,
  normalizeSaudiPhone,
} from '../utils/validation';

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('user+tag@domain.co')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});

describe('validatePhone', () => {
  it('accepts valid Saudi phone formats', () => {
    expect(validatePhone('0512345678')).toBe(true);
    expect(validatePhone('512345678')).toBe(true);
    expect(validatePhone('+966512345678')).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    expect(validatePhone('123')).toBe(false);
    expect(validatePhone('abcdefghij')).toBe(false);
    expect(validatePhone('+1234567890')).toBe(false);
  });
});

describe('validatePassword', () => {
  it('marks strong passwords as valid', () => {
    const result = validatePassword('StrongP@ss1');
    expect(result.isValid).toBe(true);
    expect(result.strength).toBe('strong');
    expect(result.errors).toHaveLength(0);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = validatePassword('Short1!');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects passwords missing uppercase', () => {
    const result = validatePassword('lowercase1!@#');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('uppercase') || e.includes('كبير'))).toBe(true);
  });

  it('rejects passwords missing numbers', () => {
    const result = validatePassword('NoNumbers!@#');
    expect(result.isValid).toBe(false);
  });

  it('rejects passwords missing special characters', () => {
    const result = validatePassword('NoSpecial123');
    expect(result.isValid).toBe(false);
  });

  it('returns Arabic error messages when language is ar', () => {
    const result = validatePassword('short', 'ar');
    expect(result.errors[0]).toMatch(/[؀-ۿ]/);
  });
});

describe('validatePrice', () => {
  it('accepts valid prices', () => {
    expect(validatePrice(100).valid).toBe(true);
    expect(validatePrice(0).valid).toBe(true);
    expect(validatePrice('50.5').valid).toBe(true);
  });

  it('rejects negative prices', () => {
    expect(validatePrice(-1).valid).toBe(false);
  });

  it('rejects prices above 100000', () => {
    expect(validatePrice(100001).valid).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(validatePrice('abc').valid).toBe(false);
  });
});

describe('validateAddress', () => {
  it('accepts valid addresses', () => {
    expect(validateAddress('123 Main Street, Riyadh').valid).toBe(true);
  });

  it('rejects empty addresses', () => {
    expect(validateAddress('').valid).toBe(false);
    expect(validateAddress('   ').valid).toBe(false);
  });

  it('rejects addresses shorter than 10 characters', () => {
    expect(validateAddress('Short').valid).toBe(false);
  });

  it('rejects addresses longer than 500 characters', () => {
    expect(validateAddress('a'.repeat(501)).valid).toBe(false);
  });
});

describe('validateName', () => {
  it('accepts valid names in English and Arabic', () => {
    expect(validateName('John Doe').valid).toBe(true);
    expect(validateName('محمد عاطف').valid).toBe(true);
  });

  it('rejects empty names', () => {
    expect(validateName('').valid).toBe(false);
  });

  it('rejects names with numbers or special chars', () => {
    expect(validateName('John123').valid).toBe(false);
    expect(validateName('John@Doe').valid).toBe(false);
  });

  it('rejects names longer than 100 characters', () => {
    expect(validateName('a'.repeat(101)).valid).toBe(false);
  });
});

describe('validateDescription', () => {
  it('accepts descriptions within limits', () => {
    expect(validateDescription('This is a valid description text.').valid).toBe(true);
  });

  it('rejects descriptions shorter than minLength', () => {
    expect(validateDescription('Short', 10).valid).toBe(false);
  });

  it('rejects descriptions longer than maxLength', () => {
    expect(validateDescription('a'.repeat(1001), 10, 1000).valid).toBe(false);
  });
});

describe('validateFileSize', () => {
  it('accepts files within the size limit', () => {
    expect(validateFileSize(4 * 1024 * 1024, 5).valid).toBe(true); // 4MB < 5MB
  });

  it('rejects files exceeding the size limit', () => {
    expect(validateFileSize(6 * 1024 * 1024, 5).valid).toBe(false); // 6MB > 5MB
  });
});

describe('validateImageType', () => {
  it('accepts supported image types', () => {
    expect(validateImageType('image/jpeg').valid).toBe(true);
    expect(validateImageType('image/png').valid).toBe(true);
    expect(validateImageType('image/webp').valid).toBe(true);
  });

  it('rejects unsupported types', () => {
    expect(validateImageType('image/gif').valid).toBe(false);
    expect(validateImageType('application/pdf').valid).toBe(false);
  });
});

describe('sanitizeInput', () => {
  it('escapes HTML special characters', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).not.toContain('<script>');
    expect(sanitizeInput('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;&#x2F;b&gt;');
  });

  it('leaves safe text unchanged in structure', () => {
    const safe = 'Hello World 123';
    expect(sanitizeInput(safe)).toBe(safe);
  });
});

describe('validateCoordinates', () => {
  it('accepts coordinates within Saudi Arabia bounds', () => {
    const r = validateCoordinates(24.7, 46.7); // Riyadh
    expect(r.valid).toBe(true);
    expect(r.insideSaudi).toBe(true);
  });

  it('flags coordinates outside Saudi Arabia but still accepts them as valid points', () => {
    // Outside-Saudi is no longer a hard rejection — country anchor is the
    // customer's explicit city selection. We only assert that the geo flag
    // distinguishes the two cases.
    const london = validateCoordinates(51.5, -0.12);
    expect(london.valid).toBe(true);
    expect(london.insideSaudi).toBe(false);
    const ny = validateCoordinates(40.7, -74.0);
    expect(ny.valid).toBe(true);
    expect(ny.insideSaudi).toBe(false);
  });

  it('rejects NaN coordinates', () => {
    expect(validateCoordinates(NaN, 46.7).valid).toBe(false);
  });

  it('rejects 0,0 null-island sentinel', () => {
    expect(validateCoordinates(0, 0).insideSaudi).toBe(false);
  });
});

describe('normalizeSaudiPhone', () => {
  it('normalizes 05XXXXXXXX format', () => {
    expect(normalizeSaudiPhone('0512345678')).toBe('+966512345678');
  });

  it('normalizes 5XXXXXXXX format', () => {
    expect(normalizeSaudiPhone('512345678')).toBe('+966512345678');
  });

  it('leaves +966 format unchanged', () => {
    expect(normalizeSaudiPhone('+966512345678')).toBe('+966512345678');
  });
});
