import PDFDocument from "pdfkit";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN - 28;

const COLORS = {
  navy: "#17365D",
  blue: "#2563EB",
  lightBlue: "#EAF2FF",
  lighterBlue: "#F5F9FF",
  border: "#CBD5E1",
  text: "#172033",
  muted: "#64748B",
  white: "#FFFFFF",
  green: "#15803D",
  greenBg: "#DCFCE7",
  red: "#B91C1C",
  redBg: "#FEE2E2",
  amber: "#B45309",
  amberBg: "#FEF3C7",
  grayBg: "#F8FAFC",
};

const money = (value) => `UGX ${Number(value || 0).toLocaleString("en-UG")}`;
const text = (value, fallback = "—") => String(value ?? "").trim() || fallback;

function resetCursor(doc) {
  doc.x = MARGIN;
}

function addPage(doc) {
  doc.addPage();
  resetCursor(doc);
}

function ensureSpace(doc, height = 35) {
  if (doc.y + height > CONTENT_BOTTOM) addPage(doc);
}

function addSectionTitle(doc, title) {
  ensureSpace(doc, 32);
  resetCursor(doc);
  const y = doc.y + 3;
  doc.save();
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 20, 3).fill(COLORS.navy);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.white).text(title.toUpperCase(), MARGIN + 8, y + 5, {
    width: CONTENT_WIDTH - 16,
    lineBreak: false,
  });
  doc.fillColor(COLORS.text);
  doc.y = y + 27;
  resetCursor(doc);
}

function addKeyValue(doc, label, value, options = {}) {
  ensureSpace(doc, 18);
  const y = doc.y;
  if (options.highlight) {
    doc.save();
    doc.rect(MARGIN, y - 2, CONTENT_WIDTH, 17).fill(options.highlight);
    doc.restore();
  }
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.text).text(label, MARGIN + 7, y, {
    width: 300,
    lineBreak: false,
  });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(options.valueColor || COLORS.text).text(String(value), MARGIN + 300, y, {
    width: CONTENT_WIDTH - 307,
    align: "right",
    lineBreak: false,
  });
  doc.y = y + 16;
  resetCursor(doc);
}

function statusColors(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "BALANCED" || normalized === "EXCESS") return { text: COLORS.green, bg: COLORS.greenBg };
  if (normalized === "SHORT") return { text: COLORS.red, bg: COLORS.redBg };
  if (normalized === "INCOMPLETE") return { text: COLORS.amber, bg: COLORS.amberBg };
  return { text: COLORS.blue, bg: COLORS.lightBlue };
}

function addTable(doc, headers, rows, widths, options = {}) {
  const x = MARGIN;
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const rowHeight = options.rowHeight || 20;
  let y = doc.y;

  const drawRow = (cells, header = false) => {
    const rowStatus = options.statusIndex !== undefined && !header ? statusColors(cells[options.statusIndex]) : null;
    const fill = header ? COLORS.navy : rowStatus?.bg || (options.striped && options.rowIndex % 2 === 1 ? COLORS.lighterBlue : COLORS.white);

    doc.save();
    doc.rect(x, y, totalWidth, rowHeight).fill(fill);
    doc.restore();

    if (header) doc.font("Helvetica-Bold").fontSize(options.headerSize || 7.5).fillColor(COLORS.white);
    else doc.font("Helvetica").fontSize(options.fontSize || 7.5).fillColor(COLORS.text);

    let cx = x;
    cells.forEach((cell, index) => {
      const isStatus = options.statusIndex === index && !header;
      const color = isStatus ? rowStatus.text : header ? COLORS.white : COLORS.text;
      doc.fillColor(color).text(text(cell), cx + 4, y + 6, {
        width: widths[index] - 8,
        height: rowHeight - 7,
        ellipsis: true,
        lineBreak: false,
        align: options.alignments?.[index] || "left",
      });
      cx += widths[index];
    });

    doc.save();
    doc.strokeColor(COLORS.border).lineWidth(0.5).rect(x, y, totalWidth, rowHeight).stroke();
    doc.restore();
    y += rowHeight;
    if (!header && options.rowIndex !== undefined) options.rowIndex += 1;
  };

  const drawHeader = () => {
    if (y + rowHeight > CONTENT_BOTTOM) {
      addPage(doc);
      y = doc.y;
    }
    drawRow(headers, true);
  };

  options.rowIndex = 0;
  drawHeader();

  for (const row of rows) {
    if (y + rowHeight > CONTENT_BOTTOM) {
      addPage(doc);
      y = doc.y;
      drawHeader();
    }
    drawRow(row);
  }

  doc.y = y + 7;
  resetCursor(doc);
}

function addWrappedText(doc, value) {
  ensureSpace(doc, 24);
  resetCursor(doc);
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.text).text(text(value), MARGIN + 5, doc.y, {
    width: CONTENT_WIDTH - 10,
    lineGap: 2,
  });
  doc.moveDown(0.25);
  resetCursor(doc);
}

function addAttentionList(doc, items) {
  ensureSpace(doc, 20);
  resetCursor(doc);
  if (!items.length) items = ["No outstanding balancing exceptions for the selected date."];
  items.forEach((item) => {
    ensureSpace(doc, 16);
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.text).text(`• ${item}`, MARGIN + 7, doc.y, {
      width: CONTENT_WIDTH - 14,
      lineGap: 1,
    });
    doc.moveDown(0.1);
  });
  resetCursor(doc);
}

function addPageFooter(doc, pageNumber, pageCount) {
  const currentY = doc.y;
  const originalBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font("Helvetica").fontSize(7).fillColor(COLORS.muted);
  doc.text("Generated by AirtelComm-Bal-System", MARGIN, PAGE_HEIGHT - 25, {
    width: 300,
    lineBreak: false,
  });
  doc.text(`Page ${pageNumber} of ${pageCount}`, PAGE_WIDTH - MARGIN - 100, PAGE_HEIGHT - 25, {
    width: 100,
    align: "right",
    lineBreak: false,
  });
  doc.page.margins.bottom = originalBottom;
  doc.fillColor(COLORS.text);
  doc.y = currentY;
  resetCursor(doc);
}

export function createGeneralShopStatusPdf(report) {
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `General Shop Status - ${text(report.branch?.name)} - ${text(report.businessDate)}`,
      Author: "AirtelComm-Bal-System",
    },
  });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  resetCursor(doc);
  doc.save();
  doc.rect(0, 0, PAGE_WIDTH, 92).fill(COLORS.navy);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(15).fillColor(COLORS.white).text("AIRTEL COMMUNICATIONS", MARGIN, 22, {
    width: CONTENT_WIDTH,
    align: "center",
    lineBreak: false,
  });
  doc.fontSize(12).text("BRANCH PERFORMANCE STATUS", MARGIN, 43, {
    width: CONTENT_WIDTH,
    align: "center",
    lineBreak: false,
  });
  doc.font("Helvetica").fontSize(9).fillColor("#DCE9FF").text("Daily operating, balancing and recovery statement", MARGIN, 64, {
    width: CONTENT_WIDTH,
    align: "center",
    lineBreak: false,
  });
  doc.fillColor(COLORS.text);
  doc.y = 105;
  resetCursor(doc);

  const headerStatus = statusColors(report.totals?.status);
  addKeyValue(doc, "Branch", text(report.branch?.name));
  addKeyValue(doc, "Business Date", text(report.businessDate));
  addKeyValue(doc, "Status", text(report.totals?.status), { valueColor: headerStatus.text });

  addSectionTitle(doc, "Branch Operating Position");
  addKeyValue(doc, "Total Float", money(report.totals?.totalFloat));
  addKeyValue(doc, "Total Cash", money(report.totals?.totalCash));
  addKeyValue(doc, "Branch Operating Capital", money(report.totals?.branchCapital ?? report.totals?.branchOperatingCapital));
  addKeyValue(doc, "Actual Branch Capital", money(Number(report.totals?.totalFloat || 0) + Number(report.totals?.totalCash || 0)));
  addKeyValue(doc, "Imbalance", money(report.totals?.difference), { valueColor: Number(report.totals?.difference || 0) < 0 ? COLORS.red : COLORS.green });

  addSectionTitle(doc, "Adjusted Position");
  addKeyValue(doc, "Capital Including Shortage Position", money(report.totals?.adjustedBranchCapital));
  addKeyValue(doc, "Adjusted Imbalance", money(report.totals?.adjustedDifference), { valueColor: Number(report.totals?.adjustedDifference || 0) < 0 ? COLORS.red : COLORS.green });

  addSectionTitle(doc, "Imbalance Remark");
  addWrappedText(doc, report.imbalanceRemark || report.reason || "No imbalance remark has been recorded.");

  addSectionTitle(doc, "Till Performance");
  const tillRows = (report.tills || []).map((item) => {
    const b = item.balance || {};
    return [item.till?.name, b.attendant_name, money(b.operating_capital), money(b.actual_till_capital), money(b.difference), b.status || "NOT BALANCED"];
  });
  addTable(doc, ["Till", "Attendant", "Operating", "Actual", "Difference", "Status"], tillRows, [82, 90, 82, 82, 82, 77], {
    alignments: ["left", "left", "right", "right", "right", "left"], statusIndex: 5, striped: true,
  });

  addSectionTitle(doc, "Daily Transaction Activity");
  const transactionRows = (report.dailyTransactions || []).map((item) => [item.terminal_name, Number(item.transactionCount || 0).toLocaleString("en-UG")]);
  addTable(doc, ["Terminal", "Transactions"], transactionRows, [360, 135], { alignments: ["left", "right"], striped: true });
  addKeyValue(doc, "Total Transactions", Number((report.dailyTransactions || []).reduce((sum, item) => sum + Number(item.transactionCount || 0), 0)).toLocaleString("en-UG"));

  addSectionTitle(doc, "Closing Float");
  const floatRows = (report.positions || []).map((position) => [position.terminal_name, money(position.amount)]);
  addTable(doc, ["Terminal", "Closing Float"], floatRows, [360, 135], { alignments: ["left", "right"], striped: true });
  addKeyValue(doc, "Total Float", money(report.totals?.totalFloat));

  addSectionTitle(doc, "Cash Book Position");
  addKeyValue(doc, "Opening Balance", money(report.cashBook?.openingBalance));
  addKeyValue(doc, "Today's Top Ups", money(report.cashBook?.dailyTopUps));
  addKeyValue(doc, "Today's Expenses", money(report.cashBook?.dailyExpenses));
  addKeyValue(doc, "Net Daily Movement", money(report.cashBook?.dailyNetMovement), { valueColor: Number(report.cashBook?.dailyNetMovement || 0) < 0 ? COLORS.red : COLORS.green });
  addKeyValue(doc, "Closing Balance", money(report.cashBook?.closingBalance));

  const expenseRows = (report.cashBook?.expenses || []).map((expense) => [expense.category || "Other", expense.description || "—", money(expense.amount)]);
  if (expenseRows.length) addTable(doc, ["Category", "Description", "Amount"], expenseRows, [135, 255, 105], { alignments: ["left", "left", "right"], striped: true });

  addSectionTitle(doc, "Accessories");
  addKeyValue(doc, "Accessories Activity / Sales", money(report.accessoriesCount));

  addSectionTitle(doc, "Shortage & Recovery");
  const shortageRows = (report.shortageCounter || []).map((item) => [item.name, item.tillName || "—", money(item.totalIncurred), money(item.recoveredToDate), money(item.balance), money(item.newShortage)]);
  addTable(doc, ["Employee", "Till", "Incurred", "Recovered", "Outstanding", "Today's Shortage"], shortageRows, [92, 78, 78, 78, 82, 87], {
    alignments: ["left", "left", "right", "right", "right", "right"], striped: true,
  });

  addSectionTitle(doc, "Management Attention");
  const attention = [];
  (report.tills || []).forEach((item) => {
    const tillStatus = String(item.balance?.status || "").toUpperCase();
    if (tillStatus === "SHORT") attention.push(`${item.till?.name || "Till"} — shortage requires attention.`);
    if (tillStatus === "EXCESS") attention.push(`${item.till?.name || "Till"} — excess recorded.`);
  });
  (report.shortageCounter || []).forEach((item) => {
    if (Number(item.balance || 0) > 0) attention.push(`${item.name} — outstanding shortage of ${money(item.balance)}.`);
  });
  addAttentionList(doc, attention);

  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i += 1) {
    doc.switchToPage(pageRange.start + i);
    addPageFooter(doc, i + 1, pageRange.count);
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
