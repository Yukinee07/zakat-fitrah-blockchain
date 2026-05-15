const mongoose = require("mongoose");
const { encryptField, decryptField } = require("../utils/encryption");

const userSchema = new mongoose.Schema({
  walletAddress:  { type: String, required: true, unique: true, lowercase: true },
  role:           { type: String, enum: ["donor", "admin", "beneficiary"], required: true },
  encryptedName:  String,
  encryptedIC:    String,
  encryptedEmail: String,
  encryptedPhone: String,
  pdpaAcceptedAt: Date,
  createdAt:      { type: Date, default: Date.now },
});

userSchema.methods.setPII = function ({ name, ic, email, phone } = {}) {
  if (name  !== undefined) this.encryptedName  = encryptField(name);
  if (ic    !== undefined) this.encryptedIC    = encryptField(ic);
  if (email !== undefined) this.encryptedEmail = encryptField(email);
  if (phone !== undefined) this.encryptedPhone = encryptField(phone);
};

userSchema.methods.getPII = function () {
  return {
    name:  decryptField(this.encryptedName),
    ic:    decryptField(this.encryptedIC),
    email: decryptField(this.encryptedEmail),
    phone: decryptField(this.encryptedPhone),
  };
};

module.exports = mongoose.model("User", userSchema);
