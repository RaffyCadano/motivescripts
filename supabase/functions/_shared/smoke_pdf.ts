import { generateInvoicePdf, invoicePdfFilename } from "./invoicePdf.ts";
import { generateProposalPdf, proposalPdfFilename } from "./proposalPdf.ts";
import { generateContractPdf, contractPdfFilename } from "./contractPdf.ts";

function assertPdf(bytes: Uint8Array, label: string) {
  const head = new TextDecoder().decode(bytes.subarray(0, 4));
  if (head !== "%PDF") throw new Error(`${label}: expected %PDF, got ${head}`);
  if (bytes.length < 1000) throw new Error(`${label}: pdf too small (${bytes.length})`);
}

const invoiceName = "MotiveScripts-Invoice-MS-INV-2026-001.pdf";
if (invoicePdfFilename("MS-INV-2026-001") !== invoiceName) {
  throw new Error(`invoice filename mismatch: ${invoicePdfFilename("MS-INV-2026-001")}`);
}
if (proposalPdfFilename("MS-2026-001") !== "MotiveScripts-Proposal-MS-2026-001.pdf") {
  throw new Error(`proposal filename mismatch: ${proposalPdfFilename("MS-2026-001")}`);
}
if (contractPdfFilename("MS-CON-2026-001") !== "MotiveScripts-Contract-MS-CON-2026-001.pdf") {
  throw new Error(`contract filename mismatch: ${contractPdfFilename("MS-CON-2026-001")}`);
}
if (
  proposalPdfFilename("MS-2026-001/../../x").includes("/") ||
  contractPdfFilename("a@b.com").includes("@") ||
  invoicePdfFilename("a@b.com").includes("@")
) {
  throw new Error("filename not sanitized");
}

const invoiceBytes = await generateInvoicePdf({
  number: "MS-INV-2026-001",
  statusLabel: "Partially Paid",
  issueDate: "2026-08-01",
  dueDate: "2026-08-15",
  currency: "USD",
  billToName: "Jane Contact",
  billToCompany: "Example Company",
  billToEmail: "jane@example.com",
  billToPhone: "555-0100",
  projectName: "Marketing Website",
  notes: "Net 15.",
  items: [
    { description: "Website Design", quantity: 1, unit_price_cents: 120000, total_cents: 120000 },
    { description: "Development", quantity: 1, unit_price_cents: 180000, total_cents: 180000 },
  ],
  subtotal_cents: 300000,
  tax_cents: 15000,
  discount_cents: 10000,
  total_cents: 305000,
  amount_paid_cents: 50000,
  amount_due_cents: 255000,
  payments: [
    {
      date: "2026-08-05",
      methodLabel: "Stripe",
      statusLabel: "Received",
      amount_cents: 50000,
      reference: "Online payment",
    },
  ],
  agencyName: "MotiveScripts",
  agencyEmail: "support@motivescripts.com",
});
assertPdf(invoiceBytes, "invoice");

const longOverview =
  "This proposal covers discovery, information architecture, visual design, and a marketing website build. ".repeat(12);
const manyItems = Array.from({ length: 18 }, (_, index) => ({
  name: `Work package ${index + 1}`,
  description: index % 3 === 0 ? "Includes research notes, drafts, and one revision round." : "",
  quantity: index % 4 === 0 ? 2 : 1,
  unit_price_cents: 25000 + index * 1500,
  total_cents: (index % 4 === 0 ? 2 : 1) * (25000 + index * 1500),
}));
const itemSum = manyItems.reduce((sum, item) => sum + item.total_cents, 0);

const proposalStatuses = ["Draft", "Sent", "Viewed", "Accepted", "Declined", "Expired"] as const;
for (const statusLabel of proposalStatuses) {
  const bytes = await generateProposalPdf({
    number: "MS-2026-001",
    title: "Example website proposal",
    statusLabel,
    revisionNumber: statusLabel === "Draft" ? 1 : 2,
    issueDate: "2026-08-01",
    validUntil: statusLabel === "Expired" ? "2026-08-10" : "2026-09-15",
    companyName: "Example Company",
    contactName: "Jane Contact",
    email: "jane@example.com",
    phone: "555-0100",
    projectName: statusLabel === "Draft" ? null : "Marketing Website",
    introduction: longOverview,
    overview: "A calm, conversion-focused marketing site with a project intake form.",
    scope: "Design and front-end implementation for five core pages plus a blog index.",
    deliverables: "Figma file, production build, CMS training notes.",
    timeline: "Six weeks after kickoff.",
    paymentTerms: "Fifty percent to start, remainder on launch.",
    terms: "This proposal is a workflow document in the MotiveScripts portal.",
    notes: statusLabel === "Draft" ? "" : "Kickoff scheduled after acceptance — we’ll send a calendar invite.",
    items: manyItems,
    subtotal_cents: itemSum,
    investment_cents: itemSum,
    acceptedAt: statusLabel === "Accepted" ? "2026-08-20T15:04:00Z" : null,
    acceptedEmail: statusLabel === "Accepted" ? "jane@example.com" : null,
    agencyEmail: "support@motivescripts.com",
  });
  assertPdf(bytes, `proposal ${statusLabel}`);
}

const sparseProposal = await generateProposalPdf({
  number: "MS-2026-002",
  title: "Sparse proposal",
  statusLabel: "Sent",
  revisionNumber: 1,
  issueDate: "2026-08-02",
  validUntil: null,
  companyName: "Solo Client",
  contactName: "",
  email: "",
  phone: "",
  projectName: null,
  introduction: "",
  overview: "",
  scope: "",
  deliverables: "",
  timeline: "",
  paymentTerms: "",
  terms: "",
  notes: "",
  items: [],
  subtotal_cents: 0,
  investment_cents: 0,
  acceptedAt: null,
  acceptedEmail: null,
  agencyEmail: "support@motivescripts.com",
});
assertPdf(sparseProposal, "sparse proposal");

const longClause = "The client will provide timely feedback, brand assets, and written approvals. ".repeat(40);
const contractStatuses = ["Draft", "Sent", "Viewed", "Accepted", "Declined", "Expired"] as const;
for (const statusLabel of contractStatuses) {
  const bytes = await generateContractPdf({
    number: "MS-CON-2026-001",
    title: "Example website agreement",
    statusLabel,
    revisionNumber: 1,
    issueDate: "2026-08-21",
    effectiveDate: statusLabel === "Draft" ? null : "2026-08-22",
    expiresAt: statusLabel === "Expired" ? "2026-08-01" : "2026-12-31",
    companyName: "Example Company",
    contactName: "Jane Contact",
    email: "jane@example.com",
    phone: "555-0100",
    projectName: "Marketing Website",
    proposalNumber: "MS-2026-001",
    parties: "MotiveScripts and Example Company.",
    scope: longClause,
    responsibilities: longClause,
    timeline: "Work begins after acceptance and an agreed kickoff date.",
    compensation: "Fixed fee matching the accepted proposal investment.",
    paymentTerms: "Invoices are issued separately and are not created by this agreement.",
    confidentiality: "Each party will keep non-public project materials confidential.",
    intellectualProperty: "Deliverables transfer as described in this section after paid invoices.",
    revisionsPolicy: "Two rounds of revisions are included for the agreed scope.",
    termination: "Either party may end the agreement in writing as described here.",
    generalTerms: longClause,
    acceptedAt: statusLabel === "Accepted" ? "2026-08-22T18:30:00Z" : null,
    acceptedEmail: statusLabel === "Accepted" ? "jane@example.com" : null,
    agencySignedAt: statusLabel === "Draft" ? null : "2026-08-21T14:00:00Z",
    agencySignedName: statusLabel === "Draft" ? null : "Alex Rivera",
    agencySignedEmail: statusLabel === "Draft" ? null : "alex@motivescripts.com",
    agencyEmail: "support@motivescripts.com",
  });
  assertPdf(bytes, `contract ${statusLabel}`);
}

const sparseContract = await generateContractPdf({
  number: "MS-CON-2026-002",
  title: "",
  statusLabel: "Sent",
  revisionNumber: 1,
  issueDate: "2026-08-22",
  effectiveDate: null,
  expiresAt: null,
  companyName: "Solo Client",
  contactName: "",
  email: "",
  phone: "",
  projectName: null,
  proposalNumber: null,
  parties: "",
  scope: "Minimal scope.",
  responsibilities: "",
  timeline: "",
  compensation: "",
  paymentTerms: "",
  confidentiality: "",
  intellectualProperty: "",
  revisionsPolicy: "",
  termination: "",
  generalTerms: "",
  acceptedAt: null,
  acceptedEmail: null,
  agencySignedAt: "2026-08-21T14:00:00Z",
  agencySignedName: "Alex Rivera",
  agencySignedEmail: "alex@motivescripts.com",
  agencyEmail: "support@motivescripts.com",
});
assertPdf(sparseContract, "sparse contract");

console.log("ok", {
  invoiceBytes: invoiceBytes.length,
  proposalFilename: proposalPdfFilename("MS-2026-001"),
  contractFilename: contractPdfFilename("MS-CON-2026-001"),
});
