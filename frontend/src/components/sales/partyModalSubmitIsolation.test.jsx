import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import AddBasicDetailsModal from "./AddBasicDetailsModal";
import AddCustomFieldModal from "./AddCustomFieldModal";
import AddOtherDetailsModal from "./AddOtherDetailsModal";

function wrapInParentForm(modal) {
  const parentSubmit = vi.fn((e) => e.preventDefault());
  render(
    <form onSubmit={parentSubmit} data-testid="parent-form">
      {modal}
    </form>
  );
  return parentSubmit;
}

describe("party modal submit isolation", () => {
  it("AddCustomFieldModal save does not submit ancestor form", () => {
    const onSave = vi.fn();
    const parentSubmit = wrapInParentForm(
      <AddCustomFieldModal open onClose={vi.fn()} onSave={onSave} existingFields={[]} />
    );

    fireEvent.change(screen.getByPlaceholderText("Enter Field Name"), {
      target: { value: "PO Ref" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Field Details"), {
      target: { value: "12345" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalled();
    expect(parentSubmit).not.toHaveBeenCalled();
  });

  it("AddBasicDetailsModal save does not submit ancestor form", () => {
    const onSave = vi.fn();
    const parentSubmit = wrapInParentForm(
      <AddBasicDetailsModal
        open
        onClose={vi.fn()}
        onSave={onSave}
        initial={{
          payment_terms_days: "30",
          opening_balance: "0",
          balance_type: "to_receive",
          email: "buyer@example.com",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalled();
    expect(parentSubmit).not.toHaveBeenCalled();
  });

  it("AddOtherDetailsModal save does not submit ancestor form", () => {
    const onSave = vi.fn();
    const parentSubmit = wrapInParentForm(
      <AddOtherDetailsModal
        open
        onClose={vi.fn()}
        onSave={onSave}
        initial={{
          party_type: "Buyer",
          gst_treatment: "Registered Business - Regular",
          tax_preference: "Taxable",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalled();
    expect(parentSubmit).not.toHaveBeenCalled();
  });
});
