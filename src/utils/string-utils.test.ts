import { describe, it, expect } from 'bun:test';
import {
  toKebabCase,
  sanitizeForText,
  sanitizeForDescription,
  sanitizeError,
  validateUrl,
  validateToken,
  generateArtifactId,
} from './string-utils.js';

describe('toKebabCase', () => {
  it('converts spaces to hyphens and lowercases', () => {
    expect(toKebabCase('My Chart Title')).toBe('my-chart-title');
  });

  it('replaces non-alphanumeric chars with hyphens', () => {
    expect(toKebabCase('Hello_World! Test')).toBe('hello-world-test');
  });

  it('removes leading and trailing hyphens', () => {
    expect(toKebabCase('--hello--')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(toKebabCase('')).toBe('');
  });
});

describe('sanitizeForText', () => {
  it('truncates to maxLength', () => {
    const long = 'a'.repeat(600);
    expect(sanitizeForText(long).length).toBeLessThanOrEqual(500);
  });

  it('truncates to custom maxLength', () => {
    expect(sanitizeForText('hello world', 5)).toBe('hello');
  });

  it('strips control characters', () => {
    expect(sanitizeForText('hello\x00\x01world')).toBe('helloworld');
  });

  it('normalizes newlines to spaces', () => {
    expect(sanitizeForText('hello\nworld')).toBe('hello world');
    expect(sanitizeForText('hello\r\nworld')).toBe('hello world');
  });

  it('collapses multiple spaces', () => {
    expect(sanitizeForText('hello   world')).toBe('hello world');
  });

  it('trims whitespace', () => {
    expect(sanitizeForText('  hello  ')).toBe('hello');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeForText(42 as unknown as string)).toBe('');
  });
});

describe('sanitizeForDescription', () => {
  it('defaults to 200 char limit', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeForDescription(long).length).toBeLessThanOrEqual(200);
  });
});

describe('sanitizeError', () => {
  it('extracts message from Error objects', () => {
    const result = sanitizeError(new Error('test error'));
    expect(result.message).toBe('test error');
  });

  it('handles string errors', () => {
    const result = sanitizeError('something went wrong');
    expect(result.message).toBe('something went wrong');
  });

  it('handles error-like objects', () => {
    const result = sanitizeError({ message: 'obj error' });
    expect(result.message).toBe('obj error');
  });

  it('redacts long token-like strings', () => {
    const token = 'a'.repeat(40);
    const result = sanitizeError(`Token is ${token}`);
    expect(result.message).toContain('[REDACTED]');
    expect(result.message).not.toContain(token);
  });

  it('preserves UUIDs', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = sanitizeError(`ID: ${uuid}`);
    expect(result.message).toContain(uuid);
  });

  it('strips query params from URLs', () => {
    const result = sanitizeError('Failed at https://example.com/api?token=secret123');
    expect(result.message).not.toContain('secret123');
  });

  it('redacts credential patterns', () => {
    const result = sanitizeError('api_key: abcdefghijklmnopqrstuvwxyz12345678');
    expect(result.message).toContain('[REDACTED]');
  });

  it('does not include stack by default', () => {
    const result = sanitizeError(new Error('test'));
    expect(result.stack).toBeUndefined();
  });

  it('includes sanitized stack when requested', () => {
    const result = sanitizeError(new Error('test'), true);
    expect(result.stack).toBeDefined();
  });

  it('handles null and undefined', () => {
    expect(sanitizeError(null).message).toBe('null');
    expect(sanitizeError(undefined).message).toBe('undefined');
  });
});

describe('validateUrl', () => {
  it('accepts valid http URL', () => {
    expect(validateUrl('http://example.com')).toBe('http://example.com');
  });

  it('accepts valid https URL', () => {
    expect(validateUrl('https://example.com')).toBe('https://example.com');
  });

  it('trims whitespace', () => {
    expect(validateUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('throws on empty string', () => {
    expect(() => validateUrl('')).toThrow('URL cannot be empty');
  });

  it('throws on invalid URL', () => {
    expect(() => validateUrl('not-a-url')).toThrow('Invalid URL format');
  });

  it('throws on non-http protocol', () => {
    expect(() => validateUrl('ftp://example.com')).toThrow('HTTP or HTTPS');
  });

  it('throws when exceeding maxLength', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(3000);
    expect(() => validateUrl(longUrl)).toThrow('exceeds maximum length');
  });

  it('enforces HTTPS when requireHttps is true', () => {
    expect(() => validateUrl('http://example.com', { requireHttps: true })).toThrow('HTTPS');
  });

  it('accepts HTTPS when requireHttps is true', () => {
    expect(validateUrl('https://example.com', { requireHttps: true })).toBe('https://example.com');
  });
});

describe('validateToken', () => {
  it('accepts valid token', () => {
    expect(validateToken('my-token-123')).toBe('my-token-123');
  });

  it('trims whitespace', () => {
    expect(validateToken('  token  ')).toBe('token');
  });

  it('throws on empty string', () => {
    expect(() => validateToken('')).toThrow('at least 1 character');
  });

  it('throws when exceeding maxLength', () => {
    const longToken = 'a'.repeat(3000);
    expect(() => validateToken(longToken)).toThrow('exceeds maximum length');
  });

  it('enforces custom minLength', () => {
    expect(() => validateToken('abc', { minLength: 5 })).toThrow('at least 5 character');
  });

  it('enforces custom maxLength', () => {
    expect(() => validateToken('abcdef', { maxLength: 3 })).toThrow('exceeds maximum length');
  });
});

describe('generateArtifactId', () => {
  it('returns id with the given type prefix and 8 hex chars', () => {
    expect(generateArtifactId('chart')).toMatch(/^chart-[0-9a-f]{8}$/);
    expect(generateArtifactId('query')).toMatch(/^query-[0-9a-f]{8}$/);
  });

  it('returns unique ids on successive calls', () => {
    expect(generateArtifactId('chart')).not.toBe(generateArtifactId('chart'));
  });
});
