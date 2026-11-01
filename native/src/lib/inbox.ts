export interface InboxItem {
  id: string;
  title: string;
  body: string;
  sessionId?: string;
  read: boolean;
  createdAt: string;
}

export function parseInbox(value: string | null): InboxItem[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is InboxItem =>
          item !== null &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          typeof item.body === "string" &&
          typeof item.read === "boolean" &&
          typeof item.createdAt === "string" &&
          Number.isFinite(Date.parse(item.createdAt)) &&
          (item.sessionId === undefined || typeof item.sessionId === "string"),
      )
      .slice(0, 100);
  } catch {
    return [];
  }
}

// New deliveries survive a slow disk read; a read item never becomes unread on redelivery.
export function mergeInbox(stored: InboxItem[], incoming: InboxItem[]): InboxItem[] {
  const byId = new Map<string, InboxItem>();
  for (const item of [...stored, ...incoming]) {
    // Also normalize history written before push/realtime used a shared identity.
    const id = item.sessionId ? `session:${item.sessionId}` : item.id;
    const previous = byId.get(id);
    byId.set(id, { ...item, id, read: item.read || previous?.read === true });
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 100);
}

export function inboxSections(items: InboxItem[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  return [
    { title: "Today", data: items.filter((item) => Date.parse(item.createdAt) >= today) },
    {
      title: "Yesterday",
      data: items.filter(
        (item) => Date.parse(item.createdAt) >= yesterday && Date.parse(item.createdAt) < today,
      ),
    },
    { title: "Earlier", data: items.filter((item) => Date.parse(item.createdAt) < yesterday) },
  ].filter((section) => section.data.length > 0);
}

export function notificationTime(value: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
