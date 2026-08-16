# Contributing

Thanks for your interest in **June Gun Game**! This is a single-file browser prototype, so
the contribution bar is low.

## Getting started

```sh
git clone git@github.com:sunritb/june-gun-game.git
cd june-gun-game
npm ci
```

Edit files under `src/`, then rebuild the playable bundle:

```sh
node build.mjs
```

Open `index.html` (or run `python3 -m http.server 8123`) to test your changes.

## Pull requests

1. Fork the repo and create a branch: `git checkout -b feat/my-thing`.
2. Make focused changes; keep the diff small and readable.
3. Run the checks locally before pushing:
   ```sh
   for f in src/*.js; do node --check "$f"; done
   node build.mjs
   ```
4. CI runs `node --check` + `node build.mjs` on every PR. Make sure it's green.
5. Open a PR against `main`. Note that merging to `main` **auto-deploys** the live site.

## Style

- No comments unless they explain *why* (not what).
- ES modules, `import * as THREE from 'three'`, no build tools beyond esbuild.
- Keep `node --check` clean — no syntax errors, no shadowed method/field names.

## Reporting bugs

Open an issue. For anything security-related, use the
[Security Advisories](SECURITY.md) flow instead.
