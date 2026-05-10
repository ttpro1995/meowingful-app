import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { PrismaModule } from '../prisma/prisma.module';

describe('AuthModule', () => {
  it('should be defined', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AuthModule, PrismaModule],
    }).compile();

    expect(module).toBeDefined();
  });
});
