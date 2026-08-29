# Triage Inbox — results dashboard

A static SPA (Vite + React + TypeScript, no runtime backend) that presents a
completed evaluation run: the baseline-vs-agent comparison, per-case results, and
an interactive trajectory explorer (router → specialist → verifier, with every
tool call and result). It reads a pre-generated data bundle — **no API keys, no
server** — so it deploys to any static host.

## Data flow

```
python eval.py            # (repo root) runs the agent+baseline, writes results/ + trajectories/
python web/build_data.py  # copies results.json, trajectories, cases → web/public/data/
npm run build             # (in web/) type-checks + builds static site into web/dist/
```

`web/public/data/` is committed so the deploy host doesn't need Python. Regenerate
it with `npm run data` (an alias for `python build_data.py`) whenever you re-run
the eval.

## Run locally

```bash
cd web
npm install
npm run data     # refresh the bundle from the latest results/ (needs Python)
npm run dev      # http://localhost:5173
```

## Deploy to Vercel

**Option A — dashboard (recommended):**
1. Push the repo to GitHub.
2. In Vercel, "Add New Project" → import the repo.
3. Set **Root Directory** to `triage-inbox/web` (this folder).
4. Framework preset auto-detects **Vite**; build `npm run build`, output `dist`.
   (`vercel.json` here pins these.)
5. Deploy. No environment variables are needed — the data is bundled.

**Option B — Vercel CLI:**
```bash
cd web
npm install -g vercel
vercel --prod          # answer prompts; it builds and deploys web/dist
```

Also deploys unchanged to **Netlify** (build `npm run build`, publish `dist`) or
**GitHub Pages** (serve `dist/`). `vite.config.ts` sets `base: "./"` so assets load
from any path.

## Refreshing with new numbers

Ran the eval on a different model/provider (e.g. Claude)? From the repo root:

```bash
TRIAGE_PROVIDER=anthropic python eval.py
python web/build_data.py
```

Commit the updated `web/public/data/` and redeploy — the dashboard shows the new
run automatically (the model badge and all metrics come from `results.json`).
