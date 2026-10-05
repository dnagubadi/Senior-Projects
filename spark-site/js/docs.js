// Docs page: loads each section's Markdown file, renders it, and highlights
// the current section in the table of contents.
//
// Edit section text in content/docs/*.md. Supported Markdown:
//   # Heading (becomes a sub-heading inside the section), ## smaller heading
//   paragraphs, - bullet lists, 1. numbered lists, > quotes, --- divider
//   **bold**, *italic*, `code`, [link text](url), ![alt text](image.png)
//   | tables | with | pipes |
//   [[Placeholder text]] shows as a dashed "fill me in" marker.

(function () {
  "use strict";

  // ---------- Markdown ----------

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function safeUrl(url) {
    return /^\s*(javascript|data|vbscript):/i.test(url) ? "#" : url;
  }

  function inline(text) {
    let out = escapeHtml(text);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\[\[([^\]]+)\]\]/g, '<mark class="placeholder">[$1]</mark>');
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) => `<img src="${safeUrl(src)}" alt="${alt}" loading="lazy" />`);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
      const external = /^https?:\/\//.test(href);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      const sr = external ? '<span class="visually-hidden"> (opens in new tab)</span>' : "";
      return `<a href="${safeUrl(href)}"${attrs}>${label}${sr}</a>`;
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    return out;
  }

  function splitRow(line) {
    return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  }

  function renderMarkdown(source) {
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    const html = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) { i++; continue; }

      // Headings: # -> h3, ## -> h4 (the section title is already the h2)
      const heading = line.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        const level = Math.min(heading[1].length + 2, 4);
        html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        i++;
        continue;
      }

      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
        html.push("<hr />");
        i++;
        continue;
      }

      // Table: header row, then a |---|---| row
      if (/^\s*\|/.test(line) && lines[i + 1] && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
        const head = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        html.push(
          '<div class="table-wrap" tabindex="0" role="region" aria-label="Table, scrolls sideways"><table><thead><tr>' +
            head.map((c) => `<th scope="col">${inline(c)}</th>`).join("") +
            "</tr></thead><tbody>" +
            rows.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
            "</tbody></table></div>"
        );
        continue;
      }

      // Blockquote
      if (/^\s*>/.test(line)) {
        const quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        html.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`);
        continue;
      }

      // Lists
      const listMatch = line.match(/^\s*([-*]|\d+\.)\s+/);
      if (listMatch) {
        const ordered = /\d/.test(listMatch[1]);
        const pattern = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
        const items = [];
        while (i < lines.length && pattern.test(lines[i])) {
          let item = lines[i].replace(pattern, "");
          i++;
          // Indented continuation lines belong to the same item
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
            item += " " + lines[i].trim();
            i++;
          }
          items.push(`<li>${inline(item)}</li>`);
        }
        const tag = ordered ? "ol" : "ul";
        html.push(`<${tag}>${items.join("")}</${tag}>`);
        continue;
      }

      // Paragraph: gather lines until a blank line or another block starts
      const para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,3})\s/.test(lines[i]) &&
        !/^\s*>/.test(lines[i]) &&
        !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) &&
        !/^\s*\|/.test(lines[i])
      ) {
        para.push(lines[i].trim());
        i++;
      }
      html.push(`<p>${inline(para.join(" "))}</p>`);
    }

    return html.join("\n");
  }

  // ---------- Load sections ----------

  const blocks = document.querySelectorAll("[data-doc]");

  blocks.forEach((block) => {
    const path = block.getAttribute("data-doc");
    fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error(response.status);
        return response.text();
      })
      .then((text) => {
        block.innerHTML = renderMarkdown(text);
      })
      .catch(() => {
        block.innerHTML =
          `<p class="prose__error">This section couldn't load. Open the site through a local server ` +
          `(see the README), or check that <code>${escapeHtml(path)}</code> exists.</p>`;
      })
      .finally(() => {
        // Re-jump to the #anchor once content has its real height
        if (location.hash && block.closest(location.hash)) {
          document.querySelector(location.hash).scrollIntoView();
        }
      });
  });

  // ---------- Table of contents ----------

  const details = document.querySelector(".docs-toc__details");
  const wide = window.matchMedia("(min-width: 60rem)");

  function syncToc() {
    if (!details) return;
    if (wide.matches) details.open = true;
  }

  syncToc();
  wide.addEventListener("change", syncToc);

  // Close the mobile menu after picking a section
  document.querySelectorAll(".docs-toc__list a").forEach((link) => {
    link.addEventListener("click", () => {
      if (details && !wide.matches) details.open = false;
    });
  });

  // Start collapsed on small screens so content comes first
  if (details && !wide.matches) details.open = false;

  // Highlight the section currently in view
  const tocLinks = new Map();
  document.querySelectorAll('.docs-toc__list a[href^="#"]').forEach((link) => {
    tocLinks.set(link.getAttribute("href").slice(1), link);
  });

  if ("IntersectionObserver" in window && tocLinks.size) {
    const visible = new Set();
    const order = Array.from(tocLinks.keys());

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        const current = order.find((id) => visible.has(id));
        if (!current) return;
        tocLinks.forEach((link, id) => {
          if (id === current) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    order.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }
})();
