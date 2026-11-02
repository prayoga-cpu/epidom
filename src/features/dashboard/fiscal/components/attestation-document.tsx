"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  COVERED_FUNCTIONS,
  EXCLUDED_FUNCTIONS,
  FISCAL_MODULE,
  type FiscalPublisher,
} from "@/lib/fiscal/attestation";

export interface AttestationStore {
  storeId: string;
  businessName: string;
  address: string | null;
  /** When the store was created on Epidom (acquired/downloaded on), YYYY-MM-DD. */
  acquiredOn: string;
  /** First fiscal record, YYYY-MM-DD, or null before the first sale. */
  firstUseOn: string | null;
}

/** "2026-10-30" → "30/10/2026": the template is French, so are its dates. */
function frDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const FALSE_ATTESTATION_WARNING =
  "Le fait de délivrer une attestation faisant état de faits matériellement inexacts ou de faire usage d'une telle attestation est puni de trois ans d'emprisonnement et de 45 000 € d'amende (article 441-1 du code pénal).";

function Blank({ wide = false }: { wide?: boolean }) {
  return (
    <span
      className={`inline-block border-b border-dotted border-black align-bottom ${wide ? "w-64" : "w-40"}`}
    />
  );
}

/**
 * The individual attestation on the administration's model (BOI-LETTRE-000242),
 * printed to sign. The document itself is in French whatever the interface
 * language: it is a French legal form and is only valid in that wording, so
 * its text lives here rather than in the locale files. Only the toolbar is
 * translated.
 *
 * Part 1 (the publisher's) is filled in and signed from FISCAL_PUBLISHER; part
 * 2 is pre-filled where Epidom knows the answer and left blank where only the
 * business can give it.
 */
export function AttestationDocument({
  publisher,
  store,
  issuedOn,
}: {
  publisher: FiscalPublisher;
  store: AttestationStore;
  issuedOn: string;
}) {
  const { t } = useI18n();

  return (
    <div className="min-h-[calc(100dvh/var(--app-zoom,1))] bg-white text-black">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="outline" className="min-h-10">
            <Link href={`/store/${store.storeId}/fiscal`}>{t("fiscal.attestation.back")}</Link>
          </Button>
          <p className="text-sm text-gray-600">{t("fiscal.attestation.toolbarHint")}</p>
          <Button className="min-h-10" onClick={() => window.print()}>
            <Printer className="mr-2 size-4" aria-hidden />
            {t("fiscal.attestation.print")}
          </Button>
        </div>

        <article className="space-y-5 text-[13px] leading-relaxed">
          <header className="space-y-1 text-center">
            <h1 className="text-lg font-bold">
              Attestation individuelle relative à l&apos;utilisation d&apos;un logiciel ou d&apos;un
              système de caisse sécurisé
            </h1>
            <p className="text-xs text-gray-700">
              Article 286, I, 3° bis du code général des impôts · modèle BOI-LETTRE-000242
            </p>
          </header>

          <p className="border border-black p-3 text-xs">
            Les deux volets de cette attestation doivent être présentés à l&apos;administration
            fiscale en cas de contrôle. L&apos;attestation n&apos;est valable que si le volet 2 est
            complété et signé par l&apos;entreprise utilisatrice.
          </p>

          <section className="space-y-3">
            <h2 className="font-bold">
              I. Volet 1 : à compléter par l&apos;éditeur du logiciel ou du système de caisse
            </h2>
            <p>
              Je soussigné(e), <strong>{publisher.representative}</strong>,{" "}
              {publisher.representativeTitle}, représentant légal de la société{" "}
              <strong>{publisher.legalName}</strong> ({publisher.registration}), {publisher.address}
              , éditeur du logiciel de caisse <strong>{FISCAL_MODULE.name}</strong> (logiciel de
              caisse en ligne Epidom : caisse, vitrine et commandes en ligne),
            </p>
            <p>
              atteste que ce logiciel, mis sur le marché à compter du{" "}
              {frDate(FISCAL_MODULE.releasedOn)}, dans sa version n°{" "}
              <strong>{FISCAL_MODULE.version}</strong>, satisfait aux conditions
              d&apos;inaltérabilité, de sécurisation, de conservation et d&apos;archivage des
              données en vue du contrôle de l&apos;administration fiscale, prévues au 3° bis du I de
              l&apos;article 286 du code général des impôts.
            </p>
            <p>
              La dernière version majeure du logiciel est identifiée par la racine suivante :{" "}
              <strong>{FISCAL_MODULE.major}</strong>. Les versions mineures ultérieures sont
              identifiées par les subdivisions de cette racine ({FISCAL_MODULE.major}-aaa), qui ne
              sont utilisées que pour des versions mineures et jamais pour une version majeure, au
              sens du § 340 du BOI-TVA-DECLA-30-10-30.
            </p>
            <div>
              <p>Cette attestation couvre les fonctionnalités suivantes :</p>
              <ul className="list-disc pl-6">
                {COVERED_FUNCTIONS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <p>Ne sont pas couvertes les fonctionnalités suivantes :</p>
              <ul className="list-disc pl-6">
                {EXCLUDED_FUNCTIONS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <p>
              Fait à {publisher.city}, le {frDate(issuedOn)}
            </p>
            <div>
              <p className="text-xs">
                Signature du représentant légal de l&apos;éditeur du logiciel ou système de caisse
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- a print document; next/image adds nothing here */}
              <img src={publisher.signatureImage} alt="" className="mt-1 h-20 w-auto" />
            </div>
            <p className="text-xs italic">{FALSE_ATTESTATION_WARNING}</p>
          </section>

          <section className="break-before-page space-y-3 border-t border-black pt-5">
            <h2 className="font-bold">
              II. Volet 2 : à compléter par l&apos;entreprise utilisatrice du logiciel ou du système
              de caisse
            </h2>
            <p>
              Je soussigné(e), <Blank wide /> (NOM Prénom), représentant légal de la société{" "}
              <strong>{store.businessName}</strong> (raison sociale : <Blank />)
              {store.address ? `, ${store.address}` : ""},
            </p>
            <p>
              atteste avoir acquis ou téléchargé le {frDate(store.acquiredOn)} auprès de{" "}
              {publisher.legalName} le logiciel ou système de caisse décrit au volet 1,
            </p>
            <p>
              et atteste l&apos;utiliser pour enregistrer les règlements de mes clients
              particuliers, conformément aux règles fiscales applicables, depuis le{" "}
              {store.firstUseOn ? frDate(store.firstUseOn) : <Blank />}.
            </p>
            <p>
              Fait à <Blank />, le <Blank />
            </p>
            <div>
              <p className="text-xs">Signature du représentant légal</p>
              <div className="mt-1 h-20 w-64 border border-black" />
            </div>
            <p className="text-xs italic">{FALSE_ATTESTATION_WARNING}</p>
          </section>

          <footer className="border-t border-gray-300 pt-2 text-[11px] text-gray-600">
            Référence : {store.storeId} · {FISCAL_MODULE.name} {FISCAL_MODULE.version} · éditée le{" "}
            {frDate(issuedOn)}
          </footer>
        </article>
      </div>
    </div>
  );
}
