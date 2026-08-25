/**
 * Migrate inline ui-search-wrap blocks to shared SearchBar component.
 * Reference: Vendors page (ui-input w-full !rounded-full !pl-10)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, "../src");

const SKIP_DIRS = new Set(["node_modules", "dist", "__tests__"]);
const SEARCH_BAR_IMPORT = 'import { SearchBar } from "../../components/common/SearchFilter";';
const SEARCH_BAR_IMPORT_DEPTH = [
  ["pages", 'import { SearchBar } from "../../components/common/SearchFilter";'],
  ["components", 'import { SearchBar } from "./SearchFilter";'],
];

const blockRegex =
  /<div className="([^"]*ui-search-wrap[^"]*)">\s*<Search[\s\S]*?\/>\s*<input\s+([\s\S]*?)\/>\s*<\/div>/g;

function parseInputAttrs(attrs) {
  const value = attrs.match(/value=\{([^}]+)\}/)?.[1]?.trim();
  let setter = null;
  const onChangeArrow = attrs.match(/onChange=\{\(e\)\s*=>\s*(\w+)\(e\.target\.value\)\}/);
  const onChangeDirect = attrs.match(/onChange=\{(\w+)\}/);
  if (onChangeArrow) setter = onChangeArrow[1];
  else if (onChangeDirect) setter = onChangeDirect[1];
  const placeholder = attrs.match(/placeholder="([^"]*)"/)?.[1] ?? "Search";
  return { value, setter, placeholder };
}

function wrapClassToProp(wrapClass) {
  const extra = wrapClass
    .replace(/relative/g, "")
    .replace(/ui-search-wrap/g, "")
    .replace(/min-w-\[[^\]]+\]/g, "")
    .replace(/flex-1/g, "")
    .replace(/min-w-0/g, "")
    .replace(/w-full/g, "")
    .trim();
  if (!extra) return 'className="w-full"';
  return `className="${extra.trim()}"`;
}

function ensureImport(content, filePath) {
  if (content.includes("SearchBar")) return content;
  const rel = path.relative(srcRoot, filePath).replace(/\\/g, "/");
  let importLine = SEARCH_BAR_IMPORT;
  if (rel.startsWith("components/")) {
    importLine = 'import { SearchBar } from "./SearchFilter";';
  } else if (rel.startsWith("pages/")) {
    const depth = rel.split("/").length - 2;
    importLine = `import { SearchBar } from "${"../".repeat(depth)}components/common/SearchFilter";`;
  }
  const importMatch = content.match(/^import .+;$/m);
  if (importMatch) {
    const idx = content.indexOf(importMatch[0]) + importMatch[0].length;
    return content.slice(0, idx) + "\n" + importLine + content.slice(idx);
  }
  return importLine + "\n" + content;
}

function removeSearchImport(content) {
  if (!/<Search[\s\S]*?\/>/.test(content)) {
    content = content.replace(
      /import\s+\{([^}]*)\bSearch\b([^}]*)\}\s+from\s+"lucide-react";\n?/g,
      (_, before, after) => {
        const names = `${before}${after}`
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (names.length === 0) return "";
        return `import { ${names.join(", ")} } from "lucide-react";\n`;
      }
    );
  }
  return content;
}

function migrateContent(content, filePath) {
  let changed = false;
  const next = content.replace(blockRegex, (match, wrapClass, inputAttrs) => {
    const { value, setter, placeholder } = parseInputAttrs(inputAttrs);
    if (!value || !setter) return match;
    changed = true;
    const classProp = wrapClassToProp(wrapClass);
    return `<SearchBar value={${value}} onChange={${setter}} placeholder="${placeholder}" ${classProp} />`;
  });
  if (!changed) return content;
  let out = ensureImport(next, filePath);
  out = removeSearchImport(out);
  return out;
}

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (/\.(jsx|tsx)$/.test(name)) files.push(full);
  }
  return files;
}

const files = walk(srcRoot);
let migrated = 0;
for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  if (!raw.includes("ui-search-wrap")) continue;
  const updated = migrateContent(raw, file);
  if (updated !== raw) {
    fs.writeFileSync(file, updated);
    migrated += 1;
    console.log("migrated:", path.relative(srcRoot, file));
  }
}
console.log(`Done. ${migrated} file(s) updated.`);
