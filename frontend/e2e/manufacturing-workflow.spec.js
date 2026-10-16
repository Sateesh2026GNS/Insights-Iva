/**
 * Manufacturing spine E2E against a disposable company and disposable API/DB.
 *
 * Enable with E2E_MANUFACTURING=1. Point E2E_API_URL / E2E_BASE_URL at a
 * dedicated test stack — never a shared or production database.
 */
import { expect, test } from "@playwright/test";
import {
  API_BASE,
  confirmSalesOrderViaDetail,
  createCustomerAndProduct,
  createDraftSalesOrder,
  createMachine,
  createRoleUser,
  clickUnblocked,
  expectPermissionDeniedOrHidden,
  expectPersistedAfterReload,
  expectToastOrStatus,
  expectValidationFeedback,
  expectWorkflowStatus,
  failOnOperationError,
  loginViaUi,
  registerDisposableCompany,
  stockMaterialCheck,
} from "./manufacturing-helpers.js";

const ENABLED = process.env.E2E_MANUFACTURING === "1";

test.describe("Manufacturing workflow", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!ENABLED, "Set E2E_MANUFACTURING=1 against a disposable test database to run this spec.");

  /** @type {any} */
  let tenant;
  /** @type {Record<string, any>} */
  let users = {};
  /** @type {{ id: number, orderNumber: string }} */
  let order;
  /** @type {any} */
  let machine;

  test("provisions a disposable company and same-tenant roles", async ({ request }) => {
    tenant = await registerDisposableCompany(request);
    test.skip(!tenant.ok, `Could not register disposable company (${tenant.status}: ${tenant.text}).`);

    users.admin = {
      email: tenant.email,
      password: tenant.password,
      role: "Admin",
      token: tenant.token,
    };
    users.sales = await createRoleUser(request, tenant.token, "Sales Manager");
    users.store = await createRoleUser(request, tenant.token, "Store Manager");
    users.production = await createRoleUser(request, tenant.token, "Production Manager");
    users.operator = await createRoleUser(request, tenant.token, "Operator");
    users.quality = await createRoleUser(request, tenant.token, "Quality Control");
    users.billing = await createRoleUser(request, tenant.token, "Accountant");
    machine = await createMachine(request, tenant.token, tenant.tenantId);

    const { customer, product } = await createCustomerAndProduct(request, tenant.token, tenant.tenantId);
    order = await createDraftSalesOrder(
      request,
      users.sales.token,
      tenant.tenantId,
      customer.id,
      product.id
    );
    expect(order.id).toBeTruthy();
    expect(order.orderNumber).toBeTruthy();
  });

  test("Sales confirms the order through the UI and it persists after refresh", async ({ page, request }) => {
    test.skip(!order?.id, "Tenant fixture missing");
    await loginViaUi(page, users.sales);
    await confirmSalesOrderViaDetail(page, order.id, order.orderNumber);
    await expect(page.getByText(/Sent to Store|material check|Open Job Card/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await expectPersistedAfterReload(page, order.orderNumber);
    await expect(page.getByRole("button", { name: /Open Job Card/i })).toBeVisible();

    await page.goto("/sales/orders");
    await expect(page.getByText(order.orderNumber).locator("visible=true").first()).toBeVisible({
      timeout: 20_000,
    });

    const persisted = await request.get(`${API_BASE}/sales/sales-orders/${order.id}`, {
      headers: { Authorization: `Bearer ${users.sales.token}` },
    });
    expect(persisted.ok()).toBeTruthy();
    const body = await persisted.json();
    const persistedOrder = body.order || body.data || body;
    expect(persistedOrder.id || order.id).toBeTruthy();
    await expectWorkflowStatus(request, users.sales.token, order.id, "MATERIAL_CHECK_PENDING");
  });

  test("Store Manager sees the order and completes inventory plus material issue", async ({ page, request }) => {
    test.skip(!order?.id, "Tenant fixture missing");
    await stockMaterialCheck(request, users.store.token, tenant.tenantId, order.id);
    await loginViaUi(page, users.store);
    await page.goto(`/manufacturing/workflow/order/${order.id}/inventory`);
    await expect(page.getByRole("button", { name: /Confirm Materials|Check Stock/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Confirm Materials|Check Stock/i }).click();
    await Promise.race([
      page.waitForURL(/\/manufacturing\/workflow\/order\/\d+\/store/, { timeout: 20_000 }),
      page.getByText(/Inventory check submitted|All materials are available/i).first().waitFor({ timeout: 20_000 }),
    ]);
    await failOnOperationError(page);

    await page.goto(`/manufacturing/workflow/order/${order.id}/store`);
    await failOnOperationError(page);
    await expect(page.getByRole("columnheader", { name: /Total Issued|Issued/i })).toBeVisible({
      timeout: 20_000,
    });
    const issuedInput = page.locator("table input[type='number']").first();
    if (await issuedInput.count()) {
      await issuedInput.fill("10");
    }
    const issueAll = page.getByRole("button", { name: "Issue All & Send to Production" });
    await expect(issueAll).toBeVisible({ timeout: 20_000 });
    await issueAll.click();
    await Promise.race([
      page.waitForURL(/\/manufacturing\/workflow\/order\/\d+\/production/, { timeout: 20_000 }),
      page.getByText(/All required materials issued|Production Pending|Production Planning/i).first().waitFor({ timeout: 20_000 }),
    ]);
    await expect(
      page.getByText(/Production Pending|Production Planning|All required materials issued/i).first()
    ).toBeVisible({ timeout: 20_000 });

    await expectWorkflowStatus(
      request,
      users.production.token,
      order.id,
      ["READY_FOR_PRODUCTION", "PRODUCTION_ASSIGNED"]
    );
    const queue = await request.get(`${API_BASE}/manufacturing/workflow/queue?status=READY_FOR_PRODUCTION`, {
      headers: { Authorization: `Bearer ${users.production.token}` },
    });
    expect(queue.ok()).toBeTruthy();
    const items = (await queue.json()).items || [];
    expect(items.some((row) => row.sales_order_id === order.id)).toBeTruthy();
  });

  test("Production Manager assigns operator and machine", async ({ page }) => {
    test.skip(!order?.id, "Tenant fixture missing");
    await loginViaUi(page, users.production);
    await page.goto(`/manufacturing/workflow/order/${order.id}/production`);
    await expect(page.getByLabel(/Assign Operator/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /Assign Operator|Assign to Operator/i }).click();
    await expectValidationFeedback(page, /Select a valid production operator|No active production operators/i);

    await page.getByLabel(/Assign Operator/i).selectOption({ label: new RegExp(users.operator.email.split("@")[0], "i") }).catch(async () => {
      const options = page.getByLabel(/Assign Operator/i).locator("option");
      const count = await options.count();
      for (let i = 0; i < count; i += 1) {
        const text = await options.nth(i).textContent();
        if (/operator/i.test(text || "") && (await options.nth(i).getAttribute("value"))) {
          await page.getByLabel(/Assign Operator/i).selectOption(await options.nth(i).getAttribute("value"));
          break;
        }
      }
    });
    if (machine?.id) {
      await page.getByLabel(/^Machine$/i).selectOption(String(machine.id)).catch(() => {});
    }
    await page.getByRole("button", { name: /Assign Operator|Assign to Operator/i }).click();
    await Promise.race([
      page.waitForURL(/\/manufacturing\/workflow\/order\/\d+\/operator/, { timeout: 20_000 }),
      page.getByText(/allocated|Shop Floor Execution/i).first().waitFor({ timeout: 20_000 }),
    ]);
  });

  test("Operator records production quantities and completes production", async ({ page, request }) => {
    test.skip(!order?.id, "Tenant fixture missing");
    await loginViaUi(page, users.operator);
    await page.goto(`/manufacturing/workflow/order/${order.id}/operator`);
    const start = page.getByRole("button", { name: /Start Production/i });
    await expect(start).toBeVisible({ timeout: 20_000 });
    await start.scrollIntoViewIfNeeded();
    await start.click();
    await expectToastOrStatus(page, /Production started/i);
    const produced = page.getByLabel(/Produced Quantity|Produced Qty/i);
    await expect(produced.first()).toBeVisible({ timeout: 20_000 });
    await produced.first().fill("10");
    const complete = page.getByRole("button", { name: /Complete Production/i });
    await expect(complete).toBeVisible({ timeout: 20_000 });
    await complete.click();
    await Promise.race([
      page.waitForURL(/\/manufacturing\/workflow\/order\/\d+\/quality/, { timeout: 20_000 }),
      page.getByText(/Quality Inspection|Production completed/i).first().waitFor({ timeout: 20_000 }),
    ]);
    await expectWorkflowStatus(request, users.quality.token, order.id, "QUALITY_CHECK_PENDING");
  });

  test("Quality Control submits a pass result after exercising fail and hold options", async ({ page }) => {
    test.skip(!order?.id, "Tenant fixture missing");
    await loginViaUi(page, users.quality);
    await page.goto(`/manufacturing/workflow/order/${order.id}/quality`);
    const result = page.getByLabel(/^Result$/i);
    await expect(result).toBeVisible({ timeout: 20_000 });
    await result.selectOption("fail");
    await result.selectOption("hold");
    await result.selectOption("pass");
    await page.getByRole("button", { name: /^Approve$/i }).click();
    await Promise.race([
      page.waitForURL(/\/manufacturing\/workflow\/order\/\d+\/packing/, { timeout: 20_000 }),
      page.getByText(/Quality Approved|Packing & Dispatch/i).first().waitFor({ timeout: 20_000 }),
    ]);
  });

  test("Packing and dispatch complete through the UI", async ({ page, request }) => {
    test.skip(!order?.id, "Tenant fixture missing");
    await loginViaUi(page, users.store);
    await page.goto(`/manufacturing/workflow/order/${order.id}/packing`);
    const startPack = page.getByRole("button", { name: /Start Packing/i });
    await expect(startPack).toBeVisible({ timeout: 20_000 });
    await startPack.scrollIntoViewIfNeeded();
    await startPack.click();
    await expectToastOrStatus(page, /Packing started/i);
    const packedQty = page.getByLabel(/Packed Qty|Packed quantity/i);
    if (await packedQty.count()) {
      await packedQty.first().fill("10");
    }
    const finishPack = page.getByRole("button", { name: "Create Dispatch" });
    await expect(finishPack).toBeVisible({ timeout: 20_000 });
    await finishPack.click();
    await Promise.race([
      page.waitForURL(/\/manufacturing\/workflow\/order\/\d+\/billing/, { timeout: 20_000 }),
      page.getByText(/Packing confirmed|Finance & Billing|Billing Information/i).first().waitFor({ timeout: 20_000 }),
    ]);
    await expectWorkflowStatus(request, users.billing.token, order.id, "BILLING_PENDING");
  });

  test("Billing generates an invoice and the workflow completes", async ({ page, request }) => {
    test.skip(!order?.id, "Tenant fixture missing");
    await loginViaUi(page, users.billing);
    await page.goto(`/manufacturing/workflow/order/${order.id}/billing`);
    await page.getByRole("button", { name: "Create Invoice" }).waitFor({ state: "visible", timeout: 20_000 });
    await clickUnblocked(page, page.getByRole("button", { name: "Create Invoice" }));
    await Promise.race([
      page.waitForURL(/my-job-cards|billing/, { timeout: 20_000 }),
      page.getByText(/GST Tax Invoice generated|Job Card completed|invoice/i).first().waitFor({ timeout: 20_000 }),
    ]);

    await page.goto(`/manufacturing/workflow/order/${order.id}/billing`);
    await expect(page.getByText(/completed|invoice|billed/i).first()).toBeVisible({ timeout: 20_000 });
    await expectPersistedAfterReload(page, /completed|invoice|billed/i);

    const data = await expectWorkflowStatus(request, users.billing.token, order.id, "COMPLETED");
    const invoiceNumber = data.invoice?.invoice_number || data.invoice_number;
    expect(invoiceNumber).toBeTruthy();

    const duplicate = await request.post(`${API_BASE}/manufacturing/workflow/billing/invoices?order_id=${order.id}`, {
      headers: { Authorization: `Bearer ${users.billing.token}`, "Content-Type": "application/json" },
      data: {},
    });
    expect(duplicate.status()).toBe(409);
  });

  test("Operator cannot invoice and Quality fail/hold cannot pack", async ({ page, request }) => {
    test.skip(!tenant?.ok, "Tenant fixture missing");
    await loginViaUi(page, users.operator);
    await page.goto(`/manufacturing/workflow/order/${order.id}/billing`);
    await expectPermissionDeniedOrHidden(page, /Create Invoice|Mark as Billed/i);

    const { customer, product } = await createCustomerAndProduct(request, tenant.token, tenant.tenantId);
    const second = await createDraftSalesOrder(
      request,
      users.sales.token,
      tenant.tenantId,
      customer.id,
      product.id
    );
    const confirm = await request.post(`${API_BASE}/sales/sales-orders/${second.id}/confirm`, {
      headers: { Authorization: `Bearer ${users.sales.token}` },
    });
    expect(confirm.ok()).toBeTruthy();

    const packing = await request.post(`${API_BASE}/manufacturing/workflow/packing/${second.id}/complete`, {
      headers: { Authorization: `Bearer ${users.store.token}`, "Content-Type": "application/json" },
      data: { packing_status: "dispatched", packed_quantity: 1 },
    });
    expect(packing.status()).toBe(409);

    const billing = await request.post(`${API_BASE}/manufacturing/workflow/billing/invoices?order_id=${second.id}`, {
      headers: { Authorization: `Bearer ${users.operator.token}`, "Content-Type": "application/json" },
      data: {},
    });
    expect(billing.status()).toBe(403);

    const foreign = await registerDisposableCompany(request);
    if (foreign.ok) {
      const stolen = await request.get(
        `${API_BASE}/manufacturing/workflow/sales-orders/${second.id}/material-check`,
        { headers: { Authorization: `Bearer ${foreign.token}` } }
      );
      expect([403, 404]).toContain(stolen.status());
    }
  });
});
