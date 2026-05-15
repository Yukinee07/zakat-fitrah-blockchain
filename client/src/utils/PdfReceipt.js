import { jsPDF } from "jspdf";
import { CURRENCY, formatEth } from "./currency";

export function generateReceipt({ donationId, donor, amount, timestamp, txHash, blockNumber }) {
  const doc  = new jsPDF();
  const date = new Date(Number(timestamp) * 1000).toLocaleString();

  doc.setFontSize(20);
  doc.setTextColor(5, 150, 105);
  doc.text("Zakat Fitrah Donation Receipt", 20, 24);

  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);
  doc.text(`Donation ID:   ${donationId}`, 20, 42);
  doc.text(`Donor Address: ${donor}`, 20, 52);
  doc.text(`Amount:        ${formatEth(amount)}`, 20, 62);
  doc.text(`Date/Time:     ${date}`, 20, 72);
  if (txHash)      doc.text(`Tx Hash:       ${txHash}`, 20, 82);
  if (blockNumber) doc.text(`Block:         ${blockNumber}`, 20, 92);
  doc.text(`Network:       ${CURRENCY === "ETH" ? "Ethereum Mainnet" : "Sepolia Testnet"}`, 20, 102);

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(
    "This receipt is auto-generated from immutable on-chain data. Keep it for your records.",
    20, 118
  );

  doc.save(`zakat-receipt-${donationId}.pdf`);
}
