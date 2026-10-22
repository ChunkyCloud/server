import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from './auth.guard';
import { parseLoginOptions } from './login.service';

@Controller('/auth')
export class LoginController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Redirect to the configured auth provider' })
  @ApiQuery({
    name: 'returnTo',
    enum: ['website', 'localhost'],
    required: false,
  })
  @ApiQuery({ name: 'state', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirect to /auth/discord',
  })
  login(
    @Query('returnTo') returnTo: unknown,
    @Query('state') state: unknown,
    @Res() res: Response,
  ): void {
    const options = parseLoginOptions(returnTo, state);
    const query = new URLSearchParams();
    if (options.returnTo !== undefined) query.set('returnTo', options.returnTo);
    if (options.state !== undefined) query.set('state', options.state);
    const suffix = query.toString();
    res.redirect(
      HttpStatus.FOUND,
      `/auth/discord${suffix ? `?${suffix}` : ''}`,
    );
  }
}
