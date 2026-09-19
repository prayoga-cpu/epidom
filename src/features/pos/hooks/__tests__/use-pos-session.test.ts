import { describe, it, expect, beforeEach } from "vitest";
import { usePosSession } from "../use-pos-session";

const STORAGE_KEY = "epidom-pos-session";

const cashier = {
  storeId: "store_1",
  staffId: "staff_1",
  staffName: "Test Acc",
  staffRole: "CASHIER",
  shiftId: null,
  allowedPages: ["/pos"],
};

function persisted(): Record<string, unknown> {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw).state : {};
}

beforeEach(() => {
  localStorage.clear();
  usePosSession.getState().logout();
  usePosSession.getState().closePicker();
});

describe("usePosSession — Switch Account picker (pickerOpen)", () => {
  it("starts closed, and opening it does NOT touch the active session", () => {
    usePosSession.getState().login(cashier);
    expect(usePosSession.getState().pickerOpen).toBe(false);

    usePosSession.getState().openPicker();

    const s = usePosSession.getState();
    expect(s.pickerOpen).toBe(true);
    // The whole point: peeking at the picker must not cost anyone their
    // session (and so a PIN re-entry to get back to it).
    expect(s.isActive).toBe(true);
    expect(s.staffId).toBe("staff_1");
    expect(s.staffRole).toBe("CASHIER");
    expect(s.allowedPages).toEqual(["/pos"]);
  });

  it("closePicker resumes the exact same session", () => {
    usePosSession.getState().login(cashier);
    usePosSession.getState().openPicker();
    usePosSession.getState().closePicker();

    const s = usePosSession.getState();
    expect(s.pickerOpen).toBe(false);
    expect(s.isActive).toBe(true);
    expect(s.staffName).toBe("Test Acc");
  });

  it("any successful login() dismisses the picker, whichever call site got there", () => {
    usePosSession.getState().login(cashier);
    usePosSession.getState().openPicker();

    usePosSession.getState().login({ ...cashier, staffId: "staff_2", staffName: "Other" });

    const s = usePosSession.getState();
    expect(s.pickerOpen).toBe(false);
    expect(s.staffId).toBe("staff_2");
  });

  it("logout() clears the picker flag along with the session", () => {
    usePosSession.getState().login(cashier);
    usePosSession.getState().openPicker();
    usePosSession.getState().logout();

    const s = usePosSession.getState();
    expect(s.pickerOpen).toBe(false);
    expect(s.isActive).toBe(false);
  });

  it("is never persisted — reopening the app must not resume mid-switch", () => {
    usePosSession.getState().login(cashier);
    usePosSession.getState().openPicker();

    const state = persisted();
    expect(state).not.toHaveProperty("pickerOpen");
    // ...while the real session still is persisted.
    expect(state.staffId).toBe("staff_1");
    expect(state.isActive).toBe(true);
  });

  it("checkStale() (a previous-day persona) still ends the session as before", () => {
    usePosSession.getState().login(cashier);
    usePosSession.setState({ loginDate: "Mon Jan 01 2001" });

    usePosSession.getState().checkStale();

    expect(usePosSession.getState().isActive).toBe(false);
  });
});
