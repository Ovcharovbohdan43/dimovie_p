import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '@dimovie/shared';

export type RoomSocket = Socket & {
  user?: AuthUser;
  isGuest?: boolean;
  guestId?: string;
  roomCode?: string;
};

/** @deprecated use RoomSocket — kept for voice gateway typing */
export type AuthedSocket = RoomSocket & { user: AuthUser };

@Injectable()
export class WsAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  extractToken(socket: Socket): string | undefined {
    return (
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization?.replace('Bearer ', '') as
        | string
        | undefined)
    );
  }

  async authenticate(socket: Socket): Promise<AuthUser> {
    const token = this.extractToken(socket);
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

  /** Optional auth — returns null for guests (no/invalid token). */
  async tryAuthenticate(socket: Socket): Promise<AuthUser | null> {
    const token = this.extractToken(socket);
    if (!token) return null;
    try {
      return await this.authenticate(socket);
    } catch {
      return null;
    }
  }
}
