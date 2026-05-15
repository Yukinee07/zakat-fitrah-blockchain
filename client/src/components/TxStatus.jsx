import React from "react";
import { Clock, Loader, CheckCircle } from "lucide-react";

/**
 * Renders a three-state transaction status indicator.
 * state: "pending" | "mining" | "confirmed"
 */
export default function TxStatus({ state, txHash, confirmations = 0, blockNumber }) {
  const REQUIRED = 3;
  const verified = confirmations >= REQUIRED;
  const explorerBase = import.meta.env.VITE_CHAIN_ID === "11155111"
    ? "https://sepolia.etherscan.io/tx/"
    : "#";

  if (state === "pending") {
    return (
      <span className="badge-pending">
        <Clock size={11} /> Pending submission
      </span>
    );
  }

  if (state === "mining") {
    return (
      <span className="badge-pending">
        <Loader size={11} className="animate-spin" />
        Mining — block {blockNumber ?? "…"}
        {txHash && (
          <a href={`${explorerBase}${txHash}`} target="_blank" rel="noreferrer"
             className="underline ml-1">view</a>
        )}
      </span>
    );
  }

  if (state === "confirmed") {
    return (
      <span className={verified ? "badge-verified" : "badge-pending"}>
        <CheckCircle size={11} />
        {verified
          ? `Verified (${confirmations} confirmations)`
          : `${confirmations}/${REQUIRED} confirmations`}
        {txHash && (
          <a href={`${explorerBase}${txHash}`} target="_blank" rel="noreferrer"
             className="underline ml-1">view</a>
        )}
      </span>
    );
  }

  return null;
}
