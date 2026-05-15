const { ethers } = require("ethers");
const path = require("path");
const fs   = require("fs");

let provider;
let contractMeta;

function getContractMeta() {
  if (!contractMeta) {
    const abiPath = path.join(__dirname, "../abi/ZakatFitrah.json");
    if (!fs.existsSync(abiPath)) {
      throw new Error("ZakatFitrah.json ABI not found — run the deploy script first");
    }
    contractMeta = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  }
  return contractMeta;
}

function getProvider() {
  if (!provider) {
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) throw new Error("RPC_URL env var is required");
    provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return provider;
}

function isValidAddress(addr) {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/**
 * Returns a read-only Contract instance.
 */
function getContract() {
  const meta = getContractMeta();
  const addr = process.env.CONTRACT_ADDRESS || meta.address;
  if (!isValidAddress(addr)) {
    throw new Error(
      `CONTRACT_ADDRESS is not set or invalid ("${addr}"). ` +
      "Deploy the contract first and paste the address into server/.env"
    );
  }
  return new ethers.Contract(addr, meta.abi, getProvider());
}

async function getCurrentBlock() {
  return getProvider().getBlockNumber();
}

/**
 * Returns how many blocks have been mined since the tx was included.
 * Returns 0 if the tx is not yet mined.
 */
async function getConfirmations(txHash) {
  try {
    const receipt = await getProvider().getTransactionReceipt(txHash);
    if (!receipt || receipt.blockNumber === null) return 0;
    const current = await getCurrentBlock();
    return current - receipt.blockNumber + 1;
  } catch {
    return 0;
  }
}

/**
 * Queries the contract for the on-chain role of a wallet address.
 * Returns "ADMIN" | "BENEFICIARY" | "DONOR" | "NONE".
 */
async function verifyAddressRole(address) {
  try {
    const contract = getContract();
    return await contract.getUserRole(address);
  } catch {
    return "NONE";
  }
}

module.exports = { getContract, getProvider, getCurrentBlock, getConfirmations, verifyAddressRole };
