import BulkImportPage from "../../components/masters/BulkImportPage";
import { createCustomer } from "../../api/salesApi";
import useTenantId from "../../hooks/useTenantId";

const COLUMNS = [
  "Company name",
  "GSTIN",
  "Address",
  "City",
  "State",
  "Pincode",
  "Mobile No.",
  "Email",
];

const SAMPLE_ROWS = [
  [
    "R.K. Traders",
    "22AAAAA0000A1Z5",
    "Near Bus Stand",
    "Raipur",
    "Chhattisgarh",
    "492001",
    "9876543210",
    "rk@example.com",
  ],
  [
    "S.L. Logistic",
    "22BBBBB0000B1Z5",
    "Industrial Area",
    "Bhilai",
    "Chhattisgarh",
    "490026",
    "9123456780",
    "sl@example.com",
  ],
  [
    "Rahul Info Tech",
    "22CCCCC0000C1Z5",
    "VIP Road",
    "Raipur",
    "Chhattisgarh",
    "492007",
    "9988776655",
    "rahul@example.com",
  ],
];

const TEMPLATE_CSV =
  "Company name,GSTIN,Address,City,State,Pincode,Mobile No.,Email\n" +
  "R.K. Traders,22AAAAA0000A1Z5,Near Bus Stand,Raipur,Chhattisgarh,492001,9876543210,rk@example.com\n";

function pick(row, ...keys) {
  for (const key of keys) {
    const found = Object.entries(row).find(([k]) => k.replace(/\s+/g, " ").trim() === key);
    if (found && found[1]) return found[1];
  }
  for (const [k, v] of Object.entries(row)) {
    const n = k.replace(/\s+/g, "").toLowerCase();
    if (keys.some((key) => key.replace(/\s+/g, "").toLowerCase() === n) && v) return v;
  }
  return "";
}

/** Masters → Customers → Bulk Import (Upload Bulk Buyer). */
export default function BulkImportBuyer() {
  const tenantId = useTenantId();

  return (
    <BulkImportPage
      title="Upload Bulk Buyer"
      backTo="/sales/customers"
      columns={COLUMNS}
      sampleRows={SAMPLE_ROWS}
      templateFilename="buyers_import_template.csv"
      templateCsv={TEMPLATE_CSV}
      steps={[
        "Step 1",
        "Step 2 : Fill the buyer data in Excel file according to columns.",
        "Step 3 : Upload Excel File",
      ]}
      onImportRows={async (rows) => {
        let created = 0;
        let failed = 0;
        for (const row of rows) {
          const name = pick(row, "company name", "company", "name", "customer name");
          if (!name) {
            failed += 1;
            continue;
          }
          try {
            await createCustomer({
              tenant_id: tenantId,
              name,
              gstin: pick(row, "gstin") || null,
              address_line1: pick(row, "address") || null,
              state: pick(row, "state") || null,
              phone: pick(row, "mobile no.", "mobile", "phone") || null,
              email: pick(row, "email") || null,
              address_line2:
                [pick(row, "city"), pick(row, "pincode")].filter(Boolean).join(", ") || null,
              status: "active",
              credit_limit: 0,
              outstanding: 0,
            });
            created += 1;
          } catch {
            failed += 1;
          }
        }
        return { created, failed };
      }}
    />
  );
}
