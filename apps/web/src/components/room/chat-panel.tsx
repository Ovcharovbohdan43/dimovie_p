"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, MessageCircle, X } from "lucide-react";
import type { ChatMessagePayload } from "@dimovie/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatEmojiPicker } from "@/components/room/chat-emoji-picker";
import { cn } from "@/lib/utils";

interface ChatPanelProps {  messages: ChatMessagePayload[];
  onSend: (content: string) => void;
  onReaction: (emoji: string) => void;
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

export function ChatPanel({
  messages,
  onSend,
  onReaction,
  currentUserId,
  participantCount = 0,
  chatCooldown = 0,
  className,
  mobileOpen,
  onMobileClose,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const panel = (
    <div
      className={cn(
        "flex h-full flex-col bg-[#141414]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
        <div>
          <h3 className="text-sm font-bold text-white">Live Chat</h3>
          <p className="text-[11px] text-white/40">
            {participantCount} in the party
          </p>
        </div>
        {onMobileClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className="size-8 text-white/50 hover:text-white lg:hidden"
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
              const isOwn = msg.userId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={cn("flex flex-col", isOwn && "items-end")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2",
                      isOwn
                        ? "rounded-br-sm bg-[#e50914]/20 ring-1 ring-[#e50914]/20"
                        : "rounded-bl-sm bg-white/[0.06] ring-1 ring-white/[0.04]",
                    )}
                  >
                    {!isOwn && (
                      <span className="text-[11px] font-semibold text-[#00a8e1]">
                        {msg.displayName}
                      </span>
                    )}
                    <p className="text-sm leading-snug text-white/90">
                      {msg.content}
                    </p>
                  </div>
                  <span className="mt-1 px-1 text-[10px] text-white/25">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-white/[0.06] bg-[#0b0b0f]/50 p-3">
        <ChatEmojiPicker
          onInsert={(emoji) => setInput((prev) => prev + emoji)}
          onReaction={onReaction}
        />
        <form onSubmit={handleSubmit} className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              chatCooldown > 0
                ? `Wait ${chatCooldown}s before sending...`
                : "Send a message..."
            }
            className="h-10 border-white/[0.08] bg-white/[0.04] pr-11 text-sm text-white placeholder:text-white/30 focus-visible:ring-[#e50914]/50"
            maxLength={500}
            disabled={chatCooldown > 0}
          />
          <button
            type="submit"
            disabled={!input.trim() || chatCooldown > 0}
            aria-label="Send message"
            className={cn(
              "absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer select-none items-center justify-center rounded-full transition",
              input.trim() && chatCooldown === 0
                ? "bg-[#e50914] text-white hover:bg-[#f40612]"
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
        <div className="absolute bottom-0 left-0 right-0 h-[75vh] overflow-hidden rounded-t-2xl border-t border-white/10 shadow-2xl">
          {panel}
        </div>
      </div>
    );
  }

  return panel;
}
