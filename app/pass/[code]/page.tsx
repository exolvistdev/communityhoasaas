import { prisma } from "@/lib/prisma";
import { qrSvg } from "@/lib/qr";
import { siteOrigin } from "@/lib/url";
import { validateGatePass, type GatePassVerdict } from "@/lib/gatepass";

export const metadata = { title: "Visitor pass" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const VERDICT_TEXT: Record<GatePassVerdict, { label: string; tone: string }> = {
  VALID: { label: "Valid now", tone: "text-green-700" },
  NOT_YET_VALID: { label: "Not valid yet", tone: "text-amber-700" },
  EXPIRED: { label: "Expired", tone: "text-red-700" },
  REVOKED: { label: "Revoked", tone: "text-red-700" },
  USED: { label: "Already used", tone: "text-red-700" },
};

export default async function VisitorPassPage({
  params,
}: {
  params: { code: string };
}) {
  const code = params.code.toUpperCase();
  const pass = await prisma.gatePass.findUnique({
    where: { code },
    include: {
      property: { select: { unitNumber: true, org: { select: { name: true } } } },
    },
  });

  if (!pass) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">
          This pass link isn&apos;t valid
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Check the link with whoever invited you.
        </p>
      </main>
    );
  }

  const verdict = validateGatePass(pass);
  const v = VERDICT_TEXT[verdict];
  const svg = await qrSvg(`${siteOrigin()}/pass/${code}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          {pass.property.org.name}
        </div>
        <div className="mt-1 text-sm text-gray-500">Visitor gate pass</div>

        <div
          className="mx-auto mt-4 h-48 w-48 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="mt-2 font-mono text-2xl font-semibold tracking-widest text-gray-900">
          {code}
        </div>

        <div className={`mt-3 text-sm font-medium ${v.tone}`}>{v.label}</div>

        <dl className="mt-4 space-y-1 text-left text-sm">
          <Row label="Visitor" value={pass.visitorName} />
          <Row label="Unit" value={pass.property.unitNumber} />
          <Row label="Valid from" value={fmt(pass.validFrom)} />
          <Row label="Valid until" value={fmt(pass.validUntil)} />
          {pass.usedAt && <Row label="Used" value={fmt(pass.usedAt)} />}
        </dl>

        <p className="mt-4 text-xs text-gray-400">
          Show this screen to the guard at the gate.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}
