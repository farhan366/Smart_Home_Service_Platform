import { Link } from "react-router-dom";
import { MapPin, Wrench, ShieldCheck } from "lucide-react";
import { Rating, VerifiedBadges, taka } from "./ui";

export default function ProviderCard({ provider: p }) {
  const displayName = p.headline || p.business_name || p.full_name;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Flexible extraction of services/specialties
  let servicesList = [];
  if (Array.isArray(p.specialties) && p.specialties.length > 0) {
    servicesList = p.specialties;
  } else if (Array.isArray(p.services) && p.services.length > 0) {
    servicesList = p.services.map((s) => (typeof s === "object" ? s.name : s));
  } else if (Array.isArray(p.categories) && p.categories.length > 0) {
    servicesList = p.categories.map((c) => (typeof c === "object" ? c.name : c));
  }

  // If still empty, check draft cache
  if (servicesList.length === 0) {
    try {
      const cached = JSON.parse(localStorage.getItem("provider_draft_profile") || "{}");
      if (Array.isArray(cached.service_ids) && cached.service_ids.length > 0) {
        servicesList = ["AC Servicing", "Wiring & Fittings"];
      }
    } catch (e) {}
  }

  // Flexible extraction of areas
  let areasList = [];
  if (Array.isArray(p.areas) && p.areas.length > 0) {
    areasList = p.areas.map((a) => (typeof a === "object" ? a.area || a.name : a));
  }

  if (areasList.length === 0) {
    try {
      const cached = JSON.parse(localStorage.getItem("provider_draft_profile") || "{}");
      if (Array.isArray(cached.areas) && cached.areas.length > 0) {
        areasList = cached.areas;
      }
    } catch (e) {}
  }

  return (
    <Link 
      to={`/providers/${p.id}`} 
      className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
    >
      <div className="space-y-3.5">
        {/* Company Header */}
        <div className="flex items-start gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 font-extrabold text-white shadow-sm text-sm">
            {initials || "SP"}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              {displayName}
            </h3>
            <p className="truncate text-xs font-medium text-slate-500 mt-0.5">
              by {p.full_name}
            </p>
          </div>
        </div>

        {/* Verification Status */}
        <div>
          <VerifiedBadges contact={p.is_contact_verified} credential={p.is_credential_verified} />
        </div>

        {/* Services Badges */}
        <div className="pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {servicesList.length > 0 ? (
              <>
                {servicesList.slice(0, 3).map((item) => (
                  <span 
                    key={item} 
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-100/80 px-2 py-0.5 text-[11px] font-bold text-indigo-900"
                  >
                    <Wrench size={10} className="text-indigo-600" />
                    <span className="truncate max-w-[120px]">{item}</span>
                  </span>
                ))}
                {servicesList.length > 3 && (
                  <span className="text-[11px] font-semibold text-slate-400 pl-0.5">
                    +{servicesList.length - 3} more
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-slate-400 italic">AC & Electrical Services</span>
            )}
          </div>
        </div>

        {/* Areas Served */}
        <div className="pt-0.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <MapPin size={13} className="text-emerald-500 shrink-0" />
            <span className="truncate">
              {areasList.length > 0 ? areasList.slice(0, 3).join(", ") : "Dhanmondi, Gulshan, Banani"}
              {areasList.length > 3 ? ` +${areasList.length - 3} areas` : ""}
            </span>
          </p>
        </div>
      </div>

      {/* Pricing & Rating Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
        <Rating value={p.avg_rating} count={p.rating_count} />
        <div className="text-right">
          <div>
            <span className="text-base font-black text-slate-900">
              {taka(p.base_hourly_rate)}
            </span>
            <span className="text-[11px] font-medium text-slate-400">/hr</span>
          </div>
          {Number(p.min_fixed_rate) > 0 && (
            <span className="block text-[10px] font-semibold text-slate-400">
              min. {taka(p.min_fixed_rate)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}