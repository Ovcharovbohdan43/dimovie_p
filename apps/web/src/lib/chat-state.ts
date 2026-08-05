import type { ChatMessagePayload } from "@dimovie/shared";

/** Merge server history with local system notices and in-flight pending rows. */
export function mergeChatOnReconnect(
  previous: ChatMessagePayload[],
  recent: ChatMessagePayload[],
): ChatMessagePayload[] {
  const byId = new Map<string, ChatMessagePayload>();

  for (const msg of recent) {
    byId.set(msg.id, { ...msg, status: msg.status ?? "sent" });
  }

  for (const msg of previous) {
    if (msg.kind === "system") {
      if (!byId.has(msg.id)) byId.set(msg.id, msg);
      continue;
    }
    if (msg.id.startsWith("opt-") && msg.status === "pending") {
      const confirmed = recent.find(
        (r) => r.userId === msg.userId && r.content === msg.content,
      );
      if (confirmed) continue;
      byId.set(msg.id, msg);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function markPendingChatFailed(
  messages: ChatMessagePayload[],
  userId: string | undefined,
): ChatMessagePayload[] {
  if (!userId) return messages;
  return messages.map((msg) =>
    msg.id.startsWith("opt-") &&
    msg.userId === userId &&
    (msg.status === "pending" || !msg.status)
      ? { ...msg, status: "failed" as const }
      : msg,
  );
}

export function upsertIncomingChat(
  previous: ChatMessagePayload[],
  msg: ChatMessagePayload,
): ChatMessagePayload[] {
  if (previous.some((m) => m.id === msg.id)) return previous;

  const incoming = {
    ...msg,
    status: msg.status ?? ("sent" as const),
  };

  if (incoming.id.startsWith("opt-")) {
    return [...previous, incoming];
  }

  const withoutDupOpt = previous.filter(
    (m) =>
      !(
        m.id.startsWith("opt-") &&
        m.userId === incoming.userId &&
        m.content === incoming.content
      ),
  );
  return [...withoutDupOpt, incoming];
}
