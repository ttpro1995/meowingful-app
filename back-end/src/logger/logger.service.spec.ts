import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService, loggerFactory } from './logger.service';

describe('AppLoggerService', () => {
  let service: AppLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppLoggerService],
    }).compile();

    service = module.get<AppLoggerService>(AppLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logger methods', () => {
    it('should log info message', () => {
      service.log('test message');
    });

    it('should log error message', () => {
      service.error('error message');
    });

    it('should log warn message', () => {
      service.warn('warn message');
    });

    it('should log debug message', () => {
      service.debug('debug message');
    });

    it('should log verbose message', () => {
      service.verbose('verbose message');
    });
  });

  describe('sensitive data sanitization', () => {
    it('should have child method', () => {
      const childLogger = service.child({ requestId: '123' });
      expect(childLogger).toBeDefined();
    });
  });
});

describe('loggerFactory', () => {
  it('should return pinoHttp configuration', () => {
    const config = loggerFactory();
    expect(config.pinoHttp).toBeDefined();
    expect(config.pinoHttp.level).toBeDefined();
  });
});
