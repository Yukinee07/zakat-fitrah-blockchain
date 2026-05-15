# Zakat Fitrah Tracker — Local Setup Guide

> Works on **Windows** and **macOS**. Follow the steps for your OS where they differ.

---

## What You Need (Prerequisites)

Install these before anything else.

### 1. Node.js (v18 or later)
| OS | Download |
|----|----------|
| Windows | https://nodejs.org → click **LTS** → run the `.msi` installer |
| macOS | https://nodejs.org → click **LTS** → run the `.pkg` installer |

Verify it worked:
```bash
node -v     # should print v18.x.x or higher
npm -v      # should print 9.x.x or higher
```

---

### 2. MongoDB Community Edition

**Windows**
1. Go to https://www.mongodb.com/try/download/community
2. Select **Version 7.x**, Platform **Windows**, Package **msi**
3. Run the installer — choose **"Install MongoD as a Service"** (important!)
4. That's it. It will run as a Windows Service automatically.

**macOS**
```bash
# Install Homebrew first if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB as a background service
brew services start mongodb-community
```

Verify it worked:
```bash
mongosh --eval "db.runCommand({ ping: 1 })"
# should print: { ok: 1 }
```

---

### 3. MetaMask Browser Extension
Install from https://metamask.io/download/ for Chrome, Firefox, or Brave.

---

## Project Structure

```
zakat-fitrah-tracker/
├── client/        ← React frontend  (port 5173)
├── server/        ← Express API     (port 5000)
└── contracts/     ← Hardhat + Solidity smart contract (port 8545)
```

---

## ⚠️ Before You Do Anything — Fill In Your Keys

There are **4 placeholders** in the code that must be filled in with your own values before the app will work. Do this before running anything.

### How to get the values

1. Open a terminal in the `contracts/` folder and run:
   ```bash
   npx hardhat node
   ```
2. You'll see a list of 20 test accounts printed. Look at **Account #0**:
   ```
   Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
   Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
   Copy the **address** and **private key** — you'll need both below.

3. Keep that terminal running. Open a second terminal for the rest of the steps.

---

### Placeholder 1 — `server/.env`

Open `server/.env` and replace the placeholder with the **private key** from Account #0:

```
OPERATOR_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```
*(your value will be different each time you reinstall Hardhat, but in practice it's always the same test key)*

---

### Placeholder 2 — `server/src/routes/auth.js`

Open that file, find the line with `HARDCODED_ADMIN` and replace the placeholder with the **address** from Account #0 (all lowercase):

```js
const HARDCODED_ADMIN = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
```

---

### Placeholder 3 — `client/src/pages/ConnectWallet.jsx`

Same address, same change — find the `HARDCODED_ADMIN` line and paste it:

```js
const HARDCODED_ADMIN = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
```

---

### Placeholder 4 — `contracts/scripts/setup-local.js`

Open that file and add your own MetaMask wallet addresses to `MY_ACCOUNTS`. These wallets will each receive 50 test ETH:

```js
const MY_ACCOUNTS = [
  "0xYourFirstMetaMaskAddressHere",
  "0xYourSecondMetaMaskAddressHere",
];
```

> **Where to find your MetaMask address:** Open MetaMask → click the account name at the top → it copies to clipboard.

---

Once all 4 placeholders are filled in, proceed with the setup below.

---

## One-Time Setup

Open a terminal in the project root folder.

### Step 1 — Install dependencies in all three folders

**Windows (PowerShell) & macOS (Terminal):**
```bash
cd client    && npm install && cd ..
cd server    && npm install && cd ..
cd contracts && npm install && cd ..
```

---

## Running the App (Every Time)

You need **3 terminal windows** open at the same time.

### Terminal 1 — Hardhat Blockchain Node

```bash
cd contracts
npx hardhat node
```

Leave this running. You'll see a list of test accounts printed — **keep this terminal open**.

> ⚠️ Every time you restart this terminal, all blockchain state is wiped (transactions, approvals, balances). You will need to redo **Step B** below.

---

### Terminal 2 — Deploy Contract + Fund Your Wallets

After Terminal 1 is running, open a **new** terminal:

```bash
cd contracts
npx hardhat run scripts/setup-local.js --network localhost
```

You should see:
```
[1/3] Deploying ZakatFitrah contract...
      Contract address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
[2/3] Writing ABI files...
      Updated server/.env
      Updated client/.env
[3/3] Funding 2 MetaMask account(s) with 50 ETH each...
      ✓ 0xYourAddress1Here  +50 ETH
```

> This script automatically updates the contract address in `server/.env` and `client/.env`. You don't need to copy-paste anything.

---

### Terminal 3 — Start the Backend Server

```bash
cd server
npm run dev
```

You should see:
```
[Server] Listening on http://localhost:5000
[Scheduler] Auto-payment scheduler started
```

---

### Terminal 4 — Start the Frontend

Open a fourth terminal (or a new tab):

```bash
cd client
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in ...ms
  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser.

---

## MetaMask Setup

### Add the Local Network to MetaMask

1. Open MetaMask → click the network dropdown at the top → **Add a network** → **Add a network manually**
2. Fill in:

| Field | Value |
|-------|-------|
| Network Name | `Localhost` |
| New RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency Symbol | `ETH` |

3. Click **Save** and switch to the `Localhost` network.

---

### Import the Admin Account

The admin wallet is Hardhat's **Account #0**. Import it into MetaMask **once**:

1. Start `npx hardhat node` and look at the printed output — find **Account #0** and copy its **Private Key**
2. MetaMask → click the circle icon (top right) → **Add account or hardware wallet** → **Import account**
3. Paste the private key → click **Import**

This is the **permanent admin** of the smart contract (same key you put in `server/.env` and the two source files).

> ⚠️ This is a local test key only — never send real ETH to it.

---

### Reset MetaMask After Restarting the Hardhat Node

Every time you restart Terminal 1 (the Hardhat node), do this in MetaMask:

**Settings → Advanced → Clear activity tab data → Clear**

This prevents MetaMask from using stale transaction nonces.

---

## Using the App

### Roles

| Role | How to get it | What they can do |
|------|--------------|-----------------|
| **Admin** | Use the imported Hardhat Account #0 | Approve Mustahiq, distribute Zakat, set the Zakat date |
| **Muzakki** | Register as Muzakki on first connect | Donate Zakat, schedule future payments |
| **Mustahiq** | Register as Mustahiq on first connect | Apply for Zakat assistance, receive funds |

### First Login Flow

1. Go to http://localhost:5173
2. Click **Connect Wallet**
3. Connect MetaMask
4. **New wallet?** → You'll see a role picker: choose **Muzakki** or **Mustahiq**
   > This choice is permanent. Only admin can change it.
5. Fill in your details on the registration page
6. Sign the login message in MetaMask (free — no ETH spent)
7. You're in!

### Admin Login Flow

1. Switch MetaMask to the imported admin account (`0xf39...`)
2. Go to http://localhost:5173 → **Connect Wallet** → **Sign & Enter**
3. You'll be taken directly to the **Admin Dashboard**

---

## Full Workflow Example

1. **Admin** sets the Zakat payment date in the Admin Dashboard
2. **Muzakki** connects, registers, and donates ETH (or schedules a future payment)
3. **Mustahiq** connects, registers, and submits a Zakat assistance application
4. **Admin** approves the Mustahiq application in the Admin Dashboard
5. When the Zakat date arrives, the server **automatically** distributes the pool equally to all approved Mustahiq
6. Admin can also click **"Distribute Equally Now"** at any time to trigger it manually

---

## Troubleshooting

### "No MetaMask detected"
Install the MetaMask extension from https://metamask.io and refresh the page.

### "Could not connect to Hardhat node" / server shows ECONNREFUSED
Terminal 1 (Hardhat node) is not running. Start it first, then run the setup script.

### "No approved Mustahiq" when distributing
The Hardhat node was restarted and the blockchain state was wiped. Redo:
1. Run the setup script again (Terminal 2)
2. Restart the server (Terminal 3)
3. Reset MetaMask activity
4. Re-approve the Mustahiq in the Admin Dashboard

### MongoDB connection warning
The server runs fine without MongoDB (uses in-memory fallback) but **data is lost on restart**.
- **Windows:** Open Services app → find **MongoDB** → Start it. Or run `net start MongoDB` in an admin PowerShell.
- **macOS:** Run `brew services start mongodb-community`

### "Nonce too high" in MetaMask
MetaMask has a stale transaction history. Go to: **Settings → Advanced → Clear activity tab data → Clear**

### Port already in use
Something else is using port 5000 or 5173.
- **Windows:** `netstat -ano | findstr :5000` then `taskkill /PID <pid> /F`
- **macOS:** `lsof -ti:5000 | xargs kill -9`

### npm install fails on Windows
Run PowerShell as Administrator and set the execution policy:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Quick Reference — Commands Cheat Sheet

| Action | Command | Where to run |
|--------|---------|-------------|
| Start blockchain | `npx hardhat node` | `contracts/` |
| Deploy + fund wallets | `npx hardhat run scripts/setup-local.js --network localhost` | `contracts/` |
| Start backend | `npm run dev` | `server/` |
| Start frontend | `npm run dev` | `client/` |
| Start MongoDB (Windows) | `net start MongoDB` | PowerShell (Admin) |
| Start MongoDB (macOS) | `brew services start mongodb-community` | Terminal |

---

## Files Your Colleague Should **NOT** Edit

| File | Reason |
|------|--------|
| `server/.env` | Auto-updated by setup script |
| `client/.env` | Auto-updated by setup script |
| `server/src/abi/ZakatFitrah.json` | Auto-generated by setup script |
| `client/src/abi/ZakatFitrah.json` | Auto-generated by setup script |

The only file you need to edit manually is `contracts/scripts/setup-local.js` to add your MetaMask addresses.
