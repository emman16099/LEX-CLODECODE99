import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://payroll-tests.invalid/payroll";
const { incentiveTotal, totalsWithIncentive } = await import("./payroll-incentives");

test("800 per week for two weeks produces 7076 net after 2500 advance and 24 late", () => {
  const incentive = incentiveTotal("800.00", 2);
  assert.equal(incentive, 1600);
  assert.deepEqual(totalsWithIncentive({
    regularPay: "8000.00", overtimePay: "0.00", lateDeductionTotal: "24.00",
    undertimeDeductionTotal: "0.00", cashAdvanceDeduction: "2500.00",
  }, incentive), { grossPay: "9600.00", netPay: "7076.00" });
});

test("incentive totals use cents and allow removing the incentive", () => {
  assert.equal(incentiveTotal("800.55", 3), 2401.65);
  assert.equal(incentiveTotal("0", 1), 0);
});

test("invalid incentive amounts and week counts cannot reach payroll totals", () => {
  for (const amount of ["-800", "", "NaN", "Infinity", "8.005", "1e3", "10000000"]) {
    assert.throws(() => incentiveTotal(amount, 2));
  }
  for (const weeks of [0, -1, 1.5, 54, NaN]) assert.throws(() => incentiveTotal("800", weeks));
  assert.throws(() => incentiveTotal("9999999", 53));
});

test("removing an incentive recomputes from source pay rather than subtracting from capped net", () => {
  const entry = { regularPay: "800", overtimePay: "0", lateDeductionTotal: "24", undertimeDeductionTotal: "0", cashAdvanceDeduction: "2500" };
  assert.equal(totalsWithIncentive(entry, 2000).netPay, "276.00");
  assert.equal(totalsWithIncentive(entry, 0).netPay, "0.00");
});
