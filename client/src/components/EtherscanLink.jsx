import React from "react";
import { ExternalLink } from "lucide-react";

export default function EtherscanLink({ txHash, address, label }) {
  const chainId = import.meta.env.VITE_CHAIN_ID;
  const base    = chainId === "11155111"
    ? "https://sepolia.etherscan.io"
    : null;

  if (!base) {
    return <span className="text-xs text-gray-400 font-mono">{label || (txHash ?? address)}</span>;
  }

  const href = txHash
    ? `${base}/tx/${txHash}`
    : `${base}/address/${address}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
    >
      {label || (txHash ? `${txHash.slice(0, 10)}…` : `${address?.slice(0, 8)}…`)}
      <ExternalLink size={11} />
    </a>
  );
}
