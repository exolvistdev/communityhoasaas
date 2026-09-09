"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TERMS, type Terms } from "@/lib/terms";

const TermsContext = createContext<Terms>(DEFAULT_TERMS);

/** Wraps an authenticated area (admin, portal) so leaf client components can
 *  read the org's display vocabulary without prop-drilling. Seed `value` from
 *  the server: `termsFor(org.communityType)`. */
export function TermsProvider({
  value,
  children,
}: {
  value: Terms;
  children: React.ReactNode;
}) {
  return (
    <TermsContext.Provider value={value}>{children}</TermsContext.Provider>
  );
}

export function useTerms(): Terms {
  return useContext(TermsContext);
}
