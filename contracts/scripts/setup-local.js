/**
 * setup-local.js
 * Run this once after every `npx hardhat node` restart.
 * It deploys the contract, funds your MetaMask accounts, and updates .env files.
 *
 * Usage:
 *   npx hardhat run scripts/setup-local.js --network localhost
 *
 * ─── CONFIGURE YOUR METAMASK ADDRESSES HERE ───────────────────────────────────
 */
const MY_ACCOUNTS = [
  // ⚠️  REQUIRED — Paste your MetaMask wallet addresses below (full 0x... address).
  // Each address will receive 50 test ETH automatically when you run this script.
  // To find your address: open MetaMask → click the account name → it copies to clipboard.
  //
  // Example (replace with your own):
  // "0xYourFirstWalletAddressHere",
  // "0xYourSecondWalletAddressHere",
];

const FUND_AMOUNT_ETH = "50"; // ETH to send to each account
// ──────────────────────────────────────────────────────────────────────────────

const fs   = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n═══════════════════════════════════════════");
  console.log("  Zakat Fitrah Tracker — Local Setup");
  console.log("═══════════════════════════════════════════");
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

  // ── 1. Deploy contract ─────────────────────────────────────────────────────
  console.log("\n[1/3] Deploying ZakatFitrah contract...");
  const Factory  = await ethers.getContractFactory("ZakatFitrah");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`      Contract address: ${address}`);

  // ── 2. Write ABI + address to both apps ───────────────────────────────────
  console.log("\n[2/3] Writing ABI files...");
  const artifact = await artifacts.readArtifact("ZakatFitrah");
  const payload  = JSON.stringify(
    { address, abi: artifact.abi, network: "localhost", chainId: 31337,
      deployedAt: new Date().toISOString() },
    null, 2
  );

  const clientAbi = path.join(__dirname, "../../client/src/abi/ZakatFitrah.json");
  const serverAbi = path.join(__dirname, "../../server/src/abi/ZakatFitrah.json");
  fs.writeFileSync(clientAbi, payload);
  fs.writeFileSync(serverAbi, payload);
  console.log(`      ABI → client/src/abi/ZakatFitrah.json`);
  console.log(`      ABI → server/src/abi/ZakatFitrah.json`);

  // Update CONTRACT_ADDRESS in server/.env
  const serverEnvPath = path.join(__dirname, "../../server/.env");
  if (fs.existsSync(serverEnvPath)) {
    let env = fs.readFileSync(serverEnvPath, "utf8");
    env = env.replace(/^CONTRACT_ADDRESS=.*/m, `CONTRACT_ADDRESS=${address}`);
    fs.writeFileSync(serverEnvPath, env);
    console.log(`      Updated server/.env  CONTRACT_ADDRESS=${address}`);
  }

  // Update VITE_CONTRACT_ADDRESS in client/.env
  const clientEnvPath = path.join(__dirname, "../../client/.env");
  if (fs.existsSync(clientEnvPath)) {
    let env = fs.readFileSync(clientEnvPath, "utf8");
    env = env.replace(/^VITE_CONTRACT_ADDRESS=.*/m, `VITE_CONTRACT_ADDRESS=${address}`);
    fs.writeFileSync(clientEnvPath, env);
    console.log(`      Updated client/.env  VITE_CONTRACT_ADDRESS=${address}`);
  }

  // ── 3. Fund MetaMask accounts ──────────────────────────────────────────────
  const validAccounts = MY_ACCOUNTS.filter(
    (a) => a && /^0x[0-9a-fA-F]{40}$/.test(a)
  );

  if (validAccounts.length === 0) {
    console.log("\n[3/3] No MetaMask accounts configured — skipping funding.");
    console.log("      Edit MY_ACCOUNTS in scripts/setup-local.js to add your addresses.");
  } else {
    console.log(`\n[3/3] Funding ${validAccounts.length} MetaMask account(s) with ${FUND_AMOUNT_ETH} ETH each...`);
    for (const acct of validAccounts) {
      const tx = await deployer.sendTransaction({
        to: acct,
        value: ethers.parseEther(FUND_AMOUNT_ETH),
      });
      await tx.wait();
      console.log(`      ✓ ${acct}  +${FUND_AMOUNT_ETH} ETH`);
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  Setup complete!");
  console.log(`  Contract : ${address}`);
  console.log("  Restart your server (npm run dev) to pick up the new address.");
  console.log("  Reset MetaMask: Settings → Advanced → Clear activity tab data");
  console.log("  Re-approve any Mustahiq through the Admin Dashboard.");
  console.log("═══════════════════════════════════════════\n");
}

main().catch((err) => { console.error(err); process.exit(1); });
