import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../common/Modal", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));

vi.mock("../common/EmptyState", () => ({
  default: () => null,
}));

vi.mock("../common/Button", () => ({
  default: ({ children, onClick, type = "button" }) => (
    <button type={type} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("../../api/axiosConfig", () => ({
  default: { get: vi.fn(async () => ({ data: [] })) },
}));

const listCustomReportShares = vi.fn();

vi.mock("../../api/reportsApi", () => ({
  listCustomReportShares: (...args) => listCustomReportShares(...args),
  createCustomReportShare: vi.fn(),
  deleteCustomReportShare: vi.fn(),
}));

import ShareCustomReportModal from "./ShareCustomReportModal";

describe("ShareCustomReportModal", () => {
  beforeEach(() => {
    listCustomReportShares.mockResolvedValue({
      data: [{ id: 7, shared_with_role: "Sales Manager" }],
    });
  });

  it("loads existing shares when opened", async () => {
    const { unmount } = render(
      <ShareCustomReportModal open reportId={42} reportName="Sales" onClose={vi.fn()} />
    );
    await waitFor(() => expect(listCustomReportShares).toHaveBeenCalledWith(42));
    unmount();
  });
});
