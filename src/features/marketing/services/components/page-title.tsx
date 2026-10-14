"use client";

import { useI18n } from "@/components/lang/i18n-provider";

/**
 * The Features page's title. The visible hero was removed (11.10.2026), so the
 * page opens on the problem picker; the h1 stays for screen readers and search
 * engines, so it names what the page is about ("POS, kitchen display and back
 * office for cafés and restaurants") rather than a slogan.
 *
 * The padding clears the floating site header (16px from the top, about 60px
 * tall). Added to the first section's own top padding (56/80/120px, see
 * `.epi-section`), the content starts 140px down, where the hero's did.
 */
export function PageTitle() {
  const { t } = useI18n();

  return (
    <div className="pt-[84px] min-[721px]:pt-[60px] min-[1025px]:pt-5">
      <h1 className="sr-only">
        {`${t("redesign.servicesPage.title1")} ${t("redesign.servicesPage.titleAccent")}`}
      </h1>
    </div>
  );
}
