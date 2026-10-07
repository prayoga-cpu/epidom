// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  listTranslatablePieces,
  segmentPage,
  translateSalesPage,
  type SalesPageTranslation,
} from "../lib/translate-sales-page";

const PAGE = [
  "<!DOCTYPE html>",
  '<html lang="fr">',
  "<head><title>Epidom — Bonjour</title>",
  '<style>.a{content:"→"} h1{color:red}</style></head>',
  "<body>",
  "<h1>Gérez <mark>TOUT</mark> ici :</h1>",
  '<button class="play" aria-label="Lire la vidéo"></button>',
  '<div class="chip">Paiement reçu<small>+ 12,50 €</small></div>',
  '<img alt="Epidom" src="data:image/png;base64,AAAA">',
  '<p class="x">Commandes &amp; encaissement</p>',
  "<script>",
  'const s = "Ajustez les curseurs.";',
  'const l = n.toLocaleString("fr-FR");',
  "const t = `soit ${fmt(n)} h de libres.`;",
  'document.getElementById("hours"); // "pas une chaîne"',
  "</script>",
  "</body></html>",
].join("\n");

const EN: SalesPageTranslation = {
  locale: "en",
  pairs: [
    ["Epidom — Bonjour", "Epidom — Hello"],
    ["Gérez", "Manage"],
    ["TOUT", "EVERYTHING"],
    ["ici :", "here:"],
    ["Lire la vidéo", 'Play the "video"'],
    ["Paiement reçu", "Payment received"],
    ["+ 12,50 €", "+ $12.50"],
    ["Commandes &amp; encaissement", "Orders & checkout <fast>"],
    ["Ajustez les curseurs.", "Move the sliders."],
    ["fr-FR", "en-US"],
    ["soit ${fmt(n)} h de libres.", "that's ${fmt(n)} h freed up."],
  ],
  keep: ["Epidom"],
};

describe("segmentPage", () => {
  it("splits a page into pieces that join back into it exactly", () => {
    expect(
      segmentPage(PAGE)
        .map((s) => s.value)
        .join("")
    ).toBe(PAGE);
  });

  it("lists what a reader sees: text, read-out attributes and prose in scripts, never CSS or code", () => {
    const pieces = listTranslatablePieces(PAGE).map((p) => p.text);

    expect(pieces).toContain("Gérez");
    expect(pieces).toContain("ici :");
    expect(pieces).toContain("Lire la vidéo");
    expect(pieces).toContain("+ 12,50 €");
    expect(pieces).toContain("Ajustez les curseurs.");
    expect(pieces).toContain("fr-FR");
    expect(pieces).toContain("soit ${fmt(n)} h de libres.");
    expect(pieces).not.toContain("hours"); // a code string
    expect(pieces).not.toContain("pas une chaîne"); // inside a comment
    expect(pieces.join(" ")).not.toContain("color");
  });
});

describe("translateSalesPage", () => {
  const { html, problems } = translateSalesPage(PAGE, EN);

  it("translates every piece and sets the language, with no problems", () => {
    expect(problems).toEqual([]);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>Epidom — Hello</title>");
    expect(html).toContain("<h1>Manage <mark>EVERYTHING</mark> here:</h1>");
    expect(html).toContain('<small>+ $12.50</small>');
    expect(html).toContain('const s = "Move the sliders.";');
    expect(html).toContain('n.toLocaleString("en-US")');
    expect(html).toContain("const t = `that's ${fmt(n)} h freed up.`;");
  });

  it("escapes the translation for where it lands", () => {
    expect(html).toContain('aria-label="Play the &quot;video&quot;"');
    expect(html).toContain("<p class=\"x\">Orders &amp; checkout &lt;fast&gt;</p>");
  });

  it("leaves every tag, style rule and line of code as it was", () => {
    const markup = (page: string) =>
      segmentPage(page)
        .filter((s) => s.kind === "raw")
        .map((s) => s.value)
        .join("");
    expect(markup(html)).toBe(markup(PAGE));
    expect(html).toContain('<style>.a{content:"→"} h1{color:red}</style>');
    expect(html).toContain('document.getElementById("hours"); // "pas une chaîne"');
  });

  it("matches the French side whatever its spaces, non-breaking or not", () => {
    // "ici :" on the page has a non-breaking space; the pair above typed a normal one.
    expect(problems).toEqual([]);
  });

  it("reports French left on the page, and a price still in euros", () => {
    const partial = translateSalesPage(PAGE, {
      ...EN,
      pairs: EN.pairs.filter(([fr]) => fr !== "Gérez" && fr !== "+ 12,50 €" && fr !== "fr-FR"),
    });
    expect(partial.problems).toEqual(
      expect.arrayContaining([
        'untranslated text: "Gérez"',
        'price still in euros: "+ 12,50 €"',
        'untranslated literal: "fr-FR"',
      ])
    );
  });

  it("reports a pair that matches nothing, a duplicate, and a translation still in euros", () => {
    const { problems: p } = translateSalesPage(PAGE, {
      ...EN,
      pairs: [...EN.pairs, ["Absent de la page", "Not on the page"], ["TOUT", "ALL"]].map(
        ([fr, to]): readonly [string, string] => [fr, fr === "Paiement reçu" ? "Paid 3 €" : to]
      ),
    });
    expect(p).toEqual(
      expect.arrayContaining([
        'pair matches nothing on the page: "Absent de la page"',
        'duplicate pair: "TOUT"',
        'translation still in euros: "Paid 3 €"',
      ])
    );
  });

  it("protects the script: its ${…} and its quotes", () => {
    const { problems: p } = translateSalesPage(PAGE, {
      ...EN,
      pairs: EN.pairs.map(([fr, to]) =>
        fr === "Ajustez les curseurs."
          ? ([fr, 'Move the "sliders".'] as const)
          : fr.startsWith("soit")
            ? ([fr, "that's a lot of hours."] as const)
            : ([fr, to] as const)
      ),
    });
    expect(p).toEqual(
      expect.arrayContaining([
        'script string breaks its quotes: "Move the \\"sliders\\"."',
        "script string lost its ${…}: \"that's a lot of hours.\"",
      ])
    );
  });

  it("keeps the spaces around a script string, which sit against `+ value +`", () => {
    const src = '<html lang="fr"><body><script>el.textContent = "Économisez " + n + " heures";</script></body></html>';
    expect(listTranslatablePieces(src)).toEqual([
      { kind: "literal", text: "Économisez", raw: "Économisez " },
      { kind: "literal", text: "heures", raw: " heures" },
    ]);

    const out = translateSalesPage(src, {
      locale: "en",
      // Written from the trimmed --list text, and once with a space of its own.
      pairs: [
        ["Économisez", "Save"],
        ["heures", " hours"],
      ],
      keep: [],
    });
    expect(out.problems).toEqual([]);
    expect(out.html).toContain('el.textContent = "Save " + n + " hours";');
  });

  it("accepts pieces deliberately kept as they are", () => {
    expect(translateSalesPage(PAGE, { ...EN, keep: [] }).problems).toContain('untranslated attr: "Epidom"');
  });
});
