import StockLedger from "./StockLedger";

/** Store Manager view: stock-out movements for the current business day (local calendar). */
export default function TodaysStockOut() {
  return <StockLedger variant="todays_stock_out" />;
}
