import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { useWeb3 } from "../contexts/Web3Context";
import { useContract } from "../hooks/useContract";
import { formatEth } from "../utils/currency";
import EtherscanLink from "../components/EtherscanLink";
import NetworkGuard from "../components/NetworkGuard";
import api from "../services/api";

const STATUS_BADGE = {
  pending:  "badge-pending",
  approved: "badge-verified",
  rejected: "bg-red-100 text-red-700 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
};

export default function BeneficiaryPortal() {
  const { account } = useWeb3();
  const contract    = useContract();

  const [applications, setApplications]         = useState([]);
  const [distributions, setDistributions]       = useState([]);
  const [form, setForm]                          = useState({ reason: "", hardshipWaiverRequested: false });
  const [file, setFile]                          = useState(null);
  const [loading, setLoading]                    = useState(false);
  const [tab, setTab]                            = useState("apply");
  const [showForm, setShowForm]                  = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const appRes = await api.get("/beneficiaries/my-applications").catch(() => null);
      setApplications(appRes?.data ?? []);
      setShowForm(appRes?.data?.length === 0);
    } catch { /* no applications */ }

    if (account && contract) {
      try {
        const dists = await contract.getDistributionsByBeneficiary(account);
        setDistributions(dists);
      } catch { /* no distributions */ }
    }
  }, [account, contract]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApply = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("reason", form.reason);
      formData.append("hardshipWaiverRequested", form.hardshipWaiverRequested);
      if (file) formData.append("document", file);

      await api.post("/beneficiaries/apply", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Application submitted successfully");
      setForm({ reason: "", hardshipWaiverRequested: false });
      setFile(null);
      setShowForm(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Application failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <NetworkGuard>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">Mustahiq Portal</h1>

        <div className="flex gap-2 border-b">
          {["apply", "funds"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 px-3 text-sm font-medium capitalize transition-colors
                ${tab === t ? "border-b-2 border-primary-600 text-primary-600" : "text-gray-500"}`}
            >
              {t === "apply" ? "My Applications" : "Received Zakat"}
            </button>
          ))}
        </div>

        {tab === "apply" && (
          <div className="space-y-4">
            {/* Past applications list */}
            {applications.length > 0 && (
              <div className="card">
                <h2 className="font-bold mb-3">Application History</h2>
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app._id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={STATUS_BADGE[app.status] ?? "badge-pending"}>
                          {app.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {app.reason && (
                        <p className="text-sm text-gray-600 mt-1">{app.reason}</p>
                      )}
                      {app.hardshipWaiverRequested && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          Hardship waiver requested
                        </span>
                      )}
                      {app.onChainTxHash && (
                        <p className="text-xs mt-1">
                          On-chain: <EtherscanLink txHash={app.onChainTxHash} />
                        </p>
                      )}
                      {app.reviewedAt && (
                        <p className="text-xs text-gray-400">
                          Reviewed: {new Date(app.reviewedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New application toggle */}
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary text-sm"
              >
                + Submit New Application
              </button>
            ) : (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold">Apply for Zakat Assistance</h2>
                  {applications.length > 0 && (
                    <button
                      onClick={() => setShowForm(false)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <form onSubmit={handleApply} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Reason for Applying</label>
                    <textarea
                      rows={4}
                      value={form.reason}
                      onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                      className="input"
                      placeholder="Describe your hardship situation…"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Supporting Document (optional, max 5 MB)</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setFile(e.target.files[0])}
                      className="text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.hardshipWaiverRequested}
                      onChange={(e) => setForm((f) => ({ ...f, hardshipWaiverRequested: e.target.checked }))}
                    />
                    Request hardship waiver
                  </label>
                  <button type="submit" disabled={loading} className="btn-primary w-full">
                    {loading ? "Submitting…" : "Submit Application"}
                  </button>
                </form>
              </div>
            )}

            {applications.length === 0 && !showForm && (
              <p className="text-sm text-gray-400">No applications yet.</p>
            )}
          </div>
        )}

        {tab === "funds" && (
          <div className="card">
            <h2 className="font-bold mb-4">Received Funds</h2>
            {distributions.length === 0 ? (
              <p className="text-sm text-gray-400">No funds received yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b">
                      <th className="pb-2">ID</th>
                      <th className="pb-2">Amount</th>
                      <th className="pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {distributions.map((d) => (
                      <tr key={d.id.toString()}>
                        <td className="py-2 font-mono text-xs">{d.id.toString()}</td>
                        <td className="py-2">{formatEth(d.amount)}</td>
                        <td className="py-2 text-xs text-gray-500">
                          {new Date(Number(d.timestamp) * 1000).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </NetworkGuard>
  );
}
