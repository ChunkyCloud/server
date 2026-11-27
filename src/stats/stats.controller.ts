import { Controller, Get, Header, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse } from '@nestjs/swagger';
import { Public } from '../users/auth.guard';
import { PublicStatsResponse } from './dto/publicStatsResponse.dto';
import { StatsService } from './stats.service';

@Controller('stats')
@Public()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
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
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Get current service stats as Prometheus metrics' })
  @ApiProduces('text/plain; version=0.0.4; charset=utf-8')
  @ApiResponse({ status: HttpStatus.OK, schema: { type: 'string' } })
  getPublicPrometheusStats(): Promise<string> {
    return this.statsService.getPublicPrometheusStats();
  }
}
