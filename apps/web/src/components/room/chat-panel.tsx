"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowDown, ArrowUp, MessageCircle, Trash2, X } from "lucide-react";
import {
  CHAT_MAX_LENGTH,
  CHAT_QUICK_REACTIONS,
  type ChatMessagePayload,
} from "@dimovie/shared";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatEmojiPicker } from "@/components/room/chat-emoji-picker";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: ChatMessagePayload[];
  onSend: (content: string) => void;
  onReaction: (emoji: string) => void;
  onTyping?: () => void;
  onRetry?: (content: string) => void;
  onDelete?: (messageId: string) => void;
  typingNames?: string[];
  currentUserId?: string;
  avatarByUserId?: Record<string, string | null | undefined>;
  canModerate?: boolean;
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

const NEAR_BOTTOM_PX = 96;

export function ChatPanel({
  messages,
  onSend,
  onReaction,
  onTyping,
  onRetry,
  onDelete,
  typingNames = [],
  currentUserId,
  avatarByUserId,
  canModerate = false,
  participantCount = 0,
  chatCooldown = 0,
  className,
  mobileOpen,
  onMobileClose,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [stickToBottom, setStickToBottom] = useState(true);
  const [unseenBelow, setUnseenBelow] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<number | null>(null);
  const prevCountRef = useRef(messages.length);

  const resizeComposer = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 112);
    el.style.height = `${Math.max(next, 44)}px`;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setStickToBottom(true);
    setUnseenBelow(0);
  }, []);

  useEffect(() => {
    resizeComposer();
  }, [input, resizeComposer]);

  useEffect(() => {
    const prev = prevCountRef.current;
    const next = messages.length;
    prevCountRef.current = next;
    if (next <= prev) return;

    if (stickToBottom) {
      scrollToBottom("smooth");
    } else {
      setUnseenBelow((count) => count + (next - prev));
    }
  }, [messages, stickToBottom, scrollToBottom]);

  useEffect(() => {
    if (!stickToBottom) return;
    if (typingNames.length === 0) return;
    scrollToBottom("smooth");
  }, [typingNames, stickToBottom, scrollToBottom]);

  useEffect(() => {
    if (mobileOpen === false) return;
    if (mobileOpen) {
      const t = window.setTimeout(() => scrollToBottom("auto"), 40);
      return () => window.clearTimeout(t);
    }
  }, [mobileOpen, scrollToBottom]);

  useEffect(() => {
    if (!onMobileClose || !mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distance <= NEAR_BOTTOM_PX;
    setStickToBottom(nearBottom);
    if (nearBottom) setUnseenBelow(0);
  };

  const sendMessage = () => {
    const text = input.trim().slice(0, CHAT_MAX_LENGTH);
    if (!text || chatCooldown > 0) return;
    onSend(text);
    setInput("");
    setStickToBottom(true);
    requestAnimationFrame(resizeComposer);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleChange = (value: string) => {
    setInput(value.slice(0, CHAT_MAX_LENGTH));
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
          <h3
            id="live-chat-title"
            className="text-sm font-semibold tracking-[-0.01em] text-white"
          >
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
            aria-label="Close chat"
            className="size-8 rounded-full text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Chat messages"
          onScroll={handleScroll}
          className="h-full overflow-y-auto overflow-x-hidden px-4 py-4 scrollbar-dimovie"
        >
          <div className="space-y-3">
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
                const failed = msg.status === "failed";
                const pending = msg.status === "pending";
                const avatarUrl = avatarByUserId?.[msg.userId];
                const canDelete =
                  canModerate &&
                  onDelete &&
                  !msg.id.startsWith("opt-") &&
                  !msg.id.startsWith("shadow-");

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "dm-msg-in flex gap-2.5",
                      isOwn && "flex-row-reverse",
                      pending && "opacity-70",
                    )}
                  >
                    <Avatar className="mt-0.5 size-8 shrink-0 rounded-xl">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt="" className="rounded-xl" />
                      ) : null}
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
                    <div className="min-w-0 max-w-[78%]">
                      {!isOwn && (
                        <p className="mb-1 truncate text-[12px] font-semibold tracking-[-0.01em] text-white">
                          {msg.displayName}
                        </p>
                      )}
                      <div
                        className={cn(
                          "group/msg relative min-w-0 max-w-full rounded-2xl px-3 py-2 text-left",
                          isOwn
                            ? "rounded-tr-md bg-white/[0.1] ring-1 ring-white/[0.08]"
                            : "rounded-tl-md bg-white/[0.05] ring-1 ring-white/[0.04]",
                          failed && "ring-[#e50914]/35",
                        )}
                      >
                        <p className="break-words text-sm leading-snug whitespace-pre-wrap text-white/90 [overflow-wrap:anywhere]">
                          {msg.content}
                        </p>
                        <div
                          className={cn(
                            "mt-1.5 flex items-center gap-2 text-[10px] tabular-nums text-white/35",
                            isOwn && "justify-end",
                          )}
                        >
                          {pending && <span>Sending…</span>}
                          {failed && <span className="text-[#ff6b73]">Not sent</span>}
                          <span>{formatMessageTime(msg.createdAt)}</span>
                        </div>
                        {failed && onRetry && (
                          <button
                            type="button"
                            className="mt-1.5 text-[11px] font-medium text-[#5b9fd4] hover:text-[#9ec9ea]"
                            onClick={() => onRetry(msg.content)}
                          >
                            Retry
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            aria-label="Delete message"
                            className={cn(
                              "absolute -top-2 rounded-full bg-[#12121a] p-1.5 text-white/45 opacity-0 ring-1 ring-white/10 transition group-hover/msg:opacity-100 hover:text-[#ff6b73]",
                              isOwn ? "-left-2" : "-right-2",
                            )}
                            onClick={() => onDelete(msg.id)}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
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
        </div>

        {unseenBelow > 0 && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-[#0e0e14]/92 px-3 py-1.5 text-[11px] font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition hover:bg-[#16161f]"
          >
            <ArrowDown className="size-3.5" />
            {unseenBelow} new
          </button>
        )}
      </div>

      <div className="relative z-10 min-w-0 shrink-0 overflow-x-hidden border-t border-white/[0.06] bg-black/20 p-3">
        <div className="mb-2 flex min-w-0 items-center gap-1">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-hide">
            {CHAT_QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReaction(emoji)}
                className="grid size-8 shrink-0 place-items-center rounded-full text-base transition hover:bg-white/10"
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <ChatEmojiPicker
            iconOnly
            className="shrink-0"
            onInsert={(emoji) =>
              setInput((prev) => (prev + emoji).slice(0, CHAT_MAX_LENGTH))
            }
            onReaction={onReaction}
          />
        </div>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              chatCooldown > 0
                ? `Wait ${chatCooldown}s…`
                : "Send a message…"
            }
            className="max-h-28 min-h-11 flex-1 resize-none overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm leading-5 text-white placeholder:text-white/30 outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:opacity-50 scrollbar-hide"
            maxLength={CHAT_MAX_LENGTH}
            disabled={chatCooldown > 0}
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={!input.trim() || chatCooldown > 0}
            aria-label="Send message"
            className={cn(
              "mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full transition",
              input.trim() && chatCooldown === 0
                ? "bg-white text-black hover:bg-white/90"
                : "bg-white/10 text-white/30",
            )}
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </form>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-white/35">
          {chatCooldown > 0 ? (
            <p>Slow down — {chatCooldown}s until you can send again</p>
          ) : (
            <p className="text-white/25">Enter to send · Shift+Enter for line</p>
          )}
          <p
            className={cn(
              "ml-auto tabular-nums",
              input.length >= CHAT_MAX_LENGTH && "text-[#ff6b73]",
              input.length >= Math.floor(CHAT_MAX_LENGTH * 0.85) &&
                input.length < CHAT_MAX_LENGTH &&
                "text-white/55",
            )}
          >
            {input.length}/{CHAT_MAX_LENGTH}
          </p>
        </div>
      </div>
    </div>
  );

  if (mobileOpen !== undefined) {
    if (!mobileOpen) return null;
    return (
      <div
        className="fixed inset-0 z-50 lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-chat-title"
      >
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
