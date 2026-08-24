import fs from "fs";
import path from "path";

const ROOT = path.join(import.meta.dirname, "..", "src");

const ADD_LABEL =
  /Add\s|Create\s|New\s|Upload Document|Add Items|Add Category|Add Location|Add Type|Add Package|Schedule Task|Add Schedule|Add Component|Add Spare|Add Budget|Add Allocation|Add GL|Add Expense|Add Payment|Add Receipt|Add Quotation|Add Order|Add Bill|Add Invoice|Add PO|Add RFQ|Add GRN|Add Material|Add Machine|Add Department|Add Warehouse|Add Lead|Add User|Add Role|Add Team|Add Vendor|Add Customer|Add Product|Add Item|Add Record|Add Employee|Add Account|Add Customer|Add Vendor|Create Stock|Create Bill|Create Invoice|Create Order|Assign Employee|Add Items|Add Line|Add Prefix|Add Delivery|Add Work Order|Create New|Add New/i;

const PLUS_ICON = '<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />';
const USER_PLUS_ICON = '<UserPlus className="h-4 w-4" strokeWidth={2.5} aria-hidden />';

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name !== "node_modules") walk(p, out);
    } else if (/\.(jsx|js|tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

function migrateFile(file) {
  let src = fs.readFileSync(file, "utf8");
  const original = src;

  // Pass 1: opening tags with primary + Plus/UserPlus in leftIcon
  src = src.replace(/<Button\b[\s\S]*?>/g, (tag) => {
    if (!tag.includes('variant="primary"')) return tag;
    if (/leftIcon=\{<(Plus|UserPlus)/.test(tag)) {
      return tag.replace('variant="primary"', 'variant="add"');
    }
    return tag;
  });

  // Pass 2: primary + Plus as first child -> leftIcon + add
  src = src.replace(
    /<Button([^>]*?)variant="primary"([^>]*)>\s*<Plus([^/]*)\/>\s*([^<]+?)<\/Button>/g,
    (_m, a, b, plusRest, label) =>
      `<Button${a}variant="add"${b} leftIcon={<Plus${plusRest}/>}>${label.trim()}<\/Button>`,
  );

  // Pass 3: primary links to /create without icon
  src = src.replace(/<Button([^>]*?)variant="primary"([^>]*?\sto="[^"]*\/create[^"]*"[^>]*)>([^<]+)<\/Button>/g, (m, a, b, label) => {
    if (b.includes("leftIcon=")) return m;
    if (!ADD_LABEL.test(label)) return m;
    return `<Button${a}variant="add"${b} leftIcon={${PLUS_ICON}}>${label.trim()}<\/Button>`;
  });

  // Pass 4: primary onClick open/create patterns with add-like label in nearby lines
  src = src.replace(
    /<Button([^>]*?)variant="primary"([^>]*?\s(?:onClick=\{[^}]+\}|to="[^"]+")[^>]*)>\s*([^<{][^<]*?)<\/Button>/g,
    (m, a, b, label) => {
      if (b.includes("leftIcon=") || b.includes('type="submit"')) return m;
      if (!ADD_LABEL.test(label)) return m;
      if (/Save|Submit|Confirm|Update|Delete|Download|Resolve|Finalize|Upload|Generate|Restore|Close|Acknowledge|Change to|Use This|Select Terms|Apply|Login|Register|Reset|Verify|Proceed|Post|Issue|Convert|Approve|Reject|Mark|Run|Start|Stop|Send|Open Page|New Chat|Skip to|Assign Work Order|Save Changes|Save Warehouse|Save Customer|Save BOM|Edit|Refresh|Import|Export|Print|Filter|Search|View|Download File|Create Company|Set Up Digital Signature|Update Digital Signature|Add Stock|Remove|Add\b$|Remove\b$/i.test(label)) {
        return m;
      }
      return `<Button${a}variant="add"${b} leftIcon={${PLUS_ICON}}>${label.trim()}<\/Button>`;
    },
  );

  // Pass 5: AccountsPrimaryButton / InventoryPrimaryButton toolbar adds
  src = src.replace(
    /<(AccountsPrimaryButton|InventoryPrimaryButton)([^>]*)>([\s\S]*?)<\/\1>/g,
    (m, comp, attrs, label) => {
      if (!ADD_LABEL.test(label)) return m;
      if (/Save|Submit|Update|Restore|Generate|Post|Close|Confirm/i.test(label)) return m;
      const replacement = comp === "AccountsPrimaryButton" ? "AccountsAddButton" : "InventoryAddButton";
      return `<${replacement}${attrs}>${label.trim()}<\/${replacement}>`;
    },
  );

  // Clean redundant text-white on Plus icons inside add buttons
  src = src.replace(/<Plus className="h-4 w-4 text-white"([^/]*)\/>/g, '<Plus className="h-4 w-4"$1 strokeWidth={2.5} aria-hidden />');

  if (src !== original) {
    fs.writeFileSync(file, src, "utf8");
    return true;
  }
  return false;
}

const files = walk(ROOT);
let changed = 0;
for (const f of files) {
  if (migrateFile(f)) {
    changed += 1;
    console.log(path.relative(ROOT, f));
  }
}
console.log(`\nUpdated ${changed} files.`);
