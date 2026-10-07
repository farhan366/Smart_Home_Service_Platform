import { Link, NavLink, useNavigate } from "react-router-dom";
import { Home, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const linkClass = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? "bg-lagoon-tint text-lagoon-dark" : "text-ink/70 hover:text-ink"}`;

export default function Navbar() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-line bg-white">
      <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
        <Link to="/" className="mr-4 flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lagoon text-white"><Home size={18} /></span>
          Smart Home Services
        </Link>
        <NavLink to="/" end className={linkClass}>Find a pro</NavLink>
        {hasRole("customer") && <NavLink to="/account/addresses" className={linkClass}>My addresses</NavLink>}
        {hasRole("provider") && <NavLink to="/provider/dashboard" className={linkClass}>My profile</NavLink>}
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-ink/70 sm:inline">{user.full_name}</span>
              <button className="btn-ghost" onClick={() => { logout(); navigate("/"); }}>
                <LogOut size={16} /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">Sign in</Link>
              <Link to="/register" className="btn-primary">Create account</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
