# CLAUDE.md

Declan's senior-year repo. Changes come from two places: Declan's local VS Code (Claude Code extension) and Claude cloud sessions that open PRs. **Run `git pull` before editing**, and commit/push when done so the other side sees it.

## Layout

| Folder | What it is |
| --- | --- |
| `index.html` | Landing page linking to every project |
| `personal-site/` | Personal hub: home, about, projects, interests, resume/CV |
| `guitar-site/` | Guitar site: my music, experience, student materials, booking |
| `spark-site/` | Spark research one-pager (in progress, not built yet) |
| `assets/` | Shared media: `images/`, `docs/` (resume PDF), `icons/` |
| `chroma-field/`, `no-man/`, `catan-dojo/` | Older projects. Leave untouched unless asked |

Each site is standalone with its own `css/` and `js/`. Colors, fonts and spacing live as custom properties in `css/tokens.css`; components use semantic tokens, not raw hex. Shared media is linked relatively (`../assets/...`) so everything works on GitHub Pages from the repo root. Full plan: README.md.

## Rules

- Plain HTML, CSS and vanilla JS. No frameworks, build step or npm dependencies.
- Flexbox layouts, mobile first.
- Low bandwidth: small images (WebP with fallback), no heavy libraries, self-host fonts when possible.
- Aim for WCAG 2.2 AA: semantic HTML, visible focus, contrast noted next to token pairs, alt text, labels on form fields. Never claim compliance without listing what still needs manual testing (screen reader, keyboard walk-through, 400% zoom).
- Links between the personal, guitar and Spark sites open in a new tab: `target="_blank" rel="noopener noreferrer"` plus screen-reader text "(opens in new tab)". Personal nav links to Guitar and Spark; personal Projects page features Spark.
- No lorem ipsum. Use real copy or a clearly marked placeholder like `[Add teaching years]`.
- Workflow for bigger work: plan first, wait for approval, then one complete file at a time. Keep explanations short.
- One PR per site for large changes.

## Design

**Personal site**: editorial, misty Irish landscape, not touristy.
- Palette: peat `#132019`, moss `#315B3A`, heather `#66706A`, lichen `#A7B68A`, parchment `#F4F0E6`, mist `#FCFBF7`, stone `#BCA58D`.
- Fonts: body and headings in Source Serif 4; hero name in Cormorant SC (see `css/tokens.css`). Celtica for headings was tried and not adopted.

**Guitar site**: warm wood, realistic static wood-texture background (CC0 wood-plank photo), serif font.
- Palette: `#562a0e` `#78380c` `#c8691c` `#d09259` `#e4ceaf`.

**Spark site**: orange-to-blue research brand. Research content is developed in a separate project; only the web page is built here.
- Palette: `#ff5400` `#ff6d00` `#ff8500` `#ff9100` `#ff9e00` `#00b4d8` `#0096c7` `#0077b6` `#023e8a` `#03045e`.

## Preview

```bash
python3 -m http.server 8080   # from the repo root, then open http://localhost:8080/
```
