const express        = require("express");
const CachedDonation = require("../models/CachedDonation");
const { verifyJWT, requireRole } = require("../middleware/auth");
const { getContract, getConfirmations, getCurrentBlock } = require("../services/blockchainService");

const router = express.Router();

// GET /api/donations/by-address/:address
router.get("/by-address/:address", async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const currentBlock = await getCurrentBlock().catch(() => null);

    let donations = await CachedDonation.find({ donor: address }).sort({ blockNumber: -1 });

    // If DB has nothing yet (event listener hasn't caught up), read directly from contract.
    if (donations.length === 0) {
      try {
        const contract  = getContract();
        const onChain   = await contract.getDonationsByDonor(address);
        if (onChain.length > 0) {
          const fallback = onChain.map((d) => ({
            donationId:    Number(d.id),
            donor:         d.donor.toLowerCase(),
            amount:        d.amount.toString(),
            timestamp:     Number(d.timestamp),
            distributed:   d.distributed,
            txHash:        null,
            blockNumber:   null,
            confirmations: currentBlock !== null ? currentBlock : 1,
          }));
          return res.json(fallback);
        }
      } catch { /* contract read failed — return empty */ }
      return res.json([]);
    }

    // Enrich cached records with fresh confirmation counts.
    const enriched = donations.map((d) => {
      const doc = d.toObject();
      if (currentBlock !== null && d.blockNumber) {
        doc.confirmations = currentBlock - d.blockNumber + 1;
      }
      return doc;
    });

    res.json(enriched);
  } catch (err) {
    console.error("[donations/by-address]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/donations/all  (admin only)
router.get("/all", verifyJWT, requireRole("admin"), async (req, res) => {
  try {
    const donations = await CachedDonation.find().sort({ blockNumber: -1 });
    res.json(donations);
  } catch (err) {
    console.error("[donations/all]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/donations/pool-stats
router.get("/pool-stats", async (req, res) => {
  try {
    const contract = getContract();
    const [totalPool, totalDistributed, donationCount] = await Promise.all([
      contract.totalPool(),
      contract.totalDistributed(),
      contract.getDonationCount(),
    ]);

    // Count unique donors from cache.
    const donorCount = await CachedDonation.distinct("donor").then((a) => a.length);

    res.json({
      totalPool:        totalPool.toString(),
      totalDistributed: totalDistributed.toString(),
      donationCount:    donationCount.toString(),
      donorCount,
    });
  } catch (err) {
    console.error("[donations/pool-stats]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
