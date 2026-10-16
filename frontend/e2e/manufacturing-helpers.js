import { expect } from "@playwright/test";
import { openCompanyLogin } from "./helpers.js";

export const API_BASE = process.env.E2E_API_URL || "http://127.0.0.1:8000";
export const PASSWORD = process.env.E2E_MFG_ADMIN_PASSWORD || "Passw0rd!123";

export async function apiJson(request, method, path, { data, token } = {}) {
  const headers = { Accept: "application/json" };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await request[method](`${API_BASE}${path}`, { data, headers });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok(), status: res.status(), body, text };
}

export async function registerDisposableCompany(request) {
  const stamp = Date.now().toString(36);
  const email = `e2e-mfg-admin-${stamp}@company-e2e.test`;
  const res = await apiJson(request, "post", "/auth/register", {
    data: {
      company_name: `E2E MFG ${stamp}`,
      full_name: "E2E Manufacturing Admin",
      email,
      password: PASSWORD,
      role: "Admin",
    },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text: (res.text || "").slice(0, 240) };
  }
  const login = await apiJson(request, "post", "/auth/login", {
    data: { email, password: PASSWORD, role: "Admin" },
  });
  if (!login.ok) {
    return { ok: false, status: login.status, text: (login.text || "").slice(0, 240) };
  }
  return {
    ok: true,
    email,
    password: PASSWORD,
    role: "Admin",
    token: login.body.access_token,
    tenantId: login.body.user?.tenant_id,
    user: login.body.user,
  };
}

export async function loginViaUi(page, { email, password, role }) {
  await openCompanyLogin(page);
  await page.locator('select[aria-label="Role"]').selectOption(role);
  await page.getByPlaceholder("Company Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /^SIGN IN$/i }).click();
  await expect(page).not.toHaveURL(/\/login\/?$/, { timeout: 20_000 });
}

export async function loginApi(request, { email, password, role }) {
  const login = await apiJson(request, "post", "/auth/login", {
    data: { email, password, role },
  });
  if (!login.ok) {
    throw new Error(`Login failed for ${role}: ${login.status} ${login.text.slice(0, 200)}`);
  }
  return {
    email,
    password,
    role,
    token: login.body.access_token,
    userId: login.body.user?.id,
  };
}

export async function createRoleUser(request, adminToken, roleName) {
  const roles = await apiJson(request, "get", "/admin/roles", { token: adminToken });
  const items = Array.isArray(roles.body) ? roles.body : roles.body?.data ?? roles.body?.items ?? [];
  const role = items.find((r) => r.name === roleName);
  if (!role) throw new Error(`Role not found: ${roleName}`);
  const stamp = Date.now().toString(36);
  const email = `e2e-${roleName.toLowerCase().replace(/\s+/g, "-")}-${stamp}@company-e2e.test`;
  const created = await apiJson(request, "post", "/admin/users", {
    token: adminToken,
    data: {
      email,
      full_name: `E2E ${roleName}`,
      password: PASSWORD,
      role_ids: [role.id],
      is_active: true,
    },
  });
  if (!created.ok) {
    throw new Error(`Create ${roleName} failed: ${created.status} ${created.text.slice(0, 240)}`);
  }
  const user = created.body?.data ?? created.body;
  return loginApi(request, { email, password: PASSWORD, role: roleName }).then((session) => ({
    ...session,
    userId: session.userId || user.id,
  }));
}

export async function createCustomerAndProduct(request, token, tenantId) {
  const stamp = Date.now().toString(36);
  const customer = await apiJson(request, "post", "/sales/customers", {
    token,
    data: {
      tenant_id: tenantId,
      name: `E2E Customer ${stamp}`,
      email: `e2e-cust-${stamp}@company-e2e.test`,
      status: "active",
    },
  });
  if (!customer.ok) {
    throw new Error(`Create customer failed: ${customer.status} ${customer.text.slice(0, 200)}`);
  }
  const product = await apiJson(request, "post", "/api/masters/products", {
    token,
    data: {
      tenant_id: tenantId,
      sku: `E2E-${stamp}`.toUpperCase(),
      name: `E2E Bottle ${stamp}`,
      unit_price: 10,
      unit_cost: 5,
    },
  });
  if (!product.ok) {
    throw new Error(`Create product failed: ${product.status} ${product.text.slice(0, 200)}`);
  }
  return {
    customer: customer.body?.data ?? customer.body,
    product: product.body?.data ?? product.body,
  };
}

export async function createDraftSalesOrder(request, token, tenantId, customerId, productId) {
  const stamp = Date.now().toString(36).toUpperCase();
  const res = await apiJson(request, "post", "/sales/sales-orders", {
    token,
    data: {
      tenant_id: tenantId,
      customer_id: customerId,
      order_number: `SO-E2E-${stamp}`,
      order_date: new Date().toISOString().slice(0, 10),
      status: "draft",
      priority: "high",
      delivery_date: "2026-08-15",
      line_items: [
        {
          product_id: productId,
          item_description: "E2E Bottle",
          quantity: 10,
          unit: "Nos",
          unit_price: 10,
          line_total: 100,
        },
      ],
    },
  });
  if (!res.ok) {
    throw new Error(`Create sales order failed: ${res.status} ${res.text.slice(0, 240)}`);
  }
  const order = res.body?.data ?? res.body;
  return { id: order.id, orderNumber: order.order_number || `SO-E2E-${stamp}` };
}

export async function createMachine(request, token, tenantId) {
  const stamp = Date.now().toString(36).toUpperCase();
  const res = await apiJson(request, "post", "/api/masters/machines/simple", {
    token,
    data: {
      tenant_id: tenantId,
      code: `E2E-${stamp}`,
      name: `E2E Press ${stamp}`,
      status: "idle",
      work_center: "WC-E2E",
    },
  });
  if (!res.ok) {
    throw new Error(`Create machine failed: ${res.status} ${res.text.slice(0, 200)}`);
  }
  const machine = res.body?.data ?? res.body;
  return machine;
}

export async function stockMaterialCheck(request, token, tenantId, orderId) {
  const check = await apiJson(
    request,
    "get",
    `/manufacturing/workflow/sales-orders/${orderId}/material-check`,
    { token }
  );
  const lines = check.body?.material_check?.lines || check.body?.data?.material_check?.lines || [];
  const warehouses = await apiJson(request, "get", "/inventory/warehouses", { token });
  const whItems = Array.isArray(warehouses.body) ? warehouses.body : warehouses.body?.data ?? [];
  let warehouseId = whItems[0]?.id;
  if (!warehouseId) {
    const created = await apiJson(request, "post", "/inventory/warehouses", {
      token,
      data: { tenant_id: tenantId, name: "E2E Warehouse", code: `E2E-WH-${Date.now().toString(36)}` },
    });
    warehouseId = (created.body?.data ?? created.body)?.id;
  }
  for (const line of lines) {
    if (!line.inventory_item_id) continue;
    await apiJson(request, "post", "/inventory/stock-movements", {
      token,
      data: {
        tenant_id: tenantId,
        warehouse_id: warehouseId,
        item_id: line.inventory_item_id,
        quantity: Number(line.required_qty || 10) + 5,
        movement_type: "in",
      },
    });
  }
  return lines;
}

export async function dismissBlockingDialog(page) {
  const dialog = page.getByRole("alertdialog");
  for (let i = 0; i < 6; i += 1) {
    if (!(await dialog.isVisible().catch(() => false))) return;
    await dialog.getByRole("button", { name: /close/i }).click();
    await expect(dialog).toBeHidden({ timeout: 5_000 }).catch(() => {});
  }
}

export async function clickUnblocked(page, locator) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await dismissBlockingDialog(page);
    try {
      await locator.click({ timeout: 8_000 });
      return;
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
}

export async function expectToastOrStatus(page, pattern) {
  await failOnOperationError(page);
  await expect(page.getByText(pattern).first()).toBeVisible({ timeout: 20_000 });
}

export async function failOnOperationError(page) {
  const dialog = page.getByRole("alertdialog");
  if (await dialog.isVisible().catch(() => false)) {
    const message = ((await dialog.textContent()) || "").replace(/\s+/g, " ").trim();
    throw new Error(`Unexpected operation error dialog: ${message}`);
  }
}

export async function expectValidationFeedback(page, pattern) {
  const dialog = page.getByRole("alertdialog");
  if (await dialog.isVisible().catch(() => false)) {
    await expect(dialog).toContainText(pattern);
    const close = dialog.getByRole("button", { name: /close|dismiss|ok/i });
    if (await close.count()) {
      await close.first().click();
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    return;
  }
  await expect(page.getByText(pattern).first()).toBeVisible({ timeout: 10_000 });
}

export async function confirmSalesOrderViaDetail(page, orderId, orderNumber) {
  await page.goto(`/sales/orders/${orderId}`);
  await expect(page.getByText(orderNumber).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /^Confirm Sales Order$/i })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /^Confirm Sales Order$/i }).click();
  await expectToastOrStatus(page, /Sales order confirmed|Sent to Store|already confirmed/i);
}

export async function expectPersistedAfterReload(page, pattern) {
  await page.reload();
  await expect(page.getByText(pattern).first()).toBeVisible({ timeout: 20_000 });
}

export async function fetchWorkflowContext(request, token, orderId) {
  return apiJson(request, "get", `/manufacturing/workflow/sales-orders/${orderId}/context`, {
    token,
  });
}

export async function expectWorkflowStatus(request, token, orderId, expected, { attempts = 10 } = {}) {
  const wanted = (Array.isArray(expected) ? expected : [expected]).map((value) => String(value).toUpperCase());
  let last = "";
  let data = {};
  for (let i = 0; i < attempts; i += 1) {
    const ctx = await fetchWorkflowContext(request, token, orderId);
    expect(ctx.ok, `workflow context ${ctx.status}: ${ctx.text.slice(0, 200)}`).toBeTruthy();
    data = ctx.body?.data ?? ctx.body;
    last = String(data.workflow_status || "").toUpperCase();
    if (wanted.includes(last)) return data;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  expect(last).toBe(wanted[0]);
  return data;
}

export async function expectPermissionDeniedOrHidden(page, actionName) {
  const denied = page.getByText(/Permission denied|does not have access/i);
  const action = page.getByRole("button", { name: actionName });
  const deniedVisible = await denied.first().isVisible().catch(() => false);
  if (deniedVisible) {
    await expect(denied.first()).toBeVisible();
    return;
  }
  await expect(action).toHaveCount(0);
}
