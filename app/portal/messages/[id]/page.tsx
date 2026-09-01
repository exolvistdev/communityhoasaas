import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { peso } from "@/lib/format";
import { publicPhotoUrl } from "@/lib/marketplace";
import { MarkRead } from "./MarkRead";
import { MessageComposer } from "./MessageComposer";

export const metadata = { title: "Conversation · HOA SaaS" };

const time = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

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
      buyer: { select: { id: true, fullName: true } },
      seller: { select: { id: true, fullName: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!convo || (convo.buyerId !== user.id && convo.sellerId !== user.id))
    notFound();

  const other = convo.buyer.id === user.id ? convo.seller : convo.buyer;
  const hasUnread = convo.messages.some(
    (m) => m.senderId !== user.id && !m.readAt
  );

  return (
    <div className="flex min-h-[70vh] flex-col space-y-3">
      <MarkRead conversationId={convo.id} hasUnread={hasUnread} />

      <Link
        href="/portal/messages"
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← Messages
      </Link>

      <Link
        href={`/portal/market/${convo.listing.id}`}
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5 hover:border-gray-300"
      >
        <div className="h-11 w-11 shrink-0 rounded-md bg-gray-100">
          {convo.listing.photos[0] && (
            <img
              src={publicPhotoUrl(convo.listing.photos[0])}
              alt=""
              className="h-11 w-11 rounded-md object-cover"
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-gray-900">
            {convo.listing.title}
          </div>
          <div className="text-xs text-gray-400">
            {peso(Number(convo.listing.price), { cents: false })} · with{" "}
            {other.fullName}
          </div>
        </div>
      </Link>

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
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-800 ring-1 ring-gray-200"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div
                  className={`mt-0.5 text-[10px] ${
                    mine ? "text-gray-300" : "text-gray-400"
                  }`}
                >
                  {time(m.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <MessageComposer conversationId={convo.id} />
    </div>
  );
}
