"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addHomeowner,
  inviteHomeowner,
  removeHomeowner,
  setPrimaryHomeowner,
  updateHomeowner,
} from "./actions";

type Role = "OWNER" | "CO_OWNER" | "RENTER";
type Person = {
  id: string;
  fullName: string;
  role: Role;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  hasLogin: boolean;
  loginAccepted: boolean;
};

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  CO_OWNER: "Co-owner",
  RENTER: "Renter",
};

export function PeopleSection({
  propertyId,
  people,
  canWrite,
}: {
  propertyId: string;
  people: Person[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const noPrimary = people.length > 0 && !people.some((p) => p.isPrimary);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if ("actionLink" in res && res.actionLink)
          setInviteLink(res.actionLink as string);
        setAdding(false);
        setEditingId(null);
        router.refresh();
      } else setError(res.error ?? "Something went wrong");
    });
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">People</h2>
        {canWrite && !adding && (
          <button
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm hover:bg-gray-50"
          >
            Add person
          </button>
        )}
      </div>

      {noPrimary && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          No primary contact set — pick one below.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {inviteLink && (
        <div className="rounded-md bg-green-50 p-3 text-xs text-green-800">
          Portal invite created — send this link:
          <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-gray-700">
            {inviteLink}
          </code>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Contact</th>
              <th className="px-4 py-2.5 font-medium"></th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && !adding && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No people on record.
                </td>
              </tr>
            )}

            {people.map((p) =>
              editingId === p.id ? (
                <tr key={p.id} className="border-t border-gray-100 bg-gray-50">
                  <td colSpan={5} className="px-4 py-3">
                    <PersonForm
                      initial={p}
                      pending={pending}
                      onCancel={() => setEditingId(null)}
                      onSubmit={(data) =>
                        act(() => updateHomeowner(p.id, data))
                      }
                    />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {p.fullName}
                    {p.isPrimary && (
                      <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                        Primary
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {ROLE_LABEL[p.role]}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {p.email || p.phone ? (
                      <span>
                        {p.email}
                        {p.email && p.phone ? " · " : ""}
                        {p.phone}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.hasLogin ? (
                      <span className="text-xs text-gray-500">
                        Portal: {p.loginAccepted ? "active" : "invited"}
                      </span>
                    ) : canWrite && p.email ? (
                      <button
                        onClick={() => act(() => inviteHomeowner(p.id))}
                        className="text-xs text-gray-500 underline hover:text-gray-900"
                      >
                        Invite to portal
                      </button>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {canWrite && (
                      <>
                        {!p.isPrimary && (
                          <button
                            onClick={() =>
                              act(() => setPrimaryHomeowner(p.id))
                            }
                            className="text-xs text-gray-500 underline hover:text-gray-900"
                          >
                            Make primary
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingId(p.id);
                            setAdding(false);
                          }}
                          className="ml-3 text-xs text-gray-500 underline hover:text-gray-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => act(() => removeHomeowner(p.id))}
                          className="ml-3 text-xs text-red-500 underline hover:text-red-700"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            )}

            {adding && (
              <tr className="border-t border-gray-100 bg-gray-50">
                <td colSpan={5} className="px-4 py-3">
                  <PersonForm
                    pending={pending}
                    showMakePrimary={people.length > 0}
                    onCancel={() => setAdding(false)}
                    onSubmit={(data) =>
                      act(() => addHomeowner(propertyId, data))
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PersonForm({
  initial,
  pending,
  showMakePrimary,
  onCancel,
  onSubmit,
}: {
  initial?: Person;
  pending: boolean;
  showMakePrimary?: boolean;
  onCancel: () => void;
  onSubmit: (data: {
    fullName: string;
    role: Role;
    email: string;
    phone: string;
    makePrimary?: boolean;
  }) => void;
}) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [role, setRole] = useState<Role>(initial?.role ?? "OWNER");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [makePrimary, setMakePrimary] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs">
        <span className="text-gray-600">Name</span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 block rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
        />
      </label>
      <label className="text-xs">
        <span className="text-gray-600">Role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="mt-1 block rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
        >
          <option value="OWNER">Owner</option>
          <option value="CO_OWNER">Co-owner</option>
          <option value="RENTER">Renter</option>
        </select>
      </label>
      <label className="text-xs">
        <span className="text-gray-600">Email</span>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
        />
      </label>
      <label className="text-xs">
        <span className="text-gray-600">Phone</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 block rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
        />
      </label>
      {showMakePrimary && (
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={makePrimary}
            onChange={(e) => setMakePrimary(e.target.checked)}
          />
          Primary contact
        </label>
      )}
      <button
        onClick={() => onSubmit({ fullName, role, email, phone, makePrimary })}
        disabled={pending}
        className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-gray-500 hover:text-gray-900"
      >
        Cancel
      </button>
    </div>
  );
}
