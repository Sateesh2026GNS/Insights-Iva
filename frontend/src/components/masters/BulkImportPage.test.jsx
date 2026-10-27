import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import BulkImportPage from "./BulkImportPage";

describe("BulkImportPage navy chrome", () => {
  it("uses the navy toolkit shell and keeps the import action", () => {
    render(
      <MemoryRouter>
        <BulkImportPage
          title="Upload Bulk Product"
          backTo="/masters/products"
          banner="INSERT MULTIPLE PRODUCT"
          columns={["ProductName"]}
          sampleRows={[["Laptop"]]}
          templateFilename="products.csv"
          templateCsv="ProductName\nLaptop"
          onImportRows={() => ({ created: 0 })}
        />
      </MemoryRouter>
    );

    expect(document.querySelector(".mtk-theme--navy")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Upload Bulk Product" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Proceed/ })).toBeTruthy();
    expect(screen.getByText("Laptop")).toBeTruthy();
  });
});
