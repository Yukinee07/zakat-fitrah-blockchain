const mongoose = require("mongoose");

const beneficiaryApplicationSchema = new mongoose.Schema({
  walletAddress:           { type: String, required: true, lowercase: true },
  encryptedReason:         String,
  documentPath:            String,
  hardshipWaiverRequested: { type: Boolean, default: false },
  status: {
    type:    String,
    enum:    ["pending", "approved", "rejected"],
    default: "pending",
  },
  reviewedBy:    String,
  reviewedAt:    Date,
  onChainTxHash: String,
  createdAt:     { type: Date, default: Date.now },
});

module.exports = mongoose.model("BeneficiaryApplication", beneficiaryApplicationSchema);
