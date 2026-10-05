import { loadGeneralShopStatus } from "./generalShopStatusController.js";
import { createGeneralShopStatusPdf } from "../services/gssReportPdf.js";
import { sendEmailWithAttachment } from "../services/emailService.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error("Business date must use YYYY-MM-DD format.");
    error.statusCode = 400;
    throw error;
  }
  return date;
}

function parseRecipients(value, label, required = false) {
  const raw = String(value || "").trim();
  if (!raw && !required) return [];
  const recipients = raw.split(/[;,\s]+/).map((item) => item.trim()).filter(Boolean);
  if (required && !recipients.length) {
    const error = new Error(`${label} is required.`);
    error.statusCode = 400;
    throw error;
  }
  if (recipients.some((email) => !EMAIL_RE.test(email))) {
    const error = new Error(`One or more ${label.toLowerCase()} addresses are invalid.`);
    error.statusCode = 400;
    throw error;
  }
  return recipients;
}

export async function emailGeneralShopStatus(req, res, next) {
  try {
    const branchId = Number(req.body.branchId);
    if (!Number.isInteger(branchId) || branchId <= 0) {
      const error = new Error("Branch ID must be a valid ID.");
      error.statusCode = 400;
      throw error;
    }
    const businessDate = validDate(req.body.businessDate);
    const to = parseRecipients(req.body.to, "To", true);
    const cc = parseRecipients(req.body.cc, "CC");
    const subject = String(req.body.subject || "").trim();
    const message = String(req.body.message || "").trim();
    if (!subject || subject.length > 180) {
      const error = new Error("Subject is required and must not exceed 180 characters.");
      error.statusCode = 400;
      throw error;
    }
    if (message.length > 5000) {
      const error = new Error("Message must not exceed 5,000 characters.");
      error.statusCode = 400;
      throw error;
    }

    const report = await loadGeneralShopStatus(branchId, businessDate);
    const pdf = await createGeneralShopStatusPdf(report);
    const branchName = report.branch?.name || "Branch";
    const filename = `General-Shop-Status-${branchName.replace(/[^a-z0-9]+/gi, "-")}-${businessDate}.pdf`;

    await sendEmailWithAttachment({
      to,
      cc,
      subject,
      text: message || `Please find attached the General Shop Status report for ${branchName} for ${businessDate}.`,
      attachment: { filename, content: pdf, contentType: "application/pdf" }
    });

    res.json({ message: "General Shop Status report emailed successfully." });
  } catch (error) {
    next(error);
  }
}

export async function generateGeneralShopStatusPdf(req, res, next) {
  try {
    const branchId = Number(req.query.branchId);
    if (!Number.isInteger(branchId) || branchId <= 0) {
      const error = new Error("Branch ID must be a valid ID.");
      error.statusCode = 400;
      throw error;
    }

    const businessDate = validDate(req.query.businessDate);
    const report = await loadGeneralShopStatus(branchId, businessDate);
    const pdf = await createGeneralShopStatusPdf(report);
    const branchName = report.branch?.name || "Branch";
    const filename = `General-Shop-Status-${branchName.replace(/[^a-z0-9]+/gi, "-")}-${businessDate}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(pdf);
  } catch (error) {
    next(error);
  }
}
