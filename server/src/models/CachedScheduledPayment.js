const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  paymentId:   { type: Number, required: true, unique: true },
  donor:       { type: String, required: true, lowercase: true },
  amount:      { type: String, required: true },
  releaseTime: { type: Number, required: true },
  executed:    { type: Boolean, default: false },
  txHash:      { type: String, default: null },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model("CachedScheduledPayment", schema);
