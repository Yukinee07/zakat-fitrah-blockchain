const express        = require("express");
const CachedDonation = require("../models/CachedDonation");
const CachedScheduledPayment = require("../models/CachedScheduledPayment");
const BeneficiaryApplication = require("../models/BeneficiaryApplication");
const AdminSetting   = require("../models/AdminSetting");
const { verifyJWT, requireRole } = require("../middleware/auth");
const { getContract, getCurrentBlock } = require("../services/blockchainService");
const { isDbConnected } = require("../config/db");
const { memSettings, memScheduled, memDonations } = require("../utils/memoryStore");

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getSetting(key) {
  if (isDbConnected()) {
    const s = await AdminSetting.findOne({ key });
    return s?.value ?? null;
  }
  return memSettings.get(key)?.value ?? null;
}

async function setSetting(key, value) {
  if (isDbConnected()) {
    await AdminSetting.findOneAndUpdate(
      { key },
      { key, value, updatedAt: new Date() },
      { upsert: true }
    );
  } else {
    memSettings.set(key, value);
  }
}

// ── Transactions ──────────────────────────────────────────────────────────────

// GET /api/admin/transactions/pending-verification
router.get(
  "/transactions/pending-verification",
  verifyJWT,
  requireRole("admin"),
  async (req, res) => {
    try {
      const currentBlock = await getCurrentBlock().catch(() => null);

      let docs;
      if (isDbConnected()) {
        docs = await CachedDonation.find({ blockNumber: { $exists: true, $ne: null } })
          .sort({ blockNumber: -1 })
          .limit(100);
      } else {
        docs = memDonations.find({}).filter((d) => d.blockNumber != null);
      }

      const result = docs
        .map((d) => {
          const obj = typeof d.toObject === "function" ? d.toObject() : { ...d };
          if (currentBlock !== null && d.blockNumber) {
            obj.confirmations = currentBlock - d.blockNumber + 1;
          }
          return obj;
        })
        .filter((d) => (d.confirmations ?? 0) < 3);

      res.json(result);
    } catch (err) {
      console.error("[admin/pending-verification]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── Dashboard ────────────────────────────────────────────────────────────────

// GET /api/admin/dashboard
router.get("/dashboard", verifyJWT, requireRole("admin"), async (req, res) => {
  try {
    const contract = getContract();

    const [totalPool, totalDistributed, donationCount, distributionCount] =
      await Promise.all([
        contract.totalPool(),
        contract.totalDistributed(),
        contract.getDonationCount(),
        contract.getDistributionCount(),
      ]);

    let pendingApplications = 0;
    let donorCount = 0;
    if (isDbConnected()) {
      [pendingApplications, donorCount] = await Promise.all([
        BeneficiaryApplication.countDocuments({ status: "pending" }),
        CachedDonation.distinct("donor").then((a) => a.length),
      ]);
    } else {
      pendingApplications = memScheduled.find({}).length; // rough fallback
      donorCount = memDonations.distinct("donor").length;
    }

    res.json({
      totalPool:            totalPool.toString(),
      totalDistributed:     totalDistributed.toString(),
      contractBalance:      (totalPool - totalDistributed).toString(),
      donationCount:        donationCount.toString(),
      distributionCount:    distributionCount.toString(),
      donorCount,
      pendingApplications,
    });
  } catch (err) {
    console.error("[admin/dashboard]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Zakat Date Setting ────────────────────────────────────────────────────────

// GET /api/admin/settings/zakat-date
router.get("/settings/zakat-date", async (req, res) => {
  try {
    const zakatDate = await getSetting("zakatDate");
    res.json({ zakatDate });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/settings/zakat-date  (admin only)
router.post("/settings/zakat-date", verifyJWT, requireRole("admin"), async (req, res) => {
  try {
    const { zakatDate } = req.body;
    if (!zakatDate) return res.status(400).json({ error: "zakatDate is required" });

    await setSetting("zakatDate", zakatDate);
    res.json({ success: true, zakatDate });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Scheduled Payments View ───────────────────────────────────────────────────

// GET /api/admin/scheduled-payments
router.get("/scheduled-payments", verifyJWT, requireRole("admin"), async (req, res) => {
  try {
    const contract = getContract();
    const [ids, payments] = await contract.getPendingScheduledPayments();

    const now = Math.floor(Date.now() / 1000);
    const result = ids.map((id, i) => ({
      paymentId:   Number(id),
      donor:       payments[i].donor,
      amount:      payments[i].amount.toString(),
      releaseTime: Number(payments[i].releaseTime),
      isDue:       Number(payments[i].releaseTime) <= now,
    }));

    res.json(result);
  } catch (err) {
    console.error("[admin/scheduled-payments]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
