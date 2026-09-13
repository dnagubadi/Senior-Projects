# Senior-Projects
Atlas Project, and sub projects

## Chroma Field

A static GitHub Pages app that maps live microphone audio to RGB and hex color. Audio is analyzed in the browser with the Web Audio API and is never sent to a server.

### Local preview

Because microphone access needs a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), open the folder over `localhost` rather than a `file://` URL:

```bash
cd Senior-Projects
python3 -m http.server 8080
```

Then visit `http://localhost:8080`, click **Enable Microphone**, and allow access.

### GitHub Pages

1. Push this repository to GitHub (`dnagubadi/Senior-Projects`).
2. Open **Settings → Pages**.
3. Set **Build and deployment → Source** to **Deploy from a branch**.
4. Choose branch `main` and folder `/ (root)`.
5. After the site publishes, open `https://dnagubadi.github.io/Senior-Projects/`.

Asset paths are relative (`./style.css`, `./script.js`), so the app works at the repository Pages URL.
