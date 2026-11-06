import { Laptop } from "lucide-react";
import type { DevicePlatform } from "@/lib/device-platform";

/** The Apple mark (Simple Icons, CC0). */
const APPLE =
  "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";

/** Four panes, as the Windows mark. */
const WINDOWS = "M1 1h10.4v10.4H1zM12.6 1H23v10.4H12.6zM1 12.6h10.4V23H1zM12.6 12.6H23V23H12.6z";

/** A robot's head with two antennae, as the Android mark (eyes cut out). */
const ANDROID_HEAD =
  "M2 18a10 10 0 0 1 20 0zM6.3 13.6a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0zM15.1 13.6a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0z";

/**
 * The visitor's platform as a small mark in the current text colour: Apple
 * for macOS / iPhone / iPad, Windows, Android, and a laptop for Chromebook
 * and Linux. Decorative: the button names the platform in words.
 */
export function PlatformIcon({
  platform,
  className,
}: {
  platform: DevicePlatform;
  className?: string;
}) {
  if (platform === "chromeos" || platform === "linux") {
    return <Laptop aria-hidden="true" className={className} />;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {platform === "windows" ? (
        <path d={WINDOWS} />
      ) : platform === "android" ? (
        <>
          <path d={ANDROID_HEAD} fillRule="evenodd" />
          <path
            d="M6.6 9.6 4.6 5.8M17.4 9.6l2-3.8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path d={APPLE} />
      )}
    </svg>
  );
}
