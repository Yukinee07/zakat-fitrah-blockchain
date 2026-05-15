const mongoose = require("mongoose");
const { getContract, getProvider } = require("./blockchainService");
const CachedDonation           = require("../models/CachedDonation");
const CachedScheduledPayment   = require("../models/CachedScheduledPayment");
const BeneficiaryApplication   = require("../models/BeneficiaryApplication");
const { memScheduled }         = require("../utils/memoryStore");

const POLL_INTERVAL_MS = 15_000;

function dbReady() {
  return mongoose.connection.readyState === 1;
}

async function handleDonationReceived(id, donor, amount, timestamp, event) {
  if (!dbReady()) return;
  try {
    const receipt = await event.getTransactionReceipt();
    await CachedDonation.findOneAndUpdate(
      { donationId: Number(id) },
      {
        donationId:  Number(id),
        donor:       donor.toLowerCase(),
        amount:      amount.toString(),
        timestamp:   Number(timestamp),
        txHash:      receipt?.hash ?? null,
        blockNumber: receipt?.blockNumber ?? null,
        distributed: false,
      },
      { upsert: true, new: true }
    );
    console.log(`[EventListener] DonationReceived id=${id} donor=${donor}`);
  } catch (err) {
    console.error("[EventListener] Error handling DonationReceived:", err.message);
  }
}

async function handleBeneficiaryApproved(beneficiary) {
  if (!dbReady()) return;
  try {
    await BeneficiaryApplication.findOneAndUpdate(
      { walletAddress: beneficiary.toLowerCase() },
      { status: "approved", reviewedAt: new Date() },
      { new: true }
    );
    console.log(`[EventListener] BeneficiaryApproved ${beneficiary}`);
  } catch (err) {
    console.error("[EventListener] Error handling BeneficiaryApproved:", err.message);
  }
}

async function handleFundsDistributed(distributionId, beneficiary, amount) {
  console.log(
    `[EventListener] FundsDistributed id=${distributionId} beneficiary=${beneficiary} amount=${amount}`
  );
}

async function handlePaymentScheduled(paymentId, donor, amount, releaseTime, event) {
  try {
    const receipt = await event.getTransactionReceipt();
    const data = {
      paymentId:   Number(paymentId),
      donor:       donor.toLowerCase(),
      amount:      amount.toString(),
      releaseTime: Number(releaseTime),
      executed:    false,
      txHash:      receipt?.hash ?? null,
    };

    if (dbReady()) {
      await CachedScheduledPayment.findOneAndUpdate(
        { paymentId: Number(paymentId) },
        data,
        { upsert: true, new: true }
      );
    } else {
      memScheduled.upsert(Number(paymentId), data);
    }
    console.log(`[EventListener] PaymentScheduled id=${paymentId} donor=${donor} releaseTime=${releaseTime}`);
  } catch (err) {
    console.error("[EventListener] Error handling PaymentScheduled:", err.message);
  }
}

async function startListeners() {
  try {
    const contract = getContract();
    const provider = getProvider();

    const network = await provider.getNetwork();
    console.log(`[EventListener] Connected to network chainId=${network.chainId}`);

    contract.on("DonationReceived",    handleDonationReceived);
    contract.on("BeneficiaryApproved", handleBeneficiaryApproved);
    contract.on("FundsDistributed",    handleFundsDistributed);
    contract.on("PaymentScheduled",    handlePaymentScheduled);

    console.log("[EventListener] Listening for contract events...");

    // Poll to keep confirmation counts fresh — only when DB is available.
    setInterval(async () => {
      if (!dbReady()) return; // silently skip when MongoDB is offline
      try {
        const currentBlock = await provider.getBlockNumber();
        const pending = await CachedDonation.find({
          blockNumber:   { $exists: true, $ne: null },
          confirmations: { $lt: 3 },
        });
        for (const doc of pending) {
          const confs = currentBlock - doc.blockNumber + 1;
          if (confs !== doc.confirmations) {
            doc.confirmations = confs;
            await doc.save();
          }
        }
      } catch (err) {
        console.error("[EventListener] Poll error:", err.message);
      }
    }, POLL_INTERVAL_MS);
  } catch (err) {
    console.warn(
      "[EventListener] Could not start — blockchain may be unavailable:",
      err.message
    );
  }
}

module.exports = { startListeners };
