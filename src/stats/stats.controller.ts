import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from 'src/users/auth.guard';
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
    description: '',
    type: PublicStatsResponse,
  })
  getPublicStats() {
    return this.statsService.getPublicStats();
  }
}
