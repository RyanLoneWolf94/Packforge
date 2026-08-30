# Brand assets

Drop the LoneWolf logo files here (in `public/`) with these exact names. The app
references them by path and renders a text fallback until they exist.

| File | Use | Background | Notes |
|---|---|---|---|
| `lonewolf-logo.png` | Client portal header | Light | Full-colour orange→purple mark. Transparent PNG (or SVG) recommended. |
| `lonewolf-logo-light.png` | Admin sidebar | Dark | White / reversed version of the mark. |
| `favicon.png` | Browser tab icon | — | Square crop of just the wolf, ideally 256×256. |

Vite serves everything in `public/` from the site root, so `public/lonewolf-logo.png`
is available at `/lonewolf-logo.png`. No import or rebuild step is needed — just add
the files and refresh.

SVG works too: if you have vector versions, save them as `.png`-named exports here,
or rename the references in `src/components/Logo.tsx` and `index.html` to `.svg`.
