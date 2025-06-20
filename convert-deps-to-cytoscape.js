// convert-deps-to-cytoscape.js
const fs = require("fs");

const deps = JSON.parse(fs.readFileSync("deps.json", "utf8"));

const nodes = new Set();
const edges = [];

deps.modules.forEach((mod) => {
  const source = mod.source.replace(/^src\//, "");
  nodes.add(source);
  (mod.dependencies || []).forEach((dep) => {
    if (dep.resolved && dep.resolved.startsWith("src/")) {
      const target = dep.resolved.replace(/^src\//, "");
      nodes.add(target);
      edges.push({ data: { source, target } });
    }
  });
});

const elements = [...[...nodes].map((id) => ({ data: { id } })), ...edges];

fs.writeFileSync("cytoscape-elements.json", JSON.stringify(elements, null, 2));
console.log("✅ 已輸出 cytoscape-elements.json");
