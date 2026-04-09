const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const crypto = require('crypto');

const docsDir = './docs';
const outDir = './output';
const stylesDir = './styles';
const hashFile = './output/hashes.json';

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));

// Load previous hashes
let oldHashes = {};
if (fs.existsSync(hashFile)) {
  oldHashes = JSON.parse(fs.readFileSync(hashFile, 'utf-8'));
}
const newHashes = {};

const routes = files.map(file => ({
  title: file.replace('.md', ''),
  url: '/doc2site/' + file.replace('.md', '.html')
}));

fs.writeFileSync(path.join(outDir, 'routes.json'), JSON.stringify(routes, null, 2));

const navLinks = routes
  .filter(r => r.title !== 'index')
  .map(r => `<a href="${r.url}">${r.title}</a>`)
  .join('');

const baseStyles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.7;
    transition: background 0.3s, color 0.3s;
  }

  :root {
    --bg: #f9fafb;
    --text: #1a1a2e;
    --nav-bg: #1a1a2e;
    --nav-link: #a0c4ff;
    --container-bg: #ffffff;
    --shadow: rgba(0,0,0,0.08);
    --code-bg: #f0f4ff;
    --pre-bg: #1e1e2e;
    --pre-text: #cdd6f4;
    --blockquote-bg: #f0f4ff;
    --border: #e0e0e0;
    --h1-border: #a0c4ff;
    --search-bg: #ffffff;
    --search-border: #ccc;
    --tag-bg: #e8f0ff;
    --tag-text: #0066cc;
  }

  body.dark {
    --bg: #0f0f1a;
    --text: #e0e0f0;
    --nav-bg: #0a0a14;
    --nav-link: #7eb8ff;
    --container-bg: #1a1a2e;
    --shadow: rgba(0,0,0,0.4);
    --code-bg: #2a2a3e;
    --pre-bg: #0d0d1a;
    --pre-text: #cdd6f4;
    --blockquote-bg: #1e1e32;
    --border: #2a2a3e;
    --h1-border: #7eb8ff;
    --search-bg: #1a1a2e;
    --search-border: #3a3a5e;
    --tag-bg: #1e2a3e;
    --tag-text: #7eb8ff;
  }

  nav {
    background: var(--nav-bg);
    padding: 14px 40px;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2px 12px var(--shadow);
  }

  .nav-brand {
    color: #ffffff;
    font-weight: 700;
    font-size: 1.1rem;
    text-decoration: none;
    margin-right: 10px;
  }

  nav a {
    color: var(--nav-link);
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 20px;
    transition: background 0.2s, color 0.2s;
  }

  nav a:hover {
    background: rgba(160,196,255,0.15);
    color: #ffffff;
  }

  .nav-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .search-box {
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid var(--search-border);
    background: var(--search-bg);
    color: var(--text);
    font-size: 0.85rem;
    width: 200px;
    outline: none;
    transition: border 0.2s;
  }

  .search-box:focus { border-color: #a0c4ff; }

  .search-results {
    position: absolute;
    top: 54px;
    right: 40px;
    background: var(--container-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 24px var(--shadow);
    width: 260px;
    z-index: 200;
    display: none;
    overflow: hidden;
  }

  .search-results a {
    display: block;
    padding: 10px 16px;
    color: var(--text);
    text-decoration: none;
    font-size: 0.9rem;
    border-bottom: 1px solid var(--border);
    transition: background 0.2s;
  }

  .search-results a:hover { background: var(--code-bg); }

  .theme-toggle {
    background: none;
    border: 1px solid var(--nav-link);
    color: var(--nav-link);
    border-radius: 20px;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .theme-toggle:hover {
    background: var(--nav-link);
    color: #1a1a2e;
  }

  .container {
    max-width: 860px;
    margin: 48px auto;
    padding: 48px;
    background: var(--container-bg);
    border-radius: 16px;
    box-shadow: 0 4px 24px var(--shadow);
  }

  h1 {
    font-size: 2.4rem;
    font-weight: 800;
    color: var(--text);
    margin-bottom: 16px;
    border-bottom: 3px solid var(--h1-border);
    padding-bottom: 12px;
  }

  h2 {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text);
    margin: 36px 0 12px;
  }

  h3 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text);
    margin: 24px 0 8px;
  }

  p { font-size: 1rem; margin-bottom: 16px; }

  a { color: #0066cc; }

  code {
    background: var(--code-bg);
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 0.88rem;
    font-family: 'Courier New', monospace;
    color: #d63384;
  }

  pre {
    background: var(--pre-bg);
    color: var(--pre-text);
    padding: 20px;
    border-radius: 10px;
    overflow-x: auto;
    margin-bottom: 20px;
    font-size: 0.9rem;
  }

  pre code { background: none; color: inherit; padding: 0; }

  ul, ol { padding-left: 24px; margin-bottom: 16px; }
  li { margin-bottom: 6px; }

  blockquote {
    border-left: 4px solid var(--h1-border);
    padding: 12px 20px;
    background: var(--blockquote-bg);
    border-radius: 0 10px 10px 0;
    margin-bottom: 16px;
    color: var(--text);
    font-style: italic;
  }

  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: var(--nav-bg); color: #fff; padding: 10px 14px; text-align: left; }
  td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
  tr:nth-child(even) { background: var(--code-bg); }

  img { max-width: 100%; border-radius: 10px; margin: 16px 0; }
  hr { border: none; border-top: 2px solid var(--border); margin: 32px 0; }

  @media (max-width: 600px) {
    .container { padding: 24px 16px; margin: 16px; }
    nav { padding: 12px 16px; }
    .search-box { width: 130px; }
    h1 { font-size: 1.8rem; }
  }
`;

const scriptTag = `
<script>
  const toggle = document.getElementById('themeToggle');
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
    toggle.textContent = '☀️ Light';
  }
  toggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    toggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
  });

  const searchBox = document.getElementById('searchBox');
  const searchResults = document.getElementById('searchResults');

  fetch('/doc2site/routes.json')
    .then(r => r.json())
    .then(routes => {
      searchBox.addEventListener('input', () => {
        const q = searchBox.value.toLowerCase().trim();
        if (!q) { searchResults.style.display = 'none'; return; }
        const matches = routes.filter(r => r.title.toLowerCase().includes(q));
        if (matches.length === 0) { searchResults.style.display = 'none'; return; }
        searchResults.innerHTML = matches.map(r =>
          \`<a href="\${r.url}">\${r.title}</a>\`
        ).join('');
        searchResults.style.display = 'block';
      });

      document.addEventListener('click', (e) => {
        if (!searchBox.contains(e.target)) searchResults.style.display = 'none';
      });
    });
</script>
`;

files.forEach(file => {
  const name = file.replace('.md', '');
  const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');

  // Incremental build — skip if unchanged
  const hash = crypto.createHash('md5').update(content).digest('hex');
  newHashes[name] = hash;
  if (oldHashes[name] === hash && fs.existsSync(path.join(outDir, file.replace('.md', '.html')))) {
    console.log('Skipped (unchanged):', file);
    return;
  }

  // Load custom CSS
  let customStyles = '';
  const customCssPath = path.join(stylesDir, name + '.css');
  if (fs.existsSync(customCssPath)) {
    customStyles = fs.readFileSync(customCssPath, 'utf-8');
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} — doc2site</title>
  <style>
${baseStyles}
${customStyles}
  </style>
</head>
<body>
  <nav>
    <a class="nav-brand" href="/doc2site/">doc2site</a>
    ${navLinks}
    <div class="nav-right">
      <input class="search-box" id="searchBox" type="text" placeholder="Search pages..." />
      <div class="search-results" id="searchResults"></div>
      <button class="theme-toggle" id="themeToggle">🌙 Dark</button>
    </div>
  </nav>
  <div class="container">
    ${marked(content)}
  </div>
  ${scriptTag}
</body>
</html>`;

  fs.writeFileSync(path.join(outDir, file.replace('.md', '.html')), html);
  console.log('Generated:', file);
});

// Save new hashes
fs.writeFileSync(hashFile, JSON.stringify(newHashes, null, 2));    background: #1a1a2e;
    padding: 14px 40px;
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }

  nav a {
    color: #a0c4ff;
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 500;
    transition: color 0.2s;
  }

  nav a:hover { color: #ffffff; }

  .container {
    max-width: 860px;
    margin: 48px auto;
    padding: 0 24px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.07);
    padding: 48px;
  }

  h1 {
    font-size: 2.2rem;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 16px;
    border-bottom: 3px solid #a0c4ff;
    padding-bottom: 10px;
  }

  h2 {
    font-size: 1.6rem;
    font-weight: 600;
    color: #2d2d5e;
    margin: 32px 0 12px;
  }

  h3 {
    font-size: 1.2rem;
    font-weight: 600;
    color: #3a3a6e;
    margin: 24px 0 8px;
  }

  p {
    font-size: 1rem;
    margin-bottom: 16px;
    color: #333;
  }

  a { color: #0066cc; }

  code {
    background: #f0f4ff;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 0.9rem;
    font-family: 'Courier New', monospace;
    color: #d63384;
  }

  pre {
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 20px;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 20px;
    font-size: 0.9rem;
  }

  pre code {
    background: none;
    color: inherit;
    padding: 0;
  }

  ul, ol {
    padding-left: 24px;
    margin-bottom: 16px;
  }

  li { margin-bottom: 6px; }

  blockquote {
    border-left: 4px solid #a0c4ff;
    padding: 10px 20px;
    background: #f0f4ff;
    border-radius: 0 8px 8px 0;
    margin-bottom: 16px;
    color: #555;
    font-style: italic;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }

  th {
    background: #1a1a2e;
    color: #fff;
    padding: 10px 14px;
    text-align: left;
  }

  td {
    padding: 10px 14px;
    border-bottom: 1px solid #e0e0e0;
  }

  tr:nth-child(even) { background: #f5f7ff; }

  img {
    max-width: 100%;
    border-radius: 8px;
    margin: 16px 0;
  }

  hr {
    border: none;
    border-top: 2px solid #e0e0e0;
    margin: 32px 0;
  }
`;

files.forEach(file => {
  const name = file.replace('.md', '');
  const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');

  // Load custom CSS if a same-name .css file exists in styles/
  let customStyles = '';
  const customCssPath = path.join(stylesDir, name + '.css');
  if (fs.existsSync(customCssPath)) {
    customStyles = fs.readFileSync(customCssPath, 'utf-8');
    console.log('Applied custom styles for:', name);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>
${baseStyles}
${customStyles}
  </style>
</head>
<body>
  <nav>${navLinks}</nav>
  <div class="container">
    ${marked(content)}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(outDir, file.replace('.md', '.html')), html);
  console.log('Generated:', file);
});
