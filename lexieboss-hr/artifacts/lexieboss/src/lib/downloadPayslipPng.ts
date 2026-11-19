type PayslipEmployee = {
  firstName: string;
  lastName: string;
  employeeCode: string;
};

type PayslipPeriod = {
  startDate: string;
  endDate: string;
  status: string;
};

type PayslipEntry = {
  employeeId: string;
  dailyRateSnapshot: string;
  daysPresent: number;
  daysAbsent: number;
  lateCount: number;
  totalLateMinutes: number;
  undertimeCount: number;
  totalUndertimeMinutes: number;
  regularPay: string;
  overtimePay?: string | null;
  incentivePay?: string | null;
  lateDeductionTotal: string;
  undertimeDeductionTotal?: string | null;
  cashAdvanceDeduction?: string | null;
  grossPay: string;
  netPay: string;
};

export type PayslipInput = {
  employee: PayslipEmployee;
  period: PayslipPeriod;
  entry: PayslipEntry;
};

const WIDTH = 1200;
const HEIGHT = 1540;
const NAVY = "#142d5c";
const GOLD = "#f5a916";
const INK = "#162033";
const MUTED = "#667085";
const LINE = "#d8dee9";

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return `PHP ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function drawLabelValue(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  context.fillStyle = MUTED;
  context.font = "600 25px Arial, sans-serif";
  context.fillText(label.toUpperCase(), x, y);
  context.fillStyle = INK;
  context.font = "700 34px Arial, sans-serif";
  context.textAlign = "right";
  context.fillText(value, x + width, y);
  context.textAlign = "left";
}

export function renderPayslipCanvas({ employee, period, entry }: PayslipInput): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PNG generation is not supported in this browser");

  context.fillStyle = "#f4f6fa";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = "#ffffff";
  context.fillRect(60, 60, WIDTH - 120, HEIGHT - 120);
  context.fillStyle = NAVY;
  context.fillRect(60, 60, WIDTH - 120, 190);
  context.fillStyle = GOLD;
  context.fillRect(60, 250, WIDTH - 120, 12);

  context.fillStyle = GOLD;
  context.fillRect(105, 105, 64, 64);
  context.fillStyle = NAVY;
  context.font = "900 27px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("LB", 137, 147);
  context.textAlign = "left";

  context.fillStyle = "#ffffff";
  context.font = "800 38px Arial, sans-serif";
  context.fillText("LEXIEBOSS", 195, 132);
  context.fillStyle = "#c9d3e6";
  context.font = "600 22px Arial, sans-serif";
  context.fillText("LEXIE WOOD ENTERPRISES", 195, 169);
  context.textAlign = "right";
  context.fillStyle = "#ffffff";
  context.font = "800 34px Arial, sans-serif";
  context.fillText("PAYSLIP", WIDTH - 105, 135);
  context.fillStyle = "#c9d3e6";
  context.font = "600 21px Arial, sans-serif";
  context.fillText(period.status.toUpperCase(), WIDTH - 105, 170);
  context.textAlign = "left";

  const employeeName = `${employee.firstName} ${employee.lastName}`;
  context.fillStyle = MUTED;
  context.font = "600 22px Arial, sans-serif";
  context.fillText("EMPLOYEE", 105, 330);
  context.fillStyle = INK;
  context.font = "800 42px Arial, sans-serif";
  context.fillText(employeeName, 105, 383);
  context.fillStyle = MUTED;
  context.font = "600 24px Arial, sans-serif";
  context.fillText(employee.employeeCode, 105, 422);

  context.textAlign = "right";
  context.font = "600 22px Arial, sans-serif";
  context.fillText("PAY PERIOD", WIDTH - 105, 330);
  context.fillStyle = INK;
  context.font = "700 29px Arial, sans-serif";
  context.fillText(`${period.startDate} to ${period.endDate}`, WIDTH - 105, 377);
  context.textAlign = "left";

  context.strokeStyle = LINE;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(105, 475);
  context.lineTo(WIDTH - 105, 475);
  context.stroke();

  context.fillStyle = NAVY;
  context.font = "800 27px Arial, sans-serif";
  context.fillText("ATTENDANCE SUMMARY", 105, 535);
  const attendance = [
    ["Daily Rate", money(entry.dailyRateSnapshot)],
    ["Days Present", String(entry.daysPresent)],
    ["Days Absent", String(entry.daysAbsent)],
    ["Late", `${entry.lateCount} time(s) / ${entry.totalLateMinutes} min`],
    ["Undertime", `${entry.undertimeCount} time(s) / ${entry.totalUndertimeMinutes} min`],
  ];
  attendance.forEach(([label, value], index) => {
    drawLabelValue(context, label, value, 125, 605 + index * 68, WIDTH - 250);
  });

  context.fillStyle = NAVY;
  context.font = "800 27px Arial, sans-serif";
  context.fillText("PAY BREAKDOWN", 105, 985);
  const breakdown = [
    ["Regular Pay", money(entry.regularPay)],
    ["Overtime Pay", money(entry.overtimePay)],
    ["Incentive", money(entry.incentivePay)],
    ["Late Deduction", `- ${money(entry.lateDeductionTotal)}`],
    ["Undertime Deduction", `- ${money(entry.undertimeDeductionTotal)}`],
    ["Cash Advance", `- ${money(entry.cashAdvanceDeduction)}`],
    ["Gross Pay", money(entry.grossPay)],
  ];
  breakdown.forEach(([label, value], index) => {
    drawLabelValue(context, label, value, 125, 1045 + index * 52, WIDTH - 250);
  });

  context.fillStyle = NAVY;
  context.fillRect(105, 1410, WIDTH - 210, 88);
  context.fillStyle = "#ffffff";
  context.font = "700 26px Arial, sans-serif";
  context.fillText("NET PAY", 140, 1465);
  context.textAlign = "right";
  context.font = "900 42px Arial, sans-serif";
  context.fillText(money(entry.netPay), WIDTH - 140, 1468);
  context.textAlign = "left";

  return canvas;
}

export async function downloadPayslipPng(input: PayslipInput) {
  const canvas = renderPayslipCanvas(input);
  const { employee, period } = input;
  const employeeName = `${employee.firstName} ${employee.lastName}`;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Unable to create payslip PNG"))),
      "image/png",
    );
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = employeeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  link.href = objectUrl;
  link.download = `payslip-${safeName}-${period.startDate}-${period.endDate}.png`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}