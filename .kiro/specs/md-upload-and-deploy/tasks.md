# Implementation Plan: Markdown Upload and Deploy

## Overview

Three coordinated changes: fix the GitHub Actions workflow permissions and hash caching, update the generator to use SHA-256 and copy the upload page, then create the `upload.html` page itself. Each area is independent and can be built in order without blocking the others.

## Tasks

- [x] 1. Fix deploy workflow — permissions and hash cache
  - [x] 1.1 Add `permissions: contents: write` to `.github/workflows/deploy.yml`
    - Insert `permissions:\n  contents: write` at the workflow top level (before `jobs:`)
    - This unblocks `peaceiris/actions-gh-pages@v4` from pushing to `gh-pages`
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Add hash-cache step to `.github/workflows/deploy.yml`
    - Insert a `Cache build hashes` step using `actions/cache@v4` after the existing `Cache node_modules` step
    - `path: output/hashes.json`
    - `key: hashes-${{ github.sha }}`
    - `restore-keys: hashes-`
    - Place the step before `npm install` so the cache is restored before the build runs
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. Fix generator — SHA-256 hashing and upload page copy
  - [x] 2.1 Replace MD5 with SHA-256 in `scripts/generate.js`
    - Change `crypto.createHash('md5')` → `crypto.createHash('sha256')` on the hash computation line inside the `files.forEach` loop
    - No other changes needed; `crypto` is already imported
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 Add `upload.html` copy step at end of `scripts/generate.js`
    - After the `fs.writeFileSync(hashFile, ...)` line, append the copy block:
      ```js
      var uploadSrc = path.join(__dirname, '..', 'upload.html');
      var uploadDest = path.join(outDir, 'upload.html');
      if (fs.existsSync(uploadSrc)) {
        fs.copyFileSync(uploadSrc, uploadDest);
        console.log('Copied: upload.html');
      } else {
        console.warn('Warning: upload.html not found at project root, skipping copy.');
      }
      ```
    - `__dirname` is `./scripts`, so the join resolves to the project root
    - Use `console.warn` (not `throw`) so existing builds without `upload.html` don't break
    - _Requirements: 9.2, 9.3_

- [ ] 3. Checkpoint — verify pipeline and generator changes
  - Run `node scripts/generate.js` locally to confirm SHA-256 hashes are written and no errors are thrown.
  - Inspect `output/hashes.json` to confirm hex digests are 64 characters (SHA-256 length).
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create `upload.html` — structure, config, and PAT input
  - [x] 4.1 Create `upload.html` at the project root with page shell, CSS, and config constants
    - Self-contained file: single `<style>` block, single inline `<script>`, no external imports
    - CSS custom properties matching the site theme: `--nav-bg: #1a1a2e`, `--nav-link: #a0c4ff`, etc.
    - Include `<nav>` with `.nav-brand` "doc2site" link and an "Upload" label
    - Define `const OWNER` and `const REPO` at the top of the inline script
    - Render a read-only repo-info paragraph: `Targeting: {OWNER}/{REPO}`
    - Add `<input type="password" id="patInput" maxlength="255">` with an associated `<label>`
    - PAT value MUST never be written to `localStorage`, `sessionStorage`, or cookies
    - Apply `outline: 3px solid #a0c4ff` on `:focus-visible` for all interactive elements
    - _Requirements: 5.1, 5.2, 7.1, 7.2, 7.3, 9.1, 9.4, 9.5_
  - [x] 4.2 Add file input, validation, and file-info display to `upload.html`
    - Add `<input type="file" id="fileInput" accept=".md">` with an associated `<label>`
    - On `change` event: validate extension ends with `.md`; validate size ≤ 750 × 1024 bytes
    - If invalid extension: populate `#errorMsg` (role="alert") and clear selection
    - If size exceeds limit: populate `#errorMsg` and clear selection
    - If valid: display filename and size in KB in `#fileInfo` (aria-live="polite"); clear `#errorMsg`
    - Add `<p id="fileInfo" aria-live="polite"></p>` and `<p id="errorMsg" role="alert"></p>` to the DOM
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 4.3 Add upload button with enable/disable gating logic
    - Add `<button id="uploadBtn" disabled>Upload & Deploy</button>`
    - Write a `checkReady()` function: enable button only when file is valid AND `patInput.value` is non-empty
    - Attach `checkReady` to `patInput` `input` event and `fileInput` `change` event
    - _Requirements: 4.4, 5.3_

- [x] 5. Implement upload handler in `upload.html`
  - [x] 5.1 Implement `handleSubmit()` — file read and base64 encoding
    - Attach `handleSubmit` to the button's `click` event
    - Disable button and show spinner text ("Uploading…") at start; re-enable and clear at end (finally block)
    - Use `FileReader.readAsText()` wrapped in a Promise to read the selected file
    - Encode with `btoa(unescape(encodeURIComponent(rawText)))` to handle UTF-8 safely
    - _Requirements: 6.6, 8.3_
  - [x] 5.2 Implement GET preflight — fetch existing file SHA
    - `GET https://api.github.com/repos/{OWNER}/{REPO}/contents/docs/{filename}`
    - Headers: `Authorization: Bearer {pat}`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`
    - If response is 200: extract `.sha` → `existingSha`
    - If response is 404: `existingSha = null`
    - If any other status: populate `#errorMsg` with status and error message; abort (return early)
    - _Requirements: 6.2, 6.3_
  - [x] 5.3 Implement PUT commit — create or update file
    - `PUT https://api.github.com/repos/{OWNER}/{REPO}/contents/docs/{filename}`
    - Body: `{ message: "docs: upload {filename} via upload page", content: b64content }` — include `sha: existingSha` only when non-null
    - Headers: same as GET plus `Content-Type: application/json`
    - If 200 or 201: populate `#successMsg` (aria-live="polite") with confirmation text and a link to `https://github.com/{OWNER}/{REPO}/actions`
    - If 401: populate `#errorMsg` with PAT-invalid message
    - If other error: populate `#errorMsg` with HTTP status code + API error message
    - _Requirements: 6.1, 6.4, 6.5, 5.4, 8.1, 8.2, 8.4_

- [ ] 6. Final checkpoint — full end-to-end review
  - Verify `upload.html` opens in a browser without console errors
  - Confirm button stays disabled until both file and PAT are provided
  - Confirm `OWNER`/`REPO` info line renders correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP — there are none here as this feature has no Correctness Properties section in the design (pure DOM/API integration, no algorithmic invariants amenable to property-based testing)
- Each task references specific requirements for traceability
- Area 1 (tasks 1.x) and Area 2 (tasks 2.x) modify existing files; read each file before editing
- The SHA-256 change in 2.1 is a one-line edit; existing `hashes.json` caches from MD5 runs will simply miss on first run and trigger a full rebuild — this is safe
- `upload.html` OWNER/REPO constants must be set to actual values before the page is usable; the design leaves them as placeholders for the maintainer to fill in

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "4.2"] },
    { "id": 2, "tasks": ["4.3"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["5.3"] }
  ]
}
```
