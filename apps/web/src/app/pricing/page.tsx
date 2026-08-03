"use client";

import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import type { SubscriptionPlan, SubscriptionStatus } from "@dimovie/shared";
import { BETA_PRICING_MESSAGE, BETA_UNLOCK_PRO_FOR_FREE } from "@dimovie/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function PricingPage() {
  const { me } = useAuth();

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => api<SubscriptionPlan[]>("/subscriptions/plans"),
  });

  const status = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api<SubscriptionStatus>("/subscriptions/status"),
    enabled: !!me.data,
  });

  const checkout = useMutation({
    mutationFn: (tier: "PRO" | "ENTERPRISE") =>
      api<{ url: string }>("/subscriptions/checkout", {
        method: "POST",
        body: JSON.stringify({ tier }),
      }),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <h1 className="text-3xl font-black md:text-5xl">
          Choose your <span className="text-[#e50914]">DiMovie</span> plan
        </h1>
        <p className="mt-4 text-lg text-white/60">
          Stream together at cinema quality — scale from friends to events
        </p>

        {BETA_UNLOCK_PRO_FOR_FREE && (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-[#e50914]/30 bg-gradient-to-b from-[#e50914]/10 to-[#181818] px-5 py-4 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e50914]/20">
                <Sparkles className="size-4 text-[#e50914]" />
              </div>
              <div>
                <p className="font-semibold text-white">Beta testing</p>
                <p className="mt-1 text-sm leading-relaxed text-white/65">
                  {BETA_PRICING_MESSAGE} Paid plans will launch once beta ends.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.data?.map((plan) => {
            const isCurrent = status.data?.tier === plan.id;
            const isPro = plan.id === "PRO";

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-xl border p-6 text-left transition",
                  isPro
                    ? "border-[#e50914] bg-gradient-to-b from-[#e50914]/10 to-[#181818] shadow-lg shadow-[#e50914]/10"
                    : "border-white/10 bg-[#181818]",
                )}
              >
                {isPro && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#e50914]">
                    Most Popular
                  </Badge>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                {BETA_UNLOCK_PRO_FOR_FREE && plan.id === "FREE" && (
                  <Badge className="mt-2 bg-emerald-600/90 text-white hover:bg-emerald-600/90">
                    Pro features included
                  </Badge>
                )}
                <div className="mt-4">
                  <span className="text-4xl font-black">
                    ${plan.price}
                  </span>
                  {plan.interval && (
                    <span className="text-white/50">/{plan.interval}</span>
                  )}
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                      <Check className="mt-0.5 size-4 shrink-0 text-[#e50914]" />
                      {f}
                    </li>
                  ))}
                  {BETA_UNLOCK_PRO_FOR_FREE && plan.id === "FREE" && (
                    <>
                      <li className="flex items-start gap-2 text-sm text-emerald-400/90">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                        100 viewers, 1080p, SFU voice — beta unlock
                      </li>
                      <li className="flex items-start gap-2 text-sm text-emerald-400/90">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                        Watch history & room analytics — beta unlock
                      </li>
                    </>
                  )}
                </ul>
                {isCurrent ? (
                  <Button disabled className="mt-8 w-full" variant="outline">
                    Current Plan
                  </Button>
                ) : plan.id === "FREE" ? (
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "mt-8 w-full border-white/10 text-center",
                    )}
                  >
                    Get Started
                  </Link>
                ) : BETA_UNLOCK_PRO_FOR_FREE ? (
                  <Button disabled className="mt-8 w-full" variant="outline">
                    Available after beta
                  </Button>
                ) : me.data ? (
                  <Button
                    className={cn(
                      "mt-8 w-full",
                      isPro
                        ? "bg-[#e50914] hover:bg-[#f40612]"
                        : "bg-white/10 hover:bg-white/20",
                    )}
                    onClick={() =>
                      checkout.mutate(plan.id as "PRO" | "ENTERPRISE")
                    }
                    disabled={checkout.isPending}
                  >
                    Upgrade to {plan.name}
                  </Button>
                ) : (
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants(),
                      "mt-8 w-full bg-[#e50914] hover:bg-[#f40612] text-center",
                    )}
                  >
                    Sign Up to Upgrade
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
