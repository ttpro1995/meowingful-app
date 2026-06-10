const nestCreate = jest.fn();
const cookieParserFactory = jest.fn(() => 'cookie-middleware');

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: (...args: [unknown, unknown]) =>
      nestCreate(...args) as Promise<unknown>,
  },
}));

jest.mock('cookie-parser', () => ({
  __esModule: true,
  default: () => cookieParserFactory(),
}));

interface AppMock {
  useLogger: jest.Mock;
  get: jest.Mock;
  enableCors: jest.Mock;
  setGlobalPrefix: jest.Mock;
  use: jest.Mock;
  useGlobalPipes: jest.Mock;
  listen: jest.Mock;
  close: jest.Mock;
}

const flushAsync = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const importMainModule = async (): Promise<void> => {
  jest.resetModules();
  jest.isolateModules(() => {
    jest.requireActual('./main');
  });
  await flushAsync();
};

const createAppMock = (): AppMock => ({
  useLogger: jest.fn(),
  get: jest.fn().mockReturnValue({}),
  enableCors: jest.fn(),
  setGlobalPrefix: jest.fn(),
  use: jest.fn(),
  useGlobalPipes: jest.fn(),
  listen: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
});

describe('main bootstrap', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalPort = process.env.PORT;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = 'http://frontend.local';
    process.env.PORT = '3501';
  });

  afterEach(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
    process.env.PORT = originalPort;
    jest.restoreAllMocks();
  });

  it('configures Nest app bootstrap with logger, cors, pipes, and prefix', async () => {
    const app = createAppMock();
    nestCreate.mockResolvedValueOnce(app);

    const signalHandlers = new Map<string, () => void>();
    jest.spyOn(process, 'on').mockImplementation((eventName, listener) => {
      if (eventName === 'SIGINT' || eventName === 'SIGTERM') {
        signalHandlers.set(eventName, () => listener());
      }
      return process;
    });

    await importMainModule();

    expect(nestCreate).toHaveBeenCalledWith(expect.any(Function), {
      bufferLogs: true,
    });
    expect(app.useLogger).toHaveBeenCalledTimes(1);
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: [
        'http://frontend.local',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ],
      credentials: true,
    });
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api/v1');
    expect(cookieParserFactory).toHaveBeenCalledTimes(1);
    expect(app.use).toHaveBeenCalledWith('cookie-middleware');
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    const [pipe] = app.useGlobalPipes.mock.calls[0] as [
      { constructor?: { name?: string }; isTransformEnabled?: boolean },
    ];
    expect(pipe.constructor?.name).toBe('ValidationPipe');
    expect(pipe.isTransformEnabled).toBe(true);
    expect(app.listen).toHaveBeenCalledWith('3501');
    expect(signalHandlers.has('SIGINT')).toBe(true);
    expect(signalHandlers.has('SIGTERM')).toBe(true);
  });

  it('handles graceful shutdown success path', async () => {
    const app = createAppMock();
    nestCreate.mockResolvedValueOnce(app);

    const signalHandlers = new Map<string, () => void>();
    jest.spyOn(process, 'on').mockImplementation((eventName, listener) => {
      if (eventName === 'SIGTERM') {
        signalHandlers.set(eventName, () => listener());
      }
      return process;
    });

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);

    await importMainModule();

    const shutdownHandler = signalHandlers.get('SIGTERM');
    expect(shutdownHandler).toBeDefined();

    shutdownHandler?.();
    await flushAsync();

    expect(app.close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles graceful shutdown error path', async () => {
    const app = createAppMock();
    app.close.mockRejectedValueOnce(new Error('close-failed'));
    nestCreate.mockResolvedValueOnce(app);

    const signalHandlers = new Map<string, () => void>();
    jest.spyOn(process, 'on').mockImplementation((eventName, listener) => {
      if (eventName === 'SIGINT') {
        signalHandlers.set(eventName, () => listener());
      }
      return process;
    });

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await importMainModule();

    const shutdownHandler = signalHandlers.get('SIGINT');
    expect(shutdownHandler).toBeDefined();

    shutdownHandler?.();
    await flushAsync();

    expect(app.close).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Error during graceful shutdown',
      expect.any(Error),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
