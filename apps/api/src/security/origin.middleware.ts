import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { SECURITY_ERROR_CODES } from '@dimovie/shared';
import { isCorsOriginAllowed } from '../common/cors';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Paths that legitimately arrive without a browser Origin (webhooks, health). */
const SKIP_PREFIXES = [
  '/subscriptions/webhook',
  '/health',
  '/auth/google',
  '/auth/discord',
];

/**
 * Defense-in-depth Origin/Referer check for mutating HTTP requests.
 * Complements CORS — never trust client payloads alone.
 */
@Injectable()
export class OriginMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (!MUTATING.has(req.method.toUpperCase())) {
      return next();
    }

    const path = req.path || req.url || '';
    if (SKIP_PREFIXES.some((p) => path.startsWith(p))) {
      return next();
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // Same-origin / server-to-server without Origin (mobile WebView edge cases
    // still send Origin when configured). Allow missing Origin for non-browser
    // clients that present a Bearer token — CSRF is mainly cookie-bound.
    if (!origin && !referer) {
      return next();
    }

    if (origin && !isCorsOriginAllowed(origin)) {
      return res.status(HttpStatus.FORBIDDEN).json({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Origin not allowed',
        code: SECURITY_ERROR_CODES.ORIGIN_REJECTED,
      });
    }

    if (!origin && referer) {
      try {
        const refOrigin = new URL(referer).origin;
        if (!isCorsOriginAllowed(refOrigin)) {
          return res.status(HttpStatus.FORBIDDEN).json({
            statusCode: HttpStatus.FORBIDDEN,
            message: 'Referer not allowed',
            code: SECURITY_ERROR_CODES.ORIGIN_REJECTED,
          });
        }
      } catch {
        return res.status(HttpStatus.FORBIDDEN).json({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Invalid Referer',
          code: SECURITY_ERROR_CODES.ORIGIN_REJECTED,
        });
      }
    }

    return next();
  }
}
