import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('validate should return user when user exists and isActive is true', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'ADMIN',
      isActive: true,
      profile: { firstName: 'A' },
    } as any);

    const result = await strategy.validate({
      sub: 'u1',
      email: 'a@b.com',
      role: 'ADMIN',
    });

    expect(result.id).toBe('u1');
    expect(result.email).toBe('a@b.com');
  });

  it('validate should throw UnauthorizedException when user is inactive or not found', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com', role: 'ADMIN' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
