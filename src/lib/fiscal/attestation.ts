/**
 * The publisher's individual attestation (attestation individuelle de
 * l'éditeur), restored as proof of compliance by the 2026 finance law (loi
 * n° 2026-103 du 19 février 2026, art. 125; in force from 21 February 2026),
 * on the administration's model BOI-LETTRE-000242. Part 1 is signed by
 * Epidom's publisher, part 2 by each business that uses the till.
 *
 * Issuing or using a false attestation is a criminal offence (Code pénal,
 * art. 441-1): every line below must stay true of the deployed system. A
 * change that touches how sales are recorded, secured, kept or archived is a
 * MAJOR version: bump FISCAL_MODULE.major and re-issue the attestation.
 *
 * The publisher's legal details are the operator's to fill in. Until they are,
 * nothing on the site claims compliance (isFiscalAttestationReady gates the
 * home page badge, the FAQ answer, the French "switch fully" path and the
 * attestation itself).
 */

export const FISCAL_MODULE = {
  name: "Epidom Caisse",
  /** Version root of the fiscal module; minor versions are "1-xxx". */
  major: "1",
  version: "1-000",
  /** Date the module was placed on the market. */
  releasedOn: "2026-11-02",
} as const;

export interface FiscalPublisher {
  /** Raison sociale of the publisher company. */
  legalName: string;
  /** Registration number (SIREN/SIRET, or the foreign equivalent). */
  registration: string;
  address: string;
  /** NOM Prénom of the legal representative who signs part 1. */
  representative: string;
  /** Their title (Gérant, Président, Director…). */
  representativeTitle: string;
  /** "Fait à (VILLE)". */
  city: string;
  /**
   * Image of the representative's signature, served from /public (e.g.
   * "/legal/publisher-signature.png"). Part 1 is signed once by the publisher
   * and printed on every store's copy.
   */
  signatureImage: string;
}

// TODO(operator): Prionation's legal details. See STATUS.md "NF525".
export const FISCAL_PUBLISHER: FiscalPublisher = {
  legalName: "",
  registration: "",
  address: "",
  representative: "",
  representativeTitle: "",
  city: "",
  signatureImage: "",
};

export function isFiscalAttestationReady(publisher: FiscalPublisher = FISCAL_PUBLISHER): boolean {
  return Object.values(publisher).every((value) => value.trim().length > 0);
}

/** Functions the attestation covers, in the template's own terms (French: it is a French legal document). */
export const COVERED_FUNCTIONS = [
  "Encaissement au point de vente (caisse Epidom, navigateur, application de bureau et Android)",
  "Encaissement des commandes en ligne de la vitrine Epidom",
  "Commandes des plateformes de livraison saisies ou importées dans la caisse",
  "Remboursements et annulations de ventes encaissées",
  "Journal des ventes signé et chaîné, totaux perpétuels",
  "Clôtures journalières, mensuelles et annuelles",
  "Archives mensuelles signées, conservées six ans",
] as const;

/** Functions it does not cover. Keep honest: see docs/FISCAL_JOURNAL.md "Limits". */
export const EXCLUDED_FUNCTIONS = [
  "Ventes saisies hors connexion, entre leur saisie sur l'appareil et leur synchronisation (elles sont journalisées et signées à la synchronisation)",
  "Additions mises en attente non encaissées",
  "Modules de gestion sans encaissement (stocks, recettes, fournisseurs, planning, rapports financiers)",
] as const;
