import { sanitize } from './logger.service';

describe('sanitize function', () => {
  it('should return non-objects unchanged', () => {
    expect(sanitize('string')).toBe('string');
    expect(sanitize(123)).toBe(123);
    expect(sanitize(null)).toBe(null);
    expect(sanitize(undefined)).toBe(undefined);
  });

  it('should sanitize password field', () => {
    const input = { password: 'secret123', username: 'test' };
    const result = sanitize(input);
    expect((result as Record<string, unknown>).password).toBe('[REDACTED]');
    expect((result as Record<string, unknown>).username).toBe('test');
  });

  it('should sanitize token field', () => {
    const input = { token: 'abc123', data: 'value' };
    const result = sanitize(input);
    expect((result as Record<string, unknown>).token).toBe('[REDACTED]');
    expect((result as Record<string, unknown>).data).toBe('value');
  });

  it('should sanitize nested objects', () => {
    const input = {
      user: { password: 'secret', name: 'John' },
    };
    const result = sanitize(input);
    expect(
      ((result as Record<string, unknown>).user as Record<string, unknown>)
        .password,
    ).toBe('[REDACTED]');
    expect(
      ((result as Record<string, unknown>).user as Record<string, unknown>)
        .name,
    ).toBe('John');
  });

  it('should sanitize arrays', () => {
    const input = [{ password: 'secret1' }, { password: 'secret2' }];
    const result = sanitize(input);
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[])[0]).toEqual({ password: '[REDACTED]' });
    expect((result as unknown[])[1]).toEqual({ password: '[REDACTED]' });
  });
});
