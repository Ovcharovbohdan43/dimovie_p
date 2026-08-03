import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { SubscriptionStatus, PlanCapabilities } from '@dimovie/shared';
import { SUBSCRIPTION_PLANS, getPlanCapabilities } from '@dimovie/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key) {
      this.stripe = new Stripe(key);
    }
  }

  getPlans() {
    return SUBSCRIPTION_PLANS;
  }

  async getStatus(userId: string): Promise<SubscriptionStatus> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return {
      tier: user.subscription,
      active: user.subscription !== 'FREE',
      endsAt: user.subscriptionEndsAt?.toISOString() ?? null,
      stripeCustomerId: user.stripeCustomerId,
    };
  }

  async createCheckoutSession(userId: string, tier: 'PRO' | 'ENTERPRISE') {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const priceId =
      tier === 'PRO'
        ? this.config.get('STRIPE_PRO_PRICE_ID')
        : this.config.get('STRIPE_ENTERPRISE_PRICE_ID');

    if (!priceId) {
      throw new BadRequestException(`Price ID for ${tier} not configured`);
    }

    const frontendUrl = this.config.get('CORS_ORIGIN', 'http://localhost:3000');

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/pricing?success=true`,
      cancel_url: `${frontendUrl}/pricing?canceled=true`,
      metadata: { userId, tier },
    });

    return { url: session.url };
  }

  async createPortalSession(userId: string) {
    if (!this.stripe) throw new BadRequestException('Stripe not configured');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) {
      throw new BadRequestException('No active subscription');
    }

    const frontendUrl = this.config.get('CORS_ORIGIN', 'http://localhost:3000');
    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendUrl}/profile`,
    });

    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    if (!this.stripe) return;

    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) return;

    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier as 'PRO' | 'ENTERPRISE' | undefined;
      if (userId && tier) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            subscription: tier,
            stripeSubscriptionId: session.subscription as string,
          },
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const user = await this.prisma.user.findFirst({
        where: { stripeSubscriptionId: sub.id },
      });
      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            subscription: 'FREE',
            stripeSubscriptionId: null,
            subscriptionEndsAt: new Date(),
          },
        });
      }
    }
  }

  getMaxUsersForTier(tier: 'FREE' | 'PRO' | 'ENTERPRISE'): number {
    return getPlanCapabilities(tier).maxUsers;
  }

  getMaxRoomsForTier(tier: 'FREE' | 'PRO' | 'ENTERPRISE'): number {
    return getPlanCapabilities(tier).maxRooms;
  }

  getCapabilitiesForTier(tier: 'FREE' | 'PRO' | 'ENTERPRISE'): PlanCapabilities {
    return getPlanCapabilities(tier);
  }

  async getUserCapabilities(userId: string): Promise<PlanCapabilities> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return getPlanCapabilities(user?.subscription ?? 'FREE');
  }

  async requireFeature(
    userId: string,
    feature: keyof Pick<
      PlanCapabilities,
      'watchHistory' | 'roomAnalytics' | 'advancedAnalytics' | 'customBranding'
    >,
  ) {
    const caps = await this.getUserCapabilities(userId);
    if (!caps[feature]) {
      throw new BadRequestException(
        `This feature requires a higher plan (${feature})`,
      );
    }
  }
}
