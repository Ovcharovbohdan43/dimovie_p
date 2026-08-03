import type { RawBodyRequest } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '@dimovie/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';

class CheckoutDto {
  tier!: 'PRO' | 'ENTERPRISE';
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  getStatus(@Req() req: { user: AuthUser }) {
    return this.subscriptionsService.getStatus(req.user.id);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(@Req() req: { user: AuthUser }, @Body() dto: CheckoutDto) {
    return this.subscriptionsService.createCheckoutSession(req.user.id, dto.tier);
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  portal(@Req() req: { user: AuthUser }) {
    return this.subscriptionsService.createPortalSession(req.user.id);
  }

  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Invalid webhook');
    }
    return this.subscriptionsService.handleWebhook(req.rawBody, signature);
  }
}
