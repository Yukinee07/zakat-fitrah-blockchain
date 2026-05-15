import React from "react";
import { AlertTriangle } from "lucide-react";
import { useWeb3 } from "../contexts/Web3Context";

export default function NetworkGuard({ children }) {
  const { account, isCorrectNetwork, switchToSepolia } = useWeb3();

  if (!account || isCorrectNetwork) return children;

  const name = import.meta.env.VITE_CHAIN_NAME || "Localhost";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card max-w-sm w-full mx-4 text-center">
        <AlertTriangle className="mx-auto mb-3 text-amber-500" size={40} />
        <h2 className="text-lg font-bold mb-2">Wrong Network</h2>
        <p className="text-sm text-gray-500 mb-5">
          Please switch to <strong>{name}</strong> to use this application.
        </p>
        <button onClick={switchToSepolia} className="btn-primary w-full">
          Switch to {name}
        </button>
      </div>
    </div>
  );
}
