import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([{ id: '1' }]),
            findOne: jest.fn().mockResolvedValue({ id: '1' }),
            updateRole: jest.fn().mockResolvedValue({ role: Role.ADMIN }),
            updateStatus: jest.fn().mockResolvedValue({ isActive: false }),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  it('findAll should return users', async () => {
    const res = await controller.findAll();
    expect(res).toEqual([{ id: '1' }]);
    expect(usersService.findAll).toHaveBeenCalled();
  });

  it('findOne should return a user by id', async () => {
    const res = await controller.findOne('1');
    expect(res).toEqual({ id: '1' });
  });

  it('updateRole should update user role', async () => {
    const res = await controller.updateRole('1', { role: Role.ADMIN });
    expect(res).toEqual({ role: Role.ADMIN });
  });

  it('updateStatus should update user status', async () => {
    const res = await controller.updateStatus('1', { isActive: false });
    expect(res).toEqual({ isActive: false });
  });
});
