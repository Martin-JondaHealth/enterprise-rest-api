import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Auth & RBAC Flow (e2e)', () => {
  let app: INestApplication<App>;
  let memberAccessToken: string;
  let memberRefreshToken: string;
  let adminAccessToken: string;

  const testUser = {
    email: `e2e_user_${Date.now()}@enterprise.dev`,
    password: 'SecurePassword123!',
    firstName: 'Test',
    lastName: 'Candidate',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/health (GET) should report healthy system and dependencies', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
      expect(response.body.data.dependencies.database.status).toBe('healthy');
      expect(response.body.data.dependencies.redis.status).toBe('healthy');
    });
  });

  describe('Authentication Flow', () => {
    it('/auth/register (POST) should register a new member', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(response.body.data.user.role).toBe('MEMBER');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      memberAccessToken = response.body.data.accessToken;
      memberRefreshToken = response.body.data.refreshToken;
    });

    it('/auth/register (POST) should reject duplicate email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.statusCode).toBe(409);
    });

    it('/auth/login (POST) should reject incorrect password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword999!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.statusCode).toBe(401);
    });

    it('/auth/login (POST) should authenticate with seeded admin account', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@enterprise.dev',
          password: 'AdminPass123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('ADMIN');
      expect(response.body.data.accessToken).toBeDefined();

      adminAccessToken = response.body.data.accessToken;
    });

    it('/auth/me (GET) should retrieve current profile with valid Bearer token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testUser.email.toLowerCase());
      expect(response.body.data.profile.firstName).toBe(testUser.firstName);
    });

    it('/auth/me (GET) should reject request without token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('/auth/refresh (POST) should rotate refresh tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: memberRefreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.refreshToken).not.toBe(memberRefreshToken);

      memberAccessToken = response.body.data.accessToken;
      memberRefreshToken = response.body.data.refreshToken;
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('/users (GET) should forbid access to regular MEMBER', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.statusCode).toBe(403);
    });

    it('/users (GET) should grant access to ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Logout Flow', () => {
    it('/auth/logout (POST) should invalidate current session', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ refreshToken: memberRefreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
