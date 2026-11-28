import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  Controller,
  Get,
  Header,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse } from '@nestjs/swagger';
import { Public } from '../users/auth.guard';
import { PublicStatsResponse } from './dto/publicStatsResponse.dto';
import { StatsService } from './stats.service';

@Controller('stats')
@Public()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(10_000)
  @ApiOperation({
    summary: 'Get public stats about the service',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: PublicStatsResponse,
  })
  getPublicStats(): Promise<PublicStatsResponse> {
    return this.statsService.getPublicStats();
  }

  @Get('prometheus')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(10_000)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Get current service stats as Prometheus metrics' })
  @ApiProduces('text/plain; version=0.0.4; charset=utf-8')
  @ApiResponse({ status: HttpStatus.OK, schema: { type: 'string' } })
  getPublicPrometheusStats(): Promise<string> {
    return this.statsService.getPublicPrometheusStats();
  }
}
