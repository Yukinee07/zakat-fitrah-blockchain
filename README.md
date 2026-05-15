# Zakat Fitrah Tracker

A production-quality decentralized application (dApp) for managing Zakat Fitrah donations on the Ethereum blockchain. Supports three roles — Donors, Admins, and Beneficiaries — with a hybrid on-chain/off-chain data model.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Vite)                    │
│  DonorDashboard │ AdminDashboard │ BeneficiaryPortal            │
│                     Ethers.js v6  │  Axios                      │
└──────────┬──────────────────────────────┬───────────────────────┘
           │  MetaMask (wallet signing)   │  REST API (JWT auth)
           ▼                              ▼
┌──────────────────────┐    ┌────────────────────────────────────┐
│  Ethereum Sepolia    │    │     SERVER (Express + Node.js)     │
│  ZakatFitrah.sol     │◄───│  blockchainService  │  eventListener│
│  - AccessControl     │    │  MongoDB (Mongoose)                 │
│  - ReentrancyGuard   │    │  AES-256-GCM PII encryption        │
│  - Pausable          │    └────────────────────────────────────┘
└──────────────────────┘                 │
                                         ▼
                              ┌─────────────────────┐
                              │     MongoDB Atlas    │
                              │  Users (encrypted)  │
                              │  Applications       │
                              │  CachedDonations    │
                              └─────────────────────┘
```

---

## Prerequisites

- Node.js 20+
- MongoDB 7+ (local) or MongoDB Atlas URI
- MetaMask browser extension
- Git

---

## Setup

### 1. Clone & install

```bash
git clone <repo-url>
cd zakat-fitrah-tracker
```

### 2. Contracts workspace

```bash
cd contracts
npm install
cp .env.example .env
# Fill in SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, ETHERSCAN_API_KEY
```

### 3. Server workspace

```bash
cd ../server
npm install
cp .env.example .env
# Fill in MONGODB_URI, JWT_SECRET, PII_ENCRYPTION_KEY (32-byte hex),
# RPC_URL, CONTRACT_ADDRESS, CHAIN_ID
```

### 4. Client workspace

```bash
cd ../client
npm install
cp .env.example .env
# Fill in VITE_CONTRACT_ADDRESS, VITE_CHAIN_ID, VITE_RPC_URL
```

---

## Running Locally (3 terminals)

**Terminal 1 — Local Hardhat node:**
```bash
cd contracts
npx hardhat node
```

**Terminal 2 — Deploy contract & start server:**
```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost

cd ../server
npm run dev
```

**Terminal 3 — Start frontend:**
```bash
cd client
npm run dev
# Opens at http://localhost:5173
```

Configure MetaMask:
- Network: Localhost 8545
- Chain ID: 31337
- Import a Hardhat test account using one of the printed private keys

---

## Deploying to Sepolia

1. Fund your deployer wallet with Sepolia ETH (https://sepoliafaucet.com)
2. Set `contracts/.env`:
   ```
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>
   DEPLOYER_PRIVATE_KEY=<your-key>
   ETHERSCAN_API_KEY=<your-key>
   ```
3. Deploy:
   ```bash
   cd contracts
   npx hardhat run scripts/deploy.js --network sepolia
   ```
4. Verify on Etherscan:
   ```bash
   npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>
   ```
5. Update `server/.env` and `client/.env` with the deployed address and Sepolia RPC URL.

---

## Deployed Contract (Sepolia)

> _To be filled after Sepolia deployment (STEP 6)._

- **Address:** `0x...`
- **Etherscan:** https://sepolia.etherscan.io/address/0x...

---

## Use Case → File Mapping

| Use Case | Description | Files |
|----------|-------------|-------|
| UC1 | Donor/Beneficiary Registration | `server/src/routes/users.js`, `client/src/pages/Register.jsx` |
| UC2 | Login via Wallet Signature | `server/src/routes/auth.js`, `client/src/pages/ConnectWallet.jsx` |
| UC3 | Donate Zakat Fitrah | `contracts/contracts/ZakatFitrah.sol#donateZakat`, `client/src/pages/DonorDashboard.jsx` |
| UC4 | View Donation History | `server/src/routes/donations.js`, `client/src/pages/DonorDashboard.jsx` |
| UC5 | Admin Verify Donations | `server/src/routes/admin.js`, `client/src/pages/AdminDashboard.jsx` |
| UC6 | Admin Distribute Funds | `contracts/contracts/ZakatFitrah.sol#distributeFunds`, `client/src/pages/AdminDashboard.jsx` |
| UC7 | Beneficiary Apply | `server/src/routes/beneficiaries.js`, `client/src/pages/BeneficiaryPortal.jsx` |
| UC8 | Beneficiary View Received | `server/src/routes/beneficiaries.js`, `client/src/pages/BeneficiaryPortal.jsx` |

---

## Regulatory Rule → Enforcement Location

| Rule | Description | Enforced In |
|------|-------------|-------------|
| R1 | Min donation 0.0003 ETH | `ZakatFitrah.sol`: `require(msg.value >= MIN_DONATION_WEI)` |
| R2 | Role-Based Access Control | `ZakatFitrah.sol`: OpenZeppelin `AccessControl`; `server/src/middleware/auth.js` |
| R3 | Reentrancy protection | `ZakatFitrah.sol`: OpenZeppelin `ReentrancyGuard` on all ETH-transferring functions |
| R4 | 3-block confirmation finality | `server/src/services/blockchainService.js#getConfirmations`; `client/src/components/TxStatus.jsx` |
| R5 | No PII on-chain | Architecture enforced: only addresses, amounts, timestamps go on-chain |
| R6 | AES-256-GCM PII encryption | `server/src/utils/encryption.js`; `server/src/models/User.js` |

---

## Running Tests

```bash
cd contracts
npx hardhat test
```

---

## E2E Test Scenarios

See STEP 5 in this README for the full checklist. Screenshots saved to `docs/screenshots/`.

### E1. Donor Flow
Register → Connect wallet → Donate 0.001 ETH → View receipt → Watch confirmations rise past 3 → "Verified" badge appears.

### E2. Admin Flow
Connect as deployer → Review pending beneficiary application → Submit + Approve on-chain → Distribute 0.0005 ETH → Confirm beneficiary balance increases.

### E3. Beneficiary Flow
Register → Connect → Apply → Admin approves → View received funds tab.

### E4. Negative: Below Threshold
Donate 0.0001 ETH → Contract reverts → MetaMask shows error → UI shows error toast.

### E5. Negative: Non-Admin Distribute
Non-admin calls distribute → AccessControl revert → UI shows error toast.

### E6. Pause
Deployer pauses contract → Donate attempt fails with "EnforcedPause" → UI shows error toast.

---

## Known Limitations & Future Work

- Document upload currently stores files on local disk; production should use IPFS or S3.
- Event listener uses polling fallback on HTTP providers; WebSocket provider recommended for production.
- The admin must sign on-chain transactions in the browser; a relayer (EIP-2771) could improve UX.
- No multi-sig for admin role; consider Gnosis Safe for production.
- Zakat amount calculation helper (RM/ETH live exchange rate) is simulated; integrate a Chainlink price feed for production.
