import { z } from "zod";
import { createStoreEssentialsSchema } from "@/features/stores/shared";
import { isValidStoreSlug, slugifyStoreLink } from "./store-link";

type Translate = (key: string) => string;

/**
 * Step 1's form: the shared store essentials (name, country, city, type,
 * currency for "Other") plus the store link. `editLink` is on when the owner
 * chose their own link; `slug` is only read (and validated) then. Otherwise
 * the server derives the link from the name. `useNameLink` is on when the
 * owner tapped "Use my store name" over a saved custom link: the server then
 * derives it from the name again even though the name didn't change.
 */
export function createStoreStepSchema(t: Translate) {
  return createStoreEssentialsSchema(t)
    .extend({
      editLink: z.boolean(),
      slug: z.string(),
      useNameLink: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (values.editLink && !isValidStoreSlug(slugifyStoreLink(values.slug))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slug"],
          message: t("onboarding.store.link.invalid"),
        });
      }
    });
}

export type StoreStepFormInput = z.input<ReturnType<typeof createStoreStepSchema>>;
export type StoreStepFormValues = z.output<ReturnType<typeof createStoreStepSchema>>;
