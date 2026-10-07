"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { PRIMARY_BUTTON, SectionHeading } from "./landing-ui";

/**
 * "You don't have to switch today": the two ways in, and the button that opens
 * the same "how do you want to start" modal as the hero link.
 */
export function SwitchPaceSection({ onOpenMigration }: { onOpenMigration: () => void }) {
  const { t } = useI18n();

  return (
    <section aria-labelledby="switch-title" className="epi-section epi-warm-section">
      <div className="epi-container">
        <div className="epi-eyebrow text-epi-gold-600 mb-4">
          {t("redesign.landing.switch.eyebrow")}
        </div>
        <h2
          id="switch-title"
          className="epi-display text-epi-navy-900 m-0 max-w-3xl text-[clamp(36px,5vw,64px)] leading-[0.95]"
        >
          {t("redesign.landing.switch.title")}
        </h2>

        <ol className="m-0 mt-10 grid list-none gap-4 p-0 md:grid-cols-2">
          {(["path1", "path2"] as const).map((key, i) => (
            <li
              key={key}
              className="border-epi-navy-900/10 flex flex-col gap-3 rounded-3xl border bg-white/60 p-6"
            >
              <span className="epi-display text-epi-gold-600 text-4xl leading-none">0{i + 1}</span>
              <h3 className="text-epi-navy-900 m-0 text-xl font-medium">
                {t(`redesign.landing.switch.${key}Title`)}
              </h3>
              <p className="text-epi-navy-700 m-0 text-[15px] leading-relaxed">
                {t(`redesign.landing.switch.${key}Body`)}
              </p>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onOpenMigration}
          className={`${PRIMARY_BUTTON} mt-10 cursor-pointer`}
        >
          {t("redesign.landing.switch.cta")}
        </button>
      </div>
    </section>
  );
}
