import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn().mockResolvedValue({ success: true }),
            login: jest.fn().mockResolvedValue({ success: true }),
            refreshTokens: jest.fn().mockResolvedValue({ success: true }),
            logout: jest.fn().mockResolvedValue({ success: true }),
            getProfile: jest.fn().mockResolvedValue({ id: 'user-1' }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('register should invoke authService.register', async () => {
    await controller.register({
      email: 'a@b.com',
      password: 'Pass',
    } as any);
    expect(authService.register).toHaveBeenCalled();
  });

  it('login should invoke authService.login', async () => {
    await controller.login({ email: 'a@b.com', password: 'Pass' });
    expect(authService.login).toHaveBeenCalled();
  });

  it('refresh should invoke authService.refreshTokens', async () => {
    await controller.refresh({ refreshToken: 'token' });
    expect(authService.refreshTokens).toHaveBeenCalled();
  });

  it('logout should invoke authService.logout', async () => {
    await controller.logout('user-1', { refreshToken: 'token' });
    expect(authService.logout).toHaveBeenCalled();
  });

  it('getProfile should invoke authService.getProfile', async () => {
    const res = await controller.getProfile('user-1');
    expect(res).toEqual({ id: 'user-1' });
  });
});
