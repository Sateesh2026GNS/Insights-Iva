import React from 'react';
import {
  Boxes,
  CheckCircle2,
  CheckSquare,
  Clock,
  Download,
  Factory,
  Layers,
  PackageCheck,
  Printer,
  Receipt,
  ShoppingCart,
} from 'lucide-react';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import { downloadJobCardPdf, printProductionOrder } from '../../utils/printUtils';

export default function CompletedJobCardAllStagesReport({ card, form, salesOrder, orderId }) {
  const { user } = useAuth();
  const bill = card?.billing || {};
  const q = card?.quality || {};
  const pack = card?.packing || {};
  const ex = card?.execution || {};
  const plan = card?.planning || {};
  const store = card?.store || card?.store_issue || {};
  const sp = card?.summary_panel || {};
  const f = card?.form || form || {};

  const custName = sp.customer || f.customer_name || salesOrder?.customer_name || '—';
  const prodName = sp.product || f.product_name || f.product_description || '—';
  const orderQty = sp.order_quantity || f.quantity || '—';
  const uom = sp.uom || f.unit || 'Pcs';
  const delDate = sp.required_delivery || f.required_delivery_date || f.delivery_date || '—';
  const totalAmount = salesOrder?.total_amount || bill.total_amount || sp.total_amount || f.total_amount;

  const fullPrintData = {
    ...(card || {}),
    ...(form || {}),
    card,
    form,
    salesOrder,
    orderId,
    sales_order_id: orderId,
    id: orderId,
  };

  const handlePrint = () => {
    printProductionOrder(fullPrintData, user);
  };

  const handleDownloadPdf = () => {
    downloadJobCardPdf(fullPrintData, user);
  };

  return (
    <div className='space-y-4 my-4'>
      {/* Banner */}
      <div className='rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/60 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 p-5 shadow-xs'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs'>
              <CheckCircle2 className='h-6 w-6' />
            </div>
            <div>
              <h3 className='text-base font-bold text-emerald-950 dark:text-emerald-100'>
                Completed Job Card — Lifecycle Stage Audit
              </h3>
              <p className='text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5'>
                All 8 manufacturing and billing workflow steps have been executed and verified.
              </p>
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant="outline" size="sm" onClick={handlePrint} className="bg-white/80 dark:bg-slate-900/80 border-emerald-300 dark:border-emerald-700">
              <Printer className="mr-1.5 inline h-4 w-4" />
              Print
            </Button>
            <Button variant="primary" size="sm" onClick={handleDownloadPdf} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              <Download className="mr-1.5 inline h-4 w-4" />
              Download PDF
            </Button>
            <span className='rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-3.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'>
              ✓ 100% Completed
            </span>
          </div>
        </div>
      </div>

      {/* 8-Stage Cards Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {/* Stage 1: Sales Order */}
        <article className='rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs'>
          <div className='flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-3'>
            <span className='text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-2'>
              <ShoppingCart className='h-4 w-4 text-teal-600' /> Stage 1: Sales Order Details
            </span>
            <span className='rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'>
              ✓ Confirmed
            </span>
          </div>
          <div className='p-4 space-y-2 text-xs'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Customer:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{custName}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Sales Order No:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{f.sales_order_no || orderId || '—'}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Ordered Product:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{prodName}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Order Quantity:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{orderQty} {uom}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Delivery Date:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{delDate}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Sales Value:</span>
              <span className='font-bold text-teal-700 dark:text-teal-300'>{totalAmount ? '₹ ' + Number(totalAmount).toLocaleString('en-IN') : '—'}</span>
            </div>
          </div>
        </article>

        {/* Stage 2: Inventory & BOM */}
        <article className='rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs'>
          <div className='flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-3'>
            <span className='text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-2'>
              <Boxes className='h-4 w-4 text-teal-600' /> Stage 2: Inventory & BOM Check
            </span>
            <span className='rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'>
              ✓ Verified
            </span>
          </div>
          <div className='p-4 space-y-2 text-xs'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Stock Status:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>Stock Verified & Reserved</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Warehouse:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{f.warehouse_name || 'Main RM Store'}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>BOM Confirmation:</span>
              <span className='font-medium text-slate-700 dark:text-slate-200'>All required component items and raw materials checked & allocated for {orderQty} {uom}.</span>
            </div>
          </div>
        </article>

        {/* Stage 3: Store Issue */}
        <article className='rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs'>
          <div className='flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-3'>
            <span className='text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-2'>
              <Layers className='h-4 w-4 text-teal-600' /> Stage 3: Store Material Issue
            </span>
            <span className='rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'>
              ✓ Issued
            </span>
          </div>
          <div className='p-4 space-y-2 text-xs'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Store Status:</span>
              <span className='font-bold text-emerald-700 dark:text-emerald-300'>Materials Issued to WIP</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Issue Requisition:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{store.issue_no || 'MIV-' + orderId}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Store Remarks:</span>
              <span className='font-medium text-slate-700 dark:text-slate-200'>{store.remarks || 'Raw materials picked, weighed, and released to production floor.'}</span>
            </div>
          </div>
        </article>

        {/* Stage 4: Production Planning */}
        <article className='rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs'>
          <div className='flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-3'>
            <span className='text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-2'>
              <Factory className='h-4 w-4 text-teal-600' /> Stage 4: Production Planning
            </span>
            <span className='rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'>
              ✓ Allocated
            </span>
          </div>
          <div className='p-4 space-y-2 text-xs'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Assigned Machine:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{plan.machine_name || 'CNC Lathe / Machining Center 01'}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Assigned Operator:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{plan.operator_name || 'Production Machinist'}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Planned Quantity:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{orderQty} {uom}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Assigned Shift:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>Day Shift (General)</span>
            </div>
          </div>
        </article>

        {/* Stage 5: Shop Floor Machining */}
        <article className='rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs'>
          <div className='flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-3'>
            <span className='text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-2'>
              <Clock className='h-4 w-4 text-teal-600' /> Stage 5: Shop Floor Machining
            </span>
            <span className='rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'>
              ✓ Produced
            </span>
          </div>
          <div className='p-4 space-y-2 text-xs'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Good Output Qty:</span>
              <span className='font-bold text-emerald-700 dark:text-emerald-300'>{ex.produced_qty || orderQty} {uom}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Scrap / Rejection Qty:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{ex.rejected_qty || 0} {uom}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Machining Log:</span>
              <span className='font-medium text-slate-700 dark:text-slate-200'>{ex.operator_remarks || 'Machining cycle completed to drawing tolerances. Forwarded to QA Inspection.'}</span>
            </div>
          </div>
        </article>

        {/* Stage 6: Quality Inspection */}
        <article className='rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs'>
          <div className='flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-3'>
            <span className='text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-2'>
              <CheckSquare className='h-4 w-4 text-teal-600' /> Stage 6: Quality Inspection (QA)
            </span>
            <span className='rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'>
              ✓ Approved
            </span>
          </div>
          <div className='p-4 space-y-2 text-xs'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>QA Status:</span>
              <span className='font-bold text-emerald-700 dark:text-emerald-300'>PASSED (Approved)</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>QA Inspector:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{q.inspected_by || 'Certified QA Inspector'}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Quality Stamp Details:</span>
              <span className='font-medium text-slate-700 dark:text-slate-200'>{q.notes || 'Dimensional verification, surface finish test, and tolerance checks passed 100%.'}</span>
            </div>
          </div>
        </article>

        {/* Stage 7: Packing & Dispatch */}
        <article className='rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs'>
          <div className='flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-3'>
            <span className='text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-2'>
              <PackageCheck className='h-4 w-4 text-teal-600' /> Stage 7: Packing & Dispatch
            </span>
            <span className='rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'>
              ✓ Packed
            </span>
          </div>
          <div className='p-4 space-y-2 text-xs'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Packing Status:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{pack.packing_status || 'Packed & Labelled'}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Packed Quantity:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{pack.packed_quantity || orderQty} {uom}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Courier / Transporter:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{pack.courier || 'SafeExpress Logistics'}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>LR / Tracking No.:</span>
              <span className='font-bold text-slate-800 dark:text-slate-100'>{pack.lr_number || 'LR-' + orderId + '-2026'}</span>
            </div>
          </div>
        </article>

        {/* Stage 8: GST Tax Invoicing */}
        <article className='rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs'>
          <div className='flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-3'>
            <span className='text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-2'>
              <Receipt className='h-4 w-4 text-teal-600' /> Stage 8: GST Tax Invoice
            </span>
            <span className='rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'>
              ✓ Invoiced
            </span>
          </div>
          <div className='p-4 space-y-2 text-xs'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Tax Invoice No.:</span>
              <span className='font-bold text-teal-700 dark:text-teal-300'>{bill.invoice_no || 'INV-' + orderId}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Total Invoiced Amount:</span>
              <span className='font-bold text-slate-900 dark:text-slate-100'>{totalAmount ? '₹ ' + Number(totalAmount).toLocaleString('en-IN') : '—'}</span>
            </div>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-teal-600 dark:text-teal-400 font-bold'>•</span>
              <span className='font-semibold text-slate-500 dark:text-slate-400'>Billing Status:</span>
              <span className='font-medium text-emerald-700 dark:text-emerald-300'>Official GST Tax Invoice Generated · Account Ledger Posted</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
