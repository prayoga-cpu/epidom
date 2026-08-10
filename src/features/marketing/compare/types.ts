export interface CompetitorComparisonData {
  slug: string;
  eyebrow: string;
  titleParts: [string, string]; // second part is gold-highlighted
  lede: string;
  colCompetitor: string;
  rows: Array<{ feature: string; epidom: string; competitor: string }>;
  note: string;
  faqEyebrow: string;
  faqTitle: string;
  faqs: Array<{ q: string; a: string }>;
  ctaTitle: string;
  ctaButton: string;
}
