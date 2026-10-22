# Requirements Document

## Introduction

This spec covers two related concerns for the `doc2site` project:

1. **Deploy pipeline fix** — restore the broken GitHub Actions workflow so that pushes to `main` reliably build the site and deploy it to GitHub Pages.
2. **Markdown upload page** — add a browser-based HTML page that lets a user upload a `.md` file, commit it to `docs/` via the GitHub REST API using a Personal Access Token (PAT), and trigger the existing deployment pipeline automatically — with no manual git operations required.

The upload page is itself hosted on GitHub Pages and uses the GitHub Contents API to perform the commit programmatically.

---

## Glossary

- **Pipeline** — the GitHub Actions workflow defined in `.github/workflows/deploy.yml`.
- **Generator** — the Node.js build script at `scripts/generate.js` that converts `.md` files to HTML.
- **Upload_Page** — the static HTML page (`upload.html`) hosted on GitHub Pages that accepts file uploads.
- **GitHub_API** — the GitHub REST API v3 endpoint used to create or update files in a repository.
- **PAT** — Personal Access Token; a GitHub token with `contents: write` scope supplied by the user to authorise API commits.
- **gh-pages branch** — the branch GitHub Pages serves from, managed by `peaceiris/actions-gh-pages`.
- **docs/ directory** — the source directory containing `.md` files that the Generator processes.
- **output/ directory** — the build artefact directory containing generated HTML, served as the published site.
- **Hash_Cache** — the `output/hashes.json` file that stores per-file content hashes to enable incremental builds.

---

## Requirements

### Requirement 1: Correct GitHub Actions Permissions for Deployment

**User Story:** As a repository maintainer, I want the GitHub Actions workflow to have sufficient permissions to push to the `gh-pages` branch, so that every push to `main` results in a successful deployment.

#### Acceptance Criteria

1. THE Pipeline SHALL declare `permissions: contents: write` at the job level so that `GITHUB_TOKEN` can push to the `gh-pages` branch.
2. WHEN the Pipeline runs the `peaceiris/actions-gh-pages@v4` step, THE Pipeline SHALL supply `github_token: ${{ secrets.GITHUB_TOKEN }}` and `publish_dir: ./output`.
3. WHEN a push to the `main` branch occurs, THE Pipeline SHALL complete the build-and-deploy job without a permissions-related failure.

---

### Requirement 2: Correct Content Hash Algorithm

**User Story:** As a developer, I want the Generator to use SHA-256 for content hashing as documented, so that the Hash_Cache accurately reflects the documented behaviour and there is no discrepancy between the README and the implementation.

#### Acceptance Criteria

1. THE Generator SHALL compute per-file hashes using the SHA-256 algorithm.
2. WHEN the Generator writes `hashes.json`, THE Generator SHALL store SHA-256 hex digests for each processed file.
3. WHEN a `.md` file has not changed between builds, THE Generator SHALL skip regenerating its HTML output, based on the SHA-256 comparison.

---

### Requirement 3: Persist Hash Cache Across CI Runs

**User Story:** As a repository maintainer, I want the `hashes.json` cache to persist between GitHub Actions runs, so that the incremental build system actually skips unchanged files in CI and reduces build time.

#### Acceptance Criteria

1. THE Pipeline SHALL cache the `output/hashes.json` file between workflow runs using `actions/cache`.
2. THE Pipeline SHALL use a cache key that incorporates the SHA of the most recent commit so that the cache is invalidated when new content is pushed.
3. WHEN a cached `hashes.json` is restored, THE Generator SHALL use it to skip regenerating HTML for unchanged `.md` files.
4. WHEN no cached `hashes.json` exists, THE Generator SHALL perform a full build of all `.md` files.

---

### Requirement 4: Upload Page — File Selection and Validation

**User Story:** As a content author, I want to select a `.md` file from my local machine through a browser-based upload page, so that I can publish new documentation without using the command line or git.

#### Acceptance Criteria

1. THE Upload_Page SHALL render a file input that accepts only files with a `.md` extension.
2. WHEN a user selects a file that does not end in `.md`, THE Upload_Page SHALL display an error message stating that only Markdown files are accepted and SHALL prevent submission.
3. WHEN a user selects a valid `.md` file, THE Upload_Page SHALL display the filename and file size to confirm the selection.
4. WHEN no file has been selected, THE Upload_Page SHALL disable the upload submit button.

---

### Requirement 5: Upload Page — PAT Token Input

**User Story:** As a content author, I want to provide my GitHub Personal Access Token directly in the upload page, so that the page can authenticate with the GitHub API without requiring me to configure server-side secrets.

#### Acceptance Criteria

1. THE Upload_Page SHALL render a password-type input field for the user to enter a GitHub PAT.
2. THE Upload_Page SHALL NOT persist the PAT to `localStorage`, `sessionStorage`, cookies, or any other browser-side storage mechanism.
3. WHEN the PAT field is empty, THE Upload_Page SHALL disable the upload submit button.
4. WHEN an API call returns HTTP 401, THE Upload_Page SHALL display an error message indicating the PAT is invalid or lacks sufficient permissions.

---

### Requirement 6: Upload Page — Commit File via GitHub API

**User Story:** As a content author, I want the upload page to commit my `.md` file to the `docs/` directory of the repository, so that the CI/CD pipeline is triggered automatically without any manual git operations.

#### Acceptance Criteria

1. WHEN the user submits a valid `.md` file with a valid PAT, THE Upload_Page SHALL call the GitHub Contents API (`PUT /repos/{owner}/{repo}/contents/docs/{filename}`) to create or update the file.
2. WHEN the target file already exists in `docs/`, THE Upload_Page SHALL first retrieve the file's current SHA via a `GET` request to the GitHub Contents API, then include that SHA in the `PUT` request body.
3. WHEN the target file does not exist in `docs/`, THE Upload_Page SHALL omit the `sha` field from the `PUT` request body.
4. WHEN the API call succeeds (HTTP 200 or 201), THE Upload_Page SHALL display a success message that includes the URL of the file on the `main` branch.
5. THE Upload_Page SHALL use `"Content-Type": "application/json"` and include a commit message of the form `"docs: upload {filename} via upload page"` in the API request body.
6. WHEN the file content is read from the local filesystem, THE Upload_Page SHALL encode it as Base64 before including it in the API request body.

---

### Requirement 7: Upload Page — Repository Configuration

**User Story:** As a content author, I want the upload page to target the correct repository and owner, so that files are committed to the right place without requiring me to configure repository details manually.

#### Acceptance Criteria

1. THE Upload_Page SHALL include a configuration section where the repository owner (GitHub username or org) and repository name are defined as constants.
2. WHEN the upload page is loaded, THE Upload_Page SHALL display the currently configured owner and repository name so the user can verify the target.
3. THE Upload_Page SHALL construct all GitHub API URLs using the configured owner and repository name constants.

---

### Requirement 8: Upload Page — Deployment Status Feedback

**User Story:** As a content author, I want feedback after uploading a file confirming that the deployment pipeline has been triggered, so that I know my content will be live on GitHub Pages shortly.

#### Acceptance Criteria

1. WHEN the API commit call succeeds, THE Upload_Page SHALL display a message informing the user that the GitHub Actions pipeline has been triggered and the site will update within a few minutes.
2. THE Upload_Page SHALL provide a direct link to the repository's Actions tab (`https://github.com/{owner}/{repo}/actions`) so the user can monitor pipeline progress.
3. WHEN the API call is in progress, THE Upload_Page SHALL display a loading indicator and disable the submit button to prevent duplicate submissions.
4. WHEN the API call fails for any reason other than HTTP 401, THE Upload_Page SHALL display the HTTP status code and the error message returned by the GitHub API.

---

### Requirement 9: Upload Page — Accessibility and Hosting

**User Story:** As a content author, I want the upload page to be accessible directly on the GitHub Pages site, so that I can upload files from any browser without any local setup.

#### Acceptance Criteria

1. THE Upload_Page SHALL be a self-contained HTML file that requires no server-side runtime, build step, or external JavaScript framework.
2. THE Upload_Page SHALL be placed in the `output/` directory during the build step so that `peaceiris/actions-gh-pages@v4` deploys it alongside the generated HTML pages.
3. THE Generator SHALL copy `upload.html` from the project root (or a designated source location) to the `output/` directory during the build.
4. WHEN rendered in a browser, THE Upload_Page SHALL meet WCAG 2.1 Level AA contrast requirements for all visible text and interactive elements.
5. ALL interactive elements on THE Upload_Page SHALL be operable via keyboard navigation alone.
