import { Navigate, Route, Routes, useParams } from "react-router-dom";

import ProtectedRoute from "../components/layout/ProtectedRoute";
import InventoryLayout from "../layouts/InventoryLayout";
import { HR_PLACEHOLDER_PATHS } from "../config/hrRouteMeta";
/* Pages are lazy-loaded via lazyPages – see vite.config manualChunks for vendor splits */
import * as P from "./lazyPages";

function ManufacturingJobCardRedirect() {
  const { orderId } = useParams();
  return <Navigate to={`/job-cards/${orderId}`} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/landing" element={<P.Landing />} />
      <Route path="/login" element={<P.Login />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/gns-admin/login" element={<P.SuperAdminLogin />} />
      <Route path="/gns-admin/verify-otp" element={<P.SuperAdminVerifyOtp />} />
      <Route path="/super-admin/login" element={<Navigate to="/gns-admin/login" replace />} />
      <Route path="/super-admin" element={<Navigate to="/gns-admin/login" replace />} />
      <Route path="/superadmin" element={<Navigate to="/gns-admin/login" replace />} />
      <Route path="/gns-admin" element={<P.SuperAdminDashboard />} />
      <Route path="/gns-admin/companies/new" element={<P.CreateCompany />} />
      <Route path="/gns-admin/companies/:tenantId" element={<P.CompanyDetail />} />
      <Route path="/forgot-password" element={<P.ForgotPassword />} />
      <Route path="/reset-password" element={<P.ResetPassword />} />
      <Route path="/verify-email" element={<P.VerifyEmail />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <P.Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production"
        element={
          <ProtectedRoute>
            <P.ProductionDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/dashboard"
        element={
          <ProtectedRoute>
            <P.ProductionDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/planning"
        element={
          <ProtectedRoute>
            <P.ProductionPlanning />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/work-orders"
        element={
          <ProtectedRoute>
            <P.WorkOrders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/job-card"
        element={<Navigate to="/my-job-cards" replace />}
      />
      <Route
        path="/production/operator-jobs"
        element={
          <ProtectedRoute>
            <P.OperatorJobsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/machines"
        element={
          <ProtectedRoute>
            <P.MachineStatus />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/machines/create"
        element={
          <ProtectedRoute>
            <P.CreateMachine />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/reports"
        element={
          <ProtectedRoute>
            <P.DailyReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/daily-reports"
        element={<Navigate to="/production/reports" replace />}
      />
      <Route
        path="/production/batch-tracking"
        element={
          <ProtectedRoute>
            <P.BatchTracking />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/create"
        element={
          <ProtectedRoute>
            <P.CreateProduction />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/work-orders/create-quick"
        element={
          <ProtectedRoute>
            <P.QuickCreateWorkOrder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/tasks"
        element={
          <ProtectedRoute>
            <P.MachineAllocation />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <InventoryLayout />
          </ProtectedRoute>
        }
      >
      <Route
        path="/inventory"
        element={<P.InventoryV2 />}
      />
      <Route
        path="/inventory/dashboard"
        element={<P.InventoryDashboard />}
      />
      <Route
        path="/inventory/settings"
        element={<P.InventorySettingsV2 />}
      />
      <Route
        path="/inventory/list"
        element={<P.InventoryList />}
      />
      <Route
        path="/inventory/items/create"
        element={<P.CreateItem />}
      />
      <Route
        path="/inventory/items/:id"
        element={<P.InventoryItemDetailV2 />}
      />
      <Route
        path="/inventory/items"
        element={<Navigate to="/inventory/raw-materials" replace />}
      />
      <Route
        path="/inventory/raw-materials"
        element={<P.RawMaterials />}
      />
      <Route
        path="/inventory/finished-goods"
        element={<P.FinishedGoods />}
      />
      <Route
        path="/inventory/stock-transfer"
        element={<P.StockTransfer />}
      />
      <Route
        path="/inventory/stock-adjustment"
        element={<P.StockAdjustment />}
      />
      <Route
        path="/inventory/stock-ledger"
        element={<P.StockLedger />}
      />
      <Route
        path="/inventory/stock-movement"
        element={<P.StockMovement />}
      />
      <Route
        path="/inventory/stock-in"
        element={<P.StoreStockIn />}
      />
      <Route
        path="/inventory/material-requests"
        element={<P.StoreMaterialRequests />}
      />
      <Route
        path="/inventory/issue-materials"
        element={<P.StoreIssueMaterials />}
      />
      <Route
        path="/inventory/stock-return"
        element={<P.StoreStockReturn />}
      />
      <Route
        path="/inventory/history"
        element={<P.StoreInventoryHistory />}
      />
      <Route
        path="/inventory/warehouses"
        element={<P.Warehouses />}
      />
      <Route
        path="/inventory/suppliers"
        element={<P.Suppliers />}
      />
      <Route
        path="/inventory/warehouses/create"
        element={<P.CreateWarehouse />}
      />
      <Route
        path="/inventory/suppliers/create"
        element={<P.CreateSupplier />}
      />
      </Route>
      <Route
        path="/sales"
        element={
          <ProtectedRoute>
            <P.SalesDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/dashboard"
        element={
          <ProtectedRoute>
            <P.SalesDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/leads"
        element={
          <ProtectedRoute>
            <P.Leads />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/quotations"
        element={
          <ProtectedRoute>
            <P.Quotations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/quotations/create"
        element={
          <ProtectedRoute>
            <P.QuotationForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/quotations/:id/edit"
        element={
          <ProtectedRoute>
            <P.QuotationForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/quotations/:id"
        element={
          <ProtectedRoute>
            <P.QuotationCopyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/quotations/:id/copy"
        element={
          <ProtectedRoute>
            <P.QuotationCopyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/dispatch"
        element={
          <ProtectedRoute>
            <P.Dispatch />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/invoices"
        element={
          <ProtectedRoute>
            <P.InvoiceDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/bills"
        element={
          <ProtectedRoute>
            <P.SalesBills />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/bills/create"
        element={
          <ProtectedRoute>
            <P.CreateBill />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/bills/:id"
        element={
          <ProtectedRoute>
            <P.BillDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/invoices/copy"
        element={
          <ProtectedRoute>
            <P.InvoiceCopyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/invoices/:id"
        element={
          <ProtectedRoute>
            <P.InvoiceCopyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/invoices/:id/copy"
        element={
          <ProtectedRoute>
            <P.InvoiceCopyPage />
          </ProtectedRoute>
        }
      />
        <Route
          path="/sales/invoices/:id/edit"
          element={
            <ProtectedRoute>
              <P.TaxInvoiceForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/invoices/create"
          element={
            <ProtectedRoute>
              <P.TaxInvoiceForm />
            </ProtectedRoute>
          }
        />
      <Route
        path="/sales/orders"
        element={
          <ProtectedRoute>
            <P.SalesOrders />
          </ProtectedRoute>
        }
      />
      <Route path="/sales/orders/create" element={<Navigate to="/sales/orders" replace />} />
      <Route
        path="/my-job-cards"
        element={
          <ProtectedRoute>
            <P.MyJobCards />
          </ProtectedRoute>
        }
      />
      <Route path="/sales/job-cards" element={<Navigate to="/my-job-cards" replace />} />
      <Route
        path="/job-cards/:orderId"
        element={
          <ProtectedRoute>
            <P.JobCardDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/orders/:id/job-card"
        element={
          <ProtectedRoute>
            <P.SalesJobCardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/orders/:id"
        element={
          <ProtectedRoute>
            <P.SalesOrderDetail />
          </ProtectedRoute>
        }
      />
      <Route path="/manufacturing/workflow" element={<Navigate to="/my-job-cards" replace />} />
      <Route
        path="/manufacturing/workflow/order/:orderId/:stage"
        element={
          <ProtectedRoute>
            <P.StageJobCardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manufacturing/job-card/:orderId"
        element={
          <ProtectedRoute>
            <ManufacturingJobCardRedirect />
          </ProtectedRoute>
        }
      />
      <Route path="/masters" element={<Navigate to="/masters/products" replace />} />
      <Route path="/procurement" element={<Navigate to="/procurement/purchase-orders" replace />} />
      <Route
        path="/masters/customers"
        element={
          <ProtectedRoute>
            <P.Customers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/masters/customers/bulk-import"
        element={
          <ProtectedRoute>
            <P.BulkImportBuyer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/masters/customers/create"
        element={
          <ProtectedRoute>
            <P.CreateCustomer />
          </ProtectedRoute>
        }
      />
      <Route path="/sales/customers" element={<Navigate to="/masters/customers" replace />} />
      <Route path="/sales/customers/bulk-import" element={<Navigate to="/masters/customers/bulk-import" replace />} />
      <Route path="/sales/customers/create" element={<Navigate to="/masters/customers/create" replace />} />
      <Route
        path="/sales/payments"
        element={
          <ProtectedRoute>
            <P.PaymentTracking />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/payments/create"
        element={
          <ProtectedRoute>
            <P.PaymentReceiptForm />
          </ProtectedRoute>
        }
      />
      <Route path="/sales/payment-receipts" element={<ProtectedRoute><P.PaymentReceipts /></ProtectedRoute>} />
      <Route path="/sales/payment-receipts/create" element={<ProtectedRoute><P.PaymentReceiptForm /></ProtectedRoute>} />
      <Route path="/sales/payment-receipts/:id" element={<ProtectedRoute><P.PaymentReceiptCopyPage /></ProtectedRoute>} />
      <Route path="/sales/payment-receipts/:id/view" element={<ProtectedRoute><P.PaymentReceiptCopyPage /></ProtectedRoute>} />
      <Route path="/sales/payment-receipts/:id/copy" element={<ProtectedRoute><P.PaymentReceiptCopyPage /></ProtectedRoute>} />
      <Route path="/sales/payment-receipts/:id/edit" element={<ProtectedRoute><P.PaymentReceiptForm /></ProtectedRoute>} />
      <Route path="/sales/refund-vouchers" element={<ProtectedRoute><P.RefundVouchers /></ProtectedRoute>} />
      <Route path="/sales/proforma-invoices" element={<ProtectedRoute><P.ProformaInvoices /></ProtectedRoute>} />
      <Route path="/sales/proforma-invoices/create" element={<ProtectedRoute><P.ProformaInvoiceForm /></ProtectedRoute>} />
      <Route path="/sales/proforma-invoices/:id" element={<ProtectedRoute><P.InvoiceCopyPage /></ProtectedRoute>} />
      <Route path="/sales/proforma-invoices/:id/copy" element={<ProtectedRoute><P.InvoiceCopyPage /></ProtectedRoute>} />
      <Route path="/sales/proforma-invoices/:id/edit" element={<ProtectedRoute><P.ProformaInvoiceForm /></ProtectedRoute>} />
      <Route path="/sales/export-invoices" element={<ProtectedRoute><P.ExportInvoices /></ProtectedRoute>} />
      <Route path="/sales/export-invoices/create" element={<ProtectedRoute><P.ExportInvoiceForm /></ProtectedRoute>} />
      <Route path="/sales/export-invoices/:id/edit" element={<ProtectedRoute><P.ExportInvoiceForm /></ProtectedRoute>} />
      <Route path="/sales/export-invoices/:id" element={<ProtectedRoute><P.InvoiceCopyPage /></ProtectedRoute>} />
      <Route path="/sales/export-invoices/:id/copy" element={<ProtectedRoute><P.InvoiceCopyPage /></ProtectedRoute>} />
      <Route path="/sales/export-proforma-invoices" element={<ProtectedRoute><P.ProformaInvoices /></ProtectedRoute>} />
      <Route path="/sales/export-proforma-invoices/:id" element={<ProtectedRoute><P.InvoiceCopyPage /></ProtectedRoute>} />
      <Route path="/sales/export-proforma-invoices/:id/copy" element={<ProtectedRoute><P.InvoiceCopyPage /></ProtectedRoute>} />
      <Route path="/sales/export-proforma-invoices/:id/edit" element={<ProtectedRoute><P.ProformaInvoiceForm /></ProtectedRoute>} />
      <Route path="/sales/delivery-challans" element={<ProtectedRoute><P.DeliveryChallans /></ProtectedRoute>} />
      <Route path="/sales/delivery-challans/create" element={<ProtectedRoute><P.DeliveryChallanForm /></ProtectedRoute>} />
      <Route path="/sales/delivery-challans/:id/edit" element={<ProtectedRoute><P.DeliveryChallanForm /></ProtectedRoute>} />
      <Route path="/sales/credit-notes" element={<ProtectedRoute><P.CreditNotes /></ProtectedRoute>} />
      <Route path="/sales/credit-notes/create" element={<ProtectedRoute><P.CreditNoteForm /></ProtectedRoute>} />
      <Route path="/sales/credit-notes/:id/edit" element={<ProtectedRoute><P.CreditNoteForm /></ProtectedRoute>} />
      <Route path="/sales/debit-notes" element={<ProtectedRoute><P.DebitNotes /></ProtectedRoute>} />
      <Route path="/sales/debit-notes/create" element={<ProtectedRoute><P.DebitNoteForm /></ProtectedRoute>} />
      <Route path="/sales/debit-notes/:id/edit" element={<ProtectedRoute><P.DebitNoteForm /></ProtectedRoute>} />
      <Route path="/sales/debit-notes/:id" element={<ProtectedRoute><P.InvoiceCopyPage /></ProtectedRoute>} />
      <Route path="/sales/e-invoice" element={<ProtectedRoute><P.EInvoiceLogin /></ProtectedRoute>} />
      <Route path="/ewaybill/login" element={<ProtectedRoute><P.EwaybillLogin /></ProtectedRoute>} />
      <Route path="/digital-signature" element={<ProtectedRoute><P.DigitalSignatureSetup /></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute><P.Purchases /></ProtectedRoute>} />
      <Route path="/purchases/create" element={<ProtectedRoute><P.PurchaseForm /></ProtectedRoute>} />
      <Route path="/purchases/:id/edit" element={<ProtectedRoute><P.PurchaseForm /></ProtectedRoute>} />
      <Route path="/purchases/:id" element={<ProtectedRoute><P.PurchaseCopyPage /></ProtectedRoute>} />
      <Route path="/purchases/payments-made" element={<ProtectedRoute><P.PaymentsMade /></ProtectedRoute>} />
      <Route path="/purchases/payments-made/create" element={<ProtectedRoute><P.MakePaymentForm /></ProtectedRoute>} />
      <Route path="/purchases/payments-made/:id/edit" element={<ProtectedRoute><P.MakePaymentForm /></ProtectedRoute>} />
      <Route path="/purchases/debit-notes" element={<ProtectedRoute><P.PurchaseDebitNotes /></ProtectedRoute>} />
      <Route path="/purchases/debit-notes/create" element={<ProtectedRoute><P.PurchaseDebitNoteForm /></ProtectedRoute>} />
      <Route path="/purchases/debit-notes/:id/edit" element={<ProtectedRoute><P.PurchaseDebitNoteForm /></ProtectedRoute>} />
      <Route path="/purchases/debit-notes/:id" element={<ProtectedRoute><P.PurchaseCopyPage /></ProtectedRoute>} />
      <Route path="/accounts/reports" element={<ProtectedRoute><P.AccountingReports /></ProtectedRoute>} />
      <Route path="/accounts/reports/:reportId" element={<ProtectedRoute><P.ReportDetailV2 /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><P.AccountingReports /></ProtectedRoute>} />
      <Route path="/reports/:reportId" element={<ProtectedRoute><P.ReportDetailV2 /></ProtectedRoute>} />
      <Route path="/accounts/ledger" element={<ProtectedRoute><P.LedgerV2 /></ProtectedRoute>} />
      <Route path="/accounts/ledger/:kind/:id" element={<ProtectedRoute><P.LedgerDetailsV2 /></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute><P.LedgerV2 /></ProtectedRoute>} />
      <Route path="/ledger/:kind/:id" element={<ProtectedRoute><P.LedgerDetailsV2 /></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><P.AccountsDashboard /></ProtectedRoute>} />
      <Route path="/accounts/profit-loss" element={<ProtectedRoute><P.ProfitLoss /></ProtectedRoute>} />
      <Route path="/accounts/expenses" element={<ProtectedRoute><P.ExpenseV2 /></ProtectedRoute>} />
      <Route path="/accounts/expenses/settings" element={<ProtectedRoute><P.ExpenseSettingsV2 /></ProtectedRoute>} />
      <Route path="/accounts/expenses/record" element={<ProtectedRoute><P.RecordExpense /></ProtectedRoute>} />
      <Route path="/accounts/tax-reports" element={<ProtectedRoute><P.TaxReports /></ProtectedRoute>} />
      <Route path="/accounts/income/record" element={<ProtectedRoute><P.RecordIncome /></ProtectedRoute>} />
      <Route path="/accounts/balance-sheet" element={<ProtectedRoute><P.BalanceSheet /></ProtectedRoute>} />
      <Route path="/accounts/restore-deleted" element={<ProtectedRoute><P.RestoreDeletedDoc /></ProtectedRoute>} />
      <Route path="/accounts/restore-deleted-docs" element={<ProtectedRoute><P.RestoreDeletedDoc /></ProtectedRoute>} />
      <Route path="/accounts/trial-balance" element={<ProtectedRoute><P.TrialBalance /></ProtectedRoute>} />
      <Route path="/accounts/journal-entries" element={<ProtectedRoute><P.JournalEntries /></ProtectedRoute>} />
      <Route path="/accounts/journal-entries/new" element={<ProtectedRoute><P.NewJournalEntry /></ProtectedRoute>} />
      <Route path="/accounts/journal-entries/:entryId/edit" element={<ProtectedRoute><P.NewJournalEntry /></ProtectedRoute>} />
      <Route path="/accounts/chart-of-accounts" element={<ProtectedRoute><P.ChartOfAccounts /></ProtectedRoute>} />
      <Route path="/accounts/chart-of-accounts/:accountId" element={<ProtectedRoute><P.ChartOfAccountDetail /></ProtectedRoute>} />
      <Route path="/accounts/chart-of-accounts/:accountId/journal/new" element={<ProtectedRoute><P.NewJournalEntry /></ProtectedRoute>} />
      <Route path="/accounts/fixed-assets" element={<ProtectedRoute><P.FixedAssets /></ProtectedRoute>} />
      <Route path="/accounts/bank-reconciliation" element={<ProtectedRoute><P.BankReconciliation /></ProtectedRoute>} />
      <Route path="/accounts/budget-actual" element={<ProtectedRoute><P.BudgetActual /></ProtectedRoute>} />
      <Route path="/accounts/cost-allocation" element={<ProtectedRoute><P.CostAllocation /></ProtectedRoute>} />
      <Route path="/accounts/accounts-payable" element={<ProtectedRoute><P.AccountsPayable /></ProtectedRoute>} />
      <Route path="/procurement/purchase-orders" element={<ProtectedRoute><P.PurchaseOrders /></ProtectedRoute>} />
      <Route path="/procurement/purchase-orders/create" element={<ProtectedRoute><P.CreatePurchaseOrder /></ProtectedRoute>} />
      <Route path="/procurement/purchase-orders/:id/edit" element={<ProtectedRoute><P.CreatePurchaseOrder /></ProtectedRoute>} />
      <Route path="/procurement/vendors" element={<ProtectedRoute><P.VendorManagement /></ProtectedRoute>} />
      <Route path="/masters/vendors" element={<ProtectedRoute><P.VendorManagement /></ProtectedRoute>} />
      <Route path="/procurement/vendors/bulk-import" element={<ProtectedRoute><P.BulkImportSeller /></ProtectedRoute>} />
      <Route path="/masters/vendors/bulk-import" element={<ProtectedRoute><P.BulkImportSeller /></ProtectedRoute>} />
      <Route path="/procurement/vendors/create" element={<ProtectedRoute><P.CreateVendor /></ProtectedRoute>} />
      <Route path="/procurement/vendors/:vendorId/edit" element={<ProtectedRoute><P.CreateVendor /></ProtectedRoute>} />
      <Route path="/procurement/vendors/:vendorId" element={<ProtectedRoute><P.VendorDetail /></ProtectedRoute>} />
      <Route path="/procurement/material-requests" element={<ProtectedRoute><P.MaterialRequests /></ProtectedRoute>} />
      <Route path="/procurement/material-requests/create" element={<ProtectedRoute><P.CreateMaterialRequest /></ProtectedRoute>} />
      <Route path="/procurement/goods-receipt" element={<ProtectedRoute><P.GoodsReceipt /></ProtectedRoute>} />
      <Route path="/procurement/goods-receipt/create" element={<ProtectedRoute><P.CreateGoodsReceipt /></ProtectedRoute>} />
      <Route path="/procurement/supplier-payments" element={<ProtectedRoute><P.SupplierPayments /></ProtectedRoute>} />
      <Route path="/procurement/supplier-payments/create" element={<ProtectedRoute><P.CreateSupplierPayment /></ProtectedRoute>} />
      <Route path="/procurement/vendor-bills" element={<ProtectedRoute><P.VendorBills /></ProtectedRoute>} />
      <Route path="/procurement/supply-chain" element={<ProtectedRoute><P.SupplyChainDashboard /></ProtectedRoute>} />
      <Route path="/quality" element={<ProtectedRoute><P.QualityDashboard /></ProtectedRoute>} />
      <Route path="/quality/incoming" element={<ProtectedRoute><P.IncomingInspection /></ProtectedRoute>} />
      <Route path="/quality/in-process" element={<ProtectedRoute><P.InProcessQC /></ProtectedRoute>} />
      <Route path="/quality/final" element={<ProtectedRoute><P.FinalQC /></ProtectedRoute>} />
      <Route path="/quality/inspection" element={<ProtectedRoute><P.QualityInspection /></ProtectedRoute>} />
      <Route path="/quality/defects" element={<ProtectedRoute><P.DefectTracking /></ProtectedRoute>} />
      <Route path="/quality/batch-reports" element={<ProtectedRoute><P.BatchQualityReports /></ProtectedRoute>} />
      <Route path="/quality/compliance" element={<ProtectedRoute><P.ComplianceLogs /></ProtectedRoute>} />
      <Route path="/maintenance" element={<ProtectedRoute><P.MaintenanceDashboard /></ProtectedRoute>} />
      <Route path="/maintenance/equipment" element={<ProtectedRoute><P.EquipmentSpareParts /></ProtectedRoute>} />
      <Route path="/maintenance/machines" element={<ProtectedRoute><P.MachineMaintenance /></ProtectedRoute>} />
      <Route path="/maintenance/preventive" element={<ProtectedRoute><P.PreventiveMaintenance /></ProtectedRoute>} />
      <Route path="/maintenance/breakdowns" element={<ProtectedRoute><P.BreakdownReports /></ProtectedRoute>} />
      <Route path="/maintenance/machine-history" element={<ProtectedRoute><P.MachineHistory /></ProtectedRoute>} />
      <Route path="/maintenance/history" element={<ProtectedRoute><P.MachineHistory /></ProtectedRoute>} />
      <Route path="/maintenance/schedule" element={<ProtectedRoute><P.MaintenanceSchedule /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><P.ExecutiveDashboard /></ProtectedRoute>} />
      <Route path="/analytics/executive" element={<ProtectedRoute><P.ExecutiveDashboard /></ProtectedRoute>} />
      <Route path="/analytics/live" element={<ProtectedRoute><P.LiveDashboard /></ProtectedRoute>} />
      <Route path="/analytics/production" element={<ProtectedRoute><P.ProductionAnalytics /></ProtectedRoute>} />
      <Route path="/analytics/machine-efficiency" element={<ProtectedRoute><P.MachineEfficiency /></ProtectedRoute>} />
      <Route path="/analytics/inventory" element={<ProtectedRoute><P.InventoryAnalytics /></ProtectedRoute>} />
      <Route path="/analytics/sales" element={<ProtectedRoute><P.SalesAnalytics /></ProtectedRoute>} />
      <Route path="/analytics/finance" element={<ProtectedRoute><P.FinanceAnalytics /></ProtectedRoute>} />
      <Route path="/analytics/profit" element={<ProtectedRoute><P.ProfitAnalysis /></ProtectedRoute>} />
      <Route path="/analytics/forecasting" element={<ProtectedRoute><P.ForecastingDashboard /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><P.AllAlerts /></ProtectedRoute>} />
      <Route path="/alerts/low-stock" element={<ProtectedRoute><P.LowStockAlerts /></ProtectedRoute>} />
      <Route path="/alerts/machine-failure" element={<ProtectedRoute><P.MachineFailureAlerts /></ProtectedRoute>} />
      <Route path="/alerts/production-delay" element={<ProtectedRoute><P.ProductionDelayAlerts /></ProtectedRoute>} />
      <Route path="/alerts/maintenance" element={<ProtectedRoute><P.MaintenanceReminders /></ProtectedRoute>} />
      <Route path="/alerts/quality" element={<ProtectedRoute><P.QualityAlerts /></ProtectedRoute>} />
      <Route path="/alerts/safety" element={<ProtectedRoute><P.SafetyAlerts /></ProtectedRoute>} />
      <Route path="/alerts/general" element={<ProtectedRoute><P.GeneralAlerts /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><P.UserManagement /></ProtectedRoute>} />
      <Route path="/admin/roles" element={<ProtectedRoute><P.RolesPermissions /></ProtectedRoute>} />
      <Route path="/admin/permissions" element={<ProtectedRoute><P.RolesPermissions /></ProtectedRoute>} />
      <Route path="/admin/audit-logs" element={<ProtectedRoute><P.AccessLogs /></ProtectedRoute>} />
      <Route path="/admin/access-logs" element={<Navigate to="/admin/audit-logs" replace />} />
      <Route path="/admin/approvals" element={<ProtectedRoute><P.PendingApprovals /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><P.DocumentsDashboard /></ProtectedRoute>} />
      <Route path="/meetings" element={<ProtectedRoute><P.MeetingsList /></ProtectedRoute>} />
      <Route path="/meetings/:id" element={<ProtectedRoute><P.MeetingDetail /></ProtectedRoute>} />
      <Route path="/documents/purchase" element={<ProtectedRoute><P.PurchaseDocuments /></ProtectedRoute>} />
      <Route path="/documents/production" element={<ProtectedRoute><P.ProductionFiles /></ProtectedRoute>} />
      <Route path="/documents/quality" element={<ProtectedRoute><P.QualityCertificates /></ProtectedRoute>} />
      <Route path="/documents/reports" element={<ProtectedRoute><P.ReportsArchive /></ProtectedRoute>} />
      <Route path="/settings/change-template" element={<ProtectedRoute><P.TemplateSettings /></ProtectedRoute>} />
      <Route path="/settings/template-settings" element={<ProtectedRoute><P.TemplateSettings /></ProtectedRoute>} />
      <Route path="/settings/invoice-template" element={<ProtectedRoute><P.TemplateSettings /></ProtectedRoute>} />
      <Route path="/settings/quotation-template" element={<ProtectedRoute><P.TemplateSettings /></ProtectedRoute>} />
      <Route path="/settings/purchase-template" element={<ProtectedRoute><P.TemplateSettings /></ProtectedRoute>} />
      <Route path="/settings/change-format" element={<ProtectedRoute><P.FormatSettings /></ProtectedRoute>} />
      <Route path="/settings/format-settings" element={<ProtectedRoute><P.FormatSettings /></ProtectedRoute>} />
      <Route path="/settings/inventory-settings" element={<ProtectedRoute><P.InventorySettingsV2 /></ProtectedRoute>} />
      <Route path="/settings/invoice-settings" element={<ProtectedRoute><P.InvoiceSettings /></ProtectedRoute>} />
      <Route path="/settings/sequence-reset" element={<ProtectedRoute><P.SequenceResetSettingV2 /></ProtectedRoute>} />
      <Route path="/settings/expense-settings" element={<ProtectedRoute><Navigate to="/accounts/expenses/settings" replace /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><P.SettingsLayout /></ProtectedRoute>}>
        <Route index element={<P.SettingsHome />} />
        <Route path=":sectionId" element={<P.SettingsSectionPage />} />
        {/* Legacy deep links → section pages (must not target the same path or it loops) */}
        <Route path="addresses/billing" element={<Navigate to="/settings/company" replace />} />
        <Route path="addresses/delivery" element={<Navigate to="/settings/company" replace />} />
        <Route path="accounts/*" element={<Navigate to="/settings/finance" replace />} />
        <Route path="documents/:legacySub/*" element={<Navigate to="/settings/documents" replace />} />
        <Route path="documents/:legacySub" element={<Navigate to="/settings/documents" replace />} />
      </Route>
      <Route path="/masters/products" element={<ProtectedRoute><P.ProductsMaster /></ProtectedRoute>} />
      <Route path="/masters/products/bulk-import" element={<ProtectedRoute><P.BulkImportProduct /></ProtectedRoute>} />
      <Route path="/masters/products/create" element={<ProtectedRoute><P.CreateProduct /></ProtectedRoute>} />
      <Route path="/masters/products/:id/edit" element={<ProtectedRoute><P.CreateProduct /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><P.ProductsMaster /></ProtectedRoute>} />
      <Route path="/products/bulk-import" element={<ProtectedRoute><P.BulkImportProduct /></ProtectedRoute>} />
      <Route path="/products/create" element={<ProtectedRoute><P.CreateProduct /></ProtectedRoute>} />
      <Route path="/products/:id/edit" element={<ProtectedRoute><P.CreateProduct /></ProtectedRoute>} />
      <Route path="/master/products" element={<ProtectedRoute><P.ProductsMaster /></ProtectedRoute>} />
      <Route path="/master/products/bulk-import" element={<ProtectedRoute><P.BulkImportProduct /></ProtectedRoute>} />
      <Route path="/master/products/create" element={<ProtectedRoute><P.CreateProduct /></ProtectedRoute>} />
      <Route path="/master/products/:id/edit" element={<ProtectedRoute><P.CreateProduct /></ProtectedRoute>} />
      <Route path="/inventory/products/bulk-import" element={<ProtectedRoute><P.BulkImportProduct /></ProtectedRoute>} />
      <Route path="/masters/bom" element={<ProtectedRoute><P.BomMaster /></ProtectedRoute>} />
      <Route path="/masters/departments" element={<ProtectedRoute><P.DepartmentManagement /></ProtectedRoute>} />
      <Route path="/production/schedule" element={<ProtectedRoute><P.ProductionSchedule /></ProtectedRoute>} />
      <Route path="/procurement/rfq" element={<ProtectedRoute><P.RFQ /></ProtectedRoute>} />
      <Route path="/finance/accounts-payable" element={<ProtectedRoute><Navigate to="/accounts/accounts-payable" replace /></ProtectedRoute>} />
      <Route path="/finance/accounts-receivable" element={<ProtectedRoute><P.AccountsReceivable /></ProtectedRoute>} />
      <Route path="/accounts/accounts-receivable" element={<Navigate to="/finance/accounts-receivable" replace />} />
      <Route path="/finance/payment-tracking" element={<ProtectedRoute><P.PaymentTracking /></ProtectedRoute>} />
      <Route path="/finance/general-ledger" element={<ProtectedRoute><P.GeneralLedger /></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute><Navigate to="/accounts" replace /></ProtectedRoute>} />
      <Route path="/factory-monitor/live-production" element={<ProtectedRoute><Navigate to="/factory-monitor/machine-status" replace /></ProtectedRoute>} />
      <Route path="/factory-monitor/machine-status" element={<ProtectedRoute><P.FactoryMonitorMachineStatus /></ProtectedRoute>} />
      <Route path="/factory-monitor/production-lines" element={<ProtectedRoute><P.FactoryMonitorProductionLines /></ProtectedRoute>} />
      <Route path="/iot" element={<ProtectedRoute><P.IotDashboard /></ProtectedRoute>} />
      <Route path="/iot/wearables" element={<ProtectedRoute><P.Wearables /></ProtectedRoute>} />
      <Route path="/iot/machine-analytics" element={<ProtectedRoute><P.MachineAnalytics /></ProtectedRoute>} />
      <Route path="/iot/sensors" element={<ProtectedRoute><P.Sensors /></ProtectedRoute>} />
      <Route path="/iot/cobots" element={<ProtectedRoute><P.Cobots /></ProtectedRoute>} />
      <Route path="/iot/agvs" element={<ProtectedRoute><P.Agvs /></ProtectedRoute>} />
      <Route path="/iot/drones" element={<ProtectedRoute><P.Drones /></ProtectedRoute>} />
      <Route path="/iot/smart-packaging" element={<ProtectedRoute><P.SmartPackaging /></ProtectedRoute>} />
      <Route path="/iot/live-operations" element={<ProtectedRoute><P.LiveOperations /></ProtectedRoute>} />
      <Route path="/hr" element={<ProtectedRoute><P.HRDashboard /></ProtectedRoute>} />
      <Route path="/hr/employees" element={<ProtectedRoute><P.HREmployees /></ProtectedRoute>} />
      <Route path="/hr/employees/create" element={<ProtectedRoute><P.HRCreateEmployee /></ProtectedRoute>} />
      <Route path="/hr/employees/bulk-upload" element={<ProtectedRoute><P.HRBulkUploadEmployees /></ProtectedRoute>} />
      <Route path="/hr/employees/offboarded" element={<ProtectedRoute><P.HROffboarded /></ProtectedRoute>} />
      <Route path="/hr/attendance" element={<ProtectedRoute><P.HRAttendance /></ProtectedRoute>} />
      <Route path="/hr/attendance/approval" element={<ProtectedRoute><P.HRAttendanceApproval /></ProtectedRoute>} />
      <Route path="/hr/attendance/overtime" element={<ProtectedRoute><P.HROvertime /></ProtectedRoute>} />
      <Route path="/hr/attendance/adjusted-leave" element={<ProtectedRoute><P.HRAttendanceAdjustedLeave /></ProtectedRoute>} />
      <Route path="/hr/attendance/settings" element={<ProtectedRoute><P.HRAttendanceSettings /></ProtectedRoute>} />
      <Route path="/hr/leave" element={<ProtectedRoute><P.HRLeave /></ProtectedRoute>} />
      <Route path="/hr/leave/approvals" element={<ProtectedRoute><P.HRLeaveApprovals /></ProtectedRoute>} />
      <Route path="/hr/leave/holiday" element={<ProtectedRoute><P.HRHoliday /></ProtectedRoute>} />
      <Route path="/hr/leave/adjustment" element={<ProtectedRoute><P.HRLeaveAdjustment /></ProtectedRoute>} />
      <Route path="/hr/leave/plans" element={<ProtectedRoute><P.HRLeavePlans /></ProtectedRoute>} />
      <Route path="/hr/leave/plans/create" element={<ProtectedRoute><P.HRCreateLeavePlan /></ProtectedRoute>} />
      <Route path="/hr/leave/create" element={<ProtectedRoute><P.HRCreateLeave /></ProtectedRoute>} />
      <Route path="/hr/payroll" element={<ProtectedRoute><P.HRPayroll /></ProtectedRoute>} />
      <Route path="/hr/payroll/create" element={<ProtectedRoute><P.HRCreatePayroll /></ProtectedRoute>} />
      <Route path="/hr/performance" element={<ProtectedRoute><P.HRPerformance /></ProtectedRoute>} />
      <Route path="/hr/performance/create" element={<ProtectedRoute><P.HRCreatePerformance /></ProtectedRoute>} />
      <Route path="/hr/training" element={<ProtectedRoute><P.HRTraining /></ProtectedRoute>} />
      <Route path="/hr/recruitment" element={<ProtectedRoute><P.HRRecruitment /></ProtectedRoute>} />
      <Route path="/hr/recruitment/create" element={<ProtectedRoute><P.HRAddCandidate /></ProtectedRoute>} />
      <Route path="/hr/shifts" element={<ProtectedRoute><P.HRShifts /></ProtectedRoute>} />
      <Route path="/hr/shifts/monthly" element={<ProtectedRoute><P.HRMonthlyShifts /></ProtectedRoute>} />
      <Route path="/hr/shifts/week-off" element={<ProtectedRoute><P.HRWeekOff /></ProtectedRoute>} />
      <Route path="/hr/shifts/create" element={<ProtectedRoute><P.HRCreateShift /></ProtectedRoute>} />
      <Route path="/hr/assets" element={<ProtectedRoute><P.HRAssets /></ProtectedRoute>} />
      <Route path="/hr/assets/create" element={<ProtectedRoute><P.HRCreateAsset /></ProtectedRoute>} />
      <Route path="/hr/assets/mapped" element={<ProtectedRoute><P.HRMappedAssets /></ProtectedRoute>} />
      <Route path="/hr/incidents" element={<ProtectedRoute><P.HRIncidents /></ProtectedRoute>} />
      <Route path="/hr/incidents/create" element={<ProtectedRoute><P.HRCreateIncident /></ProtectedRoute>} />
      <Route path="/hr/documents" element={<ProtectedRoute><P.HRDocuments /></ProtectedRoute>} />
      <Route path="/hr/settings" element={<ProtectedRoute><P.HRSettings /></ProtectedRoute>} />
      <Route path="/hr/roles" element={<ProtectedRoute><P.HRRolesPermissions /></ProtectedRoute>} />
      <Route path="/hr/site-visits" element={<ProtectedRoute><P.HRSiteVisit /></ProtectedRoute>} />
      <Route path="/hr/expenses" element={<ProtectedRoute><P.HRExpenseOverview /></ProtectedRoute>} />
      <Route path="/hr/expenses/my" element={<ProtectedRoute><P.HRMyExpenses /></ProtectedRoute>} />
      <Route path="/hr/expenses/approvals" element={<ProtectedRoute><P.HRExpenseApprovals /></ProtectedRoute>} />
      <Route path="/hr/payroll/salary-components" element={<ProtectedRoute><P.HRSalaryComponents /></ProtectedRoute>} />
      <Route path="/hr/payroll/statutory-components" element={<ProtectedRoute><P.HRStatutoryComponents /></ProtectedRoute>} />
      <Route path="/hr/payroll/salary-breakup" element={<ProtectedRoute><P.HRSalaryBreakupList /></ProtectedRoute>} />
      <Route path="/hr/payroll/salary-breakup/create" element={<ProtectedRoute><P.HRCreateSalaryBreakup /></ProtectedRoute>} />
      <Route path="/hr/payroll/on-hold" element={<ProtectedRoute><P.HRSalaryOnHold /></ProtectedRoute>} />
      <Route path="/hr/payroll/my-payslips" element={<ProtectedRoute><P.HRMyPayslips /></ProtectedRoute>} />
      <Route path="/hr/payroll/settings" element={<ProtectedRoute><P.HRPayrollSettings /></ProtectedRoute>} />
      <Route path="/hr/reports/attendance" element={<ProtectedRoute><P.HRAttendanceReport /></ProtectedRoute>} />
      <Route path="/hr/reports/leave" element={<ProtectedRoute><P.HRLeaveReport /></ProtectedRoute>} />
      <Route path="/hr/reports/expense" element={<ProtectedRoute><P.HRExpenseReport /></ProtectedRoute>} />
      <Route path="/hr/reports/site-visit" element={<ProtectedRoute><P.HRSiteVisitReport /></ProtectedRoute>} />
      <Route path="/hr/reports/employee" element={<ProtectedRoute><P.HREmployeeReport /></ProtectedRoute>} />
      <Route path="/hr/reports/pf" element={<ProtectedRoute><P.HRPfReport /></ProtectedRoute>} />
      <Route path="/hr/reports/esic" element={<ProtectedRoute><P.HREsicReport /></ProtectedRoute>} />
      <Route path="/hr/reports/salary" element={<ProtectedRoute><P.HRSalaryReport /></ProtectedRoute>} />
      <Route path="/hr/reports/bank-template" element={<ProtectedRoute><P.HRBankTemplateReport /></ProtectedRoute>} />
      {HR_PLACEHOLDER_PATHS.map((path) => (
        <Route key={path} path={path} element={<ProtectedRoute><P.HRPlaceholders /></ProtectedRoute>} />
      ))}
      <Route path="*" element={<ProtectedRoute><P.NotFound /></ProtectedRoute>} />
    </Routes>
  );
}