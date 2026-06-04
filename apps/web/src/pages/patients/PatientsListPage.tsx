import React from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Users, PlusCircle, Search, ChevronRight, Phone, Archive, ArchiveRestore } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";

interface Patient {
  id: string;
  full_name: string;
  national_id: string;
  phone?: string;
  email?: string;
  date_of_birth: string;
  biological_sex: "MALE" | "FEMALE" | "OTHER";
  created_at: string;
}

interface PatientsResponse {
  data: Patient[];
  total: number;
  page: number;
  limit: number;
}

const SEX_LABEL: Record<string, string> = {
  MALE: "Masculino",
  FEMALE: "Femenino",
  OTHER: "Otro",
};

function calcAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
  ) {
    age--;
  }
  return age;
}

export default function PatientsListPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [showArchived, setShowArchived] = React.useState(false);
  const [restorePatientId, setRestorePatientId] = React.useState<string | null>(null);
  const limit = 20;

  const fetchPatients = React.useCallback(
    async (q: string, p: number, archived: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          search: q,
          page: String(p),
          limit: String(limit),
        });
        const endpoint = archived ? `/patients/archived` : `/patients`;
        const res = await apiFetch<PatientsResponse>(`${endpoint}?${params}`);
        setPatients(res.data);
        setTotal(res.total);
      } catch {
        toast.error("Error al cargar pacientes");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    const debounce = setTimeout(() => fetchPatients(search, page, showArchived), 300);
    return () => clearTimeout(debounce);
  }, [search, page, showArchived, fetchPatients]);

  const handleRestore = async () => {
    if (!restorePatientId) return;
    try {
      await apiFetch(`/patients/${restorePatientId}/unarchive`, { method: "PATCH" });
      toast.success("Paciente restaurado");
      fetchPatients(search, page, showArchived);
      setRestorePatientId(null);
    } catch (err: any) {
      toast.error(err.error || "Error al restaurar");
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="text-emerald-600" size={24} />
            Pacientes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {total} pacientes registrados {showArchived && "(Archivados)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button
              variant={showArchived ? "default" : "outline"}
              onClick={() => { setShowArchived(!showArchived); setPage(1); }}
              className={showArchived ? "bg-slate-800 hover:bg-slate-900 text-white border-transparent" : "text-slate-600 dark:text-slate-300"}
            >
              <Archive size={16} className="mr-2" />
              {showArchived ? "Ocultar archivados" : "Ver archivados"}
            </Button>
          )}
          <Link to="/patients/new">
            <Button
              id="new-patient-btn"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <PlusCircle size={16} className="mr-2" />
              Nuevo Paciente
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <Input
          id="patients-search"
          placeholder="Buscar por nombre o RUT..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700">
          <CardContent className="py-16 text-center">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="font-medium text-slate-600 dark:text-slate-400">
              {search ? "No se encontraron pacientes" : "Aún no hay pacientes registrados"}
            </p>
            {!search && (
              <Link to="/patients/new" className="inline-block mt-4">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <PlusCircle size={16} className="mr-2" />
                  Registrar primer paciente
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {patients.map((patient) => (
            <button
              key={patient.id}
              onClick={() => navigate(`/patients/${patient.id}`)}
              className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                  {patient.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {patient.full_name}
                    </p>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {SEX_LABEL[patient.biological_sex]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>{patient.national_id}</span>
                    <span>·</span>
                    <span>{calcAge(patient.date_of_birth)} años</span>
                    {patient.phone && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Phone size={10} />
                          {patient.phone}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {showArchived && isAdmin ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRestorePatientId(patient.id);
                    }}
                  >
                    <ArchiveRestore size={14} className="mr-2" />
                    Restaurar
                  </Button>
                ) : (
                  <ChevronRight
                    size={16}
                    className="text-slate-400 group-hover:text-emerald-600 transition-colors flex-shrink-0"
                  />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Restore Modal */}
      {restorePatientId && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setRestorePatientId(null)}>
          <Card className="w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Restaurar Paciente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">
                ¿Estás seguro de que deseas restaurar este paciente? Volverá a aparecer en las listas normales.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setRestorePatientId(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleRestore} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Restaurar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
    </div>
  );
}
