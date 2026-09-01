import React from 'react';
import { StatBox } from '../components/SharedComponents.jsx';

export function FinancialsView() {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatBox label="Monthly Revenue (MRR)" value="$142,500" icon="ph-trend-up" color="text-emerald-400" />
            <StatBox label="Paid Institutions" value="48 Schools" icon="ph-buildings" color="text-cyan-400" />
            <StatBox label="Avg Revenue / School" value="$2,968" icon="ph-chart-line-up" color="text-purple-400" />
            <StatBox label="Churn Rate" value="0.8%" icon="ph-chart-pie" color="text-amber-400" />
          </div>

          <div className="glass-panel p-8 text-center py-12">
            <i className="ph ph-receipt text-5xl text-emerald-400 mb-2"></i>
            <h3 className="text-lg font-bold text-white">Payment Gateway Webhook Sync Connected</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">Stripe & Razorpay live logs active. Automatic invoice generation and tier provisioning enabled.</p>
          </div>
        </div>
      );
    }

