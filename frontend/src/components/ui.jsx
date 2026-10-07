import { BadgeCheck, PhoneCall, Star } from "lucide-react";

export function Rating({ value, count }) {
  const v = Number(value);
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star size={15} className={v > 0 ? "fill-marigold text-marigold" : "text-line"} />
      <span className="font-semibold">{v > 0 ? v.toFixed(1) : "New"}</span>
      {count > 0 && <span className="text-ink/50">({count})</span>}
    </span>
  );
}

export function VerifiedBadges({ contact, credential }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {credential && (
        <span className="inline-flex items-center gap-1 rounded-full bg-marigold-tint px-2 py-0.5 text-xs font-semibold text-ink">
          <BadgeCheck size={13} className="text-lagoon" /> Credentials verified
        </span>
      )}
      {contact && (
        <span className="inline-flex items-center gap-1 rounded-full bg-lagoon-tint px-2 py-0.5 text-xs font-semibold text-lagoon-dark">
          <PhoneCall size={12} /> Contact verified
        </span>
      )}
    </span>
  );
}

export const taka = (v) => `৳${Number(v).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;

export function Alert({ kind = "error", children }) {
  if (!children) return null;
  const style = kind === "error" ? "border-danger/30 bg-red-50 text-danger" : "border-lagoon/30 bg-lagoon-tint text-lagoon-dark";
  return <div role="alert" className={`rounded-lg border px-3 py-2 text-sm ${style}`}>{children}</div>;
}
