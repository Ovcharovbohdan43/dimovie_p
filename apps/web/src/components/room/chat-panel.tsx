"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, MessageCircle, X } from "lucide-react";
import type { ChatMessagePayload } from "@dimovie/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatEmojiPicker } from "@/components/room/chat-emoji-picker";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["😂", "❤️", "😮", "🔥", "👏"] as const;

interface ChatPanelProps {
  messages: ChatMessagePayload[];
  onSend: (content: string) => void;
  onReaction: (emoji: string) => void;
  onTyping?: () => void;
  typingNames?: string[];
  currentUserId?: string;
  participantCount?: number;
  chatCooldown?: number;
  className?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function formatMessageTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function ChatPanel({
  messages,
  onSend,
  onReaction,
  onTyping,
  typingNames = [],
  currentUserId,
  participantCount = 0,
  chatCooldown = 0,
  className,
  mobileOpen,
  onMobileClose,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingNames]);

  const sendMessage = () => {
    if (!input.trim() || chatCooldown > 0) return;
    onSend(input.trim());
    setInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleChange = (value: string) => {
    setInput(value);
    if (!onTyping || !value.trim()) return;
    if (typingTimer.current != null) return;
    onTyping();
    typingTimer.current = window.setTimeout(() => {
      typingTimer.current = null;
    }, 1600);
  };

  const panel = (
    <div
      className={cn(
        "dm-glass flex h-full min-w-0 flex-col overflow-x-hidden rounded-none",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.01em] text-white">
            Live Chat
          </h3>
          <p className="text-[11px] text-white/40">
            {participantCount} in the party
          </p>
        </div>
        {onMobileClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className="size-8 text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageCircle className="mb-3 size-8 text-white/15" />
              <p className="text-sm text-white/40">No messages yet</p>
              <p className="mt-1 text-xs text-white/25">
                Say hi or send a reaction
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.kind === "system") {
                return (
                  <div
                    key={msg.id}
                    className="dm-msg-in px-2 py-1 text-center text-[11px] text-white/40"
                  >
                    {msg.content}
                  </div>
                );
              }

              const isOwn = msg.userId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "dm-msg-in flex gap-2.5",
                    isOwn && "flex-row-reverse",
                  )}
                >
                  <Avatar className="mt-0.5 size-8 shrink-0 rounded-xl">
                    <AvatarFallback
                      className={cn(
                        "rounded-xl text-[10px] font-semibold",
                        isOwn
                          ? "bg-white/15 text-white"
                          : "bg-[#5b9fd4]/20 text-[#9ec9ea]",
                      )}
                    >
                      {initials(msg.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "min-w-0 max-w-[78%]",
                      isOwn && "items-end text-right",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-1 flex items-baseline gap-2",
                        isOwn && "flex-row-reverse",
                      )}
                    >
                      {!isOwn && (
                        <span className="text-[12px] font-semibold tracking-[-0.01em] text-white">
                          {msg.displayName}
                        </span>
                      )}
                      <span className="text-[10px] text-white/25">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-2 text-left",
                        isOwn
                          ? "rounded-tr-md bg-white/[0.1] ring-1 ring-white/[0.08]"
                          : "rounded-tl-md bg-white/[0.05] ring-1 ring-white/[0.04]",
                      )}
                    >
                      <p className="text-sm leading-snug text-white/90">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {typingNames.length > 0 && (
            <p className="dm-msg-in px-2 text-[11px] text-white/40">
              {typingNames.length === 1
                ? `${typingNames[0]} is typing…`
                : `${typingNames.slice(0, 2).join(", ")} are typing…`}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="relative z-10 min-w-0 shrink-0 overflow-x-hidden border-t border-white/[0.06] bg-black/20 p-3">
        <div className="mb-2 flex min-w-0 items-center gap-1">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-hide">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReaction(emoji)}
                className="grid size-8 shrink-0 place-items-center rounded-xl text-base transition hover:bg-white/10"
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <ChatEmojiPicker
            iconOnly
            className="shrink-0"
            onInsert={(emoji) => setInput((prev) => prev + emoji)}
            onReaction={onReaction}
          />
        </div>
        <form onSubmit={handleSubmit} className="relative">
          <Input
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              chatCooldown > 0
                ? `Wait ${chatCooldown}s…`
                : "Send a message…"
            }
            className="h-11 rounded-2xl border-white/[0.08] bg-white/[0.04] pr-12 text-sm text-white placeholder:text-white/30 focus-visible:ring-white/25"
            maxLength={500}
            disabled={chatCooldown > 0}
          />
          <button
            type="submit"
            disabled={!input.trim() || chatCooldown > 0}
            aria-label="Send message"
            className={cn(
              "absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl transition",
              input.trim() && chatCooldown === 0
                ? "bg-white text-black hover:bg-white/90"
                : "bg-white/10 text-white/30",
            )}
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </form>
        {chatCooldown > 0 && (
          <p className="mt-2 text-center text-[11px] text-white/35">
            Slow down — {chatCooldown}s until you can send again
          </p>
        )}
      </div>
    </div>
  );

  if (mobileOpen !== undefined) {
    if (!mobileOpen) return null;
    return (
      <div className="fixed inset-0 z-50 lg:hidden">
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onMobileClose}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[78vh] min-w-0 overflow-hidden overflow-x-hidden rounded-t-[20px] border-t border-white/10 shadow-2xl">
          {panel}
        </div>
      </div>
    );
  }

  return panel;
}
