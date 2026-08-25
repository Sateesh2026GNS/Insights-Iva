/**
 * Migrates embedded form picker searches to SearchBar size="compact".
 * Run: node scripts/migrate-compact-search.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, "..", "src");

const simpleLineItemRe =
  /<div className="relative min-w-\[(160|180)px\]">\s*<Search className="pointer-events-none absolute left-2 top-1\/2 h-3\.5 w-3\.5 -translate-y-1\/2 text-\[#9a9aa5\]" \/>\s*<input\s*value=\{row\.item_description\}\s*onChange=\{\(e\) => updateItem\(idx, "item_description", e\.target\.value\)\}\s*placeholder="Select Item"\s*className="w-full rounded-md border border-\[#d0d0d8\] bg-\[#f7f7f9\] py-1\.5 pl-7 pr-2 text-\[12px\]"\s*\/>\s*<\/div>/g;

const simpleLineItemReplacement = `<div className="relative min-w-[$1px]">
                          <SearchBar
                            size="compact"
                            value={row.item_description}
                            onChange={(v) => updateItem(idx, "item_description", v)}
                            placeholder="Select Item"
                            clearable={false}
                            className="w-full"
                          />
                        </div>`;

const buyerPickerRe =
  /<div className="relative mb-2">\s*<Search className="pointer-events-none absolute left-3 top-1\/2 h-4 w-4 -translate-y-1\/2 text-\[#9a9aa5\]" \/>\s*<input\s*type="search"\s*placeholder="Search"\s*value=\{(\w+)\}\s*onChange=\{\(e\) => set(\w+)\(e\.target\.value\)\}\s*className="w-full rounded-lg border border-\[#e4e4ea\] bg-white py-2 pl-9 pr-3 text-\[13px\]"\s*\/>\s*<\/div>/g;

const buyerPickerReplacement = `<SearchBar
                  size="compact"
                  value={$1}
                  onChange={set$2}
                  placeholder="Search"
                  className="mb-2 w-full"
                />`;

const formFiles = [
  "pages/sales/QuotationForm.jsx",
  "pages/sales/TaxInvoiceForm.jsx",
  "pages/sales/DeliveryChallanForm.jsx",
  "pages/sales/DebitNoteForm.jsx",
  "pages/sales/ProformaInvoiceForm.jsx",
  "pages/sales/ExportInvoiceForm.jsx",
  "pages/sales/CreditNoteForm.jsx",
  "pages/purchases/PurchaseForm.jsx",
  "pages/purchases/PurchaseDebitNoteForm.jsx",
  "pages/procurement/CreatePurchaseOrder.jsx",
];

const lineItemFiles = [...formFiles];

function ensureSearchBarImport(content, filePath) {
  if (content.includes("SearchBar")) return content;
  if (content.includes('from "../../components/common/SearchFilter"')) {
    return content.replace(
      /import \{([^}]+)\} from "\.\.\/\.\.\/components\/common\/SearchFilter";/,
      (m, imports) => {
        if (imports.includes("SearchBar")) return m;
        return `import { SearchBar${imports.trim() ? `,${imports}` : ""} } from "../../components/common/SearchFilter";`;
      }
    );
  }
  if (content.includes('from "../components/common/SearchFilter"')) {
    return content.replace(
      /import \{([^}]+)\} from "\.\.\/components\/common\/SearchFilter";/,
      (m, imports) => {
        if (imports.includes("SearchBar")) return m;
        return `import { SearchBar${imports.trim() ? `,${imports}` : ""} } from "../components/common/SearchFilter";`;
      }
    );
  }
  const buttonImport = content.match(/^import Button from "([^"]+Button)";/m);
  if (buttonImport) {
    return content.replace(
      buttonImport[0],
      `${buttonImport[0]}\nimport { SearchBar } from "${buttonImport[1].replace("Button", "SearchFilter")}";`.replace(
        "common/Button",
        "common/SearchFilter"
      )
    );
  }
  const firstImport = content.indexOf("\nimport ");
  if (firstImport === -1) return content;
  const depth = filePath.includes("/components/") ? "../" : "../../";
  return (
    content.slice(0, firstImport + 1) +
    `import { SearchBar } from "${depth}components/common/SearchFilter";\n` +
    content.slice(firstImport + 1)
  );
}

function removeUnusedSearchIcon(content) {
  if (content.includes("<Search ")) return content;
  return content.replace(/,?\s*\n?\s*Search,?\s*/g, (match, offset, str) => {
    const before = str.slice(Math.max(0, offset - 200), offset);
    if (!before.includes("from \"lucide-react\"") && !before.includes("from 'lucide-react'")) {
      return match;
    }
    return "\n";
  });
}

let changed = 0;
for (const rel of formFiles) {
  const filePath = path.join(srcRoot, rel);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, "utf8");
  const before = content;
  content = content.replace(buyerPickerRe, buyerPickerReplacement);
  content = content.replace(simpleLineItemRe, simpleLineItemReplacement);
  if (content !== before) {
    content = ensureSearchBarImport(content, rel);
    content = removeUnusedSearchIcon(content);
    fs.writeFileSync(filePath, content);
    changed += 1;
    console.log("Updated buyer picker:", rel);
  }
}

console.log(`Done. ${changed} form files updated.`);
