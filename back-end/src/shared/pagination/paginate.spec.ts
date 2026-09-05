import { paginate } from './paginate';

describe('paginate', () => {
  it('returns skip/take for page 2 with limit 10', () => {
    expect(paginate(2, 10)).toEqual({
      page: 2,
      limit: 10,
      skip: 10,
      take: 10,
    });
  });

  it('clamps limit to 100', () => {
    expect(paginate(1, 200)).toEqual({
      page: 1,
      limit: 100,
      skip: 0,
      take: 100,
    });
  });

  it('normalizes page 0 to page 1', () => {
    expect(paginate(0, 20)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });

  it('defaults page to 1 when undefined', () => {
    expect(paginate(undefined, 20)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });

  it('defaults limit to 20 when undefined', () => {
    expect(paginate(2, undefined)).toEqual({
      page: 2,
      limit: 20,
      skip: 20,
      take: 20,
    });
  });

  it('defaults both page and limit to safe values', () => {
    expect(paginate(undefined, undefined)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });

  it('clamps negative page to 1', () => {
    expect(paginate(-5, 20)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });

  it('clamps negative limit to 1', () => {
    expect(paginate(1, -10)).toEqual({
      page: 1,
      limit: 1,
      skip: 0,
      take: 1,
    });
  });

  it('normalizes NaN page to 1', () => {
    expect(paginate(NaN, 20)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });

  it('normalizes NaN limit to 20', () => {
    expect(paginate(1, NaN)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });

  it('normalizes Infinity limit to the default limit of 20 (not MAX_LIMIT)', () => {
    // Infinity is not a finite number, so toSafeInteger falls back to the default (20), not MAX_LIMIT
    expect(paginate(1, Infinity)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });

  it('handles fractional page (e.g. 1.7 → truncates to 1)', () => {
    expect(paginate(1.7, 20)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });

  it('handles fractional limit (e.g. 5.9 → truncates to 5)', () => {
    expect(paginate(1, 5.9)).toEqual({
      page: 1,
      limit: 5,
      skip: 0,
      take: 5,
    });
  });

  it('computes correct skip for page 3 with limit 25', () => {
    expect(paginate(3, 25)).toEqual({
      page: 3,
      limit: 25,
      skip: 50,
      take: 25,
    });
  });
});
