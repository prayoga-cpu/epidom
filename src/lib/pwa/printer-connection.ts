// Bluetooth link registry for thermal printers (Web Bluetooth transport).
//
// One browser can hold several BLE printers at once — a receipt printer at the
// till, a ticket printer in the kitchen, another at the bar, a label printer.
// Each is bound to a PrinterRole. Two roles may be bound to the SAME physical
// printer (a small shop with one machine); they then share one GATT link, and
// that link is only torn down when the last role using it lets go.
//
// Pure transport: it knows nothing about ESC/POS or receipts, only how to pair a
// device to a role and push bytes at it. Gracefully unavailable when Web
// Bluetooth is not supported (non-Chrome, iOS).

/**
 * What a printer is FOR, not what it is:
 *  - MAIN     cashier → customer: the receipt with prices and total, the bill,
 *             the shift report.
 *  - KITCHEN  captain order for the kitchen — items and quantities, no prices.
 *  - BAR      captain order for the bar — same ticket, bar items only.
 *  - LABEL    one sticker per item (cup / packaging).
 */
export const PRINTER_ROLES = ["MAIN", "KITCHEN", "BAR", "LABEL"] as const;
export type PrinterRole = (typeof PRINTER_ROLES)[number];

/** Thrown when a print targets a role whose printer isn't paired/live. Carries
 * the role so a caller can say WHICH printer is missing. The message stays the
 * long-standing Indonesian string the receipt path has always surfaced. */
export class PrinterNotConnectedError extends Error {
  constructor(public readonly role: PrinterRole) {
    super("Printer tidak terhubung");
    this.name = "PrinterNotConnectedError";
  }
}

/** Thrown when a write to a paired printer never settles — it is wedged, not merely disconnected. */
export class PrinterTimeoutError extends Error {
  constructor(public readonly role: PrinterRole) {
    super("Printer not responding");
    this.name = "PrinterTimeoutError";
  }
}

// Common Bluetooth service/characteristic UUIDs for ESC/POS printers
const PRINTER_PROFILES = [
  // Most common cheap BT printers (Aliexpress, Shopee)
  {
    service: 0x18f0,
    characteristic: 0x2af1,
  },
  // Alternative profile
  {
    service: "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
    characteristic: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
  },
];

interface PrinterLink {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
}

// role → live link. Two roles bound to one physical printer hold the SAME
// PrinterLink object, so "are these one device" is a device.id comparison.
const links = new Map<PrinterRole, PrinterLink>();
const listeners = new Set<() => void>();
// Devices that already carry our disconnect listener, so re-pairing the same
// BluetoothDevice never stacks a second one.
const watchedDevices = new WeakSet<BluetoothDevice>();

const notify = () => {
  for (const listener of listeners) listener();
};

/** Called whenever ANY role connects or drops — including a printer walking out
 * of range, which fires no click. The settings store mirrors this into its
 * `connected` flags so the UI can never disagree with the hardware. */
export function subscribePrinterConnections(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function isPrinterConnected(role: PrinterRole = "MAIN"): boolean {
  return !!links.get(role)?.device.gatt?.connected;
}

/** The paired device's advertised name (e.g. "XP-58IIH"), or null when the role has no live link. */
export function getPrinterDeviceName(role: PrinterRole): string | null {
  const link = links.get(role);
  return link?.device.gatt?.connected ? (link.device.name ?? null) : null;
}

/** Drops a role's binding. The GATT link itself is only closed when no other role still uses that device. */
function releaseRole(role: PrinterRole) {
  const link = links.get(role);
  if (!link) return;
  links.delete(role);
  const stillShared = [...links.values()].some((other) => other.device.id === link.device.id);
  if (!stillShared) link.device.gatt?.disconnect();
}

function watchDevice(device: BluetoothDevice) {
  if (watchedDevices.has(device)) return;
  watchedDevices.add(device);
  device.addEventListener("gattserverdisconnected", () => {
    // Every role that was riding this device goes down with it.
    for (const [role, link] of links) {
      if (link.device.id === device.id) links.delete(role);
    }
    notify();
  });
}

/**
 * Opens the browser's device picker and binds the chosen printer to `role`.
 * Needs a live user gesture (Web Bluetooth's requestDevice requirement), so it
 * can only run from a click. Resolves false — never throws — on cancel/failure.
 */
export async function connectPrinter(role: PrinterRole = "MAIN"): Promise<boolean> {
  if (!isBluetoothSupported()) return false;

  try {
    const optionalServices = PRINTER_PROFILES.map((p) => p.service);
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PRINTER_PROFILES[0].service] }],
      optionalServices,
    });

    // The same physical printer picked for a second role: ride its live link
    // instead of opening a second GATT connection to one device.
    const shared = [...links.values()].find(
      (link) => link.device.id === device.id && link.device.gatt?.connected
    );
    if (shared) {
      if (links.get(role) !== shared) releaseRole(role);
      links.set(role, shared);
      notify();
      return true;
    }

    const server = await device.gatt?.connect();
    if (!server) return false;

    // Try each profile until one works
    for (const profile of PRINTER_PROFILES) {
      try {
        const service = await server.getPrimaryService(profile.service);
        const characteristic = await service.getCharacteristic(profile.characteristic);
        // Only now that the new printer answered is the role's old one let go —
        // a failed re-pair must never take down a working printer.
        releaseRole(role);
        links.set(role, { device, characteristic });
        watchDevice(device);
        notify();
        return true;
      } catch {
        // Try next profile
      }
    }

    // It passed the picker's filter but exposes neither known characteristic (the
    // wrong model, a printer in another mode). Nothing tracks this connection, so
    // nothing would ever close it — and most cheap printers accept a single
    // central, so leaving it open locks the printer out until the page reloads.
    device.gatt?.disconnect();
    return false;
  } catch (err: any) {
    // User cancelled device picker or no device found
    if (err?.name !== "NotFoundError" && err?.name !== "NotAllowedError") {
      console.error("[Printer] connect error:", err);
    }
    return false;
  }
}

export function disconnectPrinter(role: PrinterRole = "MAIN") {
  releaseRole(role);
  notify();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// `writeValueWithoutResponse` is fire-and-forget at the BLE layer: it
// returns as soon as the browser hands the bytes to the OS's Bluetooth
// stack, not once the printer has actually consumed them — there is no ACK,
// no NACK, nothing that surfaces as a JS error if the peripheral drops data.
// Cheap ESC/POS printers (the common case here) have a small input buffer
// (often well under 1KB) and a real-world print throughput far slower than
// BLE's transfer rate. Firing large writes back-to-back with no pause
// reliably outruns both — the buffer overflows mid-receipt and everything
// past that point is silently discarded, which is what produced the
// "header prints, then quantity/subtotal/total/footer all missing" symptom.
//
// There's no portable way to ask the OS/printer what its actual buffer size
// or negotiated ATT MTU is from Web Bluetooth, so this can't be tuned to a
// value proven correct for every device — 64 bytes with a 30ms gap is a
// deliberately conservative choice (well under any realistic MTU, and slow
// enough that even a slow firmware's buffer keeps draining faster than it
// fills). If a specific printer still drops content, raise
// PRINT_CHUNK_DELAY_MS (or lower PRINT_CHUNK_BYTES further) for that model —
// there's no fixed value that's provably safe for every printer on the
// market, only more conservative vs. less.
const PRINT_CHUNK_BYTES = 64;
const PRINT_CHUNK_DELAY_MS = 30;
// Extra pause after the last content byte and before the partial-cut
// command, separate from the inter-chunk delay above: printing is
// mechanical (print head + paper feed), not instant, so the printer can
// still be physically rendering the last line or two of text even after
// its input buffer has fully drained. Cutting immediately after the last
// write can guillotine paper that hasn't finished printing yet — a
// different failure mode than dropped data, but the same visible result
// (a receipt that looks cropped).
const PRINT_SETTLE_DELAY_MS = 300;

// Sent as its own write, after PRINT_SETTLE_DELAY_MS, instead of being part of
// a builder's output — see printBytes().
const CUT_COMMAND = new Uint8Array([0x1d, 0x56, 0x41, 0x03]); // GS V A 3 — partial cut

// A write that never settles (the printer powered off mid-job, a wedged OS
// Bluetooth stack) would otherwise hold the single print chain below forever:
// no receipt, ticket or report would print again until a reload. Ten seconds is
// far beyond any healthy 64-byte write.
const PRINT_WRITE_TIMEOUT_MS = 10_000;

async function writeChunks(role: PrinterRole, link: PrinterLink, data: Uint8Array): Promise<void> {
  for (let i = 0; i < data.length; i += PRINT_CHUNK_BYTES) {
    const write = link.characteristic.writeValueWithoutResponse(
      data.slice(i, i + PRINT_CHUNK_BYTES)
    );
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Drop the link: a write still pending in the OS could otherwise complete
        // later and splice stale bytes into the NEXT job on this printer. The
        // disconnect event clears the registry and tells the UI it is down.
        link.device.gatt?.disconnect();
        reject(new PrinterTimeoutError(role));
      }, PRINT_WRITE_TIMEOUT_MS);
      write.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
    await sleep(PRINT_CHUNK_DELAY_MS);
  }
}

// Every print, whatever its role, goes through ONE chain. Two roles can share a
// printer, and interleaving their chunks would splice one ticket into the
// middle of another; running distinct printers strictly one after another also
// keeps the phone's single BLE radio from being asked to stream to several
// small-buffered devices at once. It costs about a second per extra job, which
// a kitchen ticket can afford and a scrambled one cannot.
let printQueue: Promise<unknown> = Promise.resolve();

export interface PrintBytesOptions {
  /** Send the partial-cut command after the bytes. Default true; a sticker roll must not be cut. */
  cut?: boolean;
}

/**
 * Writes `data` to the printer bound to `role`, using the chunked-write +
 * settle + cut discipline every ESC/POS job needs. Rejects with
 * PrinterNotConnectedError when the role has no live printer at the moment the
 * job actually runs (not merely when it was queued).
 */
export function printBytes(
  role: PrinterRole,
  data: Uint8Array,
  options: PrintBytesOptions = {}
): Promise<void> {
  const job = async () => {
    const link = links.get(role);
    if (!link || !link.device.gatt?.connected) throw new PrinterNotConnectedError(role);
    await writeChunks(role, link, data);
    if (options.cut ?? true) {
      // Give the printer time to physically finish rendering the last line(s)
      // before it receives the cut command — see PRINT_SETTLE_DELAY_MS above.
      await sleep(PRINT_SETTLE_DELAY_MS);
      await writeChunks(role, link, CUT_COMMAND);
    }
  };
  const run = printQueue.then(job, job);
  // The chain itself must never reject, or one failed print would poison every
  // print after it; the caller still sees the failure through `run`.
  printQueue = run.catch(() => undefined);
  return run;
}
