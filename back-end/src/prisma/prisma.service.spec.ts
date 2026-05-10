import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('should be defined', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const prismaService = module.get<PrismaService>(PrismaService);
    expect(prismaService).toBeDefined();
  });
});
