import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Wallet } from "lucide-react";
import { useWeb3 } from "../contexts/Web3Context";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { account, disconnect } = useWeb3();
  const { role, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleDisconnect = () => {
    disconnect();
    logout();
    navigate("/");
  };

  const short = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  const roleBadgeColor = {
    admin:       "bg-purple-100 text-purple-700",
    donor:       "bg-primary-100 text-primary-700",
    beneficiary: "bg-amber-100 text-amber-700",
  }[role] ?? "bg-gray-100 text-gray-700";

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-primary-600">
          Zakat Fitrah Tracker
        </Link>

        <div className="flex items-center gap-3">
          {role && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleBadgeColor}`}>
              {role === "donor" ? "Muzakki" : role === "beneficiary" ? "Mustahiq" : "Admin"}
            </span>
          )}
          {account && (
            <span className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
              <Wallet size={14} />
              {short}
            </span>
          )}
          {isAuthenticated && (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut size={14} />
              Disconnect
            </button>
          )}
          {!isAuthenticated && (
            <Link to="/connect" className="btn-primary text-sm">
              Connect Wallet
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
