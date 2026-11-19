import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

test("incentive history displays snapshots and distinguishes unavailable, empty and failed history", async () => {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const server = await createServer({
    configFile: false, root, server: { middlewareMode: true }, appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] }, esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": `${root}src` } },
  });
  try {
    const { IncentiveHistory } = await server.ssrLoadModule("/src/components/payroll/IncentiveHistory.tsx");
    const { getListPayrollIncentiveChangesQueryKey } = await server.ssrLoadModule("@workspace/api-client-react");
    const key = getListPayrollIncentiveChangesQueryKey("period-a", "employee-a");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const render = () => renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(IncentiveHistory, { periodId: "period-a", employeeId: "employee-a" })));
    assert.match(render(), /Loading history/);
    client.setQueryData(key, []);
    assert.match(render(), /No incentive changes recorded/);
    assert.match(render(), /Changes made before history was introduced are not available/);
    const change = {
      id: 2, payrollPeriodId: "period-a", employeeId: "employee-a",
      previousWeeklyAmount: "800.00", previousWeeks: 2, previousNote: "Previous note",
      newWeeklyAmount: "900.00", newWeeks: 3, newNote: "<script>unsafe</script>",
      editedBy: "editor-a", editedByName: "Original admin name", createdAt: "2026-11-15T01:00:00Z",
    };
    client.setQueryData(key, [change]);
    // Another employee's cached changes must never appear in this view.
    client.setQueryData(getListPayrollIncentiveChangesQueryKey("period-a", "employee-b"), [{ ...change, editedByName: "Other employee editor" }]);
    let html = render();
    for (const text of ["₱800.00 per week × 2 week(s)", "₱900.00 per week × 3 week(s)", "Previous note", "Original admin name", "editor-a", "PHT"]) assert.ok(html.includes(text), text);
    assert.ok(!html.includes("Other employee editor"));
    assert.ok(!html.includes("<script>"));
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
    client.setQueryData(key, [{ ...change, previousWeeklyAmount: null, previousWeeks: null, previousNote: null }]);
    assert.match(render(), /No incentive recorded/);
    client.getQueryCache().find({ queryKey: key }).setState({ status: "error", error: new Error("Unavailable") });
    html = render();
    assert.match(html, /Unable to load incentive history/);
    assert.match(html, /Retry history/);
    assert.ok(!html.includes("No incentive changes recorded"));
    client.clear();
  } finally {
    await server.close();
  }
});
