import { Controller, Get, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('System & Health')
@Controller('health')
export class HealthController implements OnModuleDestroy {
  private redisClient: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    // In production without an explicit external redis host, don't attempt localhost connection
    const shouldConnect =
      redisHost &&
      redisHost !== 'none' &&
      redisHost !== 'disabled' &&
      !(nodeEnv === 'production' && redisHost === 'localhost');

    if (shouldConnect) {
      this.redisClient = new Redis({
        host: redisHost,
        port: this.configService.get<number>('REDIS_PORT', 6379),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
      });
    }
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check verifying Database, Redis, and API' })
  @ApiResponse({
    status: 200,
    description: 'System health report including status and dependencies',
  })
  async checkHealth() {
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbStatus = 'unreachable';
    }

    let redisStatus = 'not_configured';
    let redisLatencyMs = 0;

    if (this.redisClient) {
      try {
        if (this.redisClient.status !== 'ready') {
          await this.redisClient.connect();
        }
        const redisStart = Date.now();
        await this.redisClient.ping();
        redisLatencyMs = Date.now() - redisStart;
        redisStatus = 'healthy';
      } catch {
        redisStatus = 'unreachable';
      }
    }

    const isSystemHealthy =
      dbStatus === 'healthy' &&
      (redisStatus === 'healthy' || redisStatus === 'not_configured');

    return {
      status: isSystemHealthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      dependencies: {
        database: {
          status: dbStatus,
          latency: `${dbLatencyMs}ms`,
        },
        redis: {
          status: redisStatus,
          latency:
            redisStatus === 'healthy'
              ? `${redisLatencyMs}ms`
              : 'N/A (optional cache)',
        },
      },
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      },
    };
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      }
    }
  }
}
