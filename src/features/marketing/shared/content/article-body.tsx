import type { ArticleBlock } from "./article-types";

/**
 * Editorial article renderer shared by blog posts and docs guides —
 * typography-led (display headings, serif pull-quotes, a gold rule),
 * deliberately icon-free to match the site's restrained aesthetic rather
 * than the generic "icon + card grid" SaaS-template look.
 */
export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, maxWidth: 720 }}>
      {blocks.map((block, i) => {
        if (block.type === "h2") {
          return (
            <h2
              key={i}
              className="epi-display"
              style={{
                fontSize: "clamp(24px, 3.2vw, 36px)",
                lineHeight: 1.1,
                color: "var(--epi-cream-50)",
                margin: i === 0 ? 0 : "18px 0 0",
              }}
            >
              {block.text}
            </h2>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {block.items.map((item, j) => (
                <li
                  key={j}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    padding: "10px 0",
                    borderTop: j === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                    fontSize: 16,
                    lineHeight: 1.7,
                    color: "rgba(251,249,228,0.72)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--epi-gold-500)",
                      marginTop: 11,
                      flexShrink: 0,
                    }}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote
              key={i}
              style={{
                margin: 0,
                padding: "4px 0 4px 26px",
                borderLeft: "1px solid rgba(217,174,59,0.4)",
              }}
            >
              <p
                className="epi-script"
                style={{
                  fontSize: 22,
                  lineHeight: 1.5,
                  color: "var(--epi-gold-300)",
                  margin: 0,
                }}
              >
                {block.text}
              </p>
              {block.attribution && (
                <cite
                  style={{
                    display: "block",
                    marginTop: 10,
                    fontStyle: "normal",
                    fontSize: 13,
                    letterSpacing: "0.06em",
                    color: "rgba(251,249,228,0.45)",
                  }}
                >
                  {block.attribution}
                </cite>
              )}
            </blockquote>
          );
        }
        return (
          <p
            key={i}
            style={{
              fontSize: 17,
              lineHeight: 1.8,
              color: "rgba(251,249,228,0.72)",
              margin: 0,
            }}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
