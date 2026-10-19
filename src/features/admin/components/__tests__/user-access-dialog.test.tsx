import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { UserAccessDialog, type AccessUser } from "../user-access-dialog";
import { NewPartnerDialog } from "@/features/admin/partners/components/partners-admin";

const calls: { url: string; method: string; body: unknown }[] = [];
function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      const json = url.startsWith("/api/admin/partners/candidates")
        ? { users: [{ id: "u2", name: "Aaron Vichard", email: "aaron@x.com", business: "Aaron" }] }
        : url === "/api/admin/partners"
          ? {
              partners: [
                {
                  id: "p_bob",
                  displayName: "Bob",
                  salesPages: [{ page: "sales-page-1", creditFrom: "" }],
                },
              ],
            }
          : { ok: true };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(json) } as Response);
    })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const evan: AccessUser = {
  id: "u_evan",
  name: "Evan Cao",
  email: "ecao.inquiries@gmail.com",
  isAdmin: false,
  adminSections: [],
  partner: null,
  partnerViews: [],
};

describe("Access dialog", () => {
  it("one dialog: admin pages, referral partner (opens the deal next) and saves only what changed", async () => {
    const onMakePartner = vi.fn();
    wrap(
      <UserAccessDialog
        user={evan}
        isSelf={false}
        onOpenChange={() => {}}
        onMakePartner={onMakePartner}
      />
    );
    expect(screen.getByText("Full admin")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Sales Pages/));
    fireEvent.click(screen.getByText("Referral partner"));
    fireEvent.click(screen.getByRole("button", { name: "Save and set the deal" }));
    await waitFor(() => expect(onMakePartner).toHaveBeenCalledWith(evan));
    const patches = calls.filter((c) => c.url === "/api/admin/users");
    expect(patches).toEqual([
      {
        url: "/api/admin/users",
        method: "PATCH",
        body: { action: "set-admin-sections", userId: "u_evan", sections: ["sales-pages"] },
      },
    ]);
  });

  it("an existing partner links to their page instead of the checkbox", () => {
    wrap(
      <UserAccessDialog
        user={{ ...evan, partner: { id: "p_e", referralCode: "EVAN", status: "ACTIVE" } }}
        isSelf={false}
        onOpenChange={() => {}}
        onMakePartner={() => {}}
      />
    );
    expect(screen.getByRole("link", { name: /Open/ }).getAttribute("href")).toBe(
      "/admin/partners/p_e"
    );
  });
});

describe("New referral partner dialog", () => {
  it("picks a user from the list (no email to type) and fills the name", async () => {
    wrap(<NewPartnerDialog open onOpenChange={() => {}} />);
    expect(screen.getByText("From the users list")).toBeTruthy();
    expect(screen.getByText("Invite by email")).toBeTruthy();
    fireEvent.click(await screen.findByText("Aaron Vichard"));
    expect((screen.getByPlaceholderText("Bob") as HTMLInputElement).value).toBe("Aaron");
    // The code follows the name.
    expect((screen.getByPlaceholderText("BOB") as HTMLInputElement).value).toBe("AARON");
  });

  it("opened from a user's Access: that user is already picked", () => {
    wrap(
      <NewPartnerDialog
        open
        onOpenChange={() => {}}
        initialUser={{
          id: "u_evan",
          name: "Evan Cao",
          email: "ecao.inquiries@gmail.com",
          business: "Le Comptoir",
        }}
      />
    );
    expect(screen.queryByText("Invite by email")).toBeNull();
    expect(screen.getByText(/ecao.inquiries@gmail.com/)).toBeTruthy();
  });
});
