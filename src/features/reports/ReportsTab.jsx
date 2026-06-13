import React from "react";
import {
  getOrderDiscountAmount,
  getOrderNetItemsAmount,
} from "../../shared/utils/moneyUtils";

const CURRENCY = "E\u00a3";

export default function ReportsTab({ children }) {
  return <>{children}</>;
}

export function ReportsTotalsBar({ dark, totals, reportDiscountTotal }) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: 10,
        borderRadius: 6,
        background: dark ? "#f5f5f5" : "#e8f5e9",
        color: "#000",
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
      }}
    >
      {[
        {
          label: "Revenue (items only):",
          value: totals.revenueTotal.toFixed(2),
        },
        {
          label: "Delivery Fees:",
          value: totals.deliveryFeesTotal.toFixed(2),
        },
        {
          label: "Discounts:",
          value: reportDiscountTotal.toFixed(2),
        },
        {
          label: "Purchases:",
          value: totals.purchasesTotal.toFixed(2),
        },
        {
          label: "Expenses:",
          value: totals.expensesTotal.toFixed(2),
        },
        {
          label: "Margin:",
          value: totals.margin.toFixed(2),
        },
      ].map(({ label, value }) => (
        <div
          key={label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "#000" }}>{label}</span>
          <span style={{ fontWeight: 700 }}>
            {CURRENCY}
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ReportsOrdersTable({ reportOrdersDetailed, cardBorder, fmtDateTime }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ margin: "16px 0 8px" }}>Orders in Period</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: `1px solid ${cardBorder}`, padding: 6 }}>
                Date / Time
              </th>
              <th style={{ textAlign: "right", borderBottom: `1px solid ${cardBorder}`, padding: 6 }}>
                POS #
              </th>
              <th style={{ textAlign: "left", borderBottom: `1px solid ${cardBorder}`, padding: 6 }}>
                Worker
              </th>
              <th style={{ textAlign: "left", borderBottom: `1px solid ${cardBorder}`, padding: 6 }}>
                Payment
              </th>
              <th style={{ textAlign: "right", borderBottom: `1px solid ${cardBorder}`, padding: 6 }}>
                Discount ({CURRENCY})
              </th>
              <th style={{ textAlign: "left", borderBottom: `1px solid ${cardBorder}`, padding: 6 }}>
                Type
              </th>
              <th style={{ textAlign: "right", borderBottom: `1px solid ${cardBorder}`, padding: 6 }}>
                Items ({CURRENCY})
              </th>
              <th style={{ textAlign: "right", borderBottom: `1px solid ${cardBorder}`, padding: 6 }}>
                Delivery ({CURRENCY})
              </th>
              <th style={{ textAlign: "right", borderBottom: `1px solid ${cardBorder}`, padding: 6 }}>
                Total ({CURRENCY})
              </th>
              <th style={{ textAlign: "left", borderBottom: `1px solid ${cardBorder}`, padding: 6 }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {reportOrdersDetailed.map((order, idx) => {
              const itemsOnly = getOrderNetItemsAmount(order);
              const rawDelivery = Number(order.deliveryFee || 0);
              const deliveryFeeValue = Number.isFinite(rawDelivery) ? rawDelivery : 0;
              const discountAmount = getOrderDiscountAmount(order);
              const rawTotal = Number(
                order.total != null ? order.total : itemsOnly + deliveryFeeValue
              );
              const totalValue = Number.isFinite(rawTotal)
                ? rawTotal
                : itemsOnly + deliveryFeeValue;
              const paymentDisplay = Array.isArray(order.paymentParts) && order.paymentParts.length
                ? order.paymentParts
                    .map((part) => `${part.method}: ${CURRENCY}${Number(part.amount || 0).toFixed(2)}`)
                    .join(" + ")
                : order.payment || "\u2014";
              const posDisplay = Number.isFinite(Number(order.orderNo))
                ? String(Math.floor(Number(order.orderNo)))
                : "\u2014";
              const normalizeStatusText = (value) =>
                String(value || "")
                  .replace(/[_-]+/g, " ")
                  .replace(/\b\w/g, (ch) => ch.toUpperCase());
              const statusLabel = order.voided
                ? order.restockedAt
                  ? "Cancelled"
                  : "Returned"
                : order.done
                ? "Done"
                : order.channel === "online" && order.status
                ? normalizeStatusText(order.status)
                : "Pending";
              const key =
                order.channelOrderNo ||
                `${order.orderNo || "order"}_${order.idemKey || order.onlineOrderKey || order.onlineOrderId || idx}`;
              return (
                <tr key={key}>
                  <td style={{ padding: 6 }}>{fmtDateTime(order.date)}</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{posDisplay}</td>
                  <td style={{ padding: 6 }}>{order.worker || "\u2014"}</td>
                  <td style={{ padding: 6 }}>{paymentDisplay}</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{discountAmount.toFixed(2)}</td>
                  <td style={{ padding: 6 }}>{order.orderType || "\u2014"}</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{itemsOnly.toFixed(2)}</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{deliveryFeeValue.toFixed(2)}</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{totalValue.toFixed(2)}</td>
                  <td style={{ padding: 6 }}>{statusLabel}</td>
                </tr>
              );
            })}
            {reportOrdersDetailed.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 8, opacity: 0.8 }}>
                  No orders recorded for the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
