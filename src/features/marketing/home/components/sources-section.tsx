"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { SOURCE_IDS, sourceAnchor, sourceKey, sourceNumber } from "../data/sources";

/** The numbered sources every [n] marker on the page jumps to. */
export function SourcesSection() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="sources-title" className="pb-16">
      <div className="epi-container">
        <div className="border-t border-white/10 pt-8">
          <h2
            id="sources-title"
            className="text-epi-cream-50/60 m-0 text-xs font-medium tracking-[0.18em] uppercase"
          >
            {t("redesign.landing.sources.title")}
          </h2>
          <ol className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
            {SOURCE_IDS.map((id) => (
              <li
                key={id}
                id={sourceAnchor(id)}
                className="text-epi-cream-50/60 target:text-epi-cream-50 flex scroll-mt-28 gap-3 text-xs leading-relaxed"
              >
                <span className="text-epi-gold-400 shrink-0">[{sourceNumber(id)}]</span>
                <span>{t(sourceKey(id))}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
