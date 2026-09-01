"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markConversationRead } from "../actions";

/** Fires once on mount to clear the unread flag for messages the viewer can see. */
export function MarkRead({
  conversationId,
  hasUnread,
}: {
  conversationId: string;
  hasUnread: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!hasUnread) return;
    markConversationRead(conversationId).then(() => router.refresh());
  }, [conversationId, hasUnread, router]);
  return null;
}
