"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import {
  inviteMember,
  removeMember,
  resendInvite,
  sendResetLink,
  updateMemberRole,
} from "./actions";

type Member = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  accepted: boolean;
};

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Admin",
  TREASURER: "Treasurer",
  BOARD_MEMBER: "Board member",
  GUARD: "Guard",
  HOMEOWNER: "Homeowner",
};

const ASSIGNABLE: UserRole[] = ["ADMIN", "TREASURER", "BOARD_MEMBER", "GUARD"];

export function TeamManager({
  members,
  selfId,
}: {
  members: Member[];
  selfId: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  function act(fn: () => Promise<any>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if ("actionLink" in res && res.actionLink) setLink(res.actionLink);
        setAdding(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  function onInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    act(() =>
      inviteMember({
        email: fd.get("email"),
        fullName: fd.get("fullName"),
        role: fd.get("role"),
      })
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Team</h1>
        {!adding && (
          <button
            onClick={() => {
              setAdding(true);
              setLink(null);
            }}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Invite member
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {link && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          <p className="font-medium">Link generated.</p>
          <p className="mt-1 break-all">
            Send them this link to set a password:
          </p>
          <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-xs text-gray-700">
            {link}
          </code>
        </div>
      )}

      {adding && (
        <form
          onSubmit={onInvite}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-white p-4 text-sm"
        >
          <label>
            <span className="block text-xs text-gray-600">Email</span>
            <input
              name="email"
              type="email"
              required
              className="mt-1 rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
            />
          </label>
          <label>
            <span className="block text-xs text-gray-600">Full name</span>
            <input
              name="fullName"
              required
              className="mt-1 rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
            />
          </label>
          <label>
            <span className="block text-xs text-gray-600">Role</span>
            <select
              name="role"
              defaultValue="TREASURER"
              className="mt-1 rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
            >
              {ASSIGNABLE.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-gray-900 px-3 py-1.5 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? "Inviting…" : "Send invite"}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="px-2 py-1.5 text-gray-500 hover:text-gray-900"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-gray-100">
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {m.fullName}
                  {m.id === selfId && (
                    <span className="ml-1 text-xs text-gray-400">(you)</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-600">{m.email}</td>
                <td className="px-4 py-2.5">
                  <select
                    defaultValue={m.role}
                    disabled={pending || m.role === "HOMEOWNER"}
                    onChange={(e) =>
                      act(() => updateMemberRole(m.id, e.target.value))
                    }
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-gray-900 disabled:opacity-60"
                  >
                    {(m.role === "HOMEOWNER"
                      ? (["HOMEOWNER"] as UserRole[])
                      : ASSIGNABLE
                    ).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  {m.accepted ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Invited
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  {!m.accepted ? (
                    <button
                      onClick={() => act(() => resendInvite(m.id))}
                      className="text-xs text-gray-500 underline hover:text-gray-900"
                    >
                      Invite link
                    </button>
                  ) : (
                    <button
                      onClick={() => act(() => sendResetLink(m.id))}
                      className="text-xs text-gray-500 underline hover:text-gray-900"
                    >
                      Reset link
                    </button>
                  )}
                  {m.id !== selfId && (
                    <button
                      onClick={() => {
                        if (!confirm(`Remove ${m.fullName}?`)) return;
                        act(() => removeMember(m.id));
                      }}
                      className="ml-3 text-xs text-red-500 underline hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
