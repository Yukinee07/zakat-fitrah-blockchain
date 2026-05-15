import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Wallet, CheckCircle, HandCoins, HeartHandshake, AlertTriangle } from "lucide-react";
import { useWeb3 } from "../contexts/Web3Context";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

function dashboardPath(role) {
  if (role === "admin")       return "/admin";
  if (role === "donor")       return "/donor";
  if (role === "beneficiary") return "/beneficiary";
  return "/";
}

export default function ConnectWallet() {
  const { account, connect, signer } = useWeb3();
  const { login, isAuthenticated, role } = useAuth();
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(false);

  // "checking" | "new" | "existing"
  const [userStatus, setUserStatus] = useState("checking");
  const [pickedRole, setPickedRole] = useState(null);

  // ── Auto-redirect if already signed in ──────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated && account) {
      navigate(dashboardPath(role), { replace: true });
    }
  }, [isAuthenticated, account, role, navigate]);

  // ⚠️  REQUIRED — Paste the admin wallet address (all lowercase) that was used
  //    to deploy the contract (Hardhat Account #0 address).
  //    Run `npx hardhat node` and copy the address next to Account #0.
  const HARDCODED_ADMIN = "PASTE_HARDHAT_ACCOUNT_0_ADDRESS_HERE";

  // ── Check if the connected wallet is already registered ───────────────────
  useEffect(() => {
    if (!account) {
      setUserStatus("checking");
      setPickedRole(null);
      return;
    }
    // Admin account — always go straight to sign-in, never show role picker.
    if (account.toLowerCase() === HARDCODED_ADMIN) {
      setUserStatus("existing");
      return;
    }
    api.get(`/users/exists/${account}`)
      .then(({ data }) => setUserStatus(data.exists ? "existing" : "new"))
      .catch(() => setUserStatus("existing")); // fail-safe: show sign-in
  }, [account]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setLoading(true);
    try {
      await connect();
    } catch (err) {
      toast.error("Could not connect wallet: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!account || !signer) return toast.error("Connect your wallet first");
    setLoading(true);
    try {
      const { role: r } = await login(account, signer);
      toast.success("Signed in successfully");
      navigate(dashboardPath(r), { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsNew = () => {
    if (!pickedRole) return toast.error("Please choose your role first");
    navigate(`/register?role=${pickedRole}`);
  };

  // ── If JWT exists but MetaMask is still reconnecting ────────────────────────
  if (isAuthenticated && !account) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="card">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-gray-500">Reconnecting to MetaMask…</p>
          <p className="text-xs text-gray-400 mt-2">Please unlock MetaMask if prompted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16 text-center">
      <div className="card">
        <Wallet className="mx-auto text-primary-600 mb-4" size={40} />
        <h2 className="text-2xl font-bold mb-2">Sign In</h2>
        <p className="text-sm text-gray-500 mb-6">
          Sign a message with your wallet to authenticate. No gas required — this is free.
        </p>

        {/* ── Step 1: no wallet yet ── */}
        {!account && (
          <button onClick={handleConnect} disabled={loading} className="btn-primary w-full">
            {loading ? "Connecting…" : "Connect MetaMask"}
          </button>
        )}

        {/* ── Step 2: wallet connected, checking status ── */}
        {account && userStatus === "checking" && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 w-full">
              <CheckCircle size={14} className="text-primary-600 shrink-0" />
              <span className="text-xs font-mono text-primary-700 break-all">{account}</span>
            </div>
            <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full" />
            <p className="text-xs text-gray-400">Checking registration…</p>
          </div>
        )}

        {/* ── Step 2a: existing user — normal sign-in ── */}
        {account && userStatus === "existing" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2">
              <CheckCircle size={14} className="text-primary-600 shrink-0" />
              <span className="text-xs font-mono text-primary-700 break-all">{account}</span>
            </div>
            <button onClick={handleLogin} disabled={loading} className="btn-primary w-full">
              {loading ? "Signing…" : "Sign & Enter"}
            </button>
            <p className="text-xs text-gray-400">
              MetaMask will ask you to sign a message — no ETH is spent.
            </p>
          </div>
        )}

        {/* ── Step 2b: new wallet — role picker ── */}
        {account && userStatus === "new" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2">
              <CheckCircle size={14} className="text-primary-600 shrink-0" />
              <span className="text-xs font-mono text-primary-700 break-all">{account}</span>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Who are you registering as?
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Muzakki card */}
                <button
                  type="button"
                  onClick={() => setPickedRole("donor")}
                  className={`flex flex-col items-center gap-2 border-2 rounded-xl p-4 transition-all
                    ${pickedRole === "donor"
                      ? "border-primary-500 bg-primary-50 shadow-md"
                      : "border-gray-200 hover:border-gray-300 bg-white"}`}
                >
                  <HandCoins
                    size={32}
                    className={pickedRole === "donor" ? "text-primary-600" : "text-gray-400"}
                  />
                  <span className={`text-sm font-semibold ${pickedRole === "donor" ? "text-primary-700" : "text-gray-600"}`}>
                    Muzakki
                  </span>
                  <span className="text-xs text-gray-400 leading-tight">Pay Zakat Fitrah</span>
                </button>

                {/* Mustahiq card */}
                <button
                  type="button"
                  onClick={() => setPickedRole("beneficiary")}
                  className={`flex flex-col items-center gap-2 border-2 rounded-xl p-4 transition-all
                    ${pickedRole === "beneficiary"
                      ? "border-amber-500 bg-amber-50 shadow-md"
                      : "border-gray-200 hover:border-gray-300 bg-white"}`}
                >
                  <HeartHandshake
                    size={32}
                    className={pickedRole === "beneficiary" ? "text-amber-600" : "text-gray-400"}
                  />
                  <span className={`text-sm font-semibold ${pickedRole === "beneficiary" ? "text-amber-700" : "text-gray-600"}`}>
                    Mustahiq
                  </span>
                  <span className="text-xs text-gray-400 leading-tight">Receive Zakat</span>
                </button>
              </div>
            </div>

            {/* Final choice warning */}
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-left">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                This choice is <strong>permanent</strong> and can only be changed by the Admin.
              </p>
            </div>

            <button
              onClick={handleContinueAsNew}
              disabled={!pickedRole || loading}
              className="btn-primary w-full"
            >
              Continue to Register
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
