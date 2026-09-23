import type { ReactNode } from "react";

/**
 * Renders a locale string in which **double asterisks** mark emphasis.
 * Locale values are plain strings (no JSX), and where the emphasised phrase
 * sits differs per language, so the marker travels with the translation
 * instead of the sentence being cut into fragments in code.
 */
export function BoldText({ text }: { text: string }): ReactNode {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ color: "var(--epi-cream-50)", opacity: 1 }}>
        {part}
      </strong>
    ) : (
      part
    )
  );
}
