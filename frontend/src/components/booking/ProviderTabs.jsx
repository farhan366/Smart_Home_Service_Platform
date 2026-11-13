import { NavLink } from "react-router-dom";
import { CalendarDays, ClipboardList, TrendingUp, UserCog } from "lucide-react";

const TABS = [
  { to: "/provider/jobs", label: "Requests & jobs", icon: ClipboardList },
  { to: "/provider/schedule", label: "Daily schedule", icon: CalendarDays },
  { to: "/provider/revenue", label: "Revenue", icon: TrendingUp },
  { to: "/provider/dashboard", label: "Profile", icon: UserCog },
];

export default function ProviderTabs() {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-lg bg-white p-1 ring-1 ring-line" aria-label="Technician workspace">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to}
          className={({ isActive }) => `inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? "bg-lagoon text-white" : "text-ink/70 hover:bg-lagoon-tint"}`}>
          <Icon size={16} /> {label}
        </NavLink>
      ))}
    </nav>
  );
}
