import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'test@enterprise.dev',
    passwordHash: '',
    role: Role.MEMBER,
    isActive: true,
    createdAt: new Date(),
    profile: {
      firstName: 'Test',
      lastName: 'User',
      bio: 'Bio',
    },
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('Password123!', 10);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            refreshToken: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_ACCESS_SECRET') return 'secret-access';
              if (key === 'JWT_REFRESH_SECRET') return 'secret-refresh';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    it('should throw ConflictException if email is already taken', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      await expect(
        service.register({
          email: 'test@enterprise.dev',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register new user and issue tokens', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'create').mockResolvedValue(mockUser as any);

      const result = await service.register({
        email: 'new@enterprise.dev',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      });

      expect(result.user.email).toBe('test@enterprise.dev');
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBe('signed.jwt.token');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@enterprise.dev',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      await expect(
        service.login({
          email: 'test@enterprise.dev',
          password: 'WrongPassword999!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is inactive', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      await expect(
        service.login({
          email: 'test@enterprise.dev',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should login and return tokens on valid credentials', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.login({
        email: 'test@enterprise.dev',
        password: 'Password123!',
      });

      expect(result.user.id).toBe(mockUser.id);
      expect(result.accessToken).toBe('signed.jwt.token');
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException if token verification fails', async () => {
      jest.spyOn(jwt, 'verifyAsync').mockRejectedValue(new Error('Invalid'));

      await expect(service.refreshTokens('invalid.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should detect token reuse and revoke all sessions', async () => {
      jest.spyOn(jwt, 'verifyAsync').mockResolvedValue({ sub: mockUser.id });
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.refreshToken, 'findMany').mockResolvedValue([]); // No matching active token

      await expect(service.refreshTokens('reused.token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id },
        }),
      );
    });
    it('should rotate tokens when a valid active refresh token is provided', async () => {
      const rawToken = 'valid.refresh.token';
      const hashed = await bcrypt.hash(rawToken, 10);

      jest.spyOn(jwt, 'verifyAsync').mockResolvedValue({ sub: mockUser.id });
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.refreshToken, 'findMany').mockResolvedValue([
        {
          id: 'token-rec-1',
          userId: mockUser.id,
          tokenHash: hashed,
          expiresAt: new Date(Date.now() + 100000),
          revokedAt: null,
          createdAt: new Date(),
        },
      ]);
      jest.spyOn(prisma.refreshToken, 'update').mockResolvedValue({} as any);

      const result = await service.refreshTokens(rawToken);
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'token-rec-1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('logout', () => {
    it('should revoke all user refresh tokens when no specific token passed', async () => {
      const result = await service.logout(mockUser.id);
      expect(result.message).toContain('All active sessions logged out');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('should revoke only the matched token when specific refreshToken is passed', async () => {
      const rawToken = 'specific.refresh.token';
      const hashed = await bcrypt.hash(rawToken, 10);

      jest.spyOn(prisma.refreshToken, 'findMany').mockResolvedValue([
        {
          id: 'token-rec-2',
          userId: mockUser.id,
          tokenHash: hashed,
          expiresAt: new Date(Date.now() + 100000),
          revokedAt: null,
          createdAt: new Date(),
        },
      ]);
      jest.spyOn(prisma.refreshToken, 'update').mockResolvedValue({} as any);

      const result = await service.logout(mockUser.id, rawToken);
      expect(result.message).toContain('Session logged out successfully');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'token-rec-2' },
        }),
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile if found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      const profile = await service.getProfile(mockUser.id);
      expect(profile.id).toBe(mockUser.id);
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      await expect(service.getProfile('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
