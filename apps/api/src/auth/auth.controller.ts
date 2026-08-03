import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from '@dimovie/shared';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.register(dto, res);
  }

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.authService.login(dto, res, ip);
  }

  @Post('refresh')
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.refresh(req.cookies?.refreshToken, res);
  }

  @Post('logout')
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.logout(req.cookies?.refreshToken, res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: AuthUser }) {
    return req.user;
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(
    @Req() req: Request & { user: { id: string; email: string; displayName: string } },
    @Res() res: Response,
  ) {
    const tokens = this.authService.issueOAuthTokens(req.user, res);
    const frontend = this.config.get('CORS_ORIGIN', 'http://localhost:3000');
    tokens.then((t) => {
      res.redirect(`${frontend}/auth/callback?token=${t.accessToken}`);
    });
  }

  @Get('discord')
  @UseGuards(AuthGuard('discord'))
  discordAuth() {}

  @Get('discord/callback')
  @UseGuards(AuthGuard('discord'))
  discordCallback(
    @Req() req: Request & { user: { id: string; email: string; displayName: string } },
    @Res() res: Response,
  ) {
    const tokens = this.authService.issueOAuthTokens(req.user, res);
    const frontend = this.config.get('CORS_ORIGIN', 'http://localhost:3000');
    tokens.then((t) => {
      res.redirect(`${frontend}/auth/callback?token=${t.accessToken}`);
    });
  }
}
