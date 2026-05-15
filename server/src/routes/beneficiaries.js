const express  = require("express");
const path     = require("path");
const multer   = require("multer");
const BeneficiaryApplication = require("../models/BeneficiaryApplication");
const { verifyJWT, requireRole } = require("../middleware/auth");
const { encryptField, decryptField } = require("../utils/encryption");
const { isDbConnected }   = require("../config/db");
const { memApplications } = require("../utils/memoryStore");

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../uploads"),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function findApp(query) {
  if (isDbConnected()) {
    return BeneficiaryApplication.findOne(query);
  }
  return memApplications.findOne(query);
}

async function findApps(query) {
  if (isDbConnected()) {
    return BeneficiaryApplication.find(query).sort({ createdAt: 1 });
  }
  return memApplications.find(query);
}

async function findAppsByWallet(walletAddress) {
  if (isDbConnected()) {
    return BeneficiaryApplication.find({ walletAddress: walletAddress.toLowerCase() }).sort({ createdAt: -1 });
  }
  return memApplications.find({ walletAddress });
}

function makeApp(data) {
  if (isDbConnected()) return new BeneficiaryApplication(data);
  return memApplications.newApplication(data);
}

function toPlain(app) {
  return typeof app.toObject === "function" ? app.toObject() : { ...app };
}

// POST /api/beneficiaries/apply
router.post("/apply", verifyJWT, upload.single("document"), async (req, res) => {
  try {
    const { reason, hardshipWaiverRequested } = req.body;
    const address = req.user.address;

    const application = makeApp({
      walletAddress:           address,
      encryptedReason:         encryptField(reason),
      documentPath:            req.file?.path ?? null,
      hardshipWaiverRequested: hardshipWaiverRequested === "true" || hardshipWaiverRequested === true,
    });

    await application.save();
    res.status(201).json({ success: true, applicationId: application._id });
  } catch (err) {
    console.error("[beneficiaries/apply]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/my-applications
router.get("/my-applications", verifyJWT, async (req, res) => {
  try {
    const applications = await findAppsByWallet(req.user.address);
    const result = applications.map((a) => {
      const doc = toPlain(a);
      doc.reason = decryptField(a.encryptedReason);
      delete doc.encryptedReason;
      return doc;
    });
    res.json(result);
  } catch (err) {
    console.error("[beneficiaries/my-applications]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/pending  (admin only)
router.get("/pending", verifyJWT, requireRole("admin"), async (req, res) => {
  try {
    const applications = await findApps({ status: "pending" });
    const result = applications.map((a) => {
      const doc = toPlain(a);
      doc.reason = decryptField(a.encryptedReason);
      delete doc.encryptedReason;
      return doc;
    });
    res.json(result);
  } catch (err) {
    console.error("[beneficiaries/pending]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/:walletAddress/review  (admin only)
router.post("/:walletAddress/review", verifyJWT, requireRole("admin"), async (req, res) => {
  try {
    const { decision, txHash } = req.body;
    const targetAddress = req.params.walletAddress.toLowerCase();

    if (!["approve", "reject"].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
    }

    const application = await findApp({ walletAddress: targetAddress, status: "pending" });
    if (!application) {
      return res.status(404).json({ error: "No pending application found for this address" });
    }

    application.status     = decision === "approve" ? "approved" : "rejected";
    application.reviewedBy = req.user.address;
    application.reviewedAt = new Date();
    if (txHash) application.onChainTxHash = txHash;
    await application.save();

    res.json({ success: true, status: application.status });
  } catch (err) {
    console.error("[beneficiaries/review]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:walletAddress/document  (admin only)
// Streams the uploaded document file back to the browser.
router.get("/:walletAddress/document", verifyJWT, requireRole("admin"), async (req, res) => {
  try {
    const application = await findApp({
      walletAddress: req.params.walletAddress.toLowerCase(),
    });

    if (!application || !application.documentPath) {
      return res.status(404).json({ error: "No document found for this application" });
    }

    const fs = require("fs");
    const absPath = path.resolve(application.documentPath);

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: "Document file not found on disk" });
    }

    // Derive content-type from extension.
    const ext = path.extname(absPath).toLowerCase();
    const mime = {
      ".pdf":  "application/pdf",
      ".jpg":  "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png":  "image/png",
    }[ext] ?? "application/octet-stream";

    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="doc-${req.params.walletAddress.slice(0, 8)}${ext}"`
    );
    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    console.error("[beneficiaries/document]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
