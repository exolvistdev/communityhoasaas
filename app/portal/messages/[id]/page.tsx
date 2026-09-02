import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { priceLabel, publicPhotoUrl } from "@/lib/marketplace";
import { MarkRead } from "./MarkRead";
import { MessageComposer } from "./MessageComposer";
import { ThreadActions } from "./ThreadActions";

export const metadata = { title: "Conversation · HOA SaaS" };

const time = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const partySelect = {
  id: true,
  fullName: true,
  homeowner: { select: { property: { select: { unitNumber: true } } } },
} as const;

export default async function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  const { user } = await getHomeownerContext();

  const convo = await prisma.marketConversation.findUnique({
    where: { id: params.id },
    include: {
      listing: {
        select: { id: true, title: true, price: true, photos: true, status: true },
      },
      buyer: { select: partySelect },
      seller: { select: partySelect },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!convo || (convo.buyerId !== user.id && convo.sellerId !== user.id))
    notFound();

  const other = convo.buyer.id === user.id ? convo.seller : convo.buyer;
  const hasUnread = convo.messages.some(
    (m) => m.senderId !== user.id && !m.readAt
  );

  const [myBlock, theirBlock, myReport] = await Promise.all([
    prisma.marketplaceBlock.findUnique({
      where: {
        blockerId_blockedId: { blockerId: user.id, blockedId: other.id },
      },
    }),
    prisma.marketplaceBlock.findUnique({
      where: {
        blockerId_blockedId: { blockerId: other.id, blockedId: user.id },
      },
    }),
    prisma.conversationReport.findUnique({
      where: {
        conversationId_reporterId: {
          conversationId: convo.id,
          reporterId: user.id,
        },
      },
    }),
  ]);

  const blocked = Boolean(myBlock || theirBlock);
  const unit = other.homeowner?.property?.unitNumber;

  return (
    <div className="flex min-h-[70vh] flex-col space-y-3">
      <MarkRead conversationId={convo.id} hasUnread={hasUnread} />

      <Link
        href="/portal/messages"
        className="text-sm text-fg-muted hover:text-fg"
      >
        ← Messages
      </Link>

      <Link
        href={`/portal/market/${convo.listing.id}`}
        className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5 hover:border-border"
      >
        <div className="h-11 w-11 shrink-0 rounded-md bg-surface-2">
          {convo.listing.photos[0] && (
            <img
              src={publicPhotoUrl(convo.listing.photos[0])}
              alt=""
              className="h-11 w-11 rounded-md object-cover"
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-fg">
            {convo.listing.title}
          </div>
          <div className="text-xs text-fg-subtle">
            {priceLabel(Number(convo.listing.price))} · with {other.fullName}
            {unit ? ` · ${unit}` : ""}
          </div>
        </div>
      </Link>

      <ThreadActions
        conversationId={convo.id}
        otherUserId={other.id}
        otherName={other.fullName}
        iBlocked={Boolean(myBlock)}
        alreadyReported={Boolean(myReport && !myReport.resolvedAt)}
      />

      <div className="flex-1 space-y-2">
        {convo.messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "bg-brand text-white"
                    : "bg-surface text-fg ring-1 ring-border"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div
                  className={`mt-0.5 text-[10px] ${
                    mine ? "text-fg-subtle" : "text-fg-subtle"
                  }`}
                >
                  {time(m.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {convo.closedAt ? (
        <p className="rounded-lg bg-warning-subtle px-3 py-2 text-center text-xs text-warning-fg">
          A moderator closed this conversation.
          {convo.closedReason ? ` ${convo.closedReason}` : ""}
        </p>
      ) : blocked ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-fg-muted">
          {myBlock
            ? "You blocked this person. Unblock them above to message again."
            : "This person isn't accepting messages from you."}
        </p>
      ) : (
        <MessageComposer conversationId={convo.id} />
      )}
    </div>
  );
}
