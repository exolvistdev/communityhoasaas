"use client";

import { useRouter } from "next/navigation";
import { PropertyCsvImport } from "@/components/PropertyCsvImport";
import { PageHeader } from "@/components/PageHeader";
import type { TypeRateDefaults } from "@/lib/rate";

export function ImportClient({ typeDefaults }: { typeDefaults: TypeRateDefaults }) {
  const router = useRouter();
  return (
    <div className="max-w-xl space-y-4">
      <PageHeader
        title="Import properties"
        backLink={{ href: "/properties", label: "Properties" }}
      />
      <PropertyCsvImport
        completeLabel="Back to properties"
        typeDefaults={typeDefaults}
        onComplete={() => {
          router.push("/properties");
          router.refresh();
        }}
      />
    </div>
  );
}
