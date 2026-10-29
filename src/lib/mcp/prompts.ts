import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Ready-made requests the person can pick in Claude (shown as Epidom prompts
 * or slash commands). Each one is plain text that walks Claude through the
 * right tools; nothing here bypasses the tools' own checks.
 */

interface PromptSpec {
  name: string;
  title: string;
  description: string;
  text: string;
  /** Only offered when the connection may change data. */
  writes?: boolean;
}

const PROMPTS: PromptSpec[] = [
  {
    name: "weekly_review",
    title: "Weekly business review",
    description: "How last week went, compared with the week before, and what to act on.",
    text:
      "Give me a weekly business review of my store in Epidom. Use list_stores (ask which store if I have several), " +
      "then get_sales_summary for last_week compared with the previous period, get_top_items, get_sales_breakdown " +
      "by channel and by hour, and get_stock_alerts. Summarise: revenue, orders, average ticket, gross profit and " +
      "net profit with the change versus the week before; best and worst sellers; anything unusual; and three " +
      "concrete actions for this week. Keep it short and use my store's currency.",
  },
  {
    name: "restock_check",
    title: "Restock check",
    description: "What is low or out, and a proposed order per supplier.",
    text:
      "Check what is running low in my store in Epidom. Use get_stock_alerts, then propose_supplier_order. Show me " +
      "the proposal grouped by supplier with quantities, unit prices and totals in my currency. Don't place any " +
      "order until I confirm which ones to send.",
  },
  {
    name: "roster_plan",
    title: "Plan next week's roster",
    description: "A roster for next week based on this week's shifts and who worked them.",
    text:
      "Help me plan next week's staff roster in Epidom. Use get_roster for this week and get_hours_and_overtime to " +
      "see who worked how much. Propose next week's roster as a table (day, shift, person). If I approve and this " +
      "connection can make changes, create it as drafts with create_roster_entries, and only publish it with " +
      "publish_roster when I say so.",
  },
  {
    name: "menu_review",
    title: "Menu engineering review",
    description: "Which dishes are stars, workhorses, puzzles or dogs, and what to do about each.",
    text:
      "Do a menu engineering review of my store in Epidom for this_month using get_menu_engineering and " +
      "get_top_items. Explain the four groups (star, workhorse, puzzle, dog) in plain words, list the dishes in " +
      "each, and suggest price, placement or recipe changes. Don't change anything in Epidom.",
  },
  {
    name: "import_menu_photo",
    title: "Import my menu from a photo",
    description: "Turn a photo or PDF of a menu, price list or supplier invoice into Epidom items.",
    writes: true,
    text:
      "I'll attach a photo or PDF (a menu, a price list or a supplier invoice). Read it carefully and turn it into " +
      "rows for import_catalog: menu items with name, price and category, or materials and suppliers for an " +
      "invoice. Don't guess prices or quantities you can't read; ask me instead. First call import_catalog with " +
      "mode: preview and show me the rows and any problems it reports. Only call it with mode: commit after I " +
      "confirm.",
  },
];

export function registerPrompts(server: McpServer, { canWrite }: { canWrite: boolean }): void {
  for (const prompt of PROMPTS) {
    if (prompt.writes && !canWrite) continue;
    server.registerPrompt(
      prompt.name,
      { title: prompt.title, description: prompt.description },
      () => ({
        messages: [{ role: "user", content: { type: "text", text: prompt.text } }],
      })
    );
  }
}
