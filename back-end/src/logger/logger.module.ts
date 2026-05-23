import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AppLoggerService, loggerFactory } from './logger.service';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      useFactory: loggerFactory,
    }),
  ],
  providers: [AppLoggerService],
  exports: [AppLoggerService, PinoLoggerModule],
})
export class LoggerModule {}
