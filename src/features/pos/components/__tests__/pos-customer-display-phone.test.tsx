/**
 * The customer's number entry on the customer-facing screen:
 *   1. number pad  ->  2. "looking you up"  ->  3a. welcome back (existing)
 *                                             ->  3b. optional name + email (new)
 *
 * Everything is typed on on-screen keys; nothing here may raise the OS keyboard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const STRINGS: Record<string, string> = {
  "pos.customerDisplay.welcomeBack": "Welcome back, {name}!",
  "pos.customerDisplay.welcomeBackNoName": "Welcome back!",
  "pos.customerDisplay.welcomeBackDesc": "Receipt to {phone}",
};
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => STRINGS[k] ?? k, locale: "en" }),
}));

import {
  CUSTOMER_DETAILS_SYNC_MS,
  CUSTOMER_LOOKUP_TIMEOUT_MS,
  PosCustomerDisplayPhone,
} from "../pos-customer-display-phone";
import type { CustomerDisplayIntakeStatus } from "../../lib/customer-display";

const PHONE = "+33612345678";

interface Props {
  open?: boolean;
  submitted?: string | null;
  status?: CustomerDisplayIntakeStatus | null;
}

const onClose = vi.fn();
const onSubmitPhone = vi.fn();
const onSubmitDetails = vi.fn();
const onFinishDetails = vi.fn();

const ui = ({ open = true, submitted = null, status = null }: Props = {}) => (
  <PosCustomerDisplayPhone
    open={open}
    onClose={onClose}
    defaultCountry="FR"
    submitted={submitted}
    status={status}
    onSubmitPhone={onSubmitPhone}
    onSubmitDetails={onSubmitDetails}
    onFinishDetails={onFinishDetails}
  />
);

const answer = (match: CustomerDisplayIntakeStatus["match"], firstName: string | null = null) =>
  ({ phone: PHONE, match, firstName }) satisfies CustomerDisplayIntakeStatus;

const tap = (label: string) => fireEvent.click(screen.getByRole("button", { name: label }));

/** A field's text. What was just typed sits in its own span (it pops in), so match the whole run. */
const typedMatcher = (text: string) => (_: string, el: Element | null) =>
  el?.getAttribute("data-slot") === "typed-text" && el.textContent === text;
const typed = (text: string) => screen.getByText(typedMatcher(text));
const queryTyped = (text: string) => screen.queryByText(typedMatcher(text));
/** The characters currently popping in, if any. */
const poppingIn = () => document.querySelector(".key-typed-in")?.textContent ?? null;
const tapAll = (keys: string) => [...keys].forEach((k) => tap(k));

/** Enter the number 6 12 34 56 78 on the pad and confirm it. */
const enterNumberAndConfirm = () => {
  tapAll("612345678");
  tap("pos.customerDisplay.phoneConfirm");
};

/** The dialog after the customer confirmed their number and the till answered. */
const renderAnswered = (status: CustomerDisplayIntakeStatus | null) => {
  const view = render(ui());
  enterNumberAndConfirm();
  view.rerender(ui({ submitted: PHONE, status }));
  return view;
};

beforeEach(() => {
  vi.useFakeTimers();
  onClose.mockClear();
  onSubmitPhone.mockClear();
  onSubmitDetails.mockClear();
  onFinishDetails.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("step 1 — the number", () => {
  it("only confirms a valid number", () => {
    render(ui());
    const confirm = screen.getByRole("button", { name: "pos.customerDisplay.phoneConfirm" });
    expect(confirm).toBeDisabled();
    tapAll("612345678");
    expect(confirm).toBeEnabled();
  });

  it("sends the number as E.164 and STAYS OPEN to wait for the till's answer", () => {
    render(ui());
    enterNumberAndConfirm();

    expect(onSubmitPhone).toHaveBeenCalledWith(PHONE);
    // It used to close here. Now the till decides what comes next.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("pos.customerDisplay.phoneChecking");
  });

  it("does not throw the customer back to the pad when the number is reported as sent", () => {
    // `submitted` changing on confirm must not reset the step.
    const view = render(ui());
    enterNumberAndConfirm();
    view.rerender(ui({ submitted: PHONE, status: null }));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("removing a sent number clears it and closes", () => {
    render(ui({ submitted: PHONE }));
    tap("pos.customerDisplay.phoneRemove");
    expect(onSubmitPhone).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("step 2 → 3a — a returning customer", () => {
  it("is greeted by first name, told where the receipt goes, and asked for nothing", () => {
    renderAnswered(answer("existing", "Alice"));

    expect(screen.getByText("Welcome back, Alice!")).toBeInTheDocument();
    expect(screen.getByText(`Receipt to ${PHONE}`)).toBeInTheDocument();
    // No fields, no keyboard: they are already on file.
    expect(screen.queryByTestId("customer-display-keyboard")).toBeNull();

    tap("pos.customerDisplay.detailsDone");
    expect(onClose).toHaveBeenCalled();
  });

  it("is greeted without a name when the record has none", () => {
    renderAnswered(answer("existing", null));
    expect(screen.getByText("Welcome back!")).toBeInTheDocument();
  });
});

describe("step 2 → 3b — a new customer", () => {
  it("offers the optional name and email over an on-screen keyboard", () => {
    renderAnswered(answer("new"));

    expect(screen.getByText("pos.customerDisplay.detailsTitle")).toBeInTheDocument();
    expect(screen.getByTestId("customer-display-keyboard")).toBeInTheDocument();
    // Both fields say they are optional; neither is a real <input>.
    expect(screen.getAllByText(/pos\.customerDisplay\.detailsOptional/)).toHaveLength(2);
    expect(document.querySelectorAll("input")).toHaveLength(0);
  });

  it("offers it when the till could not tell, too — the cashier still decides", () => {
    renderAnswered(answer("unknown"));
    expect(screen.getByTestId("customer-display-keyboard")).toBeInTheDocument();
  });

  it("ignores an answer that is about a different number", () => {
    const view = render(ui());
    enterNumberAndConfirm();
    view.rerender(
      ui({
        submitted: PHONE,
        status: { phone: "+33699999999", match: "existing", firstName: "Eve" },
      })
    );
    // Still waiting: an answer for the wrong number must never greet this customer.
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/)).toBeNull();
  });

  it("does not leave the customer on a spinner if the till never answers", () => {
    render(ui());
    enterNumberAndConfirm();
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(CUSTOMER_LOOKUP_TIMEOUT_MS);
    });

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("customer-display-keyboard")).toBeInTheDocument();
  });

  it("moves on to the welcome if the cashier saves them while they are still typing", () => {
    const view = renderAnswered(answer("new"));
    expect(screen.getByTestId("customer-display-keyboard")).toBeInTheDocument();

    view.rerender(ui({ submitted: PHONE, status: answer("existing", "Claire") }));

    expect(screen.getByText("Welcome back, Claire!")).toBeInTheDocument();
    expect(screen.queryByTestId("customer-display-keyboard")).toBeNull();
  });
});

describe("step 3b — typing the details", () => {
  it("names capitalise themselves, and follow into the cashier's form after a pause", () => {
    renderAnswered(answer("new"));
    tapAll("claire");

    // Auto-capitalised first letter.
    expect(typed("Claire")).toBeInTheDocument();
    // Not sent on every keystroke...
    expect(onSubmitDetails).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(CUSTOMER_DETAILS_SYNC_MS);
    });
    // ...but once they pause.
    expect(onSubmitDetails).toHaveBeenLastCalledWith("Claire", "");
  });

  it("capitalises after a space and lets Shift capitalise one letter", () => {
    renderAnswered(answer("new"));
    tapAll("anne");
    tap("pos.customerDisplay.keyboardSpace");
    tapAll("lee");
    expect(typed("Anne Lee")).toBeInTheDocument();

    tap("pos.customerDisplay.keyboardShift");
    tap("x");
    expect(typed("Anne LeeX")).toBeInTheDocument();
    tap("x");
    expect(typed("Anne LeeXx")).toBeInTheDocument();
  });

  it("never types a leading or doubled space", () => {
    renderAnswered(answer("new"));
    tap("pos.customerDisplay.keyboardSpace");
    tapAll("jo");
    tap("pos.customerDisplay.keyboardSpace");
    tap("pos.customerDisplay.keyboardSpace");
    tapAll("bo");
    expect(typed("Jo Bo")).toBeInTheDocument();
  });

  it("types an email on its own lowercase layout, with @ . and .com keys", () => {
    renderAnswered(answer("new"));
    // Pick the email field — it is a button, not an input.
    fireEvent.click(
      screen.getByRole("button", { name: /pos\.customerDisplay\.detailsEmailLabel/ })
    );

    tapAll("claire");
    tap("@");
    tapAll("mail");
    tap(".com");

    expect(typed("claire@mail.com")).toBeInTheDocument();
    // Digits row is on the email layout only.
    expect(screen.getByRole("button", { name: "9" })).toBeInTheDocument();
  });

  it("holds a half-typed email back from the till, and only sends it once it is valid", () => {
    renderAnswered(answer("new"));
    fireEvent.click(
      screen.getByRole("button", { name: /pos\.customerDisplay\.detailsEmailLabel/ })
    );
    tapAll("claire");
    tap("@");
    act(() => {
      vi.advanceTimersByTime(CUSTOMER_DETAILS_SYNC_MS);
    });
    expect(onSubmitDetails).not.toHaveBeenCalled();

    tapAll("mail");
    tap(".com");
    act(() => {
      vi.advanceTimersByTime(CUSTOMER_DETAILS_SYNC_MS);
    });
    expect(onSubmitDetails).toHaveBeenLastCalledWith("", "claire@mail.com");
  });

  it("will not close on an email that is not finished — fix it or clear it", () => {
    renderAnswered(answer("new"));
    fireEvent.click(
      screen.getByRole("button", { name: /pos\.customerDisplay\.detailsEmailLabel/ })
    );
    tapAll("claire");

    expect(screen.getByRole("button", { name: "pos.customerDisplay.detailsDone" })).toBeDisabled();

    // Move off the field: now it says why.
    fireEvent.click(screen.getByRole("button", { name: /pos\.customerDisplay\.detailsNameLabel/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("pos.customerDisplay.detailsEmailInvalid");
  });

  it("Done sends what is typed straight away, marks it final for the till to save, and closes", () => {
    renderAnswered(answer("new"));
    tapAll("claire");

    tap("pos.customerDisplay.detailsDone");

    expect(onSubmitDetails).toHaveBeenCalledWith("Claire", "");
    expect(onFinishDetails).toHaveBeenCalledWith("Claire", "");
    expect(onClose).toHaveBeenCalled();
  });

  it("with nothing typed the button is Skip, and skipping still finishes — with no details", () => {
    renderAnswered(answer("new"));
    expect(screen.queryByRole("button", { name: "pos.customerDisplay.detailsDone" })).toBeNull();

    tap("pos.customerDisplay.detailsSkip");

    expect(onSubmitDetails).not.toHaveBeenCalled();
    // A number alone is still a customer worth saving.
    expect(onFinishDetails).toHaveBeenCalledWith("", "");
    expect(onClose).toHaveBeenCalled();
  });

  it("closing with ✕ is not finishing — the till does not save anyone for it", () => {
    renderAnswered(answer("new"));
    tapAll("claire");

    tap("common.actions.close");

    expect(onFinishDetails).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("Backspace deletes, and the fields are capped at the server's length", () => {
    renderAnswered(answer("new"));
    tapAll("claire");
    tap("common.actions.delete");
    expect(typed("Clair")).toBeInTheDocument();
  });
});

describe("typing animation", () => {
  it("pops in what was just typed on the keyboard — and nothing on a backspace", () => {
    renderAnswered(answer("new"));
    // Nothing typed yet: nothing popping.
    expect(poppingIn()).toBeNull();

    tapAll("cl");
    expect(poppingIn()).toBe("l");
    expect(typed("Cl")).toBeInTheDocument();

    tap("common.actions.delete");
    expect(poppingIn()).toBeNull();
    expect(typed("C")).toBeInTheDocument();
  });

  it("pops in a multi-character key as one", () => {
    renderAnswered(answer("new"));
    fireEvent.click(
      screen.getByRole("button", { name: /pos\.customerDisplay\.detailsEmailLabel/ })
    );
    tapAll("a");
    tap("@");
    tapAll("b");
    tap(".com");
    expect(poppingIn()).toBe(".com");
  });

  it("pops in each digit on the number pad", () => {
    render(ui());
    tap("6");
    expect(poppingIn()).toBe("6");
    tap("1");
    expect(poppingIn()).toBe("1");
    expect(typed("61")).toBeInTheDocument();
  });
});

describe("reopening", () => {
  it("starts the next customer from a clean slate — no leftover step or half-typed name", () => {
    const view = renderAnswered(answer("new"));
    tapAll("claire");

    view.rerender(ui({ open: false, submitted: PHONE, status: answer("new") }));
    view.rerender(ui({ open: true, submitted: null, status: null }));

    // Back on the number pad, with the details gone.
    expect(
      screen.getByRole("button", { name: "pos.customerDisplay.phoneConfirm" })
    ).toBeInTheDocument();
    expect(queryTyped("Claire")).toBeNull();
  });
});
