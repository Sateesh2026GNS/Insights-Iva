import { describe, expect, it, vi } from "vitest";
import {
  customerFieldsFromMaster,
} from "./manualSalesJobCard";
import {
  customerToConsigneeFields,
  filterCustomers,
} from "./customerOptions";
import {
  getCustomerCompanyName,
  getCustomerDisplayName,
  getCustomerPersonName,
} from "../pages/sales/Customers";
import { enrichApiCustomer } from "../data/customersMasterData";

describe("Customer name vs Company name separation", () => {
  it("getCustomerDisplayName returns the customer name entered in Customer Name field", () => {
    // When customer has entered customer name (e.g. tejaswi munthalalakshmi), company (Cods), and contact name
    const customer = {
      id: 22,
      name: "tejaswi munthalalakshmi",
      display_name: "tejaswi munthalalakshmi",
      company_name: "Cods",
      company: "Cods",
      contact_name: "Ms. tejaswi munthalalakshmi",
      contact_person: "Ms. tejaswi munthalalakshmi",
    };
    expect(getCustomerDisplayName(customer)).toBe("tejaswi munthalalakshmi");

    // Customer without contact person falls back to customer name
    const individualCustomer = {
      id: 21,
      name: "Codeeee",
      company_name: null,
      contact_name: "Codeeee",
    };
    expect(getCustomerDisplayName(individualCustomer)).toBe("Codeeee");

    // Customer with only contact name
    const customerOnlyContact = {
      id: 23,
      name: "",
      contact_name: "Ms. Tejaswi Lakshmi",
    };
    expect(getCustomerDisplayName(customerOnlyContact)).toBe("Ms. Tejaswi Lakshmi");
  });

  it("enrichApiCustomer sets customer_name to entered name and preserves company_name", () => {
    const rawApiRow = {
      id: 22,
      name: "tejaswi munthalalakshmi",
      company_name: "Cods",
      contact_name: "Ms. tejaswi munthalalakshmi",
      email: "tejaswi@codevia.com",
    };
    const enriched = enrichApiCustomer(rawApiRow);
    expect(enriched.company_name).toBe("Cods");
    expect(enriched.company).toBe("Cods");
    expect(enriched.name).toBe("tejaswi munthalalakshmi");
    expect(enriched.customer_name).toBe("tejaswi munthalalakshmi");
    expect(enriched.contact_name).toBe("Ms. tejaswi munthalalakshmi");
    expect(getCustomerDisplayName(enriched)).toBe("tejaswi munthalalakshmi");
  });

  it("customerFieldsFromMaster populates Job card with company_name as customer_name and contact_person correctly", () => {
    const masterCustomer = {
      id: 19,
      name: "Codevia Software Pvt Ltd",
      company_name: "Codevia Software Pvt Ltd",
      company: "Codevia Software Pvt Ltd",
      contact_name: "Ms. Tejaswi Lakshmi",
      email: "tejaswi@codevia.com",
      phone: "9110721034",
    };

    const jobCardFields = customerFieldsFromMaster(masterCustomer);
    expect(jobCardFields.customer_name).toBe("Codevia Software Pvt Ltd");
    expect(jobCardFields.contact_person).toBe("Ms. Tejaswi Lakshmi");
    expect(jobCardFields.phone).toBe("9110721034");
    expect(jobCardFields.email).toBe("tejaswi@codevia.com");
  });

  it("customerToConsigneeFields prioritizes company_name", () => {
    const customer = {
      company_name: "Codevia Software Pvt Ltd",
      name: "Ms. Tejaswi Lakshmi",
      address_line1: "Road 1",
    };
    const consignee = customerToConsigneeFields(customer);
    expect(consignee.consignee_name).toBe("Codevia Software Pvt Ltd");
  });

  it("filterCustomers matches both company_name and contact_name", () => {
    const list = [
      { id: 18, company_name: "Codevia", contact_name: "Ms. Tejaswi m" },
      { id: 19, company_name: "Codevia Software Pvt Ltd", contact_name: "Ms. Tejaswi Lakshmi" },
      { id: 21, company_name: "Alpha Corp", contact_name: "John Doe" },
    ];

    expect(filterCustomers(list, "Codevia")).toHaveLength(2);
    expect(filterCustomers(list, "Lakshmi")).toHaveLength(1);
    expect(filterCustomers(list, "Lakshmi")[0].id).toBe(19);
    expect(filterCustomers(list, "John")).toHaveLength(1);
  });

  it("keeps customer name empty when adding only company name", () => {
    // Quick-add company without person name
    const companyOnlyCust = {
      id: 26,
      name: null,
      company_name: "Codevia Innovations",
      contact_name: null,
    };
    const enriched = enrichApiCustomer(companyOnlyCust);
    expect(enriched.company_name).toBe("Codevia Innovations");
    expect(enriched.company).toBe("Codevia Innovations");
    expect(enriched.name).toBe("");
    expect(enriched.customer_name).toBe("");

    expect(getCustomerCompanyName(enriched)).toBe("Codevia Innovations");
    expect(getCustomerPersonName(enriched)).toBe("");
  });
});
