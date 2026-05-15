const express = require("express");
const User    = require("../models/User");
const { verifyJWT }     = require("../middleware/auth");
const { isDbConnected } = require("../config/db");
const { memUsers }      = require("../utils/memoryStore");

const router = express.Router();

// ─── Helpers: auto-select Mongo or in-memory ──────────────────────────────────
async function findUser(walletAddress) {
  const addr = walletAddress.toLowerCase();
  if (isDbConnected()) return User.findOne({ walletAddress: addr });
  return memUsers.findOne({ walletAddress: addr });
}

function makeUser(data) {
  if (isDbConnected()) return new User(data);
  return memUsers.newUser(data);
}

// POST /api/users/register
router.post("/register", async (req, res) => {
  try {
    const { walletAddress, role, name, ic, documentType, email, phone, pdpaAccepted } = req.body;

    if (!pdpaAccepted) {
      return res.status(400).json({ error: "PDPA consent is required" });
    }
    if (!walletAddress || !role) {
      return res.status(400).json({ error: "walletAddress and role are required" });
    }
    if (!["donor", "beneficiary"].includes(role)) {
      return res.status(400).json({ error: "role must be donor or beneficiary" });
    }

    let user = await findUser(walletAddress);
    if (!user) {
      user = makeUser({ walletAddress, role, pdpaAcceptedAt: new Date() });
    } else {
      // Prevent silently switching roles — a donor cannot re-register as a beneficiary
      // and vice versa. Role changes require admin intervention on-chain.
      if (user.role !== role) {
        return res.status(409).json({
          error: `This wallet is already registered as a ${user.role}. You cannot change roles by re-registering.`,
        });
      }
      user.pdpaAcceptedAt = new Date();
    }

    // Store document type prefix with the number for auditability.
    const docValue = documentType === "passport" ? `PASSPORT:${ic}` : `IC:${ic}`;
    user.setPII({ name, ic: docValue, email, phone });
    await user.save();

    const isMemory = !isDbConnected();
    res.status(201).json({
      success: true,
      walletAddress: user.walletAddress,
      ...(isMemory && { warning: "MongoDB is offline — data stored in memory only and will be lost on server restart. Install MongoDB for persistence." }),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Wallet already registered" });
    }
    console.error("[users/register]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/exists/:address  (public — no JWT needed)
// Used by the connect-wallet page to decide whether to show the role picker.
router.get("/exists/:address", async (req, res) => {
  try {
    const user = await findUser(req.params.address);
    res.json({ exists: !!user });
  } catch (err) {
    console.error("[users/exists]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/me
router.get("/me", verifyJWT, async (req, res) => {
  try {
    const user = await findUser(req.user.address);
    if (!user) return res.status(404).json({ error: "User not found" });

    const pii = user.getPII();
    res.json({
      walletAddress:  user.walletAddress,
      role:           user.role,
      name:           pii.name,
      email:          pii.email,
      phone:          pii.phone,
      pdpaAcceptedAt: user.pdpaAcceptedAt,
      createdAt:      user.createdAt,
    });
  } catch (err) {
    console.error("[users/me]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
