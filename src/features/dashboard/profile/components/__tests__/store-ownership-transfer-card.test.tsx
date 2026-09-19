import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: h.get, post: h.post, delete: h.del },
}));

import { StoreOwnershipTransferCard } from "../store-ownership-transfer-card";

function renderCard(props: { storeName?: string } = { storeName: "Kopi Kita" }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StoreOwnershipTransferCard storeId="store_1" storeName={props.storeName} />
    </QueryClientProvider>
  );
}

const emailInput = () => screen.getByLabelText("pages.storeTransferEmailLabel") as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  h.get.mockResolvedValue({ pending: null });
  h.post.mockResolvedValue({ sent: true });
  h.del.mockResolvedValue({ canceled: true });
});

describe("StoreOwnershipTransferCard — nothing pending", () => {
  it("is the target of the staff dialog's deep link (#transfer-ownership)", async () => {
    const { container } = renderCard();
    await screen.findByLabelText("pages.storeTransferEmailLabel");
    expect(container.querySelector("#transfer-ownership")).not.toBeNull();
    expect(h.get).toHaveBeenCalledWith("/stores/store_1/transfer-ownership");
  });

  it("keeps Send disabled until the email is valid, and says why while it isn't", async () => {
    renderCard();
    const send = (await screen.findByText("pages.storeTransferSend")).closest("button")!;
    expect(send).toBeDisabled();

    fireEvent.change(emailInput(), { target: { value: "not-an-email" } });
    expect(send).toBeDisabled();
    expect(screen.getByText("Invalid email format")).toBeInTheDocument();

    fireEvent.change(emailInput(), { target: { value: "new@owner.com" } });
    expect(send).not.toBeDisabled();
    expect(screen.queryByText("Invalid email format")).toBeNull();
  });

  it("strips whitespace as it's typed or pasted", async () => {
    renderCard();
    await screen.findByLabelText("pages.storeTransferEmailLabel");
    fireEvent.change(emailInput(), { target: { value: " new @owner.com " } });
    expect(emailInput().value).toBe("new@owner.com");
  });

  it("never sends straight from the form — it asks for confirmation first", async () => {
    renderCard();
    await screen.findByLabelText("pages.storeTransferEmailLabel");
    fireEvent.change(emailInput(), { target: { value: "new@owner.com" } });
    fireEvent.click(screen.getByText("pages.storeTransferSend"));

    expect(await screen.findByText("pages.storeTransferConfirmTitle")).toBeInTheDocument();
    expect(h.post).not.toHaveBeenCalled();
  });

  it("requires the store's exact name to be typed before the destructive confirm enables", async () => {
    renderCard();
    await screen.findByLabelText("pages.storeTransferEmailLabel");
    fireEvent.change(emailInput(), { target: { value: "new@owner.com" } });
    fireEvent.click(screen.getByText("pages.storeTransferSend"));

    const confirmInput = await screen.findByLabelText("pages.storeTransferConfirmLabel");
    // Two "send" buttons exist now (form + dialog); the dialog's is the last.
    const sendButtons = screen.getAllByText("pages.storeTransferSend");
    const confirmButton = sendButtons[sendButtons.length - 1].closest("button")!;
    expect(confirmButton).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: "kopi kita" } });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(confirmInput, { target: { value: "Kopi Kita" } });
    expect(confirmButton).not.toBeDisabled();
  });

  it("posts the normalized recipient once confirmed, then clears the form", async () => {
    renderCard();
    await screen.findByLabelText("pages.storeTransferEmailLabel");
    fireEvent.change(emailInput(), { target: { value: "New@Owner.COM" } });
    fireEvent.click(screen.getByText("pages.storeTransferSend"));
    fireEvent.change(await screen.findByLabelText("pages.storeTransferConfirmLabel"), {
      target: { value: "Kopi Kita" },
    });
    const sendButtons = screen.getAllByText("pages.storeTransferSend");
    fireEvent.click(sendButtons[sendButtons.length - 1]);

    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith("/stores/store_1/transfer-ownership", {
        toEmail: "new@owner.com",
      })
    );
    await waitFor(() => expect(screen.queryByText("pages.storeTransferConfirmTitle")).toBeNull());
    expect(emailInput().value).toBe("");
  });
});

describe("StoreOwnershipTransferCard — invite pending", () => {
  beforeEach(() => {
    h.get.mockResolvedValue({
      pending: { toEmail: "new@owner.com", expiresAt: "2026-09-26T00:00:00.000Z" },
    });
  });

  it("replaces the form with the pending invite and a cancel action", async () => {
    renderCard();
    expect(await screen.findByText("pages.storeTransferPending")).toBeInTheDocument();
    expect(screen.queryByLabelText("pages.storeTransferEmailLabel")).toBeNull();
  });

  it("cancels via DELETE", async () => {
    renderCard();
    fireEvent.click(await screen.findByText("pages.storeTransferCancel"));
    await waitFor(() => expect(h.del).toHaveBeenCalledWith("/stores/store_1/transfer-ownership"));
  });
});
