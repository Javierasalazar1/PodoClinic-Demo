import React from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch } from "@/lib/api";
import {
  Users,
  ClipboardList,
  PlusCircle,
  TrendingUp,
  Calendar,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Stats {
  totalPatients: number;
  totalConsultations: number;
  consultationsThisMonth: number;
  recentConsultations: Array<{
    id: string;
    patient_name: string;
    consultation_date: string;
    status: string;
    consultation_type: string;
  }>;
}

const CONSULTATION_TYPE_LABEL: Record<string, string> = {
  FIRST_TIME: "Primera vez",
  FOLLOW_UP: "Seguimiento",
  URGENT: "Urgencia",
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiFetch<Stats>("/stats/dashboard")
      .then(setStats)
      .catch(() => {
        // Use empty state if endpoint not ready
        setStats({
          totalPatients: 0,
          totalConsultations: 0,
          consultationsThisMonth: 0,
          recentConsultations: [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      label: "Total Pacientes",
      value: stats?.totalPatients ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Total Consultas",
      value: stats?.totalConsultations ?? 0,
      icon: ClipboardList,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "Consultas Este Mes",
      value: stats?.consultationsThisMonth ?? 0,
      icon: TrendingUp,
      color: "text-violet-600",
      bg: "bg-violet-50 dark:bg-violet-900/20",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            ¡Bienvenid@, {user?.full_name?.split(" ")[0]}! 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString("es-CL", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/patients/new">
            <Button
              id="dashboard-new-patient-btn"
              variant="outline"
              className="gap-2"
            >
              <Users size={16} />
              Nuevo Paciente
            </Button>
          </Link>
          <Link to="/consultations/new">
            <Button
              id="dashboard-new-consultation-btn"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <PlusCircle size={16} />
              Nueva Consulta
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-slate-200 dark:border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${bg}`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {loading ? (
                      <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
                    ) : (
                      value
                    )}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Consultations */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-slate-800 dark:text-white flex items-center gap-2">
            <Activity size={18} className="text-emerald-600" />
            Consultas Recientes
          </CardTitle>
          <Link
            to="/consultations"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Ver todas →
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : stats?.recentConsultations.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                Aún no hay consultas registradas
              </p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                Crea tu primera consulta para comenzar
              </p>
              <Link to="/consultations/new" className="inline-block mt-4">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <PlusCircle size={16} className="mr-2" />
                  Nueva Consulta
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {stats?.recentConsultations.map((c) => (
                <Link
                  key={c.id}
                  to={`/consultations/${c.id}`}
                  className="flex items-center gap-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-6 px-6 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                    <Calendar size={16} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {c.patient_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {CONSULTATION_TYPE_LABEL[c.consultation_type] ?? c.consultation_type} •{" "}
                      {new Date(c.consultation_date).toLocaleDateString("es-CL")}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      c.status === "FINALIZED"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {c.status === "FINALIZED" ? "Finalizada" : "Borrador"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
