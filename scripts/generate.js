const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const docsDir = './docs';
const outDir = './output';

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));

const routes = files.map(file => ({
  title: file.replace('.md', ''),
  url: '/doc2site/' + file.replace('.md', '.html')
}));

fs.writeFileSync(path.join(outDir, 'routes.json'), JSON.stringify(routes, null, 2));

const navLinks = routes.map(r => `<a href="${r.url}">${r.title}</a>`).join(' | ');

files.forEach(file => {
  const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${file.replace('.md', '')}</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    nav { margin-bottom: 20px; }
    nav a { margin-right: 10px; text-decoration: none; color: #0066cc; }
  </style>
</head>
<body>
  <nav>${navLinks}</nav>
  ${marked(content)}
</body>
</html>`;
  fs.writeFileSync(path.join(outDir, file.replace('.md', '.html')), html);
  console.log('Generated:', file);
});
