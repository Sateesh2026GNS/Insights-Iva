import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const viewports = [
  { width: 360, height: 800 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const roles = {
  "responsive-operator": "operator",
  "responsive-quality": "quality-control",
  "responsive-store": "store-manager",
  "responsive-production": "production-manager",
  "responsive-sales": "sales-manager",
  "responsive-hr": "hr-manager",
  "responsive-admin": "admin",
};

function routeSlug(route) {
  const [pathname, query = ""] = route.split("?");
  const routeName = pathname.split("/").filter(Boolean).join("-") || "dashboard";
  const queryName = query ? `-${query.replace(/[=&]/g, "-")}` : "";
  return `${routeName}${queryName}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

async function getSidebarRoutes(page) {
  const sidebar = page.locator("nav.sidebar-scroll");
  await sidebar.waitFor({ state: "visible", timeout: 20_000 });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const collapsedSection = sidebar.locator('button[aria-expanded="false"]').first();
    if (!(await collapsedSection.count())) break;
    await collapsedSection.click();
  }

  const routes = await sidebar.locator('a[href^="/"]').evaluateAll((anchors) =>
    anchors.map((anchor) => {
      const url = new URL(anchor.href, window.location.origin);
      return url.origin === window.location.origin && url.pathname !== "/login"
        ? `${url.pathname}${url.search}`
        : null;
    }).filter(Boolean)
  );

  await page.setViewportSize({ width: 360, height: 800 });
  await page.keyboard.press("Escape");
  const moreButton = page.locator(".app-shell-bottom-bar button[aria-haspopup='dialog']");
  if (await moreButton.isVisible()) {
    await moreButton.click();
    const sheetRoutes = await page.locator(".app-mobile-more-sheet a[href^='/']").evaluateAll((anchors) =>
      anchors.map((anchor) => {
        const url = new URL(anchor.href, window.location.origin);
        return url.origin === window.location.origin && url.pathname !== "/login"
          ? `${url.pathname}${url.search}`
          : null;
      }).filter(Boolean)
    );
    routes.push(...sheetRoutes);
  }
  const primaryRoutes = await page.locator("nav.app-shell-bottom-bar a[href^='/']").evaluateAll((anchors) =>
    anchors.map((anchor) => {
      const url = new URL(anchor.href, window.location.origin);
      return url.origin === window.location.origin && url.pathname !== "/login"
        ? `${url.pathname}${url.search}`
        : null;
    }).filter(Boolean)
  );
  return [...new Set([...routes, ...primaryRoutes])];
}

async function inspectLayout(page, width) {
  return page.evaluate((viewportWidth) => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        element.getClientRects().length > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const targets = [...document.querySelectorAll("a[href], button, input, select, textarea, [role='button']")]
      .filter((element) => visible(element) && !element.classList.contains("sr-only"))
      .map((element) => {
        const label = ["checkbox", "radio"].includes(element.type)
          ? element.closest("label") || element.labels?.[0]
          : null;
        const rect = (label || element).getBoundingClientRect();
        return {
          name: element.getAttribute("aria-label") || label?.innerText?.trim() || element.innerText?.trim() || element.tagName.toLowerCase(),
          tag: element.tagName.toLowerCase(),
          className: String(element.className || "").slice(0, 100),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      });
    const clippedText = [...document.querySelectorAll("body *")]
      .filter((element) => (
        visible(element) &&
        !["OPTION", "SELECT"].includes(element.tagName) &&
        !element.classList.contains("sr-only") &&
        !element.closest('[aria-hidden="true"]') &&
        element.children.length === 0 &&
        element.textContent.trim()
      ))
      .filter((element) => {
        const style = getComputedStyle(element);
        const clipsX = ["hidden", "clip"].includes(style.overflowX);
        const clipsY = ["hidden", "clip"].includes(style.overflowY);
        return (
          style.textOverflow !== "ellipsis" &&
          !element.classList.contains("line-clamp-1") &&
          (
            (clipsX && element.scrollWidth > element.clientWidth + 1) ||
            (clipsY && element.scrollHeight > element.clientHeight + 1)
          )
        );
      })
      .slice(0, 8)
      .map((element) => ({
        text: element.textContent.trim().slice(0, 60),
        tag: element.tagName.toLowerCase(),
        className: String(element.className || "").slice(0, 80),
      }));

    const parentOverflows = [...document.querySelectorAll("body *")]
      .filter((element) => (
        visible(element) &&
        element.parentElement &&
        !(element.tagName === "TABLE" && element.parentElement.classList.contains("ui-table-wrap")) &&
        !["BODY", "HTML", "SVG", "G", "PATH", "LINE", "RECT", "CIRCLE", "TEXT", "DEFS", "CLIPPATH"].includes(element.tagName) &&
        !element.closest("svg") &&
        !["BODY", "HTML"].includes(element.parentElement.tagName)
      ))
      .filter((element) => !["absolute", "fixed"].includes(getComputedStyle(element).position))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement.getBoundingClientRect();
        const parentStyle = getComputedStyle(element.parentElement);
        const clipsX = ["hidden", "clip"].includes(parentStyle.overflowX);
        const clipsY = ["hidden", "clip"].includes(parentStyle.overflowY);
        return (
          (clipsX && (
            rect.left < parentRect.left - 1 ||
            rect.right > parentRect.right + 1
          )) ||
          (clipsY && (
            rect.top < parentRect.top - 1 ||
            rect.bottom > parentRect.bottom + 1
          ))
        );
      })
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: String(element.className || "").slice(0, 80),
        parent: String(element.parentElement.className || element.parentElement.tagName).slice(0, 80),
      }));

    return {
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      viewportWidth,
      undersizedTargets: viewportWidth < 1024
        ? targets.filter((target) => target.width < 44 || target.height < 44).slice(0, 12)
        : [],
      clippedText,
      parentOverflows,
    };
  }, width);
}

async function captureOperatorMachineStates(page) {
  const viewport = viewports[0];
  const outputDir = path.resolve("..", "docs", "responsive-qa", "operator", `${viewport.width}x${viewport.height}`);
  await mkdir(outputDir, { recursive: true });
  const assertMobileState = async (state) => {
    const layout = await inspectLayout(page, viewport.width);
    if (layout.documentWidth > viewport.width) {
      throw new Error(`Operator ${state} state scrolls horizontally at ${viewport.width}px.`);
    }
    if (layout.undersizedTargets.length) {
      throw new Error(`Operator ${state} state has undersized controls: ${JSON.stringify(layout.undersizedTargets)}`);
    }
    if (layout.clippedText.length) {
      throw new Error(`Operator ${state} state has clipped text: ${JSON.stringify(layout.clippedText)}`);
    }
    if (layout.parentOverflows.length) {
      throw new Error(`Operator ${state} state has overflowing elements: ${JSON.stringify(layout.parentOverflows)}`);
    }
  };

  let mockResponse = { status: 200, body: { items: [] }, delay: 0 };
  await page.route("**/machines/my", async (route) => {
    if (mockResponse.delay) {
      await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
    }
    await route.fulfill({
      status: mockResponse.status,
      contentType: "application/json",
      body: JSON.stringify(mockResponse.body),
    });
  });

  await page.setViewportSize(viewport);
  mockResponse = { status: 200, body: { items: [] }, delay: 1_000 };
  await page.goto("/production/my-machine");
  await expect(page.getByText("Checking the equipment assigned to you.")).toBeVisible();
  await page.screenshot({ path: path.join(outputDir, "operator-my-machine-state-loading.png"), animations: "disabled" });
  await assertMobileState("loading");

  mockResponse = { status: 200, body: { items: [] }, delay: 0 };
  await page.goto("/production/my-machine");
  await expect(page.getByRole("heading", { name: "No Machine Assigned" })).toBeVisible();
  await page.screenshot({ path: path.join(outputDir, "operator-my-machine-state-empty.png"), animations: "disabled" });
  await assertMobileState("empty");

  mockResponse = { status: 500, body: { detail: "Responsive QA simulated server error." }, delay: 0 };
  await page.goto("/production/my-machine");
  await expect(page.getByRole("heading", { name: "Machine information unavailable" })).toBeVisible();
  await page.screenshot({ path: path.join(outputDir, "operator-my-machine-state-error.png"), animations: "disabled" });
  await assertMobileState("error");

  mockResponse = { status: 403, body: { detail: "Responsive QA simulated permission denial." }, delay: 0 };
  await page.goto("/production/my-machine");
  await expect(page.getByRole("heading", { name: "Access Denied" })).toBeVisible();
  await page.screenshot({ path: path.join(outputDir, "operator-my-machine-state-permission.png"), animations: "disabled" });
  await assertMobileState("permission");

  mockResponse = {
    status: 200,
    delay: 0,
    body: {
      items: [{
        id: 901,
        code: "RQA-QA-MACHINE",
        name: "Responsive QA Validation Machine",
        status: "idle",
        active_work_order: null,
        status_history: [],
      }],
    },
  };
  await page.goto("/production/my-machine");
  await page.getByRole("button", { name: "Report Machine Issue" }).click();
  await page.getByLabel("Issue title").fill("   ");
  await page.getByRole("button", { name: "Submit issue" }).click();
  await expect(page.getByRole("alert").getByText("Enter a short title for the machine issue.")).toBeVisible();
  await page.screenshot({ path: path.join(outputDir, "operator-my-machine-state-validation.png"), animations: "disabled" });
  await assertMobileState("validation");
  await page.unroute("**/machines/my");
}

async function captureQualityInspectionStates(page) {
  const viewport = viewports[0];
  const outputDir = path.resolve("..", "docs", "responsive-qa", "quality-control", `${viewport.width}x${viewport.height}`);
  await mkdir(outputDir, { recursive: true });

  const assertMobileState = async (state) => {
    const layout = await inspectLayout(page, viewport.width);
    expect(layout.documentWidth, `Quality Control ${state} state page width`).toBeLessThanOrEqual(viewport.width);
    expect(layout.undersizedTargets, `Quality Control ${state} state touch targets`).toEqual([]);
    expect(layout.clippedText, `Quality Control ${state} state clipped text`).toEqual([]);
    expect(layout.parentOverflows, `Quality Control ${state} state parent overflow`).toEqual([]);
  };

  let mockResponse = { status: 200, body: [], delay: 0 };
  await page.route("**/quality/inspection", async (route) => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    if (mockResponse.delay) {
      await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
    }
    await route.fulfill({
      status: mockResponse.status,
      contentType: "application/json",
      body: JSON.stringify(mockResponse.body),
    });
  });

  await page.setViewportSize(viewport);
  mockResponse = { status: 200, body: [], delay: 1_000 };
  await page.goto("/quality/inspection");
  await expect(page.locator(".ui-table-wrap.animate-pulse")).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "quality-inspection-state-loading.png"),
    animations: "disabled",
  });
  await assertMobileState("loading");

  mockResponse = { status: 200, body: [], delay: 0 };
  await page.goto("/quality/inspection");
  await expect(page.getByRole("heading", { name: "No inspections yet" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "quality-inspection-state-empty.png"),
    animations: "disabled",
  });
  await assertMobileState("empty");

  mockResponse = { status: 500, body: { detail: "Responsive QA simulated server error." }, delay: 0 };
  await page.goto("/quality/inspection");
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "quality-inspection-state-error.png"),
    animations: "disabled",
  });
  await assertMobileState("error");

  mockResponse = { status: 403, body: { detail: "Responsive QA simulated permission denial." }, delay: 0 };
  await page.goto("/quality/inspection");
  await expect(page.getByRole("heading", { name: "Access Denied" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "quality-inspection-state-permission.png"),
    animations: "disabled",
  });
  await assertMobileState("permission");

  mockResponse = { status: 200, body: [], delay: 0 };
  await page.goto("/quality/inspection");
  await page.getByRole("button", { name: "New Inspection" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Inspection Number is required")).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "quality-inspection-state-validation.png"),
    animations: "disabled",
  });
  await assertMobileState("validation");
  await page.unroute("**/quality/inspection");
}

async function captureStoreWarehouseStates(page) {
  const viewport = viewports[0];
  const outputDir = path.resolve("..", "docs", "responsive-qa", "store-manager", `${viewport.width}x${viewport.height}`);
  await mkdir(outputDir, { recursive: true });

  const assertMobileState = async (state) => {
    const layout = await inspectLayout(page, viewport.width);
    expect(layout.documentWidth, `Store Manager ${state} state page width`).toBeLessThanOrEqual(viewport.width);
    expect(layout.undersizedTargets, `Store Manager ${state} state touch targets`).toEqual([]);
    expect(layout.clippedText, `Store Manager ${state} state clipped text`).toEqual([]);
    expect(layout.parentOverflows, `Store Manager ${state} state parent overflow`).toEqual([]);
  };

  let mockResponse = { status: 200, body: [], delay: 0 };
  await page.route("**/inventory/warehouses", async (route) => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    if (mockResponse.delay) {
      await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
    }
    await route.fulfill({
      status: mockResponse.status,
      contentType: "application/json",
      body: JSON.stringify(mockResponse.body),
    });
  });

  await page.setViewportSize(viewport);
  mockResponse = { status: 200, body: [], delay: 1_000 };
  await page.goto("/inventory/warehouses");
  await expect(page.getByText("Loading warehouses…")).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "warehouses-state-loading.png"),
    animations: "disabled",
  });
  await assertMobileState("loading");

  mockResponse = { status: 200, body: [], delay: 0 };
  await page.goto("/inventory/warehouses");
  await expect(page.getByRole("heading", { name: "No records found." }).first()).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "warehouses-state-empty.png"),
    animations: "disabled",
  });
  await assertMobileState("empty");

  mockResponse = { status: 500, body: { detail: "Responsive QA simulated server error." }, delay: 0 };
  await page.goto("/inventory/warehouses");
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "warehouses-state-error.png"),
    animations: "disabled",
  });
  await assertMobileState("error");

  mockResponse = { status: 403, body: { detail: "Responsive QA simulated permission denial." }, delay: 0 };
  await page.goto("/inventory/warehouses");
  await expect(page.getByRole("heading", { name: "Access Denied" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "warehouses-state-permission.png"),
    animations: "disabled",
  });
  await assertMobileState("permission");

  mockResponse = { status: 200, body: [], delay: 0 };
  await page.goto("/inventory/warehouses");
  await page.getByRole("button", { name: "Add Warehouse" }).click();
  await page.getByRole("button", { name: "Save Warehouse" }).click();
  await expect(page.locator("input[required]").first()).toBeVisible();
  expect(await page.locator("input[required]").first().evaluate((input) => input.matches(":invalid"))).toBe(true);
  await page.screenshot({
    path: path.join(outputDir, "warehouses-state-validation.png"),
    animations: "disabled",
  });
  await assertMobileState("validation");
  await page.unroute("**/inventory/warehouses");
}

async function captureProductionBomStates(page) {
  const viewport = viewports[0];
  const outputDir = path.resolve("..", "docs", "responsive-qa", "production-manager", `${viewport.width}x${viewport.height}`);
  await mkdir(outputDir, { recursive: true });

  const assertMobileState = async (state) => {
    const layout = await inspectLayout(page, viewport.width);
    expect(layout.documentWidth, `Production Manager ${state} state page width`).toBeLessThanOrEqual(viewport.width);
    expect(layout.undersizedTargets, `Production Manager ${state} state touch targets`).toEqual([]);
    expect(layout.clippedText, `Production Manager ${state} state clipped text`).toEqual([]);
    expect(layout.parentOverflows, `Production Manager ${state} state parent overflow`).toEqual([]);
  };

  let mockResponse = { status: 200, body: { items: [], total: 0 }, delay: 0 };
  await page.route("**/api/bom**", async (route) => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/bom/summary") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total_boms: 0, products_without_active_bom: 0, drafts_pending_activation: 0 }),
      });
      return;
    }
    if (pathname !== "/api/bom") {
      await route.continue();
      return;
    }
    if (mockResponse.delay) {
      await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
    }
    await route.fulfill({
      status: mockResponse.status,
      contentType: "application/json",
      body: JSON.stringify(mockResponse.body),
    });
  });
  await page.route("**/api/masters/products**", async (route) => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.setViewportSize(viewport);
  mockResponse = { status: 200, body: { items: [], total: 0 }, delay: 1_000 };
  await page.goto("/production/bom");
  await expect(page.locator(".ui-table-wrap.animate-pulse")).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "production-bom-state-loading.png"),
    animations: "disabled",
  });
  await assertMobileState("loading");

  mockResponse = { status: 200, body: { items: [], total: 0 }, delay: 0 };
  await page.goto("/production/bom");
  await expect(page.getByRole("heading", { name: "No BOMs yet" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "production-bom-state-empty.png"),
    animations: "disabled",
  });
  await assertMobileState("empty");

  mockResponse = { status: 500, body: { detail: "Responsive QA simulated server error." }, delay: 0 };
  await page.goto("/production/bom");
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "production-bom-state-error.png"),
    animations: "disabled",
  });
  await assertMobileState("error");

  mockResponse = { status: 403, body: { detail: "Responsive QA simulated permission denial." }, delay: 0 };
  await page.goto("/production/bom");
  await expect(page.getByRole("heading", { name: "Access Denied" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "production-bom-state-permission.png"),
    animations: "disabled",
  });
  await assertMobileState("permission");

  mockResponse = { status: 200, body: { items: [], total: 0 }, delay: 0 };
  await page.goto("/production/bom/new");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Select the finished product this BOM makes.")).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "production-bom-state-validation.png"),
    animations: "disabled",
  });
  await assertMobileState("validation");
  await page.unroute("**/api/bom**");
  await page.unroute("**/api/masters/products**");
}

async function captureSalesLeadStates(page) {
  const viewport = viewports[0];
  const outputDir = path.resolve("..", "docs", "responsive-qa", "sales-manager", `${viewport.width}x${viewport.height}`);
  await mkdir(outputDir, { recursive: true });

  const assertMobileState = async (state) => {
    const layout = await inspectLayout(page, viewport.width);
    expect(layout.documentWidth, `Sales Manager ${state} state page width`).toBeLessThanOrEqual(viewport.width);
    expect(layout.undersizedTargets, `Sales Manager ${state} state touch targets`).toEqual([]);
    expect(layout.clippedText, `Sales Manager ${state} state clipped text`).toEqual([]);
    expect(layout.parentOverflows, `Sales Manager ${state} state parent overflow`).toEqual([]);
  };

  let mockResponse = { status: 200, body: [], delay: 0 };
  await page.route("**/sales/leads/**", async (route) => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/sales/leads/summary")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total_leads: 0, new_leads: 0, qualified_leads: 0, converted_leads: 0 }),
      });
      return;
    }
    if (pathname.endsWith("/sales/leads/next-id")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ lead_no: "RQA-LEAD-001" }),
      });
      return;
    }
    if (!pathname.endsWith("/sales/leads/enriched")) {
      await route.continue();
      return;
    }
    if (mockResponse.delay) {
      await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
    }
    await route.fulfill({
      status: mockResponse.status,
      contentType: "application/json",
      body: JSON.stringify(mockResponse.body),
    });
  });
  await page.route("**/team-directory", async (route) => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/hr/employees**", async (route) => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.setViewportSize(viewport);
  mockResponse = { status: 200, body: [], delay: 1_000 };
  await page.goto("/sales/leads");
  await expect(page.getByText("Loading leads...")).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "sales-leads-state-loading.png"),
    animations: "disabled",
  });
  await assertMobileState("loading");

  mockResponse = { status: 200, body: [], delay: 0 };
  await page.goto("/sales/leads");
  await expect(page.getByRole("heading", { name: "No records found." }).first()).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "sales-leads-state-empty.png"),
    animations: "disabled",
  });
  await assertMobileState("empty");

  mockResponse = { status: 500, body: { detail: "Responsive QA simulated server error." }, delay: 0 };
  await page.goto("/sales/leads");
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "sales-leads-state-error.png"),
    animations: "disabled",
  });
  await assertMobileState("error");

  mockResponse = { status: 403, body: { detail: "Responsive QA simulated permission denial." }, delay: 0 };
  await page.goto("/sales/leads");
  await expect(page.getByRole("heading", { name: "Access Denied" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "sales-leads-state-permission.png"),
    animations: "disabled",
  });
  await assertMobileState("permission");

  mockResponse = { status: 200, body: [], delay: 0 };
  await page.goto("/sales/leads/new");
  await page.getByRole("button", { name: /create lead/i }).click();
  await expect(page.locator("#create-lead-form").getByText("Company name is required.")).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "sales-leads-state-validation.png"),
    animations: "disabled",
  });
  await assertMobileState("validation");
  await page.unroute("**/sales/leads/**");
  await page.unroute("**/team-directory");
  await page.unroute("**/hr/employees**");
}

async function captureHrEmployeeStates(page) {
  const viewport = viewports[0];
  const outputDir = path.resolve("..", "docs", "responsive-qa", "hr-manager", `${viewport.width}x${viewport.height}`);
  await mkdir(outputDir, { recursive: true });

  const assertMobileState = async (state) => {
    const layout = await inspectLayout(page, viewport.width);
    expect(layout.documentWidth, `HR Manager ${state} state page width`).toBeLessThanOrEqual(viewport.width);
    expect(layout.undersizedTargets, `HR Manager ${state} state touch targets`).toEqual([]);
    expect(layout.clippedText, `HR Manager ${state} state clipped text`).toEqual([]);
    expect(layout.parentOverflows, `HR Manager ${state} state parent overflow`).toEqual([]);
  };

  let mockResponse = { status: 200, body: [], delay: 0 };
  await page.route("**/hr/employees/enriched", async (route) => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    if (mockResponse.delay) {
      await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
    }
    await route.fulfill({
      status: mockResponse.status,
      contentType: "application/json",
      body: JSON.stringify(mockResponse.body),
    });
  });

  await page.setViewportSize(viewport);
  mockResponse = { status: 200, body: [], delay: 1_000 };
  await page.goto("/hr/employees");
  await expect(page.getByText("Loading...")).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "hr-employees-state-loading.png"),
    animations: "disabled",
  });
  await assertMobileState("loading");

  mockResponse = { status: 200, body: [], delay: 0 };
  await page.goto("/hr/employees");
  await expect(page.getByText("No records found")).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "hr-employees-state-empty.png"),
    animations: "disabled",
  });
  await assertMobileState("empty");

  mockResponse = { status: 500, body: { detail: "Responsive QA simulated server error." }, delay: 0 };
  await page.goto("/hr/employees");
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "hr-employees-state-error.png"),
    animations: "disabled",
  });
  await assertMobileState("error");

  mockResponse = { status: 403, body: { detail: "Responsive QA simulated permission denial." }, delay: 0 };
  await page.goto("/hr/employees");
  await expect(page.getByRole("heading", { name: "Access Denied" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "hr-employees-state-permission.png"),
    animations: "disabled",
  });
  await assertMobileState("permission");

  mockResponse = { status: 200, body: [], delay: 0 };
  await page.goto("/hr/employees/create");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#operation-error-dialog-message")).toContainText("Please fill required basic details");
  await page.screenshot({
    path: path.join(outputDir, "hr-employees-state-validation.png"),
    animations: "disabled",
  });
  await assertMobileState("validation");
  await page.unroute("**/hr/employees/enriched");
}

async function captureAdminUserStates(page) {
  const viewport = viewports[0];
  const outputDir = path.resolve("..", "docs", "responsive-qa", "admin", `${viewport.width}x${viewport.height}`);
  await mkdir(outputDir, { recursive: true });

  const assertMobileState = async (state) => {
    const layout = await inspectLayout(page, viewport.width);
    expect(layout.documentWidth, `Admin ${state} state page width`).toBeLessThanOrEqual(viewport.width);
    expect(layout.undersizedTargets, `Admin ${state} state touch targets`).toEqual([]);
    expect(layout.clippedText, `Admin ${state} state clipped text`).toEqual([]);
    expect(layout.parentOverflows, `Admin ${state} state parent overflow`).toEqual([]);
  };

  let usersResponse = { status: 200, body: [], delay: 0 };
  await page.route("**/admin/users", async (route) => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    if (usersResponse.delay) {
      await new Promise((resolve) => setTimeout(resolve, usersResponse.delay));
    }
    await route.fulfill({
      status: usersResponse.status,
      contentType: "application/json",
      body: JSON.stringify(usersResponse.body),
    });
  });
  await page.route("**/admin/roles", async (route) => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.setViewportSize(viewport);
  usersResponse = { status: 200, body: [], delay: 1_000 };
  await page.goto("/admin/users");
  await expect(page.getByText("Loading users…")).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "admin-users-state-loading.png"),
    animations: "disabled",
  });
  await assertMobileState("loading");

  usersResponse = { status: 200, body: [], delay: 0 };
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "No records found." })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "admin-users-state-empty.png"),
    animations: "disabled",
  });
  await assertMobileState("empty");

  usersResponse = { status: 500, body: { detail: "Responsive QA simulated server error." }, delay: 0 };
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "admin-users-state-error.png"),
    animations: "disabled",
  });
  await assertMobileState("error");

  usersResponse = { status: 403, body: { detail: "Responsive QA simulated permission denial." }, delay: 0 };
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Access Denied" })).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "admin-users-state-permission.png"),
    animations: "disabled",
  });
  await assertMobileState("permission");

  usersResponse = { status: 200, body: [], delay: 0 };
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "New User" }).click();
  await page.getByLabel("Full Name").fill("Responsive QA User");
  await page.getByLabel("Email").fill("responsive@example.test");
  await page.getByRole("button", { name: "Save User" }).click();
  await expect(page.getByText("Select at least one role")).toBeVisible();
  await page.screenshot({
    path: path.join(outputDir, "admin-users-state-validation.png"),
    animations: "disabled",
  });
  await assertMobileState("validation");
  await page.unroute("**/admin/users");
  await page.unroute("**/admin/roles");
}

test("captures RBAC pages and checks responsive layout", async ({ page: initialPage }, testInfo) => {
  let page = initialPage;
  const role = roles[testInfo.project.name];
  expect(role, `Unexpected responsive project ${testInfo.project.name}`).toBeTruthy();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page).not.toHaveURL(/\/login(?:\/|$)/);
  const actualRole = await page.evaluate(() => JSON.parse(localStorage.getItem("smrt-user") || "null")?.role);
  expect(actualRole).toBe(
    {
      operator: "Operator",
      "quality-control": "Quality Control",
      "store-manager": "Store Manager",
      "production-manager": "Production Manager",
      "sales-manager": "Sales Manager",
      "hr-manager": "HR Manager",
      admin: "Admin",
    }[role]
  );

  const routes = await getSidebarRoutes(page);
  expect(routes.length, `No sidebar routes discovered for ${role}`).toBeGreaterThan(0);
  console.log(`${role}: sidebar routes ${JSON.stringify(routes)}`);

  const violations = [];
  for (const [routeIndex, route] of routes.entries()) {
    if (role === "admin" && routeIndex > 0 && routeIndex % 80 === 0) {
      const context = page.context();
      await page.close();
      page = await context.newPage();
    }

    await page.setViewportSize(viewports[0]);
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    if (!response?.ok()) {
      violations.push(`${route}: navigation returned ${response?.status() ?? "no response"}`);
    }
    const pathname = new URL(page.url()).pathname;
    if (pathname === "/login" || pathname.startsWith("/login/")) {
      violations.push(`${route}: redirected to login`);
    }
    await page.waitForTimeout(1_000);
    const settled = await page
      .waitForFunction(
        () => !document.querySelector('[aria-label="Loading page content"]'),
        null,
        { timeout: 10_000 }
      )
      .then(
        () => true,
        (error) => {
          if (error.name !== "TimeoutError") throw error;
          return false;
        }
      );
    if (!settled) violations.push(`${route}: loading placeholder did not settle`);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      const layout = await inspectLayout(page, viewport.width);
      if (layout.documentWidth > viewport.width) {
        violations.push(`${route} at ${viewport.width}: document width ${layout.documentWidth}`);
      }
      if (layout.undersizedTargets.length) {
        violations.push(`${route} at ${viewport.width}: undersized controls ${JSON.stringify(layout.undersizedTargets)}`);
      }
      if (layout.clippedText.length) {
        violations.push(`${route} at ${viewport.width}: clipped text ${JSON.stringify(layout.clippedText)}`);
      }
      if (layout.parentOverflows.length) {
        violations.push(`${route} at ${viewport.width}: elements overflow parents ${JSON.stringify(layout.parentOverflows)}`);
      }

      const breakpoint = `${viewport.width}x${viewport.height}`;
      const screenshotDir = path.resolve("..", "docs", "responsive-qa", role, breakpoint);
      await mkdir(screenshotDir, { recursive: true });
      await page.screenshot({
        path: path.join(screenshotDir, `${routeSlug(route)}.png`),
        animations: "disabled",
      });
    }
  }

  if (role === "hr-manager") {
    await page.goto("/hr/settings");
    await expect(page.getByRole("heading", { name: "Organization Setup" })).toBeVisible();
    await page.getByRole("button", { name: "Branches" }).click();
    await page.getByRole("button", { name: "Add branch" }).click();
    const branchGrid = page.locator(".hr-org-setup__form-row--4");
    await expect(branchGrid).toBeVisible();

    for (const [width, expectedColumns] of [[639, 1], [640, 2]]) {
      await page.setViewportSize({ width, height: 900 });
      const actualColumns = await branchGrid.evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
      );
      expect(actualColumns, `Organization Setup branch form at ${width}px`).toBe(expectedColumns);
    }
  }

  if (role === "operator") {
    await page.setViewportSize(viewports[0]);
    await page.goto("/manufacturing/workflow/order/1/operator");
    await expect(page.getByRole("heading", { name: "Record production" })).toBeVisible();
    await expect(page.getByLabel("Produced quantity")).toHaveAttribute("inputmode", "decimal");

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const layout = await inspectLayout(page, viewport.width);
      if (layout.documentWidth > viewport.width) {
        violations.push(`operator work-order detail at ${viewport.width}: document width ${layout.documentWidth}`);
      }
      if (layout.undersizedTargets.length) {
        violations.push(`operator work-order detail at ${viewport.width}: undersized controls ${JSON.stringify(layout.undersizedTargets)}`);
      }
      if (layout.clippedText.length) {
        violations.push(`operator work-order detail at ${viewport.width}: clipped text ${JSON.stringify(layout.clippedText)}`);
      }
      if (layout.parentOverflows.length) {
        violations.push(`operator work-order detail at ${viewport.width}: elements overflow parents ${JSON.stringify(layout.parentOverflows)}`);
      }

      const screenshotDir = path.resolve("..", "docs", "responsive-qa", role, `${viewport.width}x${viewport.height}`);
      await mkdir(screenshotDir, { recursive: true });
      await page.screenshot({
        path: path.join(screenshotDir, "operator-work-order-detail.png"),
        animations: "disabled",
      });
    }

    await page.setViewportSize(viewports[0]);
    const startWorkButton = page.getByRole("button", { name: "Start Work" });
    if (await startWorkButton.count()) {
      await expect(startWorkButton).toBeVisible();
      await startWorkButton.click({ timeout: 15_000 });
    }
    await expect(page.getByRole("button", { name: "Pause Work" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete job and send to Quality" })).toBeVisible();
    const actionSizes = await page.getByRole("button", { name: /Pause Work|Complete job and send to Quality/ }).evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      })
    );
    expect(actionSizes.every(({ width, height }) => width >= 48 && height >= 48), JSON.stringify(actionSizes)).toBe(true);

    await captureOperatorMachineStates(page);
  }

  if (role === "quality-control") {
    await captureQualityInspectionStates(page);
  }

  if (role === "store-manager") {
    await captureStoreWarehouseStates(page);
  }

  if (role === "production-manager") {
    await captureProductionBomStates(page);
  }

  if (role === "sales-manager") {
    await captureSalesLeadStates(page);
  }

  if (role === "hr-manager") {
    await captureHrEmployeeStates(page);
  }

  if (role === "admin") {
    await captureAdminUserStates(page);
  }

  expect(violations, `${role} responsive violations:\n${violations.join("\n")}`).toEqual([]);
});
