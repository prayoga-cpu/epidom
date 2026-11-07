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
const FREE_NEW: OnboardingBilling = { canCheckout: true, posTrialEligible: true, referral: null };

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

/** Question 1 → question 2. */
async function answerName(name = "Le Petit Four") {
  fireEvent.change(screen.getByLabelText("What's your store called?"), { target: { value: name } });
  press("Continue");
  await heading("What kind of place is it?");
}

/** Questions 1-2 → the plan question. */
async function toPlan() {
  await answerName();
  press("Continue");
  await heading("How do you want to start?");
}

/** Through the plan question → the referral question. */
async function toReferral() {
  await toPlan();
  press("Continue");
  await heading("Have a partner referral code?");
}

async function claim(code: string) {
  fireEvent.change(screen.getByLabelText(/Have a partner referral code/), {
    target: { value: code },
  });
  press("Claim");
}

/** The draft: everything on one screen. */
const DRAFT = "Here's your store, ready to go";
const LAUNCH = "Looks good, launch my store";

describe("<OnboardingContent> one question at a time", { timeout: RENDER_TEST_TIMEOUT }, () => {
  describe("the store questions", () => {
    it("greets the owner by first name and shows the registered email", () => {
      renderWizard(baseState());
      expect(screen.getByRole("heading", { name: "Welcome, Sam!" })).toBeInTheDocument();
      expect(screen.getByText("Registered as sam@example.com")).toBeInTheDocument();
      expect(screen.getByTestId("detected-market")).toBeInTheDocument();
    });

    it("hides the stay-on-Free sentence on phones (the Skip setup link says it)", () => {
      renderWizard(baseState());
      const skip = screen.getByText("Skip it and you stay on the Free plan.");
      expect(skip).toHaveClass("hidden", "sm:inline");
      expect(
        screen.getByText(/Finish setup and your 14-day POS trial starts automatically/)
      ).toBeVisible();
    });

    it("asks one thing at a time: the kind of place only after the name", async () => {
      renderWizard(baseState());
      expect(screen.queryByRole("combobox")).toBeNull();
      await answerName();
      expect(screen.queryByLabelText("What's your store called?")).toBeNull();
      expect(
        screen.getByRole("combobox", { name: "What kind of place is it?" })
      ).toBeInTheDocument();
    });

    it("needs a store name, and saves nothing while the questions are answered", async () => {
      renderWizard(baseState());
      press("Continue");
      expect(await screen.findByRole("alert")).toHaveTextContent("Enter your store's name.");
      await toPlan();
      expect(callsTo("POST", "/api/onboarding/store")).toHaveLength(0);
    });

    it("Back returns to the name with the answer kept", async () => {
      renderWizard(baseState());
      await answerName("Chez Sam");
      press("Back");
      await heading("Welcome, Sam!");
      expect(screen.getByLabelText("What's your store called?")).toHaveValue("Chez Sam");
    });

    it("skips to the Free plan from the very first question", async () => {
      routeSetup();
      renderWizard(baseState());
      press("Skip setup");
      await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/stores"));
      expect(callsTo("POST", "/api/subscriptions/activate-free")).toHaveLength(1);
      expect(callsTo("POST", "/api/onboarding/store")).toHaveLength(0);
    });
  });

  describe("plan and referral", () => {
    it("starts with the 14-day POS trial picked", async () => {
      renderWizard(baseState());
      await toPlan();
      expect(screen.getByTestId("plan-trial")).toHaveAttribute("aria-checked", "true");
      expect(screen.getByTestId("plan-monthly")).toHaveAttribute("aria-checked", "false");
      expect(screen.getByTestId("plan-yearly")).toBeInTheDocument();
      // The referral code is its own question, after this one.
      expect(screen.queryByLabelText(/Have a partner referral code/)).toBeNull();
    });

    it("leaves out the trial when it was already used", async () => {
      renderWizard(baseState(), "en", {
        billing: { canCheckout: true, posTrialEligible: false, referral: null },
      });
      await toPlan();
      expect(screen.queryByTestId("plan-trial")).toBeNull();
      expect(screen.getByTestId("plan-monthly")).toHaveAttribute("aria-checked", "true");
    });

    it("shows the discount as soon as a code is claimed, and on the plan cards after it", async () => {
      routes["GET /api/onboarding/referral-code"] = () =>
        ok({ code: "BOB10", displayName: "Bob", discountPercent: 10 });
      renderWizard(baseState());
      await toReferral();
      expect(screen.queryByTestId("referral-price")).toBeNull();
      await claim("bob10");
      expect(await screen.findByTestId("referral-discount")).toHaveTextContent(
        "Bob's code: 10% off your first payment."
      );
      expect(screen.getByTestId("referral-price")).toHaveTextContent("on your first payment");

      press("Back");
      await heading("How do you want to start?");
      expect(screen.getByTestId("plan-trial-deal")).toBeInTheDocument();
      expect(screen.getByTestId("plan-monthly-deal")).toBeInTheDocument();
    });

    it("says so for an unknown code and gives no discount", async () => {
      routes["GET /api/onboarding/referral-code"] = () => ({
        status: 404,
        body: { success: false, error: { code: "NOT_FOUND", message: "no" } },
      });
      renderWizard(baseState());
      await toReferral();
      await claim("NOPE");
      expect(await screen.findByText(/We don't know this code/)).toBeInTheDocument();
      expect(screen.queryByTestId("referral-price")).toBeNull();
    });

    it("skipping keeps the Free plan but saves the store and its draft, so one Confirm is left", async () => {
      routeSetup();
      renderWizard(baseState());
      await toPlan();
      press("Skip setup, stay on Free");
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
      await toReferral();
      press("I don't have a code");
      await heading(DRAFT);

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
      await toReferral();
      press("I don't have a code");
      await heading(DRAFT);
      press("Edit menu items");
      fireEvent.keyDown(screen.getByLabelText("Item name 1"), { key: "Enter" });
      await new Promise((r) => setTimeout(r, 20));
      expect(callsTo("POST", "/api/onboarding/complete")).toHaveLength(0);
    });

    it("a link changed with the pencil is saved with the launch", async () => {
      routeSetup();
      routes["POST /api/subscriptions/checkout"] = trialOk;
      renderWizard(baseState());
      await toReferral();
      press("I don't have a code");
      await heading(DRAFT);
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

    it("keeps a renamed dish when going back to the plan and on again", async () => {
      routeSetup();
      renderWizard(baseState());
      await toReferral();
      press("I don't have a code");
      await heading(DRAFT);
      press("Edit menu items");
      fireEvent.change(screen.getByLabelText("Item name 1"), { target: { value: "Pain perdu" } });

      // The plan row's Change (the market has one too).
      const changes = screen.getAllByRole("button", { name: "Change" });
      fireEvent.click(changes[changes.length - 1]);
      await heading("How do you want to start?");
      fireEvent.click(screen.getByTestId("plan-monthly"));
      press("Continue");
      await heading("Have a partner referral code?");
      press("I don't have a code");
      await heading(DRAFT);
      expect(screen.getByTestId("draft-plan")).toHaveTextContent("billed monthly");
      press(LAUNCH);
      await heading("Your store is live");
      const saved = bodyOf("POST", "/api/onboarding/storefront", 1);
      expect(saved.menuItems[0]).toMatchObject({ id: "m1", name: "Pain perdu" });
    });

    it("confirm publishes with the claimed code and starts the trial", async () => {
      routeSetup();
      routes["GET /api/onboarding/referral-code"] = () =>
        ok({ code: "BOB10", displayName: "Bob", discountPercent: 10 });
      routes["POST /api/subscriptions/checkout"] = trialOk;
      renderWizard(baseState());
      await toReferral();
      await claim("BOB10");
      await screen.findByTestId("referral-discount");
      press("Continue");
      await heading(DRAFT);
      press(LAUNCH);

      await heading("Your store is live");
      expect(bodyOf("POST", "/api/onboarding/complete")).toEqual({ referralCode: "BOB10" });
      await waitFor(() => expect(assign).toHaveBeenCalledWith(TRIAL_URL));
      expect(bodyOf("POST", "/api/subscriptions/checkout")).toMatchObject({
        plan: "POS",
        yearly: false,
      });
    });

    it("a yearly pick goes on to the paid Checkout, not the trial", async () => {
      routeSetup();
      routes["POST /api/subscriptions/checkout"] = checkoutOk;
      renderWizard(baseState());
      await toPlan();
      fireEvent.click(screen.getByTestId("plan-yearly"));
      press("Continue");
      await heading("Have a partner referral code?");
      press("I don't have a code");
      await heading(DRAFT);
      press(LAUNCH);
      await waitFor(() => expect(assign).toHaveBeenCalledWith(STRIPE_URL));
      expect(bodyOf("POST", "/api/subscriptions/checkout")).toMatchObject({
        plan: "POS",
        yearly: true,
      });
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

    it("an account already on a plan has no plan questions", async () => {
      routeSetup();
      renderWizard(baseState(), "en", {
        billing: { canCheckout: false, posTrialEligible: false, referral: null },
      });
      await answerName();
      press("Continue");
      await heading(DRAFT);
      expect(screen.queryByTestId("plan-trial")).toBeNull();
      expect(screen.queryByTestId("draft-plan")).toBeNull();
    });
  });

  it("is available in French", () => {
    renderWizard(baseState(), "fr");
    expect(screen.getByRole("heading", { name: "Bienvenue, Sam\u00a0!" })).toBeInTheDocument();
  });
});
