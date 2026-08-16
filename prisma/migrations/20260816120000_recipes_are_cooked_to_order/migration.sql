-- Re-classify every recipe-linked product as MADE_TO_ORDER.
--
-- WHY: the two-tier backfill mapped `trackStock = true` to BATCH_PRODUCED,
-- which is the safe default for a product whose mode is unknown — it preserves
-- an existing counted balance rather than stranding it. But it is the WRONG
-- answer for this operator's actual data: their recipes describe fresh cooking
-- from raw materials, not batches prepped ahead. Under BATCH_PRODUCED a sale
-- draws the finished-goods count first and only falls through to ingredients
-- once that count hits zero, so a stale count silently absorbs sales that
-- should have been drawing flour, rice and eggs.
--
-- SCOPE, deliberately narrow:
--   * Only products that HAVE a primary recipe. A recipe is the evidence that
--     the item is cooked rather than bought in.
--   * Only those currently BATCH_PRODUCED. UNTRACKED is an explicit operator
--     choice (a service) and is never overridden here.
--   * Products with NO recipe keep BATCH_PRODUCED — those are bought-in goods
--     that genuinely are counted on a shelf, and they are managed from the
--     Stock page for adjustments and reordering.
--
-- `currentStock` is deliberately NOT zeroed. Under MADE_TO_ORDER no counted
-- balance exists, so the column is inert: deductStockForOrder never reads or
-- writes it for this mode, and the UI renders "not counted" instead of a
-- number. Leaving the value makes the change reversible per product — flipping
-- one back to BATCH_PRODUCED restores its previous figure instead of silently
-- resetting it to zero. Destroying data to tidy a display would be the wrong
-- trade.
UPDATE "products"
   SET "stockMode" = 'MADE_TO_ORDER'::"StockMode"
 WHERE "primaryRecipeId" IS NOT NULL
   AND "stockMode" = 'BATCH_PRODUCED'::"StockMode";

-- ---------------------------------------------------------------------------
-- Manual down-SQL (Prisma migrations are forward-only).
--
-- Reverting is a straight inverse; `currentStock` was never touched, so each
-- product returns to exactly the balance it had:
--
--   UPDATE "products"
--      SET "stockMode" = 'BATCH_PRODUCED'::"StockMode"
--    WHERE "primaryRecipeId" IS NOT NULL
--      AND "stockMode" = 'MADE_TO_ORDER'::"StockMode";
--
-- Note this would also catch products the operator has since switched to
-- made-to-order by hand, which is why it is written down rather than automated.
-- ---------------------------------------------------------------------------
