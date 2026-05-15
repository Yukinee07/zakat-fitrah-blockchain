const jwt = require("jsonwebtoken");
const { verifyAddressRole } = require("../services/blockchainService");

async function verifyJWT(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = header.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // R4/Q4: cross-check the JWT role against the live on-chain role.
  try {
    const onChainRole = await verifyAddressRole(decoded.address);
    const onChainNorm = onChainRole.toLowerCase();

    // Allow if the JWT role matches the on-chain role, or if the user is admin.
    if (onChainNorm !== decoded.role && onChainNorm !== "none") {
      // Role changed on-chain — update the attached role to reflect reality.
      decoded.role = onChainNorm;
    }
  } catch {
    // If blockchain is unavailable fall back to JWT role — log the issue.
    console.warn("[auth] Could not verify on-chain role for", decoded.address);
  }

  req.user = { address: decoded.address, role: decoded.role };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient role" });
    }
    next();
  };
}

module.exports = { verifyJWT, requireRole };
