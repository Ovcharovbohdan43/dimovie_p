import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '@dimovie/shared';

export type AuthedSocket = Socket & { user: AuthUser; roomCode?: string };

@Injectable()
export class WsAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async authenticate(socket: Socket): Promise<AuthUser> {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization?.replace('Bearer ', '') as
        | string
        | undefined);

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
    });

    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    return user;
  }
}
