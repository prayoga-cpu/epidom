"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Laptop, Monitor, Smartphone, type LucideIcon } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { PwaInstall, showPwaInstallDialog, usePwaInstaller } from "@/components/pwa/pwa-install";
import { trackEvent } from "@/lib/analytics";

/** The download icon first, then one per kind of device: phones and tablets are one. */
const DEVICES: readonly { key: "install" | "mobile" | "computer" | "desktop"; icon: LucideIcon }[] =
  [
    { key: "install", icon: Download },
    { key: "mobile", icon: Smartphone },
    { key: "computer", icon: Laptop },
    { key: "desktop", icon: Monitor },
  ];

/**
 * The footer's "Downloads" row: one icon per kind of device, all doing the same
 * thing, because Epidom installs one way, as a web app (PWA), from the browser.
 * A tap opens the app-wide installer dialog (one-tap install where the browser
 * offers it, illustrated steps on iPhone/iPad and Firefox).
 *
 * The installer's element is portalled to <body>: its dialog has a huge z-index,
 * but inside the footer's own stacking layer (z-10) it would sit under the
 * floating header (z-60), which is where it first appeared.
 *
 * The installer's library is only fetched on the first tap, never with the
 * page: <PwaInstall> is mounted then, and the dialog opened once it is there.
 * Nothing shows once Epidom is already installed (or running as the desktop app).
 */
export function FooterDownloads() {
  const { t } = useI18n();
  const { isStandalone, isInstallStateKnown } = usePwaInstaller();
  const [armed, setArmed] = useState(false);

  // A child's effects run before its parent's, so <PwaInstall> has registered
  // its element by the time this opens the dialog.
  useEffect(() => {
    if (armed) showPwaInstallDialog();
  }, [armed]);

  if (!isInstallStateKnown || isStandalone) return null;

  function open(device: string) {
    trackEvent("footer_download_click", { device });
    if (armed) showPwaInstallDialog();
    else setArmed(true);
  }

  return (
    <div className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="m-0 text-sm font-medium" style={{ color: "rgba(251,249,228,0.9)" }}>
          {t("footer.downloads")}
        </h2>
        <p className="m-0 mt-1 text-sm" style={{ color: "rgba(251,249,228,0.5)" }}>
          {t("footer.downloadsSub")}
        </p>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {DEVICES.map(({ key, icon: Icon }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => open(key)}
              title={t(`footer.device.${key}`)}
              aria-label={`${t("footer.downloadAction")}: ${t(`footer.device.${key}`)}`}
              className="focus-visible:outline-epi-gold-300 inline-flex size-12 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[rgba(251,249,228,0.75)] transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-2"
            >
              <Icon aria-hidden="true" className="size-5" />
            </button>
          </li>
        ))}
      </ul>
      {armed ? createPortal(<PwaInstall />, document.body) : null}
    </div>
  );
}
