import type * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Locale } from "@/components/lang/i18n-provider";
import type { OnboardingCompleteResult, OnboardingState } from "@/lib/onboarding/contracts";
import {
  RENDER_TEST_TIMEOUT,
  installDomPolyfills,
  mockBrowserTimezone,
  renderIn,
} from "@/features/stores/shared/__tests__/helpers";
import { OnboardingContent } from "../onboarding-content";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const nav = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  },
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  useSearchParams: () => nav.searchParams,
  usePathname: () => "/onboarding",
  useParams: () => ({}),
}));

const analytics = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  trackConversion: vi.fn(),
  trackMetaPixelEvent: vi.fn(),
  trackPageView: vi.fn(),
}));
vi.mock("@/lib/analytics", () => analytics);

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

const gate = vi.hoisted(() => ({ requireFeature: vi.fn(() => false) }));
vi.mock("@/features/billing/upgrade/upgrade-modal", () => ({
  UpgradeGateProvider: ({ children }: { children: React.ReactNode }) => children,
  useUpgradeGate: () => ({
    currentPlan: "FREE",
    openUpgrade: vi.fn(),
    requireFeature: gate.requireFeature,
  }),
}));

vi.mock("@/features/dashboard/data/import", () => ({
  SmartImportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="smart-import" /> : null,
}));

vi.mock("@/components/shared/image-upload", () => ({
  ImageUpload: ({
    value,
    onChange,
    deletePrevious,
  }: {
    value?: string;
    onChange: (url?: string) => void;
    deletePrevious?: boolean;
  }) => (
    <div data-testid="logo-upload" data-delete-previous={String(deletePrevious ?? true)}>
      <span data-testid="logo-value">{value ?? ""}</span>
      <button
        type="button"
        onClick={() => onChange("https://abc.public.blob.vercel-storage.com/new.png")}
      >
        mock-upload-logo
      </button>
      <button type="button" onClick={() => onChange(undefined)}>
        mock-remove-logo
      </button>
    </div>
  ),
}));

vi.mock("@/components/lang/lang-switcher", () => ({ default: () => null }));

vi.mock("qrcode.react", () => ({
  // React 19 passes `ref` as a prop, so the launch screen's export canvas ref lands here.
  QRCodeCanvas: (props: {
    value: string;
    size: number;
    marginSize?: number;
    ref?: React.Ref<HTMLCanvasElement>;
    "data-testid"?: string;
  }) => (
    <canvas
      ref={props.ref}
      data-testid={props["data-testid"] ?? "qr"}
      data-value={props.value}
      data-size={props.size}
      data-margin={props.marginSize ?? 0}
    />
  ),
}));

const exporter = vi.hoisted(() => ({ downloadDataUrl: vi.fn() }));
vi.mock("@/lib/utils/export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/export")>()),
  downloadDataUrl: exporter.downloadDataUrl,
}));

const instagramPrefill = vi.hoisted(() => ({
  name: "Sunset Café",
  tagline: "Coffee & cake",
  slugCandidate: "sunset.cafe",
  instagramUrl: "https://instagram.com/sunset.cafe",
  whatsappNumber: "+62 812-3456-7890",
  themeColor: "#123456",
  logoUrl: "https://abc.public.blob.vercel-storage.com/ig-logo.png",
  bio: "Coffee & cake",
  category: "Cafe",
}));
vi.mock("../instagram-import-step", () => ({
  InstagramImportStep: ({
    onComplete,
    onCancel,
  }: {
    onComplete: (p: typeof instagramPrefill) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onComplete(instagramPrefill)}>
        mock-instagram-complete
      </button>
      <button type="button" onClick={onCancel}>
        mock-instagram-cancel
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures + fetch
// ---------------------------------------------------------------------------

const baseState = (over: Partial<OnboardingState> = {}): OnboardingState => ({
  step: 1,
  completed: false,
  storeId: null,
  business: null,
  storefront: null,
  currency: "EUR",
  menuItems: [],
  goals: [],
  ...over,
});

const savedStore = (over: Partial<OnboardingState> = {}): OnboardingState =>
  baseState({
    step: 2,
    storeId: "store_1",
    business: {
      name: "Le Petit Four",
      countryCode: "FR",
      city: "Lyon",
      businessType: "bakery",
      timezone: "Europe/Paris",
    },
    storefront: {
      slug: "le-petit-four",
      displayName: "Le Petit Four",
      tagline: null,
      logoUrl: null,
      themeColor: "#D9AE3B",
      instagramUrl: null,
      whatsappNumber: null,
      isPublished: false,
    },
    ...over,
  });

const completeResult: OnboardingCompleteResult = {
  storeId: "store_1",
  slug: "le-petit-four",
  publicUrl: "https://epidom.fr/@le-petit-four",
  goals: ["storefront", "counter"],
};

interface Reply {
  status: number;
  body: unknown;
}
type Route = (url: string, init?: RequestInit) => Reply;

const ok = (data: unknown): Reply => ({ status: 200, body: { success: true, data } });
const conflict = (reason: string, extra: Record<string, unknown> = {}): Reply => ({
  status: 409,
  body: {
    success: false,
    error: { code: "CONFLICT", message: "Conflict", details: { reason, ...extra } },
  },
});

let routes: Record<string, Route>;
let fetchMock: ReturnType<typeof vi.fn>;

function installFetch() {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const key = `${method} ${url.split("?")[0]}`;
    const route = routes[key];
    const reply: Reply = route
      ? route(url, init)
      : key === "GET /api/onboarding/slug-check"
        ? ok({
            slug: new URL(url, "http://x").searchParams.get("slug"),
            available: true,
            suggestion: null,
          })
        : { status: 404, body: { success: false, error: { code: "NOT_FOUND", message: key } } };
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      statusText: "",
      json: async () => reply.body,
    };
  });
  global.fetch = fetchMock as never;
}

const callsTo = (method: string, path: string) =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input).split("?")[0] === path && ((init as RequestInit)?.method ?? "GET") === method
  );
const bodyOf = (method: string, path: string, index = 0) =>
  JSON.parse(String((callsTo(method, path)[index][1] as RequestInit).body));

function renderWizard(state: OnboardingState, locale: Locale = "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return renderIn(
    locale,
    <QueryClientProvider client={client}>
      <OnboardingContent initialState={state} />
    </QueryClientProvider>
  );
}

const eventsNamed = (name: string) =>
  analytics.trackEvent.mock.calls.filter(([event]) => event === name).map(([, params]) => params);

/** Past the 400 ms slug-check debounce, with room for a loaded machine. */
const SLUG_WAIT = 4000;

beforeAll(installDomPolyfills);

beforeEach(() => {
  routes = {};
  installFetch();
  nav.searchParams = new URLSearchParams();
  window.scrollTo = vi.fn() as never;
  try {
    window.sessionStorage.clear();
  } catch {
    // ignore
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("<OnboardingContent> setup wizard", { timeout: RENDER_TEST_TIMEOUT }, () => {
  describe("resume", () => {
    it("opens at the server's step", () => {
      renderWizard(savedStore({ step: 3 }));
      expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "What do you want Epidom to help with?" })
      ).toBeInTheDocument();
      expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Your goals");
    });

    it("fires onboarding_step_viewed for the step shown", () => {
      renderWizard(savedStore({ step: 2 }));
      expect(eventsNamed("onboarding_step_viewed")).toEqual([
        expect.objectContaining({ step_number: 2, step_name: "storefront" }),
      ]);
    });
  });

  describe("step 1: Your store", () => {
    it("validates the name before saving", async () => {
      mockBrowserTimezone("Europe/Paris");
      renderWizard(baseState());
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      expect(await screen.findByText("Enter your store's name.")).toBeInTheDocument();
      expect(callsTo("POST", "/api/onboarding/store")).toHaveLength(0);
    });

    it("saves the essentials with the browser timezone, then shows step 2", async () => {
      mockBrowserTimezone("Europe/Paris");
      routes["POST /api/onboarding/store"] = () => ok(savedStore());
      renderWizard(baseState());

      const name = screen.getByLabelText(/Store name/);
      expect(name).toHaveFocus();
      await waitFor(() => expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("France"));
      fireEvent.change(name, { target: { value: "Le Petit Four" } });
      fireEvent.change(screen.getByPlaceholderText("e.g. Austin"), { target: { value: "Lyon" } });
      fireEvent.click(screen.getByRole("button", { name: "Bakery" }));
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

      expect(
        await screen.findByRole("heading", { name: "Make your storefront yours" })
      ).toBeInTheDocument();
      expect(bodyOf("POST", "/api/onboarding/store")).toEqual({
        name: "Le Petit Four",
        countryCode: "FR",
        city: "Lyon",
        businessType: "bakery",
        browserTimezone: "Europe/Paris",
      });
      const [, init] = callsTo("POST", "/api/onboarding/store")[0];
      expect(((init as RequestInit).headers as Record<string, string>)["x-epidom-locale"]).toBe(
        "en"
      );
      expect(eventsNamed("onboarding_step_completed")).toEqual([
        expect.objectContaining({ step_number: 1, step_name: "store", method: "manual" }),
      ]);
      expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    });

    it("previews the store link under the name as it is typed", async () => {
      mockBrowserTimezone("Europe/Paris");
      renderWizard(baseState());
      const link = screen.getByTestId("store-link");
      expect(link).toHaveTextContent("Your link appears as you type your store's name.");
      fireEvent.change(screen.getByLabelText(/Store name/), {
        target: { value: "Crêperie du Port" },
      });
      expect(link).toHaveTextContent("epidom.fr/@creperie-du-port");
    });

    it("checks an edited link and offers the free suggestion when it is taken", async () => {
      mockBrowserTimezone("Europe/Paris");
      routes["GET /api/onboarding/slug-check"] = (url) => {
        const slug = new URL(url, "http://x").searchParams.get("slug");
        return slug === "taken-link"
          ? ok({ slug, available: false, suggestion: "taken-link-2" })
          : ok({ slug, available: true, suggestion: null });
      };
      renderWizard(baseState());
      fireEvent.change(screen.getByLabelText(/Store name/), { target: { value: "Mon Café" } });
      fireEvent.click(screen.getByRole("button", { name: "Edit link" }));

      const input = screen.getByRole("textbox", { name: "Store link" });
      expect(input).toHaveValue("mon-cafe");
      expect(input).toHaveFocus();

      fireEvent.change(input, { target: { value: "ab" } });
      expect(
        await screen.findByText(
          "Use 3 to 50 lowercase letters, numbers or dashes.",
          {},
          { timeout: SLUG_WAIT }
        )
      ).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "Taken Link" } });
      expect(input).toHaveValue("taken-link");
      expect(screen.getByText("Checking…")).toBeInTheDocument();
      expect(
        await screen.findByText("This link is already taken.", {}, { timeout: SLUG_WAIT })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Use taken-link-2" }));
      expect(input).toHaveValue("taken-link-2");
      expect(
        await screen.findByText("This link is available.", {}, { timeout: SLUG_WAIT })
      ).toBeInTheDocument();
      expect(
        callsTo("GET", "/api/onboarding/slug-check").map(([url]) =>
          new URL(String(url), "http://x").searchParams.get("slug")
        )
      ).toEqual(expect.arrayContaining(["taken-link", "taken-link-2"]));
    });

    it("shows the server's suggestion when the link is taken on save (409)", async () => {
      mockBrowserTimezone("Europe/Paris");
      routes["POST /api/onboarding/store"] = () =>
        conflict("slug_taken", { slug: "mon-cafe", suggestion: "mon-cafe-7" });
      renderWizard(baseState());
      await waitFor(() => expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("France"));
      fireEvent.change(screen.getByLabelText(/Store name/), { target: { value: "Mon Café" } });
      fireEvent.click(screen.getByRole("button", { name: "Edit link" }));
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

      // The link check is debounced (400 ms) before the taken state shows.
      expect(
        await screen.findByRole("button", { name: "Use mon-cafe-7" }, { timeout: SLUG_WAIT })
      ).toBeInTheDocument();
      expect(screen.getByText("This link is already taken.")).toBeInTheDocument();
      expect(bodyOf("POST", "/api/onboarding/store")).toMatchObject({ slug: "mon-cafe" });
      expect(toasts.error).toHaveBeenCalledWith("Someone just took this link. Pick another one.");
      expect(screen.getByRole("heading", { name: "Tell us about your store" })).toBeInTheDocument();
    });

    it("sends what Fill from Instagram found with the step", async () => {
      mockBrowserTimezone("Europe/Paris");
      routes["POST /api/onboarding/store"] = () => ok(savedStore());
      renderWizard(baseState());
      await waitFor(() => expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("France"));

      fireEvent.click(screen.getByRole("button", { name: "Fill from Instagram" }));
      fireEvent.click(await screen.findByRole("button", { name: "mock-instagram-complete" }));

      await waitFor(() => expect(screen.getByLabelText(/Store name/)).toHaveValue("Sunset Café"));
      expect(screen.getByRole("textbox", { name: "Store link" })).toHaveValue("sunset-cafe");
      expect(screen.getByRole("status")).toHaveTextContent("Filled from your Instagram");

      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      await screen.findByRole("heading", { name: "Make your storefront yours" });
      expect(bodyOf("POST", "/api/onboarding/store")).toEqual({
        name: "Sunset Café",
        countryCode: "FR",
        browserTimezone: "Europe/Paris",
        slug: "sunset-cafe",
        tagline: "Coffee & cake",
        logoUrl: "https://abc.public.blob.vercel-storage.com/ig-logo.png",
        themeColor: "#123456",
        instagramUrl: "https://instagram.com/sunset.cafe",
        whatsappNumber: "+6281234567890",
      });
      expect(eventsNamed("onboarding_step_completed")[0]).toMatchObject({ method: "instagram" });
    });

    it("Use my store name swaps a saved custom link for the name's, and asks the server for it", async () => {
      mockBrowserTimezone("Europe/Paris");
      routes["POST /api/onboarding/store"] = () => ok(savedStore());
      renderWizard(
        savedStore({ step: 1, storefront: { ...savedStore().storefront!, slug: "lpf-paris" } })
      );

      expect(screen.getByRole("textbox", { name: "Store link" })).toHaveValue("lpf-paris");
      fireEvent.click(screen.getByRole("button", { name: "Use my store name" }));
      expect(screen.getByTestId("store-link")).toHaveTextContent("epidom.fr/@le-petit-four");

      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      await screen.findByRole("heading", { name: "Make your storefront yours" });
      const body = bodyOf("POST", "/api/onboarding/store");
      expect(body).toMatchObject({ name: "Le Petit Four", slugFromName: true });
      expect(body).not.toHaveProperty("slug");
    });

    it("an unchanged saved custom link is kept (nothing asked of the server)", async () => {
      mockBrowserTimezone("Europe/Paris");
      routes["POST /api/onboarding/store"] = () => ok(savedStore());
      renderWizard(
        savedStore({ step: 1, storefront: { ...savedStore().storefront!, slug: "lpf-paris" } })
      );
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      await screen.findByRole("heading", { name: "Make your storefront yours" });
      const body = bodyOf("POST", "/api/onboarding/store");
      expect(body).toMatchObject({ slug: "lpf-paris" });
      expect(body).not.toHaveProperty("slugFromName");
    });

    it("goes to /stores when setup was already completed elsewhere", async () => {
      mockBrowserTimezone("Europe/Paris");
      routes["POST /api/onboarding/store"] = () => conflict("already_completed");
      renderWizard(baseState());
      await waitFor(() => expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("France"));
      fireEvent.change(screen.getByLabelText(/Store name/), { target: { value: "Mon Café" } });
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/stores"));
    });
  });

  describe("step 2: Your storefront", () => {
    it("saves logo, colour, tagline and the named dishes, then shows step 3", async () => {
      routes["POST /api/onboarding/storefront"] = () => ok(savedStore({ step: 3 }));
      renderWizard(savedStore());

      expect(screen.getByPlaceholderText("Cappuccino")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "mock-upload-logo" }));
      fireEvent.click(screen.getByRole("radio", { name: "Ocean" }));
      fireEvent.change(screen.getByPlaceholderText("e.g. Fresh bread every morning"), {
        target: { value: "Fresh bread every morning" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: "Dish 1 name" }), {
        target: { value: "Croissant" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: "Dish 1 price" }), {
        target: { value: "1.5" },
      });

      const preview = screen.getByTestId("storefront-preview-compact");
      expect(preview).toHaveTextContent("Le Petit Four");
      expect(preview).toHaveTextContent("Croissant");
      expect(preview).toHaveTextContent("€1.50");

      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      expect(
        await screen.findByRole("heading", { name: "What do you want Epidom to help with?" })
      ).toBeInTheDocument();
      expect(bodyOf("POST", "/api/onboarding/storefront")).toEqual({
        logoUrl: "https://abc.public.blob.vercel-storage.com/new.png",
        themeColor: "#1C7ED6",
        tagline: "Fresh bread every morning",
        menuItems: [{ name: "Croissant", price: 1.5 }],
      });
      expect(eventsNamed("onboarding_step_completed")).toEqual([
        expect.objectContaining({ step_number: 2, method: "saved", items_count: 1 }),
      ]);
    });

    it("pre-fills a resumed step and sends the saved item ids back", async () => {
      routes["POST /api/onboarding/storefront"] = () => ok(savedStore({ step: 3 }));
      renderWizard(
        savedStore({
          currency: "IDR",
          menuItems: [{ id: "item_1", name: "Nasi goreng", price: 25000 }],
        })
      );
      expect(screen.getByRole("textbox", { name: "Dish 1 name" })).toHaveValue("Nasi goreng");
      expect(screen.getByRole("textbox", { name: "Dish 2 price" })).toHaveAttribute(
        "placeholder",
        "18,000"
      );
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      await screen.findByRole("heading", { name: "What do you want Epidom to help with?" });
      expect(bodyOf("POST", "/api/onboarding/storefront").menuItems).toEqual([
        { id: "item_1", name: "Nasi goreng", price: 25000 },
      ]);
    });

    it("needs a price for a named dish", async () => {
      renderWizard(savedStore());
      fireEvent.change(screen.getByRole("textbox", { name: "Dish 2 name" }), {
        target: { value: "Café crème" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      expect(await screen.findByText("Add a price for this dish.")).toBeInTheDocument();
      expect(callsTo("POST", "/api/onboarding/storefront")).toHaveLength(0);
    });

    it("Skip for now still saves the step", async () => {
      routes["POST /api/onboarding/storefront"] = () => ok(savedStore({ step: 3 }));
      renderWizard(savedStore());
      fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
      await screen.findByRole("heading", { name: "What do you want Epidom to help with?" });
      expect(bodyOf("POST", "/api/onboarding/storefront")).toEqual({});
      expect(eventsNamed("onboarding_step_completed")).toEqual([
        expect.objectContaining({ step_number: 2, method: "skipped", items_count: 0 }),
      ]);
    });

    it("Back returns to step 1 with the saved details", async () => {
      renderWizard(savedStore());
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      const heading = await screen.findByRole("heading", { name: "Tell us about your store" });
      expect(heading).toHaveFocus();
      expect(screen.getByLabelText(/Store name/)).toHaveValue("Le Petit Four");
      expect(screen.getByTestId("store-link")).toHaveTextContent("epidom.fr/@le-petit-four");
      expect(callsTo("POST", "/api/onboarding/storefront")).toHaveLength(0);
    });

    it("Back to step 1 and on again keeps what was typed here but not saved", async () => {
      mockBrowserTimezone("Europe/Paris");
      routes["POST /api/onboarding/store"] = () => ok(savedStore());
      renderWizard(savedStore());

      fireEvent.click(screen.getByRole("button", { name: "mock-upload-logo" }));
      fireEvent.click(screen.getByRole("radio", { name: "Ocean" }));
      fireEvent.change(screen.getByPlaceholderText("e.g. Fresh bread every morning"), {
        target: { value: "Fresh bread" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: "Dish 1 name" }), {
        target: { value: "Croissant" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: "Dish 1 price" }), {
        target: { value: "1.5" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      await screen.findByRole("heading", { name: "Tell us about your store" });
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      await screen.findByRole("heading", { name: "Make your storefront yours" });

      expect(callsTo("POST", "/api/onboarding/storefront")).toHaveLength(0);
      expect(screen.getByTestId("logo-value")).toHaveTextContent(
        "https://abc.public.blob.vercel-storage.com/new.png"
      );
      expect(screen.getByRole("radio", { name: "Ocean" })).toBeChecked();
      expect(screen.getByPlaceholderText("e.g. Fresh bread every morning")).toHaveValue(
        "Fresh bread"
      );
      expect(screen.getByRole("textbox", { name: "Dish 1 name" })).toHaveValue("Croissant");
      expect(screen.getByRole("textbox", { name: "Dish 1 price" })).toHaveValue("1.5");
    });

    it("drops a drafted price when step 1 changed the currency, keeping the dish", async () => {
      mockBrowserTimezone("Europe/Paris");
      routes["POST /api/onboarding/store"] = () => ok(savedStore({ currency: "IDR" }));
      renderWizard(savedStore());
      fireEvent.change(screen.getByRole("textbox", { name: "Dish 1 name" }), {
        target: { value: "Croissant" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: "Dish 1 price" }), {
        target: { value: "4.5" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      await screen.findByRole("heading", { name: "Tell us about your store" });
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      await screen.findByRole("heading", { name: "Make your storefront yours" });

      expect(screen.getByRole("textbox", { name: "Dish 1 name" })).toHaveValue("Croissant");
      expect(screen.getByRole("textbox", { name: "Dish 1 price" })).toHaveValue("");
    });

    it("clearing a saved dish row removes that item on Continue", async () => {
      routes["POST /api/onboarding/storefront"] = () => ok(savedStore({ step: 3 }));
      renderWizard(
        savedStore({
          menuItems: [
            { id: "item_1", name: "Croissant", price: 1.5 },
            { id: "item_2", name: "Jus d'orange", price: 4 },
          ],
        })
      );
      fireEvent.change(screen.getByRole("textbox", { name: "Dish 2 name" }), {
        target: { value: "" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: "Dish 2 price" }), {
        target: { value: "" },
      });
      expect(screen.getByTestId("storefront-preview-compact")).not.toHaveTextContent(
        "Jus d'orange"
      );

      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      await screen.findByRole("heading", { name: "What do you want Epidom to help with?" });
      expect(bodyOf("POST", "/api/onboarding/storefront")).toMatchObject({
        menuItems: [{ id: "item_1", name: "Croissant", price: 1.5 }],
        removedItemIds: ["item_2"],
      });
    });

    it("reads a rupiah price typed as '25.000' as 25000, not 25", async () => {
      routes["POST /api/onboarding/storefront"] = () => ok(savedStore({ step: 3 }));
      renderWizard(savedStore({ currency: "IDR" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Dish 1 name" }), {
        target: { value: "Nasi goreng" },
      });
      const price = screen.getByRole("textbox", { name: "Dish 1 price" });
      for (const text of ["2", "25", "25.", "25.0", "25.00", "25.000"]) {
        fireEvent.change(price, { target: { value: text } });
      }
      expect(price).toHaveValue("25.000");

      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      await screen.findByRole("heading", { name: "What do you want Epidom to help with?" });
      expect(bodyOf("POST", "/api/onboarding/storefront").menuItems).toEqual([
        { name: "Nasi goreng", price: 25000 },
      ]);
    });

    it("the logo uploader never deletes the saved file itself (Skip and Back save nothing)", () => {
      renderWizard(
        savedStore({
          storefront: {
            ...savedStore().storefront!,
            logoUrl: "https://abc.public.blob.vercel-storage.com/users/u1/images/ig.png",
          },
        })
      );
      expect(screen.getByTestId("logo-upload")).toHaveAttribute("data-delete-previous", "false");
    });

    it("a returning owner (setup already complete) gets no Back to step 1 once the store exists", async () => {
      mockBrowserTimezone("Europe/Paris");
      routes["POST /api/onboarding/store"] = () => ok(savedStore({ step: 1, completed: true }));
      renderWizard(
        baseState({
          business: {
            name: "Le Petit Four",
            countryCode: "FR",
            city: "Lyon",
            businessType: "bakery",
            timezone: "Europe/Paris",
          },
        })
      );
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
      await screen.findByRole("heading", { name: "Make your storefront yours" });

      expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Skip for now" })).toBeInTheDocument();
    });

    it("gates the spreadsheet import to POS", () => {
      renderWizard(savedStore());
      fireEvent.click(screen.getByRole("button", { name: "Import from a spreadsheet" }));
      expect(gate.requireFeature).toHaveBeenCalledWith(
        "POS",
        "Importing your existing menu is a POS feature."
      );
      expect(screen.queryByTestId("smart-import")).not.toBeInTheDocument();
    });

    it("goes back to step 1 when the server says step 1 isn't saved", async () => {
      routes["POST /api/onboarding/storefront"] = () => conflict("step_order");
      renderWizard(savedStore());
      fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
      expect(
        await screen.findByRole("heading", { name: "Tell us about your store" })
      ).toBeInTheDocument();
      expect(toasts.error).toHaveBeenCalledWith("Let's finish the first step first.");
    });
  });

  describe("step 3 and the launch screen", () => {
    it("publishes with the picked goals, then shows the launch screen", async () => {
      routes["POST /api/onboarding/complete"] = () => ok(completeResult);
      renderWizard(savedStore({ step: 3 }));

      fireEvent.click(screen.getByRole("checkbox", { name: /Take orders at the counter/ }));
      fireEvent.click(screen.getByRole("checkbox", { name: /Share my menu online/ }));
      expect(screen.getByText("14-day free trial on the POS plan")).toBeInTheDocument();
      expect(screen.getByText("Operations")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Publish my store/ }));

      expect(await screen.findByRole("heading", { name: "Your store is live" })).toHaveFocus();
      expect(bodyOf("POST", "/api/onboarding/complete")).toEqual({
        goals: ["storefront", "counter"],
      });
      expect(analytics.trackConversion).toHaveBeenCalledWith(
        "onboarding_completed",
        expect.objectContaining({ goals: "storefront,counter", goals_count: 2 })
      );

      expect(screen.getByTestId("launch-public-url")).toHaveTextContent(
        "https://epidom.fr/@le-petit-four"
      );
      expect(screen.getByTestId("qr")).toHaveAttribute(
        "data-value",
        "https://epidom.fr/@le-petit-four"
      );
      const whatsapp = screen.getByRole("link", { name: /Share on WhatsApp/ });
      expect(whatsapp.getAttribute("href")).toBe(
        `https://wa.me/?text=${encodeURIComponent(
          "Le Petit Four is now online! See our menu: https://epidom.fr/@le-petit-four"
        )}`
      );
      expect(screen.getByRole("link", { name: /Open my store/ })).toHaveAttribute(
        "href",
        "https://epidom.fr/@le-petit-four"
      );
      expect(screen.getByRole("link", { name: /Take the 1-minute tour/ })).toHaveAttribute(
        "href",
        "/store/store_1/dashboard?tour=1"
      );
      expect(screen.getByRole("link", { name: /Go to my Back Office/ })).toHaveAttribute(
        "href",
        "/store/store_1/dashboard"
      );
      const trial = screen.getByTestId("launch-pos-trial");
      expect(within(trial).getByRole("link", { name: "Start my free trial" })).toHaveAttribute(
        "href",
        "/pricing?trial=true#plans"
      );
      expect(screen.queryByText(/Step \d of 3/)).not.toBeInTheDocument();
    });

    it("publishes with no goals, and no trial offer", async () => {
      routes["POST /api/onboarding/complete"] = () => ok({ ...completeResult, goals: [] });
      renderWizard(savedStore({ step: 3 }));
      fireEvent.click(screen.getByRole("button", { name: /Publish my store/ }));
      await screen.findByRole("heading", { name: "Your store is live" });
      expect(bodyOf("POST", "/api/onboarding/complete")).toEqual({ goals: [] });
      expect(screen.queryByTestId("launch-pos-trial")).not.toBeInTheDocument();
    });

    it("pre-selects saved goals and Back returns to step 2", async () => {
      renderWizard(savedStore({ step: 3, goals: ["operations"] }));
      expect(screen.getByRole("checkbox", { name: /Run stock and staff/ })).toBeChecked();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(
        await screen.findByRole("heading", { name: "Make your storefront yours" })
      ).toBeInTheDocument();
    });

    it("downloads a print-ready QR code: 4-module quiet zone, 1024 px", async () => {
      vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (
        this: HTMLCanvasElement
      ) {
        const { testid, margin, size } = this.dataset;
        return `data:image/png;base64,${testid}-${margin}-${size}`;
      });
      routes["POST /api/onboarding/complete"] = () => ok(completeResult);
      renderWizard(savedStore({ step: 3 }));
      fireEvent.click(screen.getByRole("button", { name: /Publish my store/ }));
      await screen.findByRole("heading", { name: "Your store is live" });
      expect(screen.queryByTestId("launch-qr-export")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Download QR code/ }));

      await waitFor(() =>
        expect(exporter.downloadDataUrl).toHaveBeenCalledWith(
          "data:image/png;base64,launch-qr-export-4-1024",
          "le-petit-four-qr.png"
        )
      );
      expect(exporter.downloadDataUrl).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByTestId("launch-qr-export")).not.toBeInTheDocument());
    });

    it("asks the goals question in natural French", () => {
      renderWizard(savedStore({ step: 3 }), "fr");
      expect(
        screen.getByRole("heading", { name: "En quoi Epidom peut-il vous aider ?" })
      ).toBeInTheDocument();
    });

    it("copies the public link", async () => {
      const writeText = vi.fn(async () => undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      routes["POST /api/onboarding/complete"] = () => ok(completeResult);
      renderWizard(savedStore({ step: 3 }));
      fireEvent.click(screen.getByRole("button", { name: /Publish my store/ }));
      await screen.findByRole("heading", { name: "Your store is live" });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Copy/ }));
      });
      expect(writeText).toHaveBeenCalledWith("https://epidom.fr/@le-petit-four");
      expect(toasts.success).toHaveBeenCalledWith("Link copied");
    });
  });

  describe("landing params", () => {
    it("tracks a confirmed email once and strips the flag", async () => {
      mockBrowserTimezone("Europe/Paris");
      nav.searchParams = new URLSearchParams("verified=1");
      const first = renderWizard(baseState());
      await waitFor(() =>
        expect(nav.router.replace).toHaveBeenCalledWith("/onboarding", { scroll: false })
      );
      expect(eventsNamed("email_verified")).toHaveLength(1);
      first.unmount();

      renderWizard(baseState());
      await waitFor(() => expect(nav.router.replace).toHaveBeenCalledTimes(2));
      expect(eventsNamed("email_verified")).toHaveLength(1);
    });

    it("explains a bad verification link instead of tracking it", async () => {
      mockBrowserTimezone("Europe/Paris");
      nav.searchParams = new URLSearchParams("verified=1&error=TOKEN_EXPIRED&ref=mail");
      renderWizard(baseState(), "fr");
      expect(
        await screen.findByText("Ce lien de vérification n'a pas fonctionné")
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Aller à la connexion" })).toHaveAttribute(
        "href",
        "/login"
      );
      expect(eventsNamed("email_verified")).toHaveLength(0);
      expect(nav.router.replace).toHaveBeenCalledWith("/onboarding?ref=mail", { scroll: false });

      fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
      expect(
        screen.queryByText("Ce lien de vérification n'a pas fonctionné")
      ).not.toBeInTheDocument();
    });

    it("fires the Google sign_up conversion for a brand-new account only", async () => {
      mockBrowserTimezone("Europe/Paris");
      nav.searchParams = new URLSearchParams("signup=google");
      const view = renderWizard(baseState());
      await waitFor(() =>
        expect(analytics.trackConversion).toHaveBeenCalledWith(
          "sign_up",
          expect.objectContaining({ method: "google" })
        )
      );
      expect(nav.router.replace).toHaveBeenCalledWith("/onboarding", { scroll: false });
      view.unmount();

      analytics.trackConversion.mockClear();
      window.sessionStorage.clear();
      renderWizard(savedStore());
      await waitFor(() => expect(nav.router.replace).toHaveBeenCalledTimes(2));
      expect(analytics.trackConversion).not.toHaveBeenCalledWith("sign_up", expect.anything());
    });
  });
});
