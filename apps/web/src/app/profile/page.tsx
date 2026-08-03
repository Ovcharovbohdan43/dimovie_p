"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateProfileSchema,
  type UpdateProfileInput,
  type UserProfile,
  type SubscriptionStatus,
  BETA_PRICING_MESSAGE,
  BETA_UNLOCK_PRO_FOR_FREE,
} from "@dimovie/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProfilePage() {
  const qc = useQueryClient();
  const { me } = useAuth();

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<UserProfile>("/profiles/me"),
    enabled: !!me.data,
  });

  const subscription = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api<SubscriptionStatus>("/subscriptions/status"),
    enabled: !!me.data,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: {
      displayName: profile.data?.displayName ?? "",
      bio: profile.data?.bio ?? "",
    },
  });

  const updateProfile = useMutation({
    mutationFn: (data: UpdateProfileInput) =>
      api<UserProfile>("/profiles/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  const openPortal = useMutation({
    mutationFn: () =>
      api<{ url: string }>("/subscriptions/portal", { method: "POST" }),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8 flex items-center gap-4">
          <Avatar className="size-20 ring-2 ring-[#e50914]">
            <AvatarFallback className="bg-[#e50914] text-2xl">
              {profile.data?.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{profile.data?.displayName}</h1>
            <p className="text-white/50">{profile.data?.email}</p>
            <Badge className="mt-2 bg-[#e50914]">
              {subscription.data?.tier ?? "FREE"}
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="bg-[#181818]">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <form
              onSubmit={handleSubmit((d) => updateProfile.mutate(d))}
              className="space-y-4 rounded-lg border border-white/10 bg-[#181818] p-6"
            >
              <div>
                <Label>Display Name</Label>
                <Input
                  {...register("displayName")}
                  className="mt-1 border-white/10 bg-white/5"
                />
                {errors.displayName && (
                  <p className="mt-1 text-xs text-[#e50914]">
                    {errors.displayName.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Bio</Label>
                <Input
                  {...register("bio")}
                  className="mt-1 border-white/10 bg-white/5"
                />
              </div>
              <Button
                type="submit"
                className="bg-[#e50914] hover:bg-[#f40612]"
                disabled={updateProfile.isPending}
              >
                Save Changes
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="subscription" className="mt-6">
            <div className="rounded-lg border border-white/10 bg-[#181818] p-6">
              <p className="text-white/70">
                Current plan:{" "}
                <strong>{subscription.data?.tier ?? "FREE"}</strong>
              </p>
              {BETA_UNLOCK_PRO_FOR_FREE &&
                subscription.data?.tier === "FREE" && (
                  <p className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200/90">
                    {BETA_PRICING_MESSAGE}
                  </p>
                )}
              {subscription.data?.active && (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => openPortal.mutate()}
                >
                  Manage Subscription
                </Button>
              )}
              {!subscription.data?.active && (
                <Link
                  href="/pricing"
                  className={cn(
                    buttonVariants(),
                    "mt-4 inline-flex bg-[#e50914] hover:bg-[#f40612]",
                  )}
                >
                  Upgrade Plan
                </Link>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
