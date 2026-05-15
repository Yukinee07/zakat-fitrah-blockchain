import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Download, RefreshCw, CalendarClock, X } from "lucide-react";
import { useWeb3 } from "../contexts/Web3Context";
import { useContract } from "../hooks/useContract";
import { makeContractService } from "../services/contractService";
import { generateReceipt } from "../utils/PdfReceipt";
import { CURRENCY, formatEth } from "../utils/currency";
import TxStatus from "../components/TxStatus";
import EtherscanLink from "../components/EtherscanLink";
import NetworkGuard from "../components/NetworkGuard";
import api from "../services/api";

const ETH_TO_RM = 12000;

const RICE_OPTIONS = [
  { key: "local",    label: "Local Rice",          rmPerPerson: 8  },
  { key: "imported", label: "Imported Rice",        rmPerPerson: 16 },
  { key: "basmati",  label: "Basmati Premium Rice", rmPerPerson: 25 },
];

function riceToEth(rmPerPerson) {
  return rmPerPerson / ETH_TO_RM;
}

export default function DonorDashboard() {
  const { account } = useWeb3();
  const contract    = useContract();

  const [txState, setTxState]           = useState(null);
  const [donations, setDonations]       = useState([]);
  const [loading, setLoading]           = useState(false);
  const [poolStats, setPoolStats]       = useState(null);
  const [donorInfo, setDonorInfo]       = useState(null);
  const [zakatDate, setZakatDate]       = useState(null);
  const [myScheduled, setMyScheduled]   = useState([]);
  const [schedLoading, setSchedLoading] = useState(false);

  const [riceType, setRiceType]         = useState("local");
  const [familyMembers, setFamilyMembers] = useState(0);

  const selectedRice = RICE_OPTIONS.find((r) => r.key === riceType);
  const persons      = 1 + Math.max(0, parseInt(familyMembers) || 0);
  const totalRm      = persons * selectedRice.rmPerPerson;
  const amountEth    = (persons * riceToEth(selectedRice.rmPerPerson)).toFixed(6);

  const fetchDonations = useCallback(async () => {
    if (!account) return;
    try {
      const { data } = await api.get(`/donations/by-address/${account}`);
      setDonations(data);
    } catch { /* non-fatal */ }
  }, [account]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get("/donations/pool-stats");
      setPoolStats(data);
    } catch { /* non-fatal */ }
  }, []);

  const fetchDonorInfo = useCallback(async () => {
    try {
      const { data } = await api.get("/users/me");
      setDonorInfo(data);
    } catch { /* not registered yet */ }
  }, []);

  const fetchZakatDate = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/settings/zakat-date");
      setZakatDate(data.zakatDate ?? null);
    } catch { /* no date set */ }
  }, []);

  const fetchMyScheduled = useCallback(async () => {
    if (!contract || !account) return;
    try {
      const svc  = makeContractService(contract);
      const pmts = await svc.getMyScheduledPayments(account);
      setMyScheduled(pmts.filter((p) => !p.executed));
    } catch { /* ignore */ }
  }, [contract, account]);

  useEffect(() => {
    fetchDonations();
    fetchStats();
    fetchDonorInfo();
    fetchZakatDate();
    fetchMyScheduled();
  }, [fetchDonations, fetchStats, fetchDonorInfo, fetchZakatDate, fetchMyScheduled]);

  const handleDonate = async (e) => {
    e.preventDefault();
    if (!contract) return toast.error("Contract not connected");

    setLoading(true);
    setTxState({ state: "pending" });
    try {
      const svc = makeContractService(contract);
      toast("Donation submitted — waiting for confirmation", { icon: "⏳" });

      const receipt = await svc.donate(amountEth);
      setTxState({ state: "confirmed", txHash: receipt.hash, blockNumber: receipt.blockNumber, confirmations: 1 });
      toast.success(`Donation confirmed at block ${receipt.blockNumber}`);
      fetchDonations();
      fetchStats();
      // Re-fetch after 3 s to let the event listener populate the DB
      setTimeout(() => fetchDonations(), 3000);

      let confs = 1;
      const interval = setInterval(async () => {
        try {
          const provider = contract.runner.provider ?? contract.runner;
          const current  = await provider.getBlockNumber();
          confs = current - receipt.blockNumber + 1;
          setTxState((prev) => ({ ...prev, confirmations: confs }));
          if (confs >= 3) {
            toast.success(`Confirmed (3+ confirmations)`, { icon: "✅" });
            clearInterval(interval);
          }
        } catch { clearInterval(interval); }
      }, 4000);
    } catch (err) {
      setTxState(null);
      toast.error(err.reason || err.message || "Donation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!contract) return toast.error("Contract not connected");
    if (!zakatDate) return toast.error("Admin has not set the Zakat payment date yet");

    const releaseTimestamp = Math.floor(new Date(zakatDate).getTime() / 1000);
    if (releaseTimestamp <= Math.floor(Date.now() / 1000)) {
      return toast.error("Zakat date has already passed");
    }

    setSchedLoading(true);
    try {
      const svc = makeContractService(contract);
      toast(`Locking ${amountEth} ${CURRENCY} until ${new Date(zakatDate).toLocaleString()}…`, { icon: "🔒" });
      await svc.schedulePayment(amountEth, releaseTimestamp);
      toast.success("Payment scheduled! ETH is locked — server will execute it automatically on Zakat Day.");
      fetchMyScheduled();
      fetchStats();
    } catch (err) {
      toast.error(err.reason || err.message || "Scheduling failed");
    } finally {
      setSchedLoading(false);
    }
  };

  const handleCancel = async (paymentId) => {
    if (!contract) return;
    try {
      const svc = makeContractService(contract);
      toast("Cancelling scheduled payment…", { icon: "⏳" });
      await svc.cancelScheduledPayment(paymentId);
      toast.success("Scheduled payment cancelled — ETH refunded");
      fetchMyScheduled();
    } catch (err) {
      toast.error(err.reason || err.message || "Cancel failed");
    }
  };

  return (
    <NetworkGuard>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold">Muzakki Dashboard</h1>

        {/* Pool stats */}
        {poolStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Pool",      value: formatEth(poolStats.totalPool) },
              { label: "Distributed",     value: formatEth(poolStats.totalDistributed) },
              { label: "Donors",          value: poolStats.donorCount },
              { label: "Total Donations", value: poolStats.donationCount },
            ].map(({ label, value }) => (
              <div key={label} className="card text-center">
                <p className="text-2xl font-bold text-primary-600">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Zakat Day banner */}
        {zakatDate && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <CalendarClock size={20} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Zakat Payment Day: {new Date(zakatDate).toLocaleString()}
              </p>
              <p className="text-xs text-emerald-600">
                Schedule your payment below — ETH will be locked now and released automatically on this date.
              </p>
            </div>
          </div>
        )}

        {/* Rice calculator + pay form */}
        <div className="card max-w-lg">
          <h2 className="text-lg font-bold mb-4">Zakat Fitrah Calculator (Muzakki)</h2>

          {/* Donor info */}
          {donorInfo && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-0.5">
              <p className="font-medium text-gray-700">{donorInfo.name || "—"}</p>
              <p className="text-xs text-gray-500 font-mono">{donorInfo.walletAddress}</p>
            </div>
          )}

          {/* Rice type */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Rice Type (rate per person)</label>
            <div className="space-y-2">
              {RICE_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors
                    ${riceType === opt.key ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="riceType"
                      value={opt.key}
                      checked={riceType === opt.key}
                      onChange={() => setRiceType(opt.key)}
                      className="text-primary-600"
                    />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary-600">RM {opt.rmPerPerson}</p>
                    <p className="text-xs text-gray-400">
                      ≈ {riceToEth(opt.rmPerPerson).toFixed(6)} {CURRENCY}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Family members */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Family members <span className="text-gray-400 font-normal">(excluding yourself)</span>
            </label>
            <input
              type="number"
              min={0}
              max={20}
              value={familyMembers}
              onChange={(e) => setFamilyMembers(e.target.value)}
              className="input w-32"
            />
          </div>

          {/* Breakdown */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 space-y-1 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Persons covered</span>
              <span className="font-medium">{persons}{persons > 1 ? ` (you + ${persons - 1} family)` : " (you)"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Rate × persons</span>
              <span className="font-medium">RM {selectedRice.rmPerPerson} × {persons} = RM {totalRm}</span>
            </div>
            <div className="flex justify-between border-t border-emerald-200 pt-1 mt-1">
              <span className="font-semibold text-emerald-700">Total</span>
              <span className="font-bold text-emerald-700">{amountEth} {CURRENCY}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleDonate}
              disabled={loading || schedLoading}
              className="btn-primary flex-1 text-sm"
            >
              {loading ? "Processing…" : "Donate Now"}
            </button>
            {zakatDate && new Date(zakatDate) > new Date() && (
              <button
                onClick={handleSchedule}
                disabled={loading || schedLoading}
                className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1"
              >
                <CalendarClock size={14} />
                {schedLoading ? "Locking…" : "Schedule for Zakat Day"}
              </button>
            )}
          </div>

          {txState && (
            <div className="mt-4">
              <TxStatus
                state={txState.state}
                txHash={txState.txHash}
                confirmations={txState.confirmations ?? 0}
                blockNumber={txState.blockNumber}
              />
            </div>
          )}
        </div>

        {/* My scheduled payments */}
        {myScheduled.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">My Scheduled Payments</h2>
            <div className="space-y-2">
              {myScheduled.map((p) => {
                const isDue = p.releaseTime <= Math.floor(Date.now() / 1000);
                return (
                  <div key={p.paymentId} className="border rounded-lg p-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{formatEth(p.amount)}</p>
                      <p className="text-xs text-gray-500">
                        Due: {new Date(p.releaseTime * 1000).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDue ? (
                        <span className="badge-pending text-xs">Executing soon…</span>
                      ) : (
                        <button
                          onClick={() => handleCancel(p.paymentId)}
                          className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1"
                          title="Cancel and refund"
                        >
                          <X size={12} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Donation history */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Donation History</h2>
            <button onClick={fetchDonations} className="btn-secondary text-xs flex items-center gap-1">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {donations.length === 0 ? (
            <p className="text-sm text-gray-400">No donations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b">
                    <th className="pb-2">ID</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Tx</th>
                    <th className="pb-2">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {donations.map((d) => {
                    const confs    = d.confirmations ?? 0;
                    const verified = confs >= 3;
                    return (
                      <tr key={d.donationId} className="py-2">
                        <td className="py-2 font-mono text-xs">{d.donationId}</td>
                        <td className="py-2">{formatEth(d.amount)}</td>
                        <td className="py-2 text-xs text-gray-500">
                          {new Date(d.timestamp * 1000).toLocaleString()}
                        </td>
                        <td className="py-2">
                          {verified
                            ? <span className="badge-verified">Verified</span>
                            : <span className="badge-pending">{confs}/3 confs</span>}
                        </td>
                        <td className="py-2">
                          {d.txHash
                            ? <EtherscanLink txHash={d.txHash} />
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => generateReceipt({ ...d, donor: account })}
                            className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
                          >
                            <Download size={11} /> PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </NetworkGuard>
  );
}
