import { ethers } from "ethers";

const CHAIN_ID = import.meta.env.VITE_CHAIN_ID;

// Mainnet = ETH. Everything else (Sepolia, local Hardhat) = SepoliaETH.
export const CURRENCY = CHAIN_ID === "1" ? "ETH" : "SepoliaETH";

// Format a wei value (BigInt, string, or number) into "X.XXXX SepoliaETH"
export function formatEth(weiValue, decimals = 4) {
  if (weiValue === null || weiValue === undefined) return `0 ${CURRENCY}`;
  try {
    const val = parseFloat(ethers.formatEther(BigInt(weiValue.toString())));
    return `${val.toFixed(decimals)} ${CURRENCY}`;
  } catch {
    return `— ${CURRENCY}`;
  }
}
