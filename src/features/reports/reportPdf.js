import { getOrderDiscountAmount } from "../../shared/utils/moneyUtils";

export function buildReportOrderRows(reportOrdersDetailed = [], fmtDateTime) {
  return reportOrdersDetailed.map((o) => [
    o.orderNo,
    fmtDateTime(o.date),
    o.worker,
    o.payment,
    getOrderDiscountAmount(o).toFixed(2),
    o.orderType || "",
    (o.deliveryFee || 0).toFixed(2),
    o.total.toFixed(2),
    o.voided ? (o.restockedAt ? "Cancelled" : "Returned") : (o.done ? "Done" : "Not done"),
    o.voided ? (o.voidReason || "") : "",
  ]);
}
