import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  ArrowLeft,
  Briefcase
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { taka, Alert } from "../components/ui";

const STATUS_BADGES = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200"
};

export default function CustomerBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentEmail = user?.email || "anonymous_customer";

  const loadServiceLogs = () => {
    // Strictly load THIS logged-in user's logs
    const userLogKey = `customer_service_logs_${currentEmail}`;
    const localUserLogs = JSON.parse(localStorage.getItem(userLogKey) || "[]");

    api.get(`/services/bookings/my?customer_id=${user?.id || ""}`)
      .then(({ data }) => {
        const serverList = Array.isArray(data) ? data : (data.items || []);
        // Match server bookings for this user if returned
        const userServerList = serverList.filter(
          (b) => !b.customer_email || b.customer_email === currentEmail
        );
        const combined = [...userServerList, ...localUserLogs];
        const unique = Array.from(
          new Map(combined.map((item) => [item.id || `${item.scheduled_date}_${item.scheduled_time}`, item])).values()
        );
        setBookings(unique);
      })
      .catch(() => {
        setBookings(localUserLogs);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    loadServiceLogs();
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 font-sans">
      <div className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Service Engagement Logs
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Service history for <span className="font-bold text-slate-800">{user?.full_name || currentEmail}</span>
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
          >
            <ArrowLeft size={14} className="text-slate-400" />
            <span>Find Services</span>
          </Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {error && bookings.length === 0 && (
          <div className="mb-6">
            <Alert kind="error">{error}</Alert>
          </div>
        )}

        {loading ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold text-slate-500">Loading your service logs...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
              <Briefcase size={22} />
            </div>
            <p className="text-sm font-bold text-slate-700">No service engagements recorded yet.</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You haven't booked any services with this account yet.
            </p>
            <Link
              to="/"
              className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
            >
              Book A Service Now
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((item) => {
              const statusClass = STATUS_BADGES[item.status?.toLowerCase()] || STATUS_BADGES.pending;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-slate-900 text-base">
                        {item.service_name || "Home Repair Service"}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border capitalize ${statusClass}`}>
                        {item.status || "Pending"}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-indigo-600">
                      Provided by: {item.provider_name || `Specialist #${item.provider_id || "Pro"}`}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        {item.scheduled_date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        {item.scheduled_time}
                      </span>
                      {item.address && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400" />
                          {item.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 flex sm:flex-col justify-between items-center sm:items-end">
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Total Charge</span>
                      <span className="text-lg font-black text-slate-900">
                        {taka(item.amount || item.total_price || 2000)}
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md mt-1 border border-emerald-100 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Verified Log
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
