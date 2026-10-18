import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REDIS_HOST') return 'none';
              if (key === 'NODE_ENV') return 'development';
              return null;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('checkHealth should report ok status when database is reachable', async () => {
    const result = await controller.checkHealth();
    expect(result.status).toBe('ok');
    expect(result.dependencies.database.status).toBe('healthy');
  });

  it('checkHealth should report degraded status when database query fails', async () => {
    jest
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValue(new Error('DB unreachable'));

    const result = await controller.checkHealth();
    expect(result.status).toBe('degraded');
    expect(result.dependencies.database.status).toBe('unreachable');
  });

  it('checkHealth should report healthy redis when redisClient is active', async () => {
    (controller as any).redisClient = {
      status: 'ready',
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
    };

    const result = await controller.checkHealth();
    expect(result.status).toBe('ok');
    expect(result.dependencies.redis.status).toBe('healthy');
  });

  it('onModuleDestroy should complete without throwing', async () => {
    await expect(controller.onModuleDestroy()).resolves.not.toThrow();
  });
});
