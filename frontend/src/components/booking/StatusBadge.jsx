const STYLES = {
  pending: ["Pending", "bg-amber-50 text-amber-800 border-amber-200"],
  quoted: ["Quote sent", "bg-sky-50 text-sky-800 border-sky-200"],
  confirmed: ["Confirmed", "bg-lagoon-tint text-lagoon-dark border-lagoon/30"],
  in_progress: ["In progress", "bg-violet-50 text-violet-800 border-violet-200"],
  completed: ["Completed", "bg-emerald-50 text-emerald-800 border-emerald-200"],
  cancelled: ["Cancelled", "bg-red-50 text-danger border-danger/30"],
  disputed: ["Disputed", "bg-orange-50 text-orange-800 border-orange-200"],
};

export const STATUS_LABEL = Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, v[0]]));

export default function StatusBadge({ status }) {
  const [label, cls] = STYLES[status] ?? [status, "bg-white text-ink border-line"];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
