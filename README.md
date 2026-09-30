# Senior-Projects
Atlas Project, and sub projects. Every project lives in its own folder and is its own site.

| Folder | What it is |
| --- | --- |
| `index.html` | Landing page linking to every project |
| `website/` | Personal site: portfolio (about, resume, projects) and guitar lessons |
| `spark/` | Spark (worked on separately) |
| `chroma-field/` | Chroma Field |
| `no-man/` | No-Man |
| `catan-dojo/` | Catan Dojo |

### Local preview

Serve the repo root over `localhost` (microphone features need a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), so avoid `file://` URLs):

```bash
cd Senior-Projects
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Chroma Field

A static GitHub Pages app that maps live microphone audio to RGB and hex color. Audio is analyzed in the browser with the Web Audio API and is never sent to a server.

Lives in `chroma-field/`. With the local server running, visit `http://localhost:8080/chroma-field/`, click **Enable Microphone**, and allow access.

## GitHub Pages

1. Push this repository to GitHub (`dnagubadi/Senior-Projects`).
2. Open **Settings → Pages**.
3. Set **Build and deployment → Source** to **Deploy from a branch**.
4. Choose branch `main` and folder `/ (root)`.
5. After the site publishes, open `https://dnagubadi.github.io/Senior-Projects/` for the landing page, or add a folder name (for example `/chroma-field/` or `/website/`).

Asset paths are relative (`./style.css`, `./script.js`), so each project works from its folder on the Pages URL.
