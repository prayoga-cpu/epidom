"use client";

import { useState } from "react";

/**
 * Text typed on one of the customer display's on-screen keys, with whatever
 * was just typed popping into place (`.key-typed-in` in globals.css) — the
 * field-side half of the keys' own press animation.
 *
 * Only an append animates: a backspace, or a value replaced wholesale (a reset
 * when the pad reopens), just shows. The fresh run is keyed on the length so
 * every keystroke remounts it and replays the pop.
 */
export function TypedText({ value }: { value: string }) {
  const [previous, setPrevious] = useState(value);
  const [freshFrom, setFreshFrom] = useState(value.length);

  if (value !== previous) {
    setPrevious(value);
    const appended = value.length > previous.length && value.startsWith(previous);
    setFreshFrom(appended ? previous.length : value.length);
  }

  const fresh = value.slice(freshFrom);
  return (
    <span data-slot="typed-text">
      {value.slice(0, freshFrom)}
      {fresh && (
        <span key={value.length} className="key-typed-in">
          {fresh}
        </span>
      )}
    </span>
  );
}
