import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

test("payroll history renders complete earnings and deductions on both layouts", async () => {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const server = await createServer({
    configFile: false,
    root,
    server: { middlewareMode: true },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": `${root}src` } },
  });
  try {
    const { default: Page } = await server.ssrLoadModule("/src/pages/employee/PayrollHistory.tsx");
    const { getGetMyPayrollHistoryQueryKey } = await server.ssrLoadModule("@workspace/api-client-react");
    const base = {
      id: "sample", daysPresent: 10, daysAbsent: 0, lateCount: 1,
      regularPay: "8000.00", overtimePay: "600.00", incentivePay: "1000.00",
      grossPay: "9600.00", lateDeductionTotal: "24.00",
      undertimeDeductionTotal: "150.00", cashAdvanceDeduction: "2500.00",
      netPay: "6926.00",
    };
    const cases = [
      { entry: base, total: "2,674.00" },
      { entry: { ...base, overtimePay: "0.00", incentivePay: undefined, grossPay: "8000.00", lateDeductionTotal: "0.00", undertimeDeductionTotal: "0.00", cashAdvanceDeduction: "0.00", netPay: "8000.00" }, total: "0.00" },
      { entry: { ...base, regularPay: "10.00", overtimePay: "0.00", incentivePay: "0.00", grossPay: "10.00", lateDeductionTotal: "0.10", undertimeDeductionTotal: "0.20", cashAdvanceDeduction: "0.30", netPay: "9.40" }, total: "0.60" },
      { entry: { ...base, regularPay: "100.00", overtimePay: "0.00", incentivePay: "0.00", grossPay: "100.00", lateDeductionTotal: "20.00", undertimeDeductionTotal: "30.00", cashAdvanceDeduction: "100.00", netPay: "0.00" }, total: "150.00" },
    ];
    const fmt = (value) => `₱${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    for (const { entry, total } of cases) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
      const original = JSON.stringify(entry);
      client.setQueryData(getGetMyPayrollHistoryQueryKey(), [{
        entry, period: { startDate: "2026-11-01", endDate: "2026-11-15", status: "paid" },
      }]);
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Page)));
      const expected = [
        ["Regular pay", entry.regularPay], ["Overtime", entry.overtimePay],
        ["Incentive", entry.incentivePay ?? "0"], ["Gross pay", entry.grossPay],
        ["Late", entry.lateDeductionTotal], ["Undertime", entry.undertimeDeductionTotal],
        ["Cash advances", entry.cashAdvanceDeduction],
      ];
      for (const [label, amount] of expected) {
        assert.equal(html.split(`>${label}</dt><dd`).length - 1, 2, `${label} appears on both layouts`);
        assert.ok(html.includes(`>${fmt(amount)}</dd>`), `${label} uses recorded amount`);
      }
      assert.equal(html.split(`Total deductions</dt><dd>₱${total}</dd>`).length - 1, 2);
      for (const id of ["text-mobile-net-pay-sample", "text-net-pay-sample"]) {
        assert.ok(html.includes(`data-testid="${id}">${fmt(entry.netPay)}`));
      }
      const deductions = [entry.lateDeductionTotal, entry.undertimeDeductionTotal, entry.cashAdvanceDeduction]
        .reduce((sum, value) => sum + Math.round(Number(value) * 100), 0);
      assert.equal(Math.round((Number(entry.regularPay) + Number(entry.overtimePay) + Number(entry.incentivePay ?? 0)) * 100), Math.round(Number(entry.grossPay) * 100));
      assert.equal(Math.max(0, Math.round(Number(entry.grossPay) * 100) - deductions), Math.round(Number(entry.netPay) * 100));
      assert.ok(html.includes("md:hidden") && html.includes("hidden md:block"));
      assert.equal(JSON.stringify(entry), original, "display does not mutate the record");
      client.clear();
    }
  } finally {
    await server.close();
  }
});
