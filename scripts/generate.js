const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const docsDir = path.join(__dirname, "../docs");
const siteDir = path.join(__dirname, "../site");

if (!fs.existsSync(siteDir)) {
  fs.mkdirSync(siteDir);
}

const routes = {};

const files = fs.readdirSync(docsDir);

files.forEach(file => {
  if (file.endsWith(".md")) {
    const content = fs.readFileSync(path.join(docsDir, file), "utf-8");
    const html = marked(content);

    const name = file.replace(".md", "");
    const outputPath = path.join(siteDir, `${name}.html`);

    fs.writeFileSync(outputPath, html);

    routes[name] = `/site/${name}.html`;
  }
});

fs.writeFileSync(
  path.join(__dirname, "../index.json"),
  JSON.stringify(routes, null, 2)
);

console.log("Done!");
