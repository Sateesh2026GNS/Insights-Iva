import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import CreateProduct from "./CreateProduct";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="loc">{`${location.pathname}${location.search}`}</div>;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/masters/products/create" element={<CreateProduct />} />
        <Route path="/masters/products/:id/edit" element={<CreateProduct />} />
        <Route path="/products/:id/edit" element={<CreateProduct />} />
        <Route path="/masters/products" element={<LocationProbe />} />
        <Route path="/products" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CreateProduct redirect", () => {
  it("opens the catalog add dialog for a new product", async () => {
    renderAt("/masters/products/create");
    await waitFor(() => {
      expect(screen.getByTestId("loc")).toHaveTextContent("/masters/products?add=1");
    });
  });

  it("opens the catalog edit dialog for an existing product", async () => {
    renderAt("/masters/products/42/edit");
    await waitFor(() => {
      expect(screen.getByTestId("loc")).toHaveTextContent("/masters/products?edit=42");
    });
  });

  it("keeps the products catalog path when editing from /products", async () => {
    renderAt("/products/7/edit");
    await waitFor(() => {
      expect(screen.getByTestId("loc")).toHaveTextContent("/products?edit=7");
    });
  });
});
