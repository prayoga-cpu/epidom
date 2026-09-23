-- Till cash (a shift's opening float and closing count, tips, paid-outs) moved from the
-- Schedule page's Log & History to its own Back Office page, /shifts (release 2.94.0).
--
-- A MANAGER whose saved page list includes /schedule could see that cash on the Schedule
-- page; without this they would silently lose it, because role defaults only apply to an
-- EMPTY list and a saved list never learns about a new page. Grant /shifts to exactly
-- those managers. Additive and idempotent: it only appends, and skips anyone who already
-- has it. Managers on the default (empty) list, and every other role, are untouched.
UPDATE "staff_members"
SET "allowedPages" = array_append("allowedPages", '/shifts'),
    "updatedAt" = NOW()
WHERE "role" = 'MANAGER'
  AND '/schedule' = ANY("allowedPages")
  AND NOT ('/shifts' = ANY("allowedPages"));
