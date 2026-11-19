import type { PayslipInput } from "./downloadPayslipPng";
import { renderPayslipCanvas } from "./downloadPayslipPng";

export type PayslipAttendanceRecord = {
  log: {
    employeeId: string;
    date: string;
    clockInAt?: string | null;
    clockOutAt?: string | null;
  };
  summary?: {
    status?: string | null;
    regularHours?: string | null;
    lateMinutes?: number | null;
    undertimeMinutes?: number | null;
    lateDeductionAmount?: string | null;
    undertimeDeductionAmount?: string | null;
  } | null;
  overtimeHours?: string | null;
  applicableDailyRate?: string | null;
};

type PayslipPdfInput = PayslipInput & {
  attendance: PayslipAttendanceRecord[];
};

const WIDTH = 1200;
const HEIGHT = 1540;
const NAVY = "#142d5c";
const GOLD = "#f5a916";
const INK = "#162033";
const MUTED = "#667085";
const ROWS_PER_PAGE = 16;

function dateRange(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const final = new Date(`${end}T00:00:00Z`);
  for (; cursor <= final; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push(cursor.toISOString().slice(0, 10));
  }
  return days;
}

function clock(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function amount(value: string | null | undefined): string {
  return `₱${Number(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function drawLedgerPage(
  input: PayslipPdfInput,
  dates: string[],
  records: Map<string, PayslipAttendanceRecord>,
  page: number,
  pageCount: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PDF generation is not supported in this browser");

  ctx.fillStyle = "#f4f6fa";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(60, 60, 1080, 1420);
  ctx.fillStyle = NAVY;
  ctx.fillRect(60, 60, 1080, 190);
  ctx.fillStyle = GOLD;
  ctx.fillRect(60, 250, 1080, 12);
  ctx.fillRect(105, 105, 64, 64);
  ctx.fillStyle = NAVY;
  ctx.font = "900 27px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LB", 137, 147);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 38px Arial, sans-serif";
  ctx.fillText("LEXIEBOSS", 195, 132);
  ctx.fillStyle = "#c9d3e6";
  ctx.font = "600 22px Arial, sans-serif";
  ctx.fillText("LEXIE WOOD ENTERPRISES", 195, 169);
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 29px Arial, sans-serif";
  ctx.fillText("ATTENDANCE", 1095, 135);
  ctx.fillStyle = "#c9d3e6";
  ctx.font = "600 21px Arial, sans-serif";
  ctx.fillText(input.period.status.toUpperCase(), 1095, 170);
  ctx.textAlign = "left";

  ctx.fillStyle = NAVY;
  ctx.font = "800 34px Arial, sans-serif";
  ctx.fillText("OFFICIAL ATTENDANCE LEDGER", 105, 330);
  ctx.fillStyle = INK;
  ctx.font = "700 26px Arial, sans-serif";
  ctx.fillText(`${input.employee.firstName} ${input.employee.lastName}`, 105, 377);
  ctx.fillStyle = MUTED;
  ctx.font = "600 21px Arial, sans-serif";
  ctx.fillText(`${input.employee.employeeCode}   |   ${input.period.startDate} to ${input.period.endDate}`, 105, 414);

  const columns = [
    { label: "DATE", x: 117 },
    { label: "STATUS", x: 237 },
    { label: "IN", x: 355 },
    { label: "OUT", x: 453 },
    { label: "REG.", x: 551 },
    { label: "LATE", x: 637 },
    { label: "UNDERTIME", x: 757 },
    { label: "OT", x: 877 },
    { label: "DAILY RATE", x: 952 },
  ];
  ctx.fillStyle = NAVY;
  ctx.fillRect(105, 450, 990, 50);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 17px Arial, sans-serif";
  columns.forEach(({ label, x }) => ctx.fillText(label, x, 482));

  dates.forEach((date, index) => {
    const y = 500 + index * 56;
    ctx.fillStyle = index % 2 === 0 ? "#f6f8fc" : "#ffffff";
    ctx.fillRect(105, y, 990, 56);
    const record = records.get(date);
    const summary = record?.summary;
    const dateObj = new Date(`${date}T00:00:00Z`);
    ctx.font = "700 18px Arial, sans-serif";
    ctx.fillStyle = INK;
    ctx.fillText(dateObj.toLocaleDateString("en-PH", { timeZone: "UTC", month: "short", day: "numeric" }), 117, y + 25);
    ctx.font = "16px Arial, sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText(dateObj.toLocaleDateString("en-PH", { timeZone: "UTC", weekday: "short" }), 117, y + 45);
    ctx.font = "600 17px Arial, sans-serif";
    ctx.fillStyle = summary?.status === "late" ? "#975a09" : summary?.status === "present" ? "#167444" : INK;
    ctx.fillText((summary?.status ?? (record ? "Unconfirmed" : "No record")).replaceAll("_", " "), 237, y + 35, 113);
    ctx.fillStyle = INK;
    ctx.fillText(clock(record?.log.clockInAt ?? null), 355, y + 35, 95);
    ctx.fillText(clock(record?.log.clockOutAt ?? null), 453, y + 35, 95);
    ctx.fillText(summary?.regularHours ? `${summary.regularHours}h` : "—", 551, y + 35, 82);
    ctx.fillText(summary?.lateMinutes ? `${summary.lateMinutes}m` : "—", 637, y + 24);
    if (summary?.lateMinutes) {
      ctx.font = "15px Arial, sans-serif";
      ctx.fillStyle = MUTED;
      ctx.fillText(amount(summary.lateDeductionAmount), 637, y + 45, 114);
    }
    ctx.font = "600 17px Arial, sans-serif";
    ctx.fillStyle = INK;
    ctx.fillText(summary?.undertimeMinutes ? `${summary.undertimeMinutes}m` : "—", 757, y + 24);
    if (summary?.undertimeMinutes) {
      ctx.font = "15px Arial, sans-serif";
      ctx.fillStyle = MUTED;
      ctx.fillText(amount(summary.undertimeDeductionAmount), 757, y + 45, 114);
    }
    ctx.font = "600 17px Arial, sans-serif";
    ctx.fillStyle = INK;
    ctx.fillText(record?.overtimeHours && Number(record.overtimeHours) > 0 ? `${record.overtimeHours}h` : "—", 877, y + 35, 72);
    ctx.fillText(record?.applicableDailyRate ? amount(record.applicableDailyRate) : "—", 952, y + 35, 135);
  });

  ctx.fillStyle = MUTED;
  ctx.font = "18px Arial, sans-serif";
  ctx.fillText("Times shown in Philippine time (PHT). Dashes indicate no recorded value.", 105, 1432);
  ctx.textAlign = "right";
  ctx.fillText(`Page ${page} of ${pageCount}`, 1095, 1432);
  return canvas;
}

export async function downloadPayslipPdf(input: PayslipPdfInput): Promise<void> {
  if (!input.attendance) throw new Error("Attendance records are not available yet");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [600, 770], compress: true });
  pdf.addImage(renderPayslipCanvas(input).toDataURL("image/jpeg", 0.88), "JPEG", 0, 0, 600, 770);
  const dates = dateRange(input.period.startDate, input.period.endDate);
  const records = new Map(input.attendance
    .filter((record) => record.log.employeeId === input.entry.employeeId)
    .map((record) => [record.log.date, record]));
  const chunks = Math.max(1, Math.ceil(dates.length / ROWS_PER_PAGE));
  for (let i = 0; i < chunks; i++) {
    pdf.addPage([600, 770], "portrait");
    const ledger = drawLedgerPage(
      input,
      dates.slice(i * ROWS_PER_PAGE, (i + 1) * ROWS_PER_PAGE),
      records,
      i + 2,
      chunks + 1,
    );
    pdf.addImage(ledger.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 600, 770);
  }
  const safeName = `${input.employee.firstName} ${input.employee.lastName}`
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  pdf.save(`payslip-${safeName}-${input.period.startDate}-${input.period.endDate}.pdf`);
}