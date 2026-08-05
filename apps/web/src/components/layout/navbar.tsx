"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { RoomCodeSearch } from "@/components/layout/room-code-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { PlayMark } from "@/components/home/marks";
import { DiMovieLogo } from "@/components/brand/dimovie-logo";

export function Navbar() {
  const pathname = usePathname();
  const { me, logout } = useAuth();
  const user = me.data;
  const isRoom = pathname.startsWith("/room/");
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  if (isRoom) return null;

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-[background-color,backdrop-filter,border-color] duration-300",
        scrolled || !isHome
          ? "border-b border-white/6 bg-[#08080c]/92 backdrop-blur-xl"
          : "border-b border-transparent bg-gradient-to-b from-black/75 to-transparent",
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1920px] items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6 md:px-10 lg:px-14">
        <div className="flex min-w-0 items-center gap-4 md:gap-8">
          <Link href="/" className="min-w-0 shrink-0" aria-label="DiMovie home">
            <DiMovieLogo
              className="gap-1.5 sm:gap-2"
              markClassName="size-7 sm:size-8"
              wordmarkClassName="hidden text-xl sm:inline sm:text-2xl"
            />
          </Link>
          {user && (
            <nav className="hidden items-center gap-5 md:flex">
              <Link
                href="/dashboard"
                className="text-sm text-white/75 transition hover:text-white"
              >
                Home
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-white/75 transition hover:text-white"
              >
                Parties
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-white/75 transition hover:text-white"
              >
                Plans
              </Link>
            </nav>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
          <RoomCodeSearch className="hidden md:flex" />
          <RoomCodeSearch compact className="md:hidden" />
          {user ? (
            <>
              <Link
                href="/dashboard?create=true"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "hidden h-8 bg-[#e50914] px-3 hover:bg-[#f40612] md:inline-flex",
                )}
              >
                <PlayMark className="mr-1.5 size-3.5" />
                Start party
              </Link>
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
            <div className="flex items-center gap-0.5 sm:gap-2">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "h-8 px-2 text-xs sm:px-3 sm:text-sm",
                )}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "h-8 bg-[#e50914] px-2.5 text-xs hover:bg-[#f40612] sm:px-3 sm:text-sm",
                )}
              >
                <span className="sm:hidden">Start</span>
                <span className="hidden sm:inline">Get Started</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
