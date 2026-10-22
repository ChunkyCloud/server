import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { Public } from '../auth.guard';
import { LoginService, parseLoginOptions } from '../login.service';
import { FakeLoginDto } from './fakeLogin.dto';
import { FakeAuthService } from './fake.service';

@Controller('/auth')
export class FakeAuthController {
  constructor(
    private readonly fakeAuthService: FakeAuthService,
    private readonly loginService: LoginService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Start login using the configured auth provider' })
  @ApiQuery({
    name: 'returnTo',
    enum: ['website', 'localhost'],
    required: false,
  })
  @ApiQuery({ name: 'state', type: String, required: false })
  @ApiResponse({ status: HttpStatus.OK, description: 'Development login form' })
  form(
    @Query('returnTo') returnTo: unknown,
    @Query('state') state: unknown,
    @Res() res: Response,
  ): void {
    const options = parseLoginOptions(returnTo, state);
    const callback = this.loginService.getCallbackUrl(options.returnTo);
    this.renderForm(res, callback);
  }

  @Post()
  @Public()
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Submit development login and receive an auth code',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Auth code for /auth/exchange',
  })
  @ApiResponse({
    status: HttpStatus.SEE_OTHER,
    description: 'Redirect to the configured callback with code and state',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED })
  async login(
    @Body() body: FakeLoginDto,
    @Query('returnTo') returnTo: unknown,
    @Query('state') state: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const options = parseLoginOptions(returnTo, state);
    const cookies = req.cookies as Record<string, unknown> | undefined;
    if (!cookies?.fake_auth_nonce || cookies.fake_auth_nonce !== body.nonce) {
      throw new ForbiddenException('Invalid login form token');
    }
    const user = await this.fakeAuthService.authenticate(body.username);
    res.clearCookie('fake_auth_nonce', { path: '/auth' });
    await this.loginService.complete(user, options, res);
  }

  private renderForm(
    res: Response,
    callback?: URL,
    status = HttpStatus.OK,
    error = '',
  ): void {
    // Browsers can also apply form-action to the redirect after submitting.
    const callbackSource = callback
      ? ` ${callback.origin === 'null' ? callback.protocol : callback.origin}`
      : '';
    const nonce = randomBytes(32).toString('base64url');
    res.cookie('fake_auth_nonce', nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/auth',
      maxAge: 15 * 60 * 1000,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; form-action 'self'${callbackSource}; frame-ancestors 'none'; base-uri 'none'`,
    );
    res.status(status).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ChunkyCloud login</title></head>
<body><main><h1>ChunkyCloud</h1><p>Development login</p>
${error ? `<p role="alert">${error}</p>` : ''}
<form method="post">
<input type="hidden" name="nonce" value="${nonce}">
<p><label>Username <input name="username" autocomplete="username" required autofocus></label></p>
<button type="submit">Log in</button>
</form></main></body></html>`);
  }
}
