"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { PropertyCsvImport } from "@/components/PropertyCsvImport";

export function ImportClient() {
  const router = useRouter();
  return (
    <div className="max-w-xl space-y-4">
      <Link href="/properties" className="text-sm text-fg-muted hover:text-fg">
        ← Properties
      </Link>
      <h1 className="text-lg font-semibold text-fg">Import properties</h1>
      <PropertyCsvImport
        completeLabel="Back to properties"
        onComplete={() => {
          router.push("/properties");
          router.refresh();
        }}
      />
    </div>
  );
}
