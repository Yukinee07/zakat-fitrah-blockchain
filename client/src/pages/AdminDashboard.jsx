import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { RefreshCw, Plus, Trash2, FileText, Calendar, Clock, Zap } from "lucide-react";
import { useContract } from "../hooks/useContract";
import { makeContractService } from "../services/contractService";
import { CURRENCY, formatEth } from "../utils/currency";
import TxStatus from "../components/TxStatus";
import EtherscanLink from "../components/EtherscanLink";
import NetworkGuard from "../components/NetworkGuard";
import api from "../services/api";

export default function AdminDashboard() {
  const contract = useContract();

  const [stats, setStats]             = useState(null);
  const [pending, setPending]         = useState([]);
  const [pendingTx, setPendingTx]     = useState([]);
  const [scheduledPmts, setScheduled] = useState([]);
  const [distRows, setDistRows]       = useState([{ address: "", amount: "" }]);
  const [txState, setTxState]         = useState(null);
  const [loading, setLoading]         = useState(false);

  const [zakatDate, setZakatDate]       = useState("");
  const [zakatDateInput, setZakatDateInput] = useState("");
  const [savingDate, setSavingDate]     = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, pendingRes, pendingTxRes, scheduledRes, dateRes] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/beneficiaries/pending"),
        api.get("/admin/transactions/pending-verification"),
        api.get("/admin/scheduled-payments").catch(() => ({ data: [] })),
        api.get("/admin/settings/zakat-date").catch(() => ({ data: {} })),
      ]);
      setStats(statsRes.data);
      setPending(pendingRes.data);
      setPendingTx(pendingTxRes.data);
      setScheduled(scheduledRes.data);
      if (dateRes.data?.zakatDate) {
        setZakatDate(dateRes.data.zakatDate);
        setZakatDateInput(dateRes.data.zakatDate.slice(0, 16)); // for datetime-local input
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleApprove = async (walletAddress) => {
    if (!contract) return;
    setLoading(true);
    try {
      const svc = makeContractService(contract);
      toast("Submitting beneficiary on-chain…", { icon: "⏳" });
      await svc.submitBeneficiary(walletAddress);
      toast("Approving beneficiary on-chain…", { icon: "⏳" });
      const receipt = await svc.approveBeneficiary(walletAddress);

      await api.post(`/beneficiaries/${walletAddress}/review`, {
        decision: "approve",
        txHash:   receipt.hash,
      });
      toast.success(`Beneficiary ${walletAddress.slice(0, 8)}… approved`);
      fetchAll();
    } catch (err) {
      toast.error(err.reason || err.message || "Approval failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (walletAddress) => {
    setLoading(true);
    try {
      await api.post(`/beneficiaries/${walletAddress}/review`, { decision: "reject" });
      toast.success("Application rejected");
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || "Rejection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveZakatDate = async (e) => {
    e.preventDefault();
    if (!zakatDateInput) return toast.error("Please pick a date and time");
    setSavingDate(true);
    try {
      const iso = new Date(zakatDateInput).toISOString();
      await api.post("/admin/settings/zakat-date", { zakatDate: iso });
      setZakatDate(iso);
      toast.success("Zakat date saved — donors will see this when scheduling payment");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save date");
    } finally {
      setSavingDate(false);
    }
  };

  const addRow    = () => setDistRows((r) => [...r, { address: "", amount: "" }]);
  const removeRow = (i) => setDistRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) =>
    setDistRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const handleDistribute = async (e) => {
    e.preventDefault();
    if (!contract) return;
    const valid = distRows.filter((r) => r.address && r.amount);
    if (!valid.length) return toast.error("Add at least one recipient");

    setLoading(true);
    setTxState({ state: "pending" });
    try {
      const svc      = makeContractService(contract);
      const addresses = valid.map((r) => r.address);
      const amounts   = valid.map((r) => r.amount);
      toast(`Distributing to ${valid.length} beneficiar${valid.length > 1 ? "ies" : "y"}…`, { icon: "📤" });
      const receipt  = await svc.distribute(addresses, amounts);
      setTxState({ state: "confirmed", txHash: receipt.hash, blockNumber: receipt.blockNumber, confirmations: 1 });
      toast.success(`Distribution sent to ${valid.length} beneficiar${valid.length > 1 ? "ies" : "y"}`);
      setDistRows([{ address: "", amount: "" }]);
      fetchAll();
    } catch (err) {
      setTxState(null);
      toast.error(err.reason || err.message || "Distribution failed");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (wei) => formatEth(wei || "0");

  return (
    <NetworkGuard>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>

        {/* Pool stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Pool",        value: fmt(stats.totalPool) },
              { label: "Distributed",       value: fmt(stats.totalDistributed) },
              { label: "Pending Apps",      value: stats.pendingApplications },
              { label: "Muzakki",           value: stats.donorCount },
            ].map(({ label, value }) => (
              <div key={label} className="card text-center">
                <p className="text-2xl font-bold text-primary-600">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Zakat Date Setting */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-primary-600" />
            <h2 className="text-lg font-bold">Zakat Payment Date</h2>
          </div>
          {zakatDate && (
            <p className="text-sm text-emerald-700 mb-3">
              Current: <strong>{new Date(zakatDate).toLocaleString()}</strong>
              {new Date(zakatDate) > new Date()
                ? ` — in ${Math.ceil((new Date(zakatDate) - Date.now()) / 86400000)} day(s)`
                : " — PAST DUE"}
            </p>
          )}
          <form onSubmit={handleSaveZakatDate} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Set date &amp; time</label>
              <input
                type="datetime-local"
                value={zakatDateInput}
                onChange={(e) => setZakatDateInput(e.target.value)}
                className="input"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <button type="submit" disabled={savingDate} className="btn-primary text-sm">
              {savingDate ? "Saving…" : "Save"}
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-2">
            Muzakki will see this date and pre-pay by escrowing ETH. At this time the server auto-executes all payments then distributes the pool <strong>equally</strong> to all approved Mustahiq.
          </p>
        </div>

        {/* Scheduled payments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-primary-600" />
              <h2 className="text-lg font-bold">Scheduled Payments</h2>
            </div>
            <button onClick={fetchAll} className="btn-secondary text-xs flex items-center gap-1">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {scheduledPmts.length === 0 ? (
            <p className="text-sm text-gray-400">No pending scheduled payments.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Donor</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Due At</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {scheduledPmts.map((p) => (
                    <tr key={p.paymentId} className={p.isDue ? "bg-amber-50" : ""}>
                      <td className="py-2 font-mono text-xs">{p.paymentId}</td>
                      <td className="py-2 font-mono text-xs">{p.donor.slice(0, 10)}…</td>
                      <td className="py-2">{fmt(p.amount)}</td>
                      <td className="py-2 text-xs text-gray-500">
                        {new Date(p.releaseTime * 1000).toLocaleString()}
                      </td>
                      <td className="py-2">
                        {p.isDue
                          ? <span className="badge-pending">Executing…</span>
                          : <span className="text-xs text-gray-400">Pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending verifications */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Pending Verification (&lt;3 confirmations)</h2>
            <button onClick={fetchAll} className="btn-secondary text-xs flex items-center gap-1">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {pendingTx.length === 0 ? (
            <p className="text-sm text-gray-400">All transactions confirmed.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b">
                    <th className="pb-2">Donor</th><th className="pb-2">Amount</th>
                    <th className="pb-2">Tx</th><th className="pb-2">Confs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendingTx.map((d) => (
                    <tr key={d.donationId} className="bg-amber-50">
                      <td className="py-2 font-mono text-xs">{d.donor.slice(0, 10)}…</td>
                      <td className="py-2">{fmt(d.amount)}</td>
                      <td className="py-2">{d.txHash ? <EtherscanLink txHash={d.txHash} /> : "—"}</td>
                      <td className="py-2">
                        <span className="badge-pending">{d.confirmations}/3</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Beneficiary approvals */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Mustahiq Applications</h2>
          {pending.length === 0 ? (
            <p className="text-sm text-gray-400">No pending applications.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((app) => (
                <div key={app._id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm">{app.walletAddress}</p>
                      {app.reason && <p className="text-xs text-gray-500 mt-1">{app.reason}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-400">
                          {new Date(app.createdAt).toLocaleDateString()}
                        </p>
                        {app.hardshipWaiverRequested && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            Hardship waiver requested
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {app.documentPath && (
                        <a
                          href={`${import.meta.env.VITE_API_URL}/beneficiaries/${app.walletAddress}/document`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
                          title="View uploaded document"
                        >
                          <FileText size={12} /> Doc
                        </a>
                      )}
                      <button
                        onClick={() => handleApprove(app.walletAddress)}
                        disabled={loading}
                        className="btn-primary text-xs py-1 px-3"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(app.walletAddress)}
                        disabled={loading}
                        className="btn-secondary text-xs py-1 px-3 text-red-600"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distribute funds */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Distribute Funds</h2>
            <button
              onClick={async () => {
                if (!contract) return;
                setLoading(true);
                try {
                  const svc = makeContractService(contract);
                  toast("Distributing equally to all Mustahiq…", { icon: "⚖️" });
                  await svc.distributeEqually();
                  toast.success("Pool distributed equally to all approved Mustahiq");
                  fetchAll();
                } catch (err) {
                  toast.error(err.reason || err.message || "Distribution failed");
                } finally { setLoading(false); }
              }}
              disabled={loading}
              className="btn-secondary text-xs flex items-center gap-1 text-emerald-700"
            >
              <Zap size={12} /> Distribute Equally Now
            </button>
          </div>
          <form onSubmit={handleDistribute} className="space-y-3">
            {distRows.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  placeholder="Beneficiary address (0x…)"
                  value={row.address}
                  onChange={(e) => updateRow(i, "address", e.target.value)}
                  className="input flex-1"
                />
                <input
                  type="number" step="0.0001" min="0.0001"
                  placeholder={`${CURRENCY} amount`}
                  value={row.amount}
                  onChange={(e) => updateRow(i, "amount", e.target.value)}
                  className="input w-32"
                />
                {distRows.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)}
                    className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button type="button" onClick={addRow} className="btn-secondary text-xs flex items-center gap-1">
                <Plus size={12} /> Add Recipient
              </button>
              <button type="submit" disabled={loading} className="btn-primary text-sm">
                {loading ? "Processing…" : "Distribute"}
              </button>
            </div>
          </form>
          {txState && (
            <div className="mt-4">
              <TxStatus state={txState.state} txHash={txState.txHash}
                confirmations={txState.confirmations ?? 0} blockNumber={txState.blockNumber} />
            </div>
          )}
        </div>
      </div>
    </NetworkGuard>
  );
}
