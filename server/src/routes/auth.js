const express = require("express");
const { ethers } = require("ethers");
const jwt  = require("jsonwebtoken");
const User = require("../models/User");
const { verifyAddressRole } = require("../services/blockchainService");
const { isDbConnected }     = require("../config/db");
const { memUsers }          = require("../utils/memoryStore");

const router = express.Router();

const nonceStore  = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [addr, entry] of nonceStore) {
    if (entry.expiresAt < now) nonceStore.delete(addr);
  }
}, 60_000);

// GET /api/auth/nonce/:address
router.get("/nonce/:address", (req, res) => {
  const address = req.params.address.toLowerCase();
  const nonce = `Sign this message to authenticate with Zakat Fitrah Tracker.\nNonce: ${ethers.hexlify(
    ethers.randomBytes(16)
  )}\nTimestamp: ${Date.now()}`;
  nonceStore.set(address, { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
  res.json({ nonce });
});

// POST /api/auth/verify
router.post("/verify", async (req, res) => {
  try {
    const { address, signature } = req.body;
    if (!address || !signature) {
      return res.status(400).json({ error: "address and signature required" });
    }

    const normalAddress = address.toLowerCase();
    const entry = nonceStore.get(normalAddress);

    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(401).json({ error: "Nonce expired or not found — request a new one" });
    }

    let recovered;
    try {
      recovered = ethers.verifyMessage(entry.nonce, signature).toLowerCase();
    } catch {
      return res.status(401).json({ error: "Invalid signature" });
    }

    if (recovered !== normalAddress) {
      return res.status(401).json({ error: "Signature does not match address" });
    }

    nonceStore.delete(normalAddress);

    // On-chain role always available even without DB.
    const onChainRole = (await verifyAddressRole(address)).toLowerCase();

    // Try DB first, fall back to in-memory store.
    let user = null;
    try {
      if (isDbConnected()) {
        user = await User.findOne({ walletAddress: normalAddress });
      } else {
        user = memUsers.findOne({ walletAddress: normalAddress });
      }
    } catch {
      user = memUsers.findOne({ walletAddress: normalAddress });
    }

    // ⚠️  REQUIRED — Paste the admin wallet address (all lowercase) that was used
    //    to deploy the contract (Hardhat Account #0 address).
    //    Run `npx hardhat node` and copy the address next to Account #0.
    const HARDCODED_ADMIN = "PASTE_HARDHAT_ACCOUNT_0_ADDRESS_HERE";
    const role = normalAddress === HARDCODED_ADMIN
      ? "admin"
      : (user?.role || (onChainRole !== "none" ? onChainRole : "donor"));

    const token = jwt.sign(
      { address: normalAddress, role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, role, walletAddress: normalAddress });
  } catch (err) {
    console.error("[auth/verify]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
