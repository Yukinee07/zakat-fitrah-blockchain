const cron        = require("node-cron");
const { ethers }  = require("ethers");
const { getContract, getProvider } = require("./blockchainService");
const { isDbConnected } = require("../config/db");
const { memSettings }   = require("../utils/memoryStore");
const AdminSetting      = require("../models/AdminSetting");

let _operatorWallet = null;

function getOperatorWallet() {
  if (_operatorWallet) return _operatorWallet;
  const key = process.env.OPERATOR_PRIVATE_KEY;
  if (!key) return null;
  _operatorWallet = new ethers.Wallet(key, getProvider());
  return _operatorWallet;
}

async function getSetting(key) {
  try {
    if (isDbConnected()) {
      const s = await AdminSetting.findOne({ key });
      return s?.value ?? null;
    }
    return memSettings.get(key)?.value ?? null;
  } catch { return null; }
}

async function setSetting(key, value) {
  try {
    if (isDbConnected()) {
      await AdminSetting.findOneAndUpdate(
        { key },
        { key, value, updatedAt: new Date() },
        { upsert: true }
      );
    } else {
      memSettings.set(key, value);
    }
  } catch { /* non-fatal */ }
}

// ── Execute individual scheduled payments that are past due ───────────────────
async function executeDuePayments() {
  const wallet = getOperatorWallet();
  if (!wallet) {
    console.warn("[Scheduler] OPERATOR_PRIVATE_KEY not set — skipping auto-execution");
    return;
  }

  const contract = getContract();
  const now = Math.floor(Date.now() / 1000);
  const [ids, payments] = await contract.getPendingScheduledPayments();
  const dueIds = ids.filter((_, i) => Number(payments[i].releaseTime) <= now);

  if (dueIds.length === 0) return;

  console.log(`[Scheduler] ${dueIds.length} scheduled payment(s) due — executing...`);
  const signed = contract.connect(wallet);

  for (const id of dueIds) {
    try {
      const tx      = await signed.executeScheduledPayment(id);
      const receipt = await tx.wait();
      console.log(`[Scheduler] Payment #${id} executed — tx ${receipt.hash}`);
    } catch (err) {
      console.error(`[Scheduler] Failed to execute payment #${id}:`, err.message);
    }
  }
}

// ── Auto-distribute pool equally to all approved Mustahiq on Zakat date ───────
async function checkAutoDistribution() {
  const wallet = getOperatorWallet();
  if (!wallet) return;

  const zakatDate = await getSetting("zakatDate");
  if (!zakatDate) return;

  const zakatTs = new Date(zakatDate).getTime();
  const now     = Date.now();

  // Only trigger after the zakat date
  if (now < zakatTs) return;

  // Don't repeat if we already distributed for this zakat date
  const lastDist = await getSetting("lastAutoDistribution");
  if (lastDist === zakatDate) return;

  const contract = getContract();

  // Wait for all pending scheduled payments to be executed first
  const [ids, payments] = await contract.getPendingScheduledPayments();
  const stillDue = ids.filter((_, i) => Number(payments[i].releaseTime) <= Math.floor(now / 1000));
  if (stillDue.length > 0) {
    console.log(`[Scheduler] Waiting for ${stillDue.length} payment(s) before distribution...`);
    return;
  }

  // Check there are approved Mustahiq and funds available
  const [balance, escrowed, mustahiq] = await Promise.all([
    contract.getContractBalance(),
    contract.totalEscrowed(),
    contract.getApprovedMustahiq(),
  ]);

  const available = balance - escrowed;
  if (available <= 0n || mustahiq.length === 0) {
    console.log("[Scheduler] Nothing to distribute (no funds or no Mustahiq).");
    await setSetting("lastAutoDistribution", zakatDate);
    return;
  }

  console.log(`[Scheduler] Auto-distributing ${ethers.formatEther(available)} ETH equally to ${mustahiq.length} Mustahiq...`);
  const signed = contract.connect(wallet);
  try {
    const tx      = await signed.distributeEqually();
    const receipt = await tx.wait();
    console.log(`[Scheduler] Equal distribution complete — tx ${receipt.hash}`);
    await setSetting("lastAutoDistribution", zakatDate);
  } catch (err) {
    console.error("[Scheduler] Auto-distribution failed:", err.message);
  }
}

function startScheduler() {
  cron.schedule("* * * * *", async () => {
    try {
      await executeDuePayments();
      await checkAutoDistribution();
    } catch (err) {
      console.error("[Scheduler] Unexpected error:", err.message);
    }
  });
  console.log("[Scheduler] Auto-payment scheduler started (runs every minute)");
}

module.exports = { startScheduler };
