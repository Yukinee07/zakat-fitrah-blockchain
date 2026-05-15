/**
 * In-memory fallback store used when MongoDB is not available.
 * Mimics the Mongoose model interface used by the routes.
 * Data is lost on server restart — for development only.
 */
const { encryptField, decryptField } = require("./encryption");

// ─── Storage maps ─────────────────────────────────────────────────────────────
const _users            = new Map(); // walletAddress (lower) -> MemoryUser
const _applications     = new Map(); // walletAddress (lower) -> MemoryApplication[]
const _donations        = new Map(); // donationId -> object
const _scheduledPayments = new Map(); // paymentId (number) -> object
const _settings         = new Map(); // key -> { key, value }

// ─── MemoryUser ───────────────────────────────────────────────────────────────
class MemoryUser {
  constructor({ walletAddress, role, pdpaAcceptedAt } = {}) {
    this.walletAddress  = walletAddress.toLowerCase();
    this.role           = role;
    this.pdpaAcceptedAt = pdpaAcceptedAt || null;
    this.createdAt      = new Date();
    this.encryptedName  = null;
    this.encryptedIC    = null;
    this.encryptedEmail = null;
    this.encryptedPhone = null;
  }

  setPII({ name, ic, email, phone } = {}) {
    if (name  !== undefined) this.encryptedName  = encryptField(name);
    if (ic    !== undefined) this.encryptedIC    = encryptField(ic);
    if (email !== undefined) this.encryptedEmail = encryptField(email);
    if (phone !== undefined) this.encryptedPhone = encryptField(phone);
  }

  getPII() {
    return {
      name:  decryptField(this.encryptedName),
      ic:    decryptField(this.encryptedIC),
      email: decryptField(this.encryptedEmail),
      phone: decryptField(this.encryptedPhone),
    };
  }

  save() {
    _users.set(this.walletAddress, this);
    return this;
  }
}

// ─── MemoryApplication ────────────────────────────────────────────────────────
class MemoryApplication {
  constructor({ walletAddress, encryptedReason, documentPath, hardshipWaiverRequested }) {
    this._id                    = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.walletAddress          = walletAddress.toLowerCase();
    this.encryptedReason        = encryptedReason || null;
    this.documentPath           = documentPath || null;
    this.hardshipWaiverRequested = hardshipWaiverRequested || false;
    this.status                 = "pending";
    this.reviewedBy             = null;
    this.reviewedAt             = null;
    this.onChainTxHash          = null;
    this.createdAt              = new Date();
  }

  toObject() {
    return { ...this };
  }

  save() {
    const list = _applications.get(this.walletAddress) || [];
    const idx  = list.findIndex((a) => a._id === this._id);
    if (idx >= 0) list[idx] = this; else list.push(this);
    _applications.set(this.walletAddress, list);
    return this;
  }
}

// ─── Adapter objects (drop-in replacements for Mongoose models) ───────────────

const memUsers = {
  findOne({ walletAddress } = {}) {
    if (!walletAddress) return null;
    return _users.get(walletAddress.toLowerCase()) ?? null;
  },
  newUser(data) {
    return new MemoryUser(data);
  },
};

const memApplications = {
  findOne({ walletAddress, status } = {}) {
    const list = _applications.get(walletAddress?.toLowerCase()) || [];
    if (status) return list.find((a) => a.status === status) ?? null;
    return list[list.length - 1] ?? null;
  },
  find({ walletAddress, status } = {}) {
    const all = [];
    if (walletAddress) {
      const list = _applications.get(walletAddress.toLowerCase()) || [];
      for (const a of list) {
        if (!status || a.status === status) all.push(a);
      }
    } else {
      for (const list of _applications.values()) {
        for (const a of list) {
          if (!status || a.status === status) all.push(a);
        }
      }
    }
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },
  newApplication(data) {
    return new MemoryApplication(data);
  },
};

const memDonations = {
  find({ donor } = {}) {
    const all = [..._donations.values()];
    if (donor) return all.filter((d) => d.donor === donor.toLowerCase());
    return all;
  },
  findAll() {
    return [..._donations.values()];
  },
  distinct(field) {
    return [...new Set([..._donations.values()].map((d) => d[field]))];
  },
  upsert(donationId, data) {
    _donations.set(donationId, { ..._donations.get(donationId), ...data });
  },
};

const memScheduled = {
  find({ executed, releaseTimeLte } = {}) {
    return [..._scheduledPayments.values()].filter((p) => {
      if (executed !== undefined && p.executed !== executed) return false;
      if (releaseTimeLte !== undefined && p.releaseTime > releaseTimeLte) return false;
      return true;
    });
  },
  findByDonor(donor) {
    return [..._scheduledPayments.values()].filter(
      (p) => p.donor === donor.toLowerCase()
    );
  },
  upsert(paymentId, data) {
    _scheduledPayments.set(paymentId, { ..._scheduledPayments.get(paymentId), ...data });
  },
  markExecuted(paymentId) {
    const p = _scheduledPayments.get(paymentId);
    if (p) p.executed = true;
  },
};

const memSettings = {
  get(key) {
    return _settings.get(key) ?? null;
  },
  set(key, value) {
    _settings.set(key, { key, value, updatedAt: new Date() });
  },
};

module.exports = { memUsers, memApplications, memDonations, memScheduled, memSettings };
