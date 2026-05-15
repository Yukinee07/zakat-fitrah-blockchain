import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api";
import { useWeb3 } from "../contexts/Web3Context";
import { useAuth } from "../contexts/AuthContext";

// ─── Country codes (Malaysia +60 first, then alphabetical) ───────────────────
const COUNTRY_CODES = [
  { code: "+60",  flag: "🇲🇾", name: "Malaysia" },
  { code: "+1",   flag: "🇺🇸", name: "USA / Canada" },
  { code: "+7",   flag: "🇷🇺", name: "Russia" },
  { code: "+20",  flag: "🇪🇬", name: "Egypt" },
  { code: "+27",  flag: "🇿🇦", name: "South Africa" },
  { code: "+30",  flag: "🇬🇷", name: "Greece" },
  { code: "+31",  flag: "🇳🇱", name: "Netherlands" },
  { code: "+32",  flag: "🇧🇪", name: "Belgium" },
  { code: "+33",  flag: "🇫🇷", name: "France" },
  { code: "+34",  flag: "🇪🇸", name: "Spain" },
  { code: "+36",  flag: "🇭🇺", name: "Hungary" },
  { code: "+39",  flag: "🇮🇹", name: "Italy" },
  { code: "+40",  flag: "🇷🇴", name: "Romania" },
  { code: "+41",  flag: "🇨🇭", name: "Switzerland" },
  { code: "+43",  flag: "🇦🇹", name: "Austria" },
  { code: "+44",  flag: "🇬🇧", name: "United Kingdom" },
  { code: "+45",  flag: "🇩🇰", name: "Denmark" },
  { code: "+46",  flag: "🇸🇪", name: "Sweden" },
  { code: "+47",  flag: "🇳🇴", name: "Norway" },
  { code: "+48",  flag: "🇵🇱", name: "Poland" },
  { code: "+49",  flag: "🇩🇪", name: "Germany" },
  { code: "+51",  flag: "🇵🇪", name: "Peru" },
  { code: "+52",  flag: "🇲🇽", name: "Mexico" },
  { code: "+54",  flag: "🇦🇷", name: "Argentina" },
  { code: "+55",  flag: "🇧🇷", name: "Brazil" },
  { code: "+56",  flag: "🇨🇱", name: "Chile" },
  { code: "+57",  flag: "🇨🇴", name: "Colombia" },
  { code: "+58",  flag: "🇻🇪", name: "Venezuela" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
  { code: "+62",  flag: "🇮🇩", name: "Indonesia" },
  { code: "+63",  flag: "🇵🇭", name: "Philippines" },
  { code: "+64",  flag: "🇳🇿", name: "New Zealand" },
  { code: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "+66",  flag: "🇹🇭", name: "Thailand" },
  { code: "+81",  flag: "🇯🇵", name: "Japan" },
  { code: "+82",  flag: "🇰🇷", name: "South Korea" },
  { code: "+84",  flag: "🇻🇳", name: "Vietnam" },
  { code: "+86",  flag: "🇨🇳", name: "China" },
  { code: "+90",  flag: "🇹🇷", name: "Turkey" },
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "+93",  flag: "🇦🇫", name: "Afghanistan" },
  { code: "+94",  flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+95",  flag: "🇲🇲", name: "Myanmar" },
  { code: "+98",  flag: "🇮🇷", name: "Iran" },
  { code: "+212", flag: "🇲🇦", name: "Morocco" },
  { code: "+213", flag: "🇩🇿", name: "Algeria" },
  { code: "+216", flag: "🇹🇳", name: "Tunisia" },
  { code: "+218", flag: "🇱🇾", name: "Libya" },
  { code: "+220", flag: "🇬🇲", name: "Gambia" },
  { code: "+221", flag: "🇸🇳", name: "Senegal" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+249", flag: "🇸🇩", name: "Sudan" },
  { code: "+251", flag: "🇪🇹", name: "Ethiopia" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+261", flag: "🇲🇬", name: "Madagascar" },
  { code: "+263", flag: "🇿🇼", name: "Zimbabwe" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+972", flag: "🇮🇱", name: "Israel" },
  { code: "+973", flag: "🇧🇭", name: "Bahrain" },
  { code: "+974", flag: "🇶🇦", name: "Qatar" },
  { code: "+975", flag: "🇧🇹", name: "Bhutan" },
  { code: "+976", flag: "🇲🇳", name: "Mongolia" },
  { code: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "+994", flag: "🇦🇿", name: "Azerbaijan" },
  { code: "+995", flag: "🇬🇪", name: "Georgia" },
];

export default function Register() {
  const { account, connect } = useWeb3();
  const { isAuthenticated, role: existingRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Role passed from the connect-wallet role picker (locked — user already chose).
  const preselectedRole = searchParams.get("role"); // "donor" | "beneficiary" | null
  const roleIsLocked    = !!preselectedRole && ["donor", "beneficiary"].includes(preselectedRole);

  // If already signed in, go straight to the dashboard — no need to register again.
  useEffect(() => {
    if (isAuthenticated) {
      const path =
        existingRole === "admin"       ? "/admin" :
        existingRole === "donor"       ? "/donor" :
        existingRole === "beneficiary" ? "/beneficiary" : null;
      if (path) navigate(path, { replace: true });
    }
  }, [isAuthenticated, existingRole, navigate]);

  const [docType, setDocType]         = useState("ic"); // "ic" | "passport"
  const [countryCode, setCountryCode] = useState("+60");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [form, setForm] = useState({
    role: roleIsLocked ? preselectedRole : "donor",
    name: "", ic: "", email: "", pdpaAccepted: false,
  });
  const [loading, setLoading] = useState(false);

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const submit = async (e) => {
    e.preventDefault();

    // ── Get wallet address directly from MetaMask (React state is async) ──────
    let currentAccount = account;
    if (!currentAccount) {
      if (!window.ethereum) return toast.error("MetaMask not found — please install it");
      try {
        await connect();
        // Read directly from MetaMask instead of waiting for React state update.
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        currentAccount = accounts[0] ?? null;
      } catch {
        return toast.error("Could not connect wallet — please try again");
      }
    }

    if (!currentAccount) return toast.error("No wallet account found — connect MetaMask first");
    if (!form.pdpaAccepted) return toast.error("You must accept the PDPA consent");
    if (!phoneNumber.trim()) return toast.error("Phone number is required");

    const fullPhone = `${countryCode}${phoneNumber.trim()}`;

    setLoading(true);
    try {
      await api.post("/users/register", {
        walletAddress: currentAccount,
        role:          form.role,
        name:          form.name,
        ic:            form.ic,
        documentType:  docType,
        email:         form.email,
        phone:         fullPhone,
        pdpaAccepted:  form.pdpaAccepted,
      });
      toast.success("Registered! Now sign in with your wallet.");
      navigate("/connect");
    } catch (err) {
      const msg = err.response?.data?.error || "Registration failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="card">
        <h2 className="text-2xl font-bold mb-6">Register</h2>

        {/* Wallet connection status */}
        {account ? (
          <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
            <span className="text-xs text-primary-700 font-mono break-all">{account}</span>
          </div>
        ) : (
          <button onClick={connect} className="btn-secondary w-full mb-5">
            Connect Wallet First
          </button>
        )}

        <form onSubmit={submit} className="space-y-4">
          {/* Role */}
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            {roleIsLocked ? (
              <div className="input bg-gray-50 text-gray-700 flex items-center justify-between cursor-not-allowed">
                <span>
                  {form.role === "donor" ? "Muzakki (Donor)" : "Mustahiq (Recipient)"}
                </span>
                <span className="text-xs text-gray-400 ml-2">Locked</span>
              </div>
            ) : (
              <select name="role" value={form.role} onChange={handle} className="input">
                <option value="donor">Muzakki (Donor)</option>
                <option value="beneficiary">Mustahiq (Recipient)</option>
              </select>
            )}
            {roleIsLocked && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ Role selected at sign-in. This is permanent and can only be changed by the Admin.
              </p>
            )}
          </div>

          {/* Full name */}
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              type="text" name="name" value={form.name}
              onChange={handle} className="input" required placeholder="As per identity document"
            />
          </div>

          {/* IC / Passport toggle */}
          <div>
            <label className="block text-sm font-medium mb-1">Identity Document</label>
            <div className="flex gap-2 mb-2">
              {[
                { value: "ic",       label: "IC (MyKad)" },
                { value: "passport", label: "Passport" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDocType(opt.value)}
                  className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors
                    ${docType === opt.value
                      ? "bg-primary-600 border-primary-600 text-white"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="text" name="ic" value={form.ic}
              onChange={handle} className="input" required
              placeholder={docType === "passport" ? "E.g. A12345678" : "E.g. 880101-01-1234"}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email" name="email" value={form.email}
              onChange={handle} className="input" required
            />
          </div>

          {/* Phone — country code + number */}
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number</label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="input w-44 shrink-0"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code + c.name} value={c.code}>
                    {c.flag} {c.code} {c.name}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="input flex-1"
                placeholder="e.g. 123456789"
                required
              />
            </div>
            {phoneNumber && (
              <p className="text-xs text-gray-400 mt-1">
                Full number: {countryCode}{phoneNumber}
              </p>
            )}
          </div>

          {/* PDPA consent */}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox" name="pdpaAccepted"
              checked={form.pdpaAccepted} onChange={handle}
              className="mt-0.5 shrink-0"
            />
            <span>
              I consent to my personal data being stored in encrypted form as per the{" "}
              <strong>Personal Data Protection Act (PDPA)</strong> of Malaysia.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !form.pdpaAccepted}
            className="btn-primary w-full"
          >
            {loading ? "Registering…" : "Register"}
          </button>
        </form>
      </div>
    </div>
  );
}
