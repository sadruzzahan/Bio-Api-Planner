// Single source of truth for the legal-document versions the app currently
// surfaces. Bump these whenever the underlying content changes — the consent
// gate compares against them and re-prompts users who only accepted older
// versions.
export const LEGAL_VERSIONS = {
  tos: "1.0",
  privacy: "1.0",
  disclaimer: "1.0",
  cookies: "1.0",
} as const;

export const EFFECTIVE_DATE = "May 1, 2026";

export const COMPANY = {
  name: "BioOS, Inc.",
  shortName: "BioOS",
  contact: "privacy@bioos.app",
  address: "Delaware, USA",
} as const;

export type LegalDocument = keyof typeof LEGAL_VERSIONS;
