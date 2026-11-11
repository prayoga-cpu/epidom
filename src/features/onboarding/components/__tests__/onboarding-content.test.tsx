import type * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Locale } from "@/components/lang/i18n-provider";
import type {
  OnboardingBilling,
  OnboardingCompleteResult,
  OnboardingState,
} from "@/lib/onboarding/contracts";
import type { PlanIntent } from "../../lib/plan-intent";
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
  goals: [],
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

/** A new account: on Free, never subscribed, so a POS Checkout is the trial. */
const FREE_NEW: OnboardingBilling = {
  canCheckout: true,
  posTrialEligible: true,
  paidPlan: null,
  referral: null,
};

function renderWizard(
  state: OnboardingState,
  locale: Locale = "en",
  {
    billing = FREE_NEW,
    planIntent = null,
  }: { billing?: OnboardingBilling; planIntent?: PlanIntent | null } = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return renderIn(
    locale,
    <QueryClientProvider client={client}>
      <OnboardingContent
        initialState={state}
        billing={billing}
        planIntent={planIntent}
        user={{ name: "Sam Rivera", email: "sam@example.com" }}
      />
    </QueryClientProvider>
  );
}

const STRIPE_URL = "https://checkout.stripe.test/c/cs_1";
const checkoutOk = (): Reply => ({
  status: 201,
  body: { success: true, data: { sessionId: "cs_1", url: STRIPE_URL } },
});
// A first POS subscription: the trial starts on the server with no card, and
// the answer is the success page, not Stripe.
const TRIAL_URL = "http://localhost/checkout/success?plan=POS&trial=true&session_id=sub_trial_1";
const trialOk = (): Reply => ({
  status: 201,
  body: { success: true, data: { url: TRIAL_URL, trialStarted: true } },
});

const eventsNamed = (name: string) =>
  analytics.trackEvent.mock.calls.filter(([event]) => event === name).map(([, params]) => params);

/** Past the 400 ms slug-check debounce, with room for a loaded machine. */
const SLUG_WAIT = 4000;

beforeAll(installDomPolyfills);

const realLocation = window.location;
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // jsdom can't navigate: a plain object records where Checkout would go.
  assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { href: "http://localhost/onboarding", assign },
  });
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
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: realLocation,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const withItems = (over: Partial<OnboardingState> = {}) =>
  savedStore({
    menuItems: [
      { id: "m1", name: "Butter croissant", price: 9.5 },
      { id: "m2", name: "Sourdough loaf", price: 4.5 },
      { id: "m3", name: "Chocolate muffin", price: 3 },
    ],
    ...over,
  });

/** The mocked API of a store being set up: step 1 saves it empty, step 2 adds the examples. */
function routeSetup() {
  // Like the server: once the examples are saved, saving the store again returns them.
  routes["POST /api/onboarding/store"] = () =>
    ok(callsTo("POST", "/api/onboarding/storefront").length > 0 ? withItems() : savedStore());
  routes["POST /api/onboarding/storefront"] = () => ok(withItems());
  routes["POST /api/onboarding/complete"] = () => ok(completeResult);
  routes["POST /api/subscriptions/activate-free"] = () => ok({});
}

const heading = (name: string | RegExp) => screen.findByRole("heading", { name });
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

/** The plan screen is the first screen; Continue goes on to the name. */
async function answerPlan() {
  press("Continue");
  await heading("What's your store called?");
}

/** Plan → name → kind of place. */
async function answerName(name = "Le Petit Four") {
  await answerPlan();
  fireEvent.change(screen.getByLabelText("What's your store called?"), { target: { value: name } });
  press("Continue");
  await heading("What kind of place is it?");
}

/** Plan, name and kind of place answered; the store is set up and the draft is on screen. */
async function toDraft() {
  await answerName();
  press("Continue");
  await heading(DRAFT);
}

async function claim(code: string) {
  fireEvent.change(screen.getByLabelText(/Partner code/), {
    target: { value: code },
  });
  press("Claim");
}

/** The draft: everything on one screen. */
const DRAFT = "Here's your store, ready to go";
const LAUNCH = "Looks good, launch my store";

describe("<OnboardingContent> one screen at a time", { timeout: RENDER_TEST_TIMEOUT }, () => {
  describe("plan and referral: the first screen", () => {
    it("greets the owner and offers POS and Operations, the free trial already picked", () => {
      renderWizard(baseState());
      expect(screen.getByRole("heading", { name: "Welcome, Sam!" })).toBeInTheDocument();
      expect(screen.getByText("Registered as sam@example.com")).toBeInTheDocument();
      expect(screen.getByTestId("plan-pos-select")).toHaveAttribute("aria-checked", "true");
      expect(screen.getByTestId("plan-pos-select")).toHaveTextContent("Start free trial");
      expect(screen.getByTestId("plan-operations-select")).toHaveAttribute("aria-checked", "false");
      expect(screen.getByText("14-day free trial")).toBeInTheDocument();
      // The referral code sits on the same screen, under the cards.
      expect(screen.getByLabelText(/Partner code/)).toBeInTheDocument();
      expect(screen.queryByLabelText("What's your store called?")).toBeNull();
    });

    it("leaves out the trial when it was already used", () => {
      renderWizard(baseState(), "en", {
        billing: { canCheckout: true, posTrialEligible: false, paidPlan: null, referral: null },
      });
      expect(screen.queryByTestId("trial-toggle")).toBeNull();
      expect(screen.queryByText("14-day free trial")).toBeNull();
      expect(screen.getByTestId("plan-pos-select")).toHaveTextContent("Choose POS");
      expect(screen.getByTestId("plan-pos-select")).toHaveAttribute("aria-checked", "true");
    });

    it("an Operations link from the pricing page starts on Operations, billed yearly", () => {
      renderWizard(baseState(), "en", { planIntent: { plan: "OPERATIONS", yearly: true } });
      expect(screen.getByTestId("plan-operations-select")).toHaveAttribute("aria-checked", "true");
      expect(screen.getByTestId("interval-yearly")).toHaveAttribute("aria-pressed", "true");
    });

    it("a yearly POS link from the pricing page starts on paid yearly POS, not the trial", () => {
      renderWizard(baseState(), "en", { planIntent: { plan: "POS", yearly: true } });
      expect(screen.getByTestId("plan-pos-select")).toHaveTextContent("Choose POS");
      expect(screen.getByTestId("interval-yearly")).toHaveAttribute("aria-pressed", "true");
    });

    it("the home page's trial button keeps the free trial picked", () => {
      renderWizard(baseState(), "en", { planIntent: { plan: "POS", yearly: false } });
      expect(screen.getByTestId("plan-pos-select")).toHaveTextContent("Start free trial");
    });

    it("the free trial shows FREE with the price crossed out in red and no card needed", () => {
      renderWizard(baseState());
      fireEvent.change(screen.getByTestId("plan-currency"), { target: { value: "USD" } });
      expect(screen.getByTestId("plan-pos-price")).toHaveTextContent("Free");
      expect(screen.getByTestId("plan-pos-was")).toHaveClass("text-red-500");
      expect(screen.getByTestId("plan-pos-was")).toHaveTextContent("$14.99");
      expect(screen.getByTestId("plan-pos-nocard")).toHaveTextContent("No card needed");
    });

    it("skipping the trial shows the real price, and the yearly toggle changes it", () => {
      renderWizard(baseState());
      fireEvent.change(screen.getByTestId("plan-currency"), { target: { value: "USD" } });
      fireEvent.click(screen.getByTestId("interval-yearly"));
      // The trial stays picked, and the crossed-out price is the yearly one: that is the discount.
      expect(screen.getByTestId("plan-pos-select")).toHaveTextContent("Start free trial");
      expect(screen.getByTestId("plan-pos-price")).toHaveTextContent("Free");
      expect(screen.getByTestId("plan-pos-was")).toHaveTextContent("$12.49");
      expect(screen.getByTestId("plan-pos-save")).toHaveTextContent("Save");
      press("Skip the trial and pay now");
      expect(screen.getByTestId("plan-pos-select")).toHaveTextContent("Choose POS");
      expect(screen.getByTestId("plan-pos-price")).toHaveTextContent("$12.49");
      expect(screen.queryByTestId("plan-pos-nocard")).toBeNull();
      press("Start with the free trial instead");
      expect(screen.getByTestId("plan-pos-price")).toHaveTextContent("Free");
    });

    it("shows who referred you and the new prices as soon as a code is claimed", async () => {
      routes["GET /api/onboarding/referral-code"] = () =>
        ok({ code: "BOB10", displayName: "Bob", discountPercent: 10 });
      renderWizard(baseState());
      press("Skip the trial and pay now");
      expect(screen.queryByTestId("plan-pos-deal")).toBeNull();
      await claim("bob10");
      expect(await screen.findByTestId("referral-discount")).toHaveTextContent(
        "Bob's code: 10% off your first payment."
      );
      expect(screen.getByTestId("plan-pos-deal")).toBeInTheDocument();
      expect(screen.getByTestId("plan-operations-deal")).toBeInTheDocument();
      press("Remove");
      expect(screen.queryByTestId("plan-pos-deal")).toBeNull();
    });

    it("says so for an unknown code and gives no discount", async () => {
      routes["GET /api/onboarding/referral-code"] = () => ({
        status: 404,
        body: { success: false, error: { code: "NOT_FOUND", message: "no" } },
      });
      renderWizard(baseState());
      await claim("NOPE");
      expect(await screen.findByText(/we can't use this code/i)).toBeInTheDocument();
      expect(screen.queryByTestId("plan-pos-deal")).toBeNull();
    });

    it("Enter in the code box claims it and doesn't leave the screen", async () => {
      routes["GET /api/onboarding/referral-code"] = () =>
        ok({ code: "BOB10", displayName: "Bob", discountPercent: 10 });
      renderWizard(baseState());
      const input = screen.getByLabelText(/Partner code/);
      fireEvent.change(input, { target: { value: "BOB10" } });
      fireEvent.keyDown(input, { key: "Enter" });
      await screen.findByTestId("referral-discount");
      expect(screen.getByRole("heading", { name: "Welcome, Sam!" })).toBeInTheDocument();
    });

    it("an account that signed up with a partner link has the code filled in, locked, and the discount on", async () => {
      renderWizard(baseState(), "en", {
        billing: {
          canCheckout: true,
          posTrialEligible: true,
          paidPlan: null,
          referral: { code: "DINDA", displayName: "Dinda", discountPercent: 10 },
        },
      });
      const input = screen.getByLabelText(/Partner code/);
      expect(input).toHaveValue("DINDA");
      expect(input).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Claim" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
      expect(screen.getByTestId("referral-credited")).toHaveTextContent("referred by Dinda");
      press("Skip the trial and pay now");
      expect(screen.getByTestId("plan-pos-deal")).toHaveTextContent("-10%");
      expect(screen.getByTestId("plan-operations-deal")).toHaveTextContent("-10%");
    });

    it("back from payment: the first screen shows the paid plan, and Continue goes on with setup", async () => {
      renderWizard(baseState(), "en", {
        billing: {
          canCheckout: false,
          posTrialEligible: false,
          paidPlan: "OPERATIONS",
          referral: null,
        },
      });
      expect(screen.getByRole("heading", { name: "Welcome, Sam!" })).toBeInTheDocument();
      expect(screen.getByText(/Payment received/)).toBeInTheDocument();
      expect(screen.getByTestId("plan-operations-paid")).toHaveTextContent("Paid");
      expect(screen.getByTestId("plan-operations-select")).toBeDisabled();
      expect(screen.getByTestId("plan-operations-select")).toHaveAttribute("aria-checked", "true");
      // The other card is out of the way, and there is nothing to claim or skip the trial for.
      expect(screen.getByTestId("plan-pos-select")).toBeDisabled();
      expect(screen.queryByTestId("trial-toggle")).toBeNull();
      expect(screen.queryByLabelText(/Partner code/)).toBeNull();
      press("Continue");
      await heading("What's your store called?");
      expect(callsTo("POST", "/api/subscriptions/checkout")).toHaveLength(0);
    });

    it("skips to the Free plan from the very first screen, saving nothing", async () => {
      routeSetup();
      renderWizard(baseState());
      press("Skip setup, stay on Free");
      await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/stores"));
      expect(callsTo("POST", "/api/subscriptions/activate-free")).toHaveLength(1);
      expect(callsTo("POST", "/api/onboarding/store")).toHaveLength(0);
    });
  });

  describe("the store questions", () => {
    it("asks one thing at a time: the kind of place only after the name", async () => {
      renderWizard(baseState());
      await answerPlan();
      expect(screen.queryByRole("combobox")).toBeNull();
      fireEvent.change(screen.getByLabelText("What's your store called?"), {
        target: { value: "Le Petit Four" },
      });
      press("Continue");
      await heading("What kind of place is it?");
      expect(screen.queryByLabelText("What's your store called?")).toBeNull();
      expect(
        screen.getByRole("combobox", { name: "What kind of place is it?" })
      ).toBeInTheDocument();
    });

    it("shows the detected market under the name", async () => {
      // The market comes from the device time zone; pin it so a UTC runner
      // (CI) detects a country like a laptop in Paris or Jakarta does.
      mockBrowserTimezone("Europe/Paris");
      renderWizard(baseState());
      await answerPlan();
      expect(screen.getByTestId("detected-market")).toBeInTheDocument();
    });

    it("needs a store name, and saves nothing while the questions are answered", async () => {
      renderWizard(baseState());
      await answerPlan();
      press("Continue");
      expect(await screen.findByRole("alert")).toHaveTextContent("Enter your store's name.");
      expect(callsTo("POST", "/api/onboarding/store")).toHaveLength(0);
    });

    it("Back returns to the plan screen with the pick kept", async () => {
      renderWizard(baseState());
      fireEvent.change(screen.getByTestId("plan-currency"), { target: { value: "USD" } });
      await answerPlan();
      press("Back");
      await heading("Welcome, Sam!");
      expect(screen.getByTestId("plan-currency")).toHaveValue("USD");
      expect(screen.getByTestId("plan-pos-select")).toHaveAttribute("aria-checked", "true");
    });

    it("skipping on the kind of place keeps the store and its draft for one Confirm later", async () => {
      routeSetup();
      renderWizard(baseState());
      await answerName();
      press("Skip setup");
      await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/stores"));
      expect(callsTo("POST", "/api/onboarding/store")).toHaveLength(1);
      expect(callsTo("POST", "/api/onboarding/storefront")).toHaveLength(1);
      expect(callsTo("POST", "/api/subscriptions/activate-free")).toHaveLength(1);
      expect(callsTo("POST", "/api/onboarding/complete")).toHaveLength(0);
    });
  });

  describe("the draft and the launch", () => {
    it("sets the store up and shows it all on one screen: link on top, preview, details", async () => {
      routeSetup();
      mockBrowserTimezone("Europe/Paris");
      renderWizard(baseState());
      await toDraft();

      expect(bodyOf("POST", "/api/onboarding/store")).toMatchObject({
        name: "Le Petit Four",
        countryCode: "FR",
      });
      const storefront = bodyOf("POST", "/api/onboarding/storefront");
      expect(storefront.themeColor).toMatch(/^#[0-9A-F]{6}$/);
      expect(storefront.menuItems).toHaveLength(3);

      expect(screen.getByTestId("draft-link")).toHaveTextContent("le-petit-four");
      expect(screen.getAllByText("Butter croissant").length).toBeGreaterThan(0);
      expect(screen.getByTestId("draft-plan")).toHaveTextContent("14-day free trial");
      expect(screen.getByTestId("market-note")).toHaveTextContent(
        "You can change the currency, payments and time zone later in Settings."
      );
      // The dishes are edited from the card's pencil, not shown as fields up front.
      expect(screen.queryByLabelText("Item name 1")).toBeNull();
      press("Edit menu items");
      expect(screen.getByLabelText("Item name 1")).toHaveValue("Butter croissant");
      expect(screen.getByRole("button", { name: LAUNCH })).toBeEnabled();
    });

    it("Enter in a dish field doesn't launch the store", async () => {
      routeSetup();
      renderWizard(baseState());
      await toDraft();
      press("Edit menu items");
      fireEvent.keyDown(screen.getByLabelText("Item name 1"), { key: "Enter" });
      await new Promise((r) => setTimeout(r, 20));
      expect(callsTo("POST", "/api/onboarding/complete")).toHaveLength(0);
    });

    it("a link changed with the pencil is saved with the launch", async () => {
      routeSetup();
      routes["POST /api/subscriptions/checkout"] = trialOk;
      renderWizard(baseState());
      await toDraft();
      press("Edit link");
      fireEvent.change(screen.getByLabelText("Store link"), { target: { value: "chez-sam" } });
      await waitFor(() => expect(screen.getByRole("button", { name: LAUNCH })).toBeEnabled(), {
        timeout: SLUG_WAIT,
      });
      press(LAUNCH);
      await heading("Your store is live");
      const stores = callsTo("POST", "/api/onboarding/store");
      expect(bodyOf("POST", "/api/onboarding/store", stores.length - 1)).toMatchObject({
        slug: "chez-sam",
      });
    });

    it("creates the store with the link claimed on the home page, read once", async () => {
      window.localStorage.setItem(
        "epidom:claimed-link",
        JSON.stringify({ slug: "my-claimed-cafe", at: Date.now() })
      );
      routeSetup();
      renderWizard(baseState());
      await toDraft();
      expect(bodyOf("POST", "/api/onboarding/store", 0)).toMatchObject({ slug: "my-claimed-cafe" });
      // Taken from storage: a later visit starts clean.
      expect(window.localStorage.getItem("epidom:claimed-link")).toBeNull();
    });

    it("Change on the draft returns to the plan screen and comes straight back, edits kept", async () => {
      routeSetup();
      renderWizard(baseState());
      await toDraft();
      press("Edit menu items");
      fireEvent.change(screen.getByLabelText("Item name 1"), { target: { value: "Pain perdu" } });

      // The plan row's Change (the market has one too).
      const changes = screen.getAllByRole("button", { name: "Change" });
      fireEvent.click(changes[changes.length - 1]);
      await heading("Welcome, Sam!");
      press("Continue");
      await heading(DRAFT);
      press(LAUNCH);
      await heading("Your store is live");
      const saved = bodyOf("POST", "/api/onboarding/storefront", 1);
      expect(saved.menuItems[0]).toMatchObject({ id: "m1", name: "Pain perdu" });
    });

    it("phones: tapping a card opens its details; Choose selects it and closes, the red X just closes", async () => {
      renderWizard(baseState());
      fireEvent.click(screen.getByTestId("plan-operations-open"));
      const sheet = await screen.findByTestId("plan-operations-sheet");
      expect(sheet).toHaveTextContent("Stock, recipes and suppliers");
      // No second card frame around it: the dialog itself has no border or background.
      expect(screen.getByRole("dialog")).toHaveClass("border-0", "bg-transparent");
      fireEvent.click(screen.getByTestId("plan-operations-select-sheet"));
      await waitFor(() => expect(screen.queryByTestId("plan-operations-sheet")).toBeNull());
      expect(screen.getByTestId("plan-operations-select")).toHaveAttribute("aria-checked", "true");

      fireEvent.click(screen.getByTestId("plan-pos-open"));
      await screen.findByTestId("plan-pos-sheet");
      fireEvent.click(screen.getByTestId("plan-sheet-close"));
      await waitFor(() => expect(screen.queryByTestId("plan-pos-sheet")).toBeNull());
      // Closing changed nothing.
      expect(screen.getByTestId("plan-operations-select")).toHaveAttribute("aria-checked", "true");
    });

    it("the card that is picked takes the gold highlight", () => {
      renderWizard(baseState());
      expect(screen.getByTestId("plan-pos")).toHaveClass("border-[var(--epi-gold-500)]");
      fireEvent.click(screen.getByTestId("plan-operations-select"));
      expect(screen.getByTestId("plan-operations")).toHaveClass("border-[var(--epi-gold-500)]");
      expect(screen.getByTestId("plan-pos")).not.toHaveClass("border-[var(--epi-gold-500)]");
    });

    it("the currency can be changed: prices and the payment follow it", async () => {
      routes["POST /api/subscriptions/checkout"] = checkoutOk;
      // Pinned so the default currency is EUR everywhere; on a UTC runner (CI)
      // nothing is detected, the default is USD, and "change to USD" is a no-op.
      mockBrowserTimezone("Europe/Paris");
      renderWizard(baseState());
      press("Skip the trial and pay now");
      const before = screen.getByTestId("plan-pos-price").textContent;
      fireEvent.change(screen.getByTestId("plan-currency"), { target: { value: "USD" } });
      expect(screen.getByTestId("plan-currency")).toHaveValue("USD");
      expect(screen.getByTestId("plan-pos-price").textContent).not.toBe(before);
      expect(screen.getByTestId("plan-pos-price")).toHaveTextContent("$14.99");
      press("Continue to payment");
      await waitFor(() => expect(assign).toHaveBeenCalledWith(STRIPE_URL));
      expect(bodyOf("POST", "/api/subscriptions/checkout")).toMatchObject({ currency: "USD" });
    });

    it("a discount shows the old price crossed out in red, the new one, and a -10% label", async () => {
      routes["GET /api/onboarding/referral-code"] = () =>
        ok({ code: "BOB10", displayName: "Bob", discountPercent: 10 });
      renderWizard(baseState());
      fireEvent.change(screen.getByTestId("plan-currency"), { target: { value: "EUR" } });
      press("Skip the trial and pay now");
      await claim("BOB10");
      const deal = await screen.findByTestId("plan-pos-deal");
      expect(deal.querySelector("s")).toHaveTextContent("€13.99");
      expect(deal.querySelector("s")).toHaveClass("text-red-500");
      expect(deal).toHaveTextContent("-10%");
      expect(screen.getByTestId("plan-pos-price")).toHaveTextContent("€12.59");
    });

    it("a paid pick pays on Stripe first: the code is credited, the trial is skipped, nothing is set up yet", async () => {
      routes["GET /api/onboarding/referral-code"] = () =>
        ok({ code: "BOB10", displayName: "Bob", discountPercent: 10 });
      routes["POST /api/onboarding/referral-code"] = () => ok({ credited: true });
      routes["POST /api/subscriptions/checkout"] = checkoutOk;
      renderWizard(baseState());
      await claim("BOB10");
      await screen.findByTestId("referral-discount");
      fireEvent.click(screen.getByTestId("plan-operations-select"));
      press("Continue to payment");
      await waitFor(() => expect(assign).toHaveBeenCalledWith(STRIPE_URL));
      expect(bodyOf("POST", "/api/onboarding/referral-code")).toEqual({ code: "BOB10" });
      expect(bodyOf("POST", "/api/subscriptions/checkout")).toMatchObject({
        plan: "OPERATIONS",
        yearly: false,
        next: "/onboarding",
        skipTrial: true,
      });
      expect(callsTo("POST", "/api/onboarding/store")).toHaveLength(0);
    });

    it("confirm publishes with the claimed code and starts the trial", async () => {
      routeSetup();
      routes["GET /api/onboarding/referral-code"] = () =>
        ok({ code: "BOB10", displayName: "Bob", discountPercent: 10 });
      routes["POST /api/subscriptions/checkout"] = trialOk;
      renderWizard(baseState());
      await claim("BOB10");
      await screen.findByTestId("referral-discount");
      await toDraft();
      press(LAUNCH);

      await heading("Your store is live");
      expect(bodyOf("POST", "/api/onboarding/complete")).toEqual({ referralCode: "BOB10" });
      await waitFor(() => expect(assign).toHaveBeenCalledWith(TRIAL_URL));
      expect(bodyOf("POST", "/api/subscriptions/checkout")).toMatchObject({
        plan: "POS",
        yearly: false,
      });
    });

    it("a yearly free trial is started yearly: billed yearly after the 14 days", async () => {
      routeSetup();
      routes["POST /api/subscriptions/checkout"] = trialOk;
      renderWizard(baseState());
      fireEvent.click(screen.getByTestId("interval-yearly"));
      await toDraft();
      expect(screen.getByTestId("draft-plan")).toHaveTextContent("then yearly");
      press(LAUNCH);
      await heading("Your store is live");
      await waitFor(() => expect(assign).toHaveBeenCalledWith(TRIAL_URL));
      expect(bodyOf("POST", "/api/subscriptions/checkout")).toMatchObject({
        plan: "POS",
        yearly: true,
      });
    });

    it("a yearly pick pays on Stripe right from the plan screen", async () => {
      routes["POST /api/subscriptions/checkout"] = checkoutOk;
      renderWizard(baseState());
      fireEvent.click(screen.getByTestId("interval-yearly"));
      press("Skip the trial and pay now");
      press("Continue to payment");
      await waitFor(() => expect(assign).toHaveBeenCalledWith(STRIPE_URL));
      expect(bodyOf("POST", "/api/subscriptions/checkout")).toMatchObject({
        plan: "POS",
        yearly: true,
        skipTrial: true,
      });
    });

    it("an Operations yearly pick goes to the Operations payment", async () => {
      routes["POST /api/subscriptions/checkout"] = checkoutOk;
      renderWizard(baseState());
      fireEvent.click(screen.getByTestId("interval-yearly"));
      fireEvent.click(screen.getByTestId("plan-operations-select"));
      press("Continue to payment");
      await waitFor(() => expect(assign).toHaveBeenCalledWith(STRIPE_URL));
      expect(bodyOf("POST", "/api/subscriptions/checkout")).toMatchObject({
        plan: "OPERATIONS",
        yearly: true,
      });
    });

    it("a failed payment start stays on the plan screen with a message", async () => {
      routes["POST /api/subscriptions/checkout"] = () => ({
        status: 500,
        body: { success: false, error: { code: "INTERNAL_ERROR", message: "x" } },
      });
      renderWizard(baseState());
      fireEvent.click(screen.getByTestId("plan-operations-select"));
      press("Continue to payment");
      await waitFor(() => expect(toasts.error).toHaveBeenCalled());
      expect(screen.getByRole("heading", { name: "Welcome, Sam!" })).toBeInTheDocument();
    });

    it("a skipped setup resumes on the draft: one Confirm starts the trial", async () => {
      routes["POST /api/onboarding/storefront"] = () => ok(withItems());
      routes["POST /api/onboarding/complete"] = () => ok(completeResult);
      routes["POST /api/subscriptions/checkout"] = trialOk;
      renderWizard(withItems());
      expect(screen.getByRole("heading", { name: DRAFT })).toBeInTheDocument();
      press(LAUNCH);
      await heading("Your store is live");
      await waitFor(() => expect(assign).toHaveBeenCalledWith(TRIAL_URL));
    });

    it("an account already on a plan has no plan screen: it starts at the name", async () => {
      routeSetup();
      renderWizard(baseState(), "en", {
        billing: { canCheckout: false, posTrialEligible: false, paidPlan: null, referral: null },
      });
      expect(screen.getByRole("heading", { name: "Welcome, Sam!" })).toBeInTheDocument();
      expect(screen.queryByTestId("plan-pos")).toBeNull();
      fireEvent.change(screen.getByLabelText("What's your store called?"), {
        target: { value: "Le Petit Four" },
      });
      press("Continue");
      await heading("What kind of place is it?");
      press("Continue");
      await heading(DRAFT);
      expect(screen.queryByTestId("draft-plan")).toBeNull();
    });
  });

  it("is available in French", () => {
    renderWizard(baseState(), "fr");
    expect(screen.getByRole("heading", { name: "Bienvenue, Sam\u00a0!" })).toBeInTheDocument();
  });
});
