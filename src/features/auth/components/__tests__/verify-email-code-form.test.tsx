import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  verifyEmail: vi.fn(),
  assign: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { emailOtp: { verifyEmail: h.verifyEmail } },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: h.toastSuccess } }));

import { VerifyEmailCodeForm } from "../verify-email-code-form";

const LANDING = "/onboarding?verified=1";

beforeEach(() => {
  h.verifyEmail.mockReset();
  h.assign.mockReset();
  h.toastSuccess.mockReset();
  vi.stubGlobal("location", { ...window.location, assign: h.assign });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function codeInput() {
  return screen.getByLabelText("auth.verifyEmail.codeLabel");
}

async function submitCode(typed: string) {
  fireEvent.change(codeInput(), { target: { value: typed } });
  fireEvent.click(screen.getByRole("button", { name: "auth.verifyEmail.codeSubmit" }));
}

describe("VerifyEmailCodeForm", () => {
  it("checks the code for the known address, then lands where the link would", async () => {
    h.verifyEmail.mockResolvedValue({ data: { status: true }, error: null });
    render(<VerifyEmailCodeForm email="ana@example.com" callbackURL={LANDING} />);

    // A pasted "123 456" keeps its digits.
    await submitCode("123 456");

    await waitFor(() =>
      expect(h.verifyEmail).toHaveBeenCalledWith({ email: "ana@example.com", otp: "123456" })
    );
    await waitFor(() => expect(h.assign).toHaveBeenCalledWith(LANDING));
    expect(h.toastSuccess).toHaveBeenCalledWith("auth.verifyEmail.codeSuccess");
    // The address is known, so it is not asked for.
    expect(screen.queryByLabelText("auth.email")).toBeNull();
  });

  it("asks for the address when the page doesn't know it (another tab or device)", async () => {
    h.verifyEmail.mockResolvedValue({ data: { status: true }, error: null });
    render(<VerifyEmailCodeForm email={null} callbackURL={LANDING} />);

    fireEvent.change(screen.getByLabelText("auth.email"), {
      target: { value: "dendi@example.com" },
    });
    await submitCode("042917");

    await waitFor(() =>
      expect(h.verifyEmail).toHaveBeenCalledWith({ email: "dendi@example.com", otp: "042917" })
    );
  });

  it("does not call the server until all 6 digits are in", async () => {
    render(<VerifyEmailCodeForm email="ana@example.com" callbackURL={LANDING} />);

    await submitCode("1234");

    expect(await screen.findByText("auth.verifyEmail.codeFormat")).toBeTruthy();
    expect(h.verifyEmail).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "INVALID_OTP", status: 400 }, "auth.verifyEmail.codeInvalid"],
    [{ code: "OTP_EXPIRED", status: 400 }, "auth.verifyEmail.codeExpired"],
    [{ code: "TOO_MANY_ATTEMPTS", status: 403 }, "auth.verifyEmail.codeTooManyAttempts"],
    [{ status: 429 }, "auth.verifyEmail.codeRateLimited"],
    [{ code: "SOMETHING_ELSE", status: 500 }, "auth.verifyEmail.codeError"],
  ])("explains a refused code (%o) and stays on the page", async (error, message) => {
    h.verifyEmail.mockResolvedValue({ data: null, error });
    render(<VerifyEmailCodeForm email="ana@example.com" callbackURL={LANDING} />);

    await submitCode("123456");

    expect(await screen.findByText(message)).toBeTruthy();
    expect(h.assign).not.toHaveBeenCalled();
  });
});
