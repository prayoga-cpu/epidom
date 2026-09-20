import { describe, it, expect } from "vitest";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";
import {
  createLoginSchema,
  createRegisterSchema,
  NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type Translate,
} from "../auth.schemas";

/** A `t` backed by a real dictionary, the way useI18n() resolves a key. */
function translatorFor(dict: unknown): Translate {
  return (key) => {
    const value = key
      .split(".")
      .reduce<unknown>(
        (acc, part) =>
          acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined,
        dict
      );
    return typeof value === "string" ? value : key;
  };
}

const keyOnly: Translate = (key) => key;

/** field -> messages, for a failed parse. */
function errorsOf(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  const out: Record<string, string[]> = {};
  for (const issue of result.error?.issues ?? []) {
    (out[String(issue.path[0])] ??= []).push(issue.message);
  }
  return out;
}

const valid = {
  name: "Jane Baker",
  email: "jane@bakery.com",
  password: "hunter22",
  confirmPassword: "hunter22",
};

describe("createRegisterSchema: the rules", () => {
  const schema = createRegisterSchema(keyOnly);

  it("accepts a well-formed sign-up", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("requires a name of at least NAME_MIN_LENGTH characters", () => {
    expect(NAME_MIN_LENGTH).toBe(2);
    expect(errorsOf(schema.safeParse({ ...valid, name: "" })).name?.[0]).toBe(
      "auth.validation.nameRequired"
    );
    expect(errorsOf(schema.safeParse({ ...valid, name: "J" })).name).toEqual([
      "auth.validation.nameTooShort",
    ]);
    expect(schema.safeParse({ ...valid, name: "Jo" }).success).toBe(true);
  });

  it("requires a well-formed email", () => {
    expect(errorsOf(schema.safeParse({ ...valid, email: "" })).email?.[0]).toBe(
      "auth.validation.emailRequired"
    );
    expect(errorsOf(schema.safeParse({ ...valid, email: "not-an-email" })).email).toEqual([
      "auth.validation.emailInvalid",
    ]);
  });

  it("uses the 8 to 100 character password window", () => {
    // Deliberate change: the floor was 6, but Better Auth's own default
    // minPasswordLength is 8 (src/lib/auth.ts sets no override), so a 6-7 character
    // password cleared this form and was then refused by the server, in English.
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(100);

    const at = (length: number) => {
      const password = "p".repeat(length);
      return schema.safeParse({ ...valid, password, confirmPassword: password });
    };
    expect(errorsOf(at(5)).password).toEqual(["auth.validation.passwordTooShort"]);
    expect(errorsOf(at(6)).password).toEqual(["auth.validation.passwordTooShort"]);
    expect(errorsOf(at(7)).password).toEqual(["auth.validation.passwordTooShort"]);
    expect(at(8).success).toBe(true);
    expect(at(100).success).toBe(true);
    expect(errorsOf(at(101)).password).toEqual(["auth.validation.passwordTooLong"]);
  });

  it("asks for a confirmation and flags a mismatch on the confirm field", () => {
    expect(errorsOf(schema.safeParse({ ...valid, confirmPassword: "" })).confirmPassword?.[0]).toBe(
      "auth.validation.confirmPasswordRequired"
    );
    expect(errorsOf(schema.safeParse({ ...valid, confirmPassword: "hunter23" }))).toEqual({
      confirmPassword: ["messages.passwordsDoNotMatch"],
    });
  });

  it("leaves the optional business fields optional", () => {
    expect(schema.safeParse({ ...valid, businessName: "Bakery", address: "1 rue X" }).success).toBe(
      true
    );
  });
});

describe("createLoginSchema: the rules", () => {
  const schema = createLoginSchema(keyOnly);

  it("accepts a well-formed login", () => {
    expect(schema.safeParse({ email: "jane@bakery.com", password: "hunter22" }).success).toBe(true);
  });

  it("requires an email, well-formed", () => {
    expect(errorsOf(schema.safeParse({ email: "", password: "hunter22" })).email?.[0]).toBe(
      "auth.validation.emailRequired"
    );
    expect(errorsOf(schema.safeParse({ email: "nope", password: "hunter22" })).email).toEqual([
      "auth.validation.emailInvalid",
    ]);
  });

  it("only requires a password: no length floor on sign-in", () => {
    expect(
      errorsOf(schema.safeParse({ email: "jane@bakery.com", password: "" })).password?.[0]
    ).toBe("auth.validation.passwordRequired");
    // The 8-character minimum is a sign-up rule. An older account may have a shorter
    // password, and it must reach the server rather than be stopped by the form.
    for (const short of ["a", "abcde", "abcdefg"]) {
      expect(schema.safeParse({ email: "jane@bakery.com", password: short }).success).toBe(true);
    }
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});

describe("the messages follow the language", () => {
  const bad = { name: "J", email: "nope", password: "abc", confirmPassword: "abd" };
  const worst = { ...bad, password: "p".repeat(101), confirmPassword: "p".repeat(101) };

  const allMessages = (dict: unknown) => {
    const t = translatorFor(dict);
    const register = createRegisterSchema(t);
    return [
      ...Object.values(errorsOf(register.safeParse(bad))).flat(),
      ...Object.values(errorsOf(register.safeParse(worst))).flat(),
      ...Object.values(
        errorsOf(createLoginSchema(t).safeParse({ email: "nope", password: "abc" }))
      ).flat(),
    ];
  };

  it("fills the {min} and {max} placeholders, never leaving a raw one in a message", () => {
    for (const dict of [en, fr, id]) {
      for (const message of allMessages(dict)) {
        expect(message).not.toMatch(/[{}]/);
        expect(message).not.toMatch(/^(auth|messages)\./);
      }
    }
  });

  it("spells the numbers out in each language", () => {
    const messages = (dict: unknown) => allMessages(dict).join(" | ");
    expect(messages(en)).toContain("at least 8 characters");
    expect(messages(en)).toContain("at least 2 characters");
    expect(messages(en)).toContain("less than 100 characters");
    expect(messages(fr)).toContain("au moins 8 caractères");
    expect(messages(fr)).toContain("au moins 2 caractères");
    expect(messages(fr)).toContain("moins de 100 caractères");
    expect(messages(id)).toContain("minimal 8 karakter");
    expect(messages(id)).toContain("minimal 2 karakter");
    expect(messages(id)).toContain("kurang dari 100 karakter");
  });

  it("gives fr and id their own wording, not the English one", () => {
    const english = new Set(allMessages(en));
    for (const dict of [fr, id]) {
      for (const message of allMessages(dict)) {
        expect(english.has(message), `"${message}" is still English`).toBe(false);
      }
    }
  });

  it("keeps the English wording that shipped (only the {min} number moved, 6 to 8)", () => {
    expect(new Set(allMessages(en))).toEqual(
      new Set([
        "Name must be at least 2 characters",
        "Please enter a valid email address",
        "Password must be at least 8 characters",
        "Passwords do not match",
        "Password must be less than 100 characters",
      ])
    );
  });
});
