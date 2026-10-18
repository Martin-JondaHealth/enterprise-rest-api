import { Controller, Get, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('System & Health')
@Controller('health')
export class HealthController implements OnModuleDestroy {
  private redisClient: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
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

    let redisStatus = 'healthy';
    let redisLatencyMs = 0;
    try {
      if (this.redisClient.status !== 'ready') {
        await this.redisClient.connect();
      }
      const redisStart = Date.now();
      await this.redisClient.ping();
      redisLatencyMs = Date.now() - redisStart;
    } catch {
      redisStatus = 'unreachable';
    }

    const isSystemHealthy =
      dbStatus === 'healthy' && redisStatus === 'healthy';

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
          latency: `${redisLatencyMs}ms`,
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
