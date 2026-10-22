# Design Document

## Overview

Two coordinated changes to the `doc2site` project:

1. **Pipeline fix** — patch `.github/workflows/deploy.yml` and `scripts/generate.js` so the GitHub Actions deployment works correctly and the incremental build actually does what the README says.
2. **Upload page** — add `upload.html`, a zero-dependency static page that lets a user commit a `.md` file to `docs/` via the GitHub Contents API, triggering the pipeline automatically.

---

## Architecture

### Files changed

| File | Change type | What changes |
|---|---|---|
| `.github/workflows/deploy.yml` | Modified | Add `permissions: contents: write`; add hash-cache step |
| `scripts/generate.js` | Modified | MD5 → SHA-256; add `upload.html` copy step |
| `upload.html` | New | The browser upload page (project root) |

No new dependencies. No new npm packages. Everything runs in the existing Node 20 + browser environment.

### How the pieces connect

```
[User browser]
  │  picks .md file, enters PAT
  ▼
[upload.html — GitHub Pages]
  │  FileReader → base64
  │  GET /repos/{owner}/{repo}/contents/docs/{filename}  ← get existing SHA (if any)
  │  PUT /repos/{owner}/{repo}/contents/docs/{filename}  ← commit file
  ▼
[GitHub main branch — docs/{filename}.md added]
  │  push event triggers workflow
  ▼
[GitHub Actions — deploy.yml]
  │  checkout → npm install → npm run build → deploy
  ▼
[GitHub Pages — output/ published]
  │  upload.html copied into output/ by generate.js
  ▼
[Live site: https://{owner}.github.io/doc2site/{filename}.html]
```

---

## Component Design

### 1. Deploy workflow fix — `deploy.yml`

**Problem:** `peaceiris/actions-gh-pages@v4` pushes to the `gh-pages` branch, which requires write access to repo contents. Without an explicit `permissions` block, GitHub Actions uses a read-only token by default in newer repos, causing a 403 on push.

**Fix:** Add `permissions: contents: write` at the job level, and add a cache step for `output/hashes.json` so the incremental build is actually incremental in CI.

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('package.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - name: Cache build hashes
        uses: actions/cache@v4
        with:
          path: output/hashes.json
          key: hashes-${{ github.sha }}
          restore-keys: |
            hashes-

      - run: npm install

      - run: npm run build

      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./output
```

**Why `permissions` at the top level (not job level):** Placing it at the workflow top level is simpler and applies to all jobs. For a single-job workflow this is equivalent.

**Cache key design:** `hashes-${{ github.sha }}` creates a new cache entry on every push (since the SHA changes), but `restore-keys: hashes-` falls back to the most recent previous cache. This means the generator always sees the last known good hashes and only regenerates changed files.

---

### 2. Generator fix — `scripts/generate.js`

Two changes:

**a) MD5 → SHA-256**

```js
// Before
var hash = crypto.createHash('md5').update(content).digest('hex');

// After
var hash = crypto.createHash('sha256').update(content).digest('hex');
```

This aligns the implementation with the README. The `crypto` module is already imported — no other changes needed to the hash logic.

**b) Copy `upload.html` to `output/`**

At the end of the script, after writing `hashes.json`, add:

```js
// Copy upload page into output so it is deployed to GitHub Pages
var uploadSrc = path.join(__dirname, '..', 'upload.html');
var uploadDest = path.join(outDir, 'upload.html');
if (fs.existsSync(uploadSrc)) {
  fs.copyFileSync(uploadSrc, uploadDest);
  console.log('Copied: upload.html');
} else {
  console.warn('Warning: upload.html not found at project root, skipping copy.');
}
```

`__dirname` is `./scripts`, so `path.join(__dirname, '..', 'upload.html')` resolves to the project root `upload.html`. The warning (not an error) means existing builds without `upload.html` don't break.

---

### 3. Upload page — `upload.html`

A single self-contained HTML file. No bundler, no framework, no CDN imports. Ships to GitHub Pages via the Generator copy step.

#### Configuration constants

At the top of the inline `<script>`:

```js
const OWNER = 'YOUR_GITHUB_USERNAME'; // ← user sets this once
const REPO  = 'doc2site';
```

These two constants drive every GitHub API URL in the file. The page renders them in a read-only info line so the user can verify the target before uploading.

#### State model

The submit button is enabled only when **both** conditions are true:
- A `.md` file ≤ 750 KB has been selected
- The PAT input is non-empty

Any change to either input re-evaluates this condition synchronously.

#### Upload flow (sequential async steps)

```
handleSubmit()
  │
  ├─ 1. Read file with FileReader.readAsText()
  │       → rawText (string)
  │
  ├─ 2. Base64-encode: btoa(unescape(encodeURIComponent(rawText)))
  │       → b64content
  │       (handles UTF-8 multibyte chars correctly)
  │
  ├─ 3. GET https://api.github.com/repos/{OWNER}/{REPO}/contents/docs/{filename}
  │       Authorization: Bearer {pat}
  │       → if 200: extract .sha → existingSha
  │       → if 404: existingSha = null
  │       → if other error: show error, abort
  │
  ├─ 4. PUT https://api.github.com/repos/{OWNER}/{REPO}/contents/docs/{filename}
  │       body: { message, content: b64content, [sha: existingSha] }
  │       → if 200 or 201: show success + Actions link
  │       → if 401: show PAT error
  │       → if other: show status code + API error message
  │
  └─ 5. Re-enable submit button, clear loading state
```

#### GitHub API request shapes

**GET — check for existing file:**
```
GET https://api.github.com/repos/{OWNER}/{REPO}/contents/docs/{filename}
Headers:
  Authorization: Bearer {pat}
  Accept: application/vnd.github+json
  X-GitHub-Api-Version: 2022-11-28
```

**PUT — commit file:**
```
PUT https://api.github.com/repos/{OWNER}/{REPO}/contents/docs/{filename}
Headers:
  Authorization: Bearer {pat}
  Accept: application/vnd.github+json
  Content-Type: application/json
  X-GitHub-Api-Version: 2022-11-28
Body:
{
  "message": "docs: upload {filename} via upload page",
  "content": "{base64-encoded file content}",
  "sha": "{existing file SHA}"   ← omitted if file is new
}
```

#### Security constraints

- The PAT is held only in the `<input type="password">` DOM value during the session. It is never written to `localStorage`, `sessionStorage`, or any cookie.
- No data is sent to any server except `api.github.com`.
- The page does not log or echo the PAT in any visible element.

#### UI structure

```
<nav>  doc2site brand + "Upload" label
<main>
  <div class="container">
    <h1>Upload Markdown</h1>
    <p class="repo-info">Targeting: {OWNER}/{REPO}</p>

    <label>GitHub Personal Access Token
      <input type="password" id="patInput" maxlength="255" />
    </label>

    <label>Markdown file (.md, max 750 KB)
      <input type="file" id="fileInput" accept=".md" />
    </label>

    <p id="fileInfo" aria-live="polite"></p>   ← shows filename + size
    <p id="errorMsg" role="alert"></p>          ← validation + API errors
    <p id="successMsg" aria-live="polite"></p>  ← success + Actions link

    <button id="uploadBtn" disabled>Upload & Deploy</button>
  </div>
</main>
```

`aria-live="polite"` on status regions means screen readers announce updates without interrupting the user. `role="alert"` on the error region announces immediately.

#### Visual style

The page reuses the same CSS custom properties and nav style as the generated doc pages (`--nav-bg: #1a1a2e`, `--nav-link: #a0c4ff`, etc.) so it looks like a native part of the site. The container, button, and input styles are written inline in the `<style>` block to keep the file self-contained.

#### Accessibility

- All inputs have associated `<label>` elements (explicit `for`/`id` pairing).
- The submit button uses a native `<button>` element — keyboard operable by default.
- Focus styles: `outline: 3px solid #a0c4ff` on `:focus-visible` for all interactive elements (meets 3:1 contrast ratio against the dark nav background and the light container background).
- Status regions use `aria-live` and `role="alert"` as described above.
- Tab order follows DOM order: PAT input → file input → upload button.

---

## Key Design Decisions

**Why a PAT in the browser instead of a backend?**
This is a static GitHub Pages site — there is no server to hold secrets. The GitHub Contents API supports CORS for browser requests with a PAT, so a fully client-side approach works. The tradeoff is that the user must supply their own PAT, but this is acceptable for a personal/team doc tool.

**Why GET-then-PUT instead of just PUT?**
The GitHub Contents API requires the current file's SHA when updating an existing file. Omitting the SHA on an update returns HTTP 422. The GET is a necessary preflight check, not a performance concern.

**Why `btoa(unescape(encodeURIComponent(text)))` for Base64?**
Plain `btoa(text)` throws on any non-Latin-1 character (e.g. UTF-8 markdown with em dashes or emoji). The `encodeURIComponent` + `unescape` pattern expands multi-byte chars to their percent-encoded Latin-1 representation before `btoa`, making it safe for any valid UTF-8 markdown file.

**Why copy `upload.html` from root to `output/` in generate.js instead of committing it directly to `output/`?**
The `output/` directory is the build artefact — it is regenerated on every build and managed by the Generator. Source files belong at the project root or in designated source directories. Keeping `upload.html` at the root makes it clear it is a source file, not a generated artefact, while the copy step ensures it always ends up in the deployed output.

**Why 750 KB file size limit?**
The GitHub Contents API has a hard 1 MB limit on file content in a single API call. Base64 encoding inflates size by ~33%, so a 750 KB raw file becomes ~1 MB encoded — right at the limit. Capping at 750 KB gives a safe margin.
