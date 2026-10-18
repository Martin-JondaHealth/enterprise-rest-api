import 'reflect-metadata';
import { validate } from './env.validation';

describe('Environment Validation', () => {
  it('should validate and return valid environment config', () => {
    const validConfig = {
      PORT: '4000',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      JWT_ACCESS_SECRET: 'access-secret-32-chars-long-valid',
      JWT_REFRESH_SECRET: 'refresh-secret-32-chars-long-valid',
      JWT_ACCESS_EXPIRATION: '15m',
      JWT_REFRESH_EXPIRATION: '7d',
      THROTTLE_TTL: '60',
      THROTTLE_LIMIT: '100',
    };

    const result = validate(validConfig);
    expect(result.PORT).toBe(4000);
    expect(result.NODE_ENV).toBe('development');
    expect(result.DATABASE_URL).toBe(
      'postgresql://user:pass@localhost:5432/db',
    );
  });

  it('should throw error when required environment variables are missing', () => {
    const invalidConfig = {
      PORT: 'invalid_port',
    };

    expect(() => validate(invalidConfig)).toThrow(
      'Environment validation failed',
    );
  });
});
