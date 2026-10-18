import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'test@enterprise.dev',
    role: Role.MEMBER,
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn().mockResolvedValue([mockUser]),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('findAll should return array of users', async () => {
    const users = await service.findAll();
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(mockUser.id);
  });

  it('findOne should return user when ID exists', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
    const user = await service.findOne(mockUser.id);
    expect(user.id).toBe(mockUser.id);
  });

  it('findOne should throw NotFoundException when ID does not exist', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    await expect(service.findOne('invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updateRole should update role for existing user', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
    jest
      .spyOn(prisma.user, 'update')
      .mockResolvedValue({ ...mockUser, role: Role.ADMIN } as any);

    const updated = await service.updateRole(mockUser.id, Role.ADMIN);
    expect(updated.role).toBe(Role.ADMIN);
  });

  it('updateStatus should update active status for existing user', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
    jest
      .spyOn(prisma.user, 'update')
      .mockResolvedValue({ ...mockUser, isActive: false } as any);

    const updated = await service.updateStatus(mockUser.id, false);
    expect(updated.isActive).toBe(false);
  });
});
