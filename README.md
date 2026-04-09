# Doc2Site 

A scalable, high-performance Markdown-to-static-site generator engineered with **incremental builds**, **SHA-256 content hashing**, and **CI/CD pipeline caching** to eliminate redundant computation.

---

## 📌 Overview

Doc2Site is designed to solve the scalability bottlenecks inherent in traditional static site generators. By implementing a state-aware build engine, it ensures that only modified content is processed, significantly reducing build times for large-scale documentation projects.

---

## ⚠️ The Problem: Computational Waste

### 1. Full Rebuild Redundancy
- **Issue:** Traditional generators rebuild the entire site on every commit.
- **Impact:** Inefficient for large repositories; Time Complexity remains **$O(N)$**.

### 2. Ephemeral CI Environments
- **Issue:** GitHub Actions runners start with a fresh state, losing previous build context.
- **Impact:** Increased resource consumption and longer deployment cycles.

---

## ✅ The Solution: Intelligent Incrementalism

Doc2Site optimizes the build lifecycle through:
- **Incremental Build System:** Processes only the delta ($k$ changed files).
- **Cryptographic Change Detection:** Utilizes SHA-256 hashing to detect content mutations.
- **Persistent CI Caching:** Integrates with `actions/cache` to persist `hashes.json` across workflow runs.

---

## ⚙️ System Architecture

### 🔄 Build Pipeline Logic


1. **Scan:** Identify all `.md` files in the source directory.
2. **Hash:** Generate SHA-256 signatures for current files.
3. **Compare:** Evaluate current hashes against the cached `hashes.json`.
4. **Transform:** Invoke the `marked` parser only for files where hashes mismatch.
5. **Update:** Synchronize the cache and deploy generated HTML to `/output`.

---

## 🧩 Core Features

* ⚡ **Efficiency:** $O(k)$ build time where $k$ is the number of changed files.
* 🧠 **State Awareness:** Intelligent detection of file deletions and updates.
* 💾 **CI Integration:** Pre-configured for GitHub Actions persistence.
* 📄 **Clean Output:** Generates minified, SEO-friendly static HTML.
* 🔐 **Security-First:** Built-in input sanitization and path normalization.

---

## 🧰 Tech Stack & Ecosystem

| Tool | Role |
| :--- | :--- |
| **Node.js** | Core runtime environment |
| **marked (v9)** | High-speed Markdown-to-HTML parsing |
| **SHA-256** | Data integrity and change detection |
| **GitHub Actions** | Automated CI/CD and deployment orchestration |
| **GitHub Pages** | High-availability static content hosting |

---

## 📁 Project Structure

```text
Doc2Site/
├── docs/              # Source Markdown files
├── output/            # Distribution directory (Generated HTML)
│   └── hashes.json    # Local state cache
├── styles/            # CSS assets
├── generate.js        # Core build engine logic
├── package.json       # Dependency management
└── .github/           # CI/CD workflow definitions

---

## 🚀 Usage

### Install Dependencies
```bash
npm install
node generate.js
```

output
  ├── *.html
  └── hashes.json

  
