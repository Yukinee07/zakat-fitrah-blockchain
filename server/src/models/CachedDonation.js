const mongoose = require("mongoose");

const cachedDonationSchema = new mongoose.Schema({
  donationId:    { type: Number, required: true, unique: true },
  donor:         { type: String, required: true, lowercase: true },
  amount:        { type: String, required: true }, // wei as string
  timestamp:     Number,
  txHash:        String,
  blockNumber:   Number,
  confirmations: { type: Number, default: 0 },
  distributed:   { type: Boolean, default: false },
});

cachedDonationSchema.index({ donor: 1 });
cachedDonationSchema.index({ blockNumber: 1 });

module.exports = mongoose.model("CachedDonation", cachedDonationSchema);
