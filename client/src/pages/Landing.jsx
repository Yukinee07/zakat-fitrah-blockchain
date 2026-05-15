import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Coins, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
        Zakat Fitrah Tracker
      </h1>
      <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
        A transparent, blockchain-powered platform for managing Zakat Fitrah
        donations — immutable, auditable, and privacy-first.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {[
          { icon: Coins,       title: "Donors",         desc: "Pay Zakat Fitrah in ETH and track your donations with full transparency." },
          { icon: ShieldCheck, title: "Admins",         desc: "Verify transactions, approve beneficiaries, and distribute collected funds." },
          { icon: Users,       title: "Beneficiaries",  desc: "Apply, get approved, and receive your share directly to your wallet." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card text-left">
            <Icon className="text-primary-600 mb-3" size={28} />
            <h3 className="font-bold text-gray-800 mb-1">{title}</h3>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/register" className="btn-primary px-8 py-3 text-base">
          Register
        </Link>
        <Link to="/connect" className="btn-secondary px-8 py-3 text-base">
          Connect Wallet
        </Link>
      </div>
    </div>
  );
}
