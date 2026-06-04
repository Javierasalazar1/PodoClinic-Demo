import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch } from "@/lib/api";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  X,
  Stethoscope,
  BellRing,
} from "lucide-react";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/patients", icon: Users, label: "Pacientes" },
  { to: "/consultations", icon: ClipboardList, label: "Consultas" },
  { to: "/reminders", icon: BellRing, label: "Recordatorios" },
  { to: "/settings", icon: Settings, label: "Configuración" },
];

export default function AppShell() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [clinic, setClinic] = React.useState<{ name: string; logo_url: string | null } | null>(null);

  React.useEffect(() => {
    const fetchClinic = () => {
      apiFetch<{ name: string; logo_url: string | null }>("/clinic").then(setClinic).catch(() => {});
    };

    fetchClinic();

    window.addEventListener("clinic-updated", fetchClinic);
    return () => window.removeEventListener("clinic-updated", fetchClinic);
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // silent
    } finally {
      clearAuth();
      navigate("/login");
      toast.success("Sesión cerrada correctamente");
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800 h-[76px]">
          {clinic?.logo_url ? (
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-white rounded-lg p-1">
              <img src={clinic.logo_url} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-600 flex-shrink-0">
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-tight truncate w-full" title={clinic?.name ?? "PodoClinic"}>
              {clinic?.name ?? "PodoClinic"}
            </p>
            <p className="text-slate-500 text-xs truncate w-full">Sistema Clínico</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )
              }
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
              {label}
            </NavLink>
          ))}
          {user?.role === "ADMIN" && (
            <NavLink
              to="/specialists"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )
              }
            >
              <Stethoscope className="w-4.5 h-4.5 flex-shrink-0" size={18} />
              Especialistas
            </NavLink>
          )}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 mt-2 mb-2 rounded-lg bg-slate-800/50">
            <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {user?.full_name}
              </p>
              <p className="text-slate-500 text-xs capitalize truncate">
                {user?.role === "ADMIN" ? "Administrador" : user?.role === "SPECIALIST" ? "Especialista" : "Recepción"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            id="logout-btn"
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-600 dark:text-slate-300"
            aria-label="Abrir menú"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-bold text-slate-800 dark:text-white">PodoClinic</span>
        </header>

        {/* Page outlet */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
