import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ClipboardList, Search, PlusCircle, ChevronRight, Calendar } from "lucide-react";
import toast from "react-hot-toast";

interface Consultation {
  id: string;
  consultation_date: string;
  consultation_type: "FIRST_TIME" | "FOLLOW_UP" | "URGENT";
  status: "DRAFT" | "FINALIZED";
  chief_complaint?: string;
  patient: { id: string; full_name: string; national_id: string };
}

interface ConsultationsResponse {
  data: Consultation[];
  total: number;
  page: number;
}

const TYPE_LABEL: Record<string, string> = {
  FIRST_TIME: "Primera vez",
  FOLLOW_UP: "Seguimiento",
  URGENT: "Urgencia",
};

const TYPE_COLOR: Record<string, string> = {
  FIRST_TIME: "secondary",
  FOLLOW_UP: "default",
  URGENT: "destructive",
};

export default function ConsultationsListPage() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = React.useState<Consultation[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const limit = 20;

  const fetch = React.useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search: q, page: String(p), limit: String(limit) });
      const res = await apiFetch<ConsultationsResponse>(`/consultations?${params}`);
      setConsultations(res.data);
      setTotal(res.total);
    } catch {
      toast.error("Error al cargar consultas");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => fetch(search, page), 300);
    return () => clearTimeout(t);
  }, [search, page, fetch]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="text-emerald-600" size={24} />
            Consultas
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} consultas registradas</p>
        </div>
        <Link to="/consultations/new">
          <Button id="new-consultation-btn" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <PlusCircle size={16} className="mr-2" />
            Nueva Consulta
          </Button>
        </Link>
      </div>

      <div className="max-w-md">
        <Input
          id="consultations-search"
          placeholder="Buscar por paciente..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : consultations.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700">
          <CardContent className="py-16 text-center">
            <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="font-medium text-slate-600 dark:text-slate-400">
              {search ? "No se encontraron consultas" : "Sin consultas aún"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {consultations.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/consultations/${c.id}`)}
              className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <Calendar size={18} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{c.patient.full_name}</p>
                    <Badge variant={TYPE_COLOR[c.consultation_type] as "default" | "secondary" | "destructive"} className="text-xs">
                      {TYPE_LABEL[c.consultation_type]}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {new Date(c.consultation_date).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}
                    {c.chief_complaint && ` · ${c.chief_complaint.slice(0, 60)}...`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.status === "FINALIZED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                    {c.status === "FINALIZED" ? "Finalizada" : "Borrador"}
                  </span>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <span className="text-sm text-slate-600 dark:text-slate-400">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
        </div>
      )}
    </div>
  );
}
