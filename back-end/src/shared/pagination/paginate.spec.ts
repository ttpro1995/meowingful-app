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
});
