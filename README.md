# Senior-Projects

Declan's senior year work. Every project lives in its own folder and runs as its own static site: plain HTML, CSS and vanilla JavaScript, with no build step and no dependencies.

| Folder | What it is |
| --- | --- |
| `index.html` | Landing page linking to every project |
| `personal-site/` | Personal portfolio and hub: home, about, projects, interests, resume/CV |
| `guitar-site/` | Guitar site: my music, experience, student materials, booking |
| `spark-site/` | Spark: one-page research site (in progress) |
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

## Chroma Field

A static app that maps live microphone audio to RGB and hex color. Audio is analyzed in the browser with the Web Audio API and is never sent to a server.

Lives in `chroma-field/`. With the local server running, visit `http://localhost:8080/chroma-field/`, click **Enable Microphone**, and allow access.
