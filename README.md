# Senior-Projects

Declan's senior year work. Every project lives in its own folder and runs as its own static site: plain HTML, CSS and vanilla JavaScript, with no build step and no dependencies.

| Folder | What it is |
| --- | --- |
| `index.html` | Landing page linking to every project |
| `personal-site/` | Personal portfolio and hub: home, about, projects, interests, resume/CV |
| `guitar-site/` | Guitar site: my music, experience, student materials, booking |
| `spark-site/` | Spark: capstone project docs site (home page and design kit parked for later) |
| `assets/` | Media shared between sites: `images/`, `docs/` (resume PDF), `icons/` |
| `chroma-field/` | Chroma Field |
| `no-man/` | No-Man |
| `catan-dojo/` | Catan Dojo |

## Site structure

Each of the three main sites follows the same layout:

```
<site>/
├── *.html
├── css/   tokens.css  base.css  layout.css  components.css
└── js/    small scripts (navigation, form validation)
```

- `tokens.css` holds that site's colors, type scale and spacing as CSS custom properties. Each site has its own palette.
- Shared media in `assets/` is linked with relative paths such as `../assets/docs/resume.pdf`, so the sites work when served from the repo root.
- Links between the personal, guitar and Spark sites open in a new tab (`target="_blank" rel="noopener noreferrer"`).

## Local preview

Serve the repo root over `localhost` (Chroma Field's microphone features need a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), so avoid `file://` URLs):

```bash
cd Senior-Projects
python3 -m http.server 8080
```

Then visit:

- `http://localhost:8080/` for the landing page
- `http://localhost:8080/personal-site/`
- `http://localhost:8080/guitar-site/`
- `http://localhost:8080/spark-site/`

## Deploying to GitHub Pages

1. Push this repository to GitHub (`dnagubadi/Senior-Projects`).
2. Open **Settings → Pages**.
3. Set **Build and deployment → Source** to **Deploy from a branch**.
4. Choose branch `main` and folder `/ (root)`.
5. After it publishes, open `https://dnagubadi.github.io/Senior-Projects/` for the landing page, or add a folder name such as `/personal-site/`.

All paths are relative, so every site works from its folder on the Pages URL.

## Accessibility

The sites are built toward WCAG 2.2 AA. A checklist of what is implemented and what still needs manual testing (screen readers, keyboard walk-throughs, zoom to 400%) will be added here as each site is finished.

## Spark

Lives in `spark-site/`. **Current scope: the project docs page, linked from the end of the pitch.** The home page and design kit are built but parked for later: they aren't linked from the docs, but still open directly. Nothing interactive works yet.

**Run it:** start the local server above, then open `http://localhost:8080/spark-site/`. Use the server rather than opening the file directly, because the docs page loads its sections with `fetch`.

| Page | File |
| --- | --- |
| Docs (the live page) | `spark-site/index.html` |
| Example journey (linked from Frameworks) | `spark-site/journey.html`, copy in `content/pages/example-journey.md` |
| Sparkplug 3D model (linked from Sparkplug) | `spark-site/sparkplug.html`, copy in `content/pages/sparkplug-model.md` |
| Home (parked) | `spark-site/home.html` |
| Design kit, every component and state (parked) | `spark-site/design.html` |

**Edit the docs copy** in `spark-site/content/docs/`, one Markdown file per section (`01-general-idea.md` to `08-timeline.md`). Use `#` for sub-headings (they render under the section title), plus lists, `**bold**`, links and `| tables |`. Write `[[like this]]` for a placeholder: it shows as a dashed orange marker. To add or rename a section, edit both the table of contents and the matching `<section>` in `index.html`.

**Edit the parked home page copy** directly in `spark-site/home.html`. Placeholders there are `<mark class="placeholder">[...]</mark>`; search for `placeholder` to find every one left to fill in.

**Sparkplug STL files** are in `spark-site/models/`, made by the Blender script `models/sparkplug.py`. Change the sizes under SETTINGS, then run `/Applications/Blender.app/Contents/MacOS/Blender -b --python sparkplug.py` from that folder. It rewrites the STLs and the preview pictures in `images/`. The 3D viewer loads three.js from jsDelivr only when someone presses its button.

**Design tokens and styles** are in `spark-site/css/`:

- `tokens.css`: every color, font, type size, spacing, radius and shadow, with contrast ratios noted. Change the look here.
- `base.css`: element defaults, links, focus rings, placeholder style.
- `layout.css`: container, header, footer, sections, rows.
- `components.css`: buttons, cards, tags, badges, form controls, callouts, the hemisphere.
- `docs.css`, `page.css`, `home.css`, `design.css`: page-specific styles.

Fonts are Bricolage Grotesque (headings, buttons) and Atkinson Hyperlegible Next (body), loaded from Google Fonts. Still to check by hand: screen reader, full keyboard walk-through, and 400% zoom.

## Chroma Field

A static app that maps live microphone audio to RGB and hex color. Audio is analyzed in the browser with the Web Audio API and is never sent to a server.

Lives in `chroma-field/`. With the local server running, visit `http://localhost:8080/chroma-field/`, click **Enable Microphone**, and allow access.
