import { Request, Response } from 'express';
import { loggerMiddleware } from './logger.middleware';

describe('Logger Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      originalUrl: '/test',
    };
    mockResponse = {
      on: jest.fn().mockImplementation((event: string, callback: () => void) => {
        if (event === 'finish') {
          callback();
        }
      }),
      statusCode: 200,
    };
    mockNext = jest.fn();

    // Mock console.log
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call next function', () => {
    loggerMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockNext).toHaveBeenCalled();
  });

  it('should log request information on finish', () => {
    loggerMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(console.log).toHaveBeenCalled();
  });

  it('should log correct format', () => {
    mockRequest.method = 'POST';
    mockRequest.originalUrl = '/api/users';
    mockResponse.statusCode = 201;

    loggerMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[POST\] \/api\/users - 201 - \d+ms/),
    );
  });
});