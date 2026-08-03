"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, Bell } from "lucide-react";
import { RoomCodeSearch } from "@/components/layout/room-code-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const pathname = usePathname();
  const { me, logout } = useAuth();
  const user = me.data;
  const isRoom = pathname.startsWith("/room/");

  if (isRoom) return null;

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-colors duration-300",
        pathname === "/"
          ? "bg-gradient-to-b from-black/80 to-transparent"
          : "bg-[#0b0b0f]/95 backdrop-blur-md border-b border-white/5",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1920px] items-center justify-between px-4 md:px-8 lg:px-12">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-[#e50914]">
              DiMovie
            </span>
          </Link>
          {user && (
            <nav className="hidden items-center gap-6 md:flex">
              <Link
                href="/dashboard"
                className="text-sm text-white/80 transition hover:text-white"
              >
                Home
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-white/80 transition hover:text-white"
              >
                Watch Parties
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-white/80 transition hover:text-white"
              >
                Plans
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <RoomCodeSearch className="hidden md:flex" />
          <RoomCodeSearch compact className="md:hidden" />
          {user ? (
            <>
              <Link
                href="/dashboard?create=true"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "hidden bg-[#e50914] hover:bg-[#f40612] md:inline-flex",
                )}
              >
                <Play className="mr-1 size-4 fill-current" />
                Start Party
              </Link>
              <button className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
                <Bell className="size-5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">
                  <Avatar className="size-8 ring-2 ring-transparent transition hover:ring-[#e50914]">
                    <AvatarImage src={undefined} />
                    <AvatarFallback className="bg-[#e50914] text-xs text-white">
                      {user.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 border-white/10 bg-[#181818]"
                >
                  <DropdownMenuItem
                    render={<Link href="/profile" className="w-full" />}
                  >
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<Link href="/pricing" className="w-full" />}
                  >
                    Subscription
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => logout.mutate()}
                    className="text-[#e50914]"
                  >
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Sign In
              </Link>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-[#e50914] hover:bg-[#f40612]",
                )}
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
