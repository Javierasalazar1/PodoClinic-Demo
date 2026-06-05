import React from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  PlusCircle,
  ClipboardList,
  Calendar,
  Archive,
  Edit2,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { RutInput, PhoneInput, LettersInput } from "@/components/ui/MaskedInputs";

const patientSchema = z.object({
  national_id: z.string().min(1, "Identificación obligatoria"),
  full_name: z.string().min(2, "Nombre demasiado corto"),
  date_of_birth: z.string().min(1, "Fecha de nacimiento obligatoria"),
  biological_sex: z.enum(["MALE", "FEMALE", "OTHER"]),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
});

type PatientForm = z.infer<typeof patientSchema>;

interface Patient {
  id: string;
  full_name: string;
  national_id: string;
  date_of_birth: string;
  biological_sex: "MALE" | "FEMALE" | "OTHER";
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at: string;
}

interface ConsultationSummary {
  id: string;
  consultation_date: string;
  consultation_type: "FIRST_TIME" | "FOLLOW_UP" | "URGENT";
  status: "DRAFT" | "FINALIZED";
  chief_complaint?: string;
}

const SEX_LABEL: Record<string, string> = {
  MALE: "Masculino",
  FEMALE: "Femenino",
  OTHER: "Otro",
};

const TYPE_LABEL: Record<string, string> = {
  FIRST_TIME: "Primera vez",
  FOLLOW_UP: "Seguimiento",
  URGENT: "Urgencia",
};

function calcAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
  )
    age--;
  return age;
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";
  const [patient, setPatient] = React.useState<Patient | null>(null);
  const [consultations, setConsultations] = React.useState<ConsultationSummary[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [showArchiveModal, setShowArchiveModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
  });

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await apiFetch(`/patients/${patient!.id}/archive`, { method: "PATCH" });
      toast.success("Paciente archivado");
      setShowArchiveModal(false);
      navigate("/patients");
    } catch (err: any) {
      toast.error(err.error || "Error al archivar paciente");
    } finally {
      setArchiving(false);
    }
  };

  const handleEdit = async (data: PatientForm) => {
    try {
      const updated = await apiFetch<Patient>(`/patients/${patient!.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      toast.success("Paciente actualizado correctamente");
      setPatient(updated);
      setShowEditModal(false);
    } catch (err: any) {
      toast.error(err.error || "Error al actualizar paciente");
    }
  };

  React.useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch<Patient>(`/patients/${id}`),
      apiFetch<ConsultationSummary[]>(`/patients/${id}/consultations`),
    ])
      .then(([p, c]) => {
        setPatient(p);
        setConsultations(c);
      })
      .catch(() => toast.error("Error al cargar el paciente"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <p className="text-slate-600">Paciente no encontrado</p>
        <Button onClick={() => navigate("/patients")} className="mt-4">Volver</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/patients")}
          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">
            {patient.full_name}
          </h1>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-slate-500 text-sm">{patient.national_id}</span>
            <Badge variant="secondary">{SEX_LABEL[patient.biological_sex]}</Badge>
            <span className="text-slate-500 text-sm">
              {calcAge(patient.date_of_birth)} años
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            onClick={() => {
              reset({
                national_id: patient.national_id,
                full_name: patient.full_name,
                date_of_birth: patient.date_of_birth ? patient.date_of_birth.split("T")[0] : "",
                biological_sex: patient.biological_sex,
                gender: patient.gender || "",
                phone: patient.phone || "",
                email: patient.email || "",
                address: patient.address || "",
                emergency_contact_name: patient.emergency_contact_name || "",
                emergency_contact_phone: patient.emergency_contact_phone || "",
              });
              setShowEditModal(true);
            }}
          >
            <Edit2 size={16} className="mr-1.5" />
            Editar
          </Button>

          {isAdmin && (
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30"
              onClick={() => setShowArchiveModal(true)}
            >
              <Archive size={16} className="mr-1.5" />
              Archivar
            </Button>
          )}

          <Link to={`/consultations/new?patient_id=${patient.id}`}>
            <Button
              id="new-consultation-from-patient"
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
            >
              <PlusCircle size={16} className="mr-1.5" />
              Nueva Consulta
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info column */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Datos personales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Fecha de nacimiento</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {new Date(patient.date_of_birth).toLocaleDateString("es-CL")}
                </p>
              </div>
              {patient.gender && (
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Género</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{patient.gender}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500 dark:text-slate-400">Registrado el</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {new Date(patient.created_at).toLocaleDateString("es-CL")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {patient.phone && (
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Phone size={14} className="text-emerald-600 flex-shrink-0" />
                  {patient.phone}
                </div>
              )}
              {patient.email && (
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Mail size={14} className="text-emerald-600 flex-shrink-0" />
                  {patient.email}
                </div>
              )}
              {patient.address && (
                <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <MapPin size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  {patient.address}
                </div>
              )}
              {!patient.phone && !patient.email && !patient.address && (
                <p className="text-slate-400">Sin datos de contacto</p>
              )}
            </CardContent>
          </Card>

          {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Emergencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {patient.emergency_contact_name && (
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {patient.emergency_contact_name}
                  </p>
                )}
                {patient.emergency_contact_phone && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Phone size={13} className="text-emerald-600" />
                    {patient.emergency_contact_phone}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Consultations column */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                <ClipboardList size={18} className="text-emerald-600" />
                Historial de Consultas
              </CardTitle>
              <span className="text-sm text-slate-500">{consultations.length} consultas</span>
            </CardHeader>
            <CardContent>
              {consultations.length === 0 ? (
                <div className="text-center py-10">
                  <ClipboardList className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    No hay consultas para este paciente
                  </p>
                  <Link to={`/consultations/new?patient_id=${patient.id}`}>
                    <Button
                      size="sm"
                      className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Crear primera consulta
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {consultations.map((c) => (
                    <Link
                      key={c.id}
                      to={`/consultations/${c.id}`}
                      className="flex items-center gap-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-6 px-6 transition-colors"
                    >
                      <Calendar size={15} className="text-emerald-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {new Date(c.consultation_date).toLocaleDateString("es-CL", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {TYPE_LABEL[c.consultation_type]}
                          {c.chief_complaint && ` · ${c.chief_complaint}`}
                        </p>
                      </div>
                      <Badge
                        variant={c.status === "FINALIZED" ? "success" : "secondary"}
                      >
                        {c.status === "FINALIZED" ? "Finalizada" : "Borrador"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      {showArchiveModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <AlertCircle size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">¿Archivar paciente?</CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Esta acción ocultará al paciente de las listas activas</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                El paciente <strong className="text-slate-800 dark:text-slate-100">{patient.full_name}</strong> será archivado. 
                Sus historiales clínicos e información se conservarán, pero no aparecerá en las búsquedas cotidianas.
                Puedes reactivarlo en cualquier momento desde la sección de pacientes archivados.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="outline" onClick={() => setShowArchiveModal(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="button" 
                  className="bg-red-600 hover:bg-red-700 text-white" 
                  onClick={handleArchive}
                  isLoading={archiving}
                >
                  Archivar Paciente
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      {/* Edit Patient Modal */}
      {showEditModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 my-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Editar Información del Paciente</CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">Actualiza los datos personales y de contacto</p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={20} />
              </button>
            </CardHeader>
            <CardContent className="max-h-[70vh] overflow-y-auto pr-2">
              <form onSubmit={handleSubmit(handleEdit)} className="space-y-5">
                {/* Identificación */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b pb-1">Identificación</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Controller
                      control={control}
                      name="national_id"
                      render={({ field }) => (
                        <RutInput
                          id="edit-patient-national-id"
                          label="RUT / Identificación"
                          required
                          error={errors.national_id?.message}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="full_name"
                      render={({ field }) => (
                        <LettersInput
                          id="edit-patient-full-name"
                          label="Nombre completo"
                          placeholder="María González López"
                          required
                          error={errors.full_name?.message}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <Input
                          id="edit-patient-dob"
                          label="Fecha de nacimiento"
                          type="date"
                          required
                          error={errors.date_of_birth?.message}
                          {...field}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="biological_sex"
                      render={({ field }) => (
                        <Select
                          id="edit-patient-sex"
                          label="Sexo biológico"
                          required
                          options={[
                            { value: "FEMALE", label: "Femenino" },
                            { value: "MALE", label: "Masculino" },
                            { value: "OTHER", label: "Otro" },
                          ]}
                          error={errors.biological_sex?.message}
                          {...field}
                        />
                      )}
                    />
                    <div className="sm:col-span-2">
                      <Controller
                        control={control}
                        name="gender"
                        render={({ field }) => (
                          <Input
                            id="edit-patient-gender"
                            label="Género (opcional)"
                            placeholder="Identidad de género"
                            {...field}
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Contacto */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b pb-1">Contacto</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Controller
                      control={control}
                      name="phone"
                      render={({ field }) => (
                        <PhoneInput
                          id="edit-patient-phone"
                          label="Teléfono"
                          error={errors.phone?.message}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="email"
                      render={({ field }) => (
                        <Input
                          id="edit-patient-email"
                          label="Correo electrónico"
                          type="email"
                          placeholder="paciente@email.com"
                          error={errors.email?.message}
                          {...field}
                        />
                      )}
                    />
                    <div className="sm:col-span-2">
                      <Controller
                        control={control}
                        name="address"
                        render={({ field }) => (
                          <Input
                            id="edit-patient-address"
                            label="Dirección"
                            placeholder="Av. Providencia 123, Santiago"
                            {...field}
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Emergencia */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b pb-1">Contacto de emergencia</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Controller
                      control={control}
                      name="emergency_contact_name"
                      render={({ field }) => (
                        <LettersInput
                          id="edit-patient-emergency-name"
                          label="Nombre contacto"
                          placeholder="Juan González"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="emergency_contact_phone"
                      render={({ field }) => (
                        <PhoneInput
                          id="edit-patient-emergency-phone"
                          label="Teléfono contacto"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    id="update-patient-btn"
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    isLoading={isSubmitting}
                  >
                    Guardar Cambios
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
    </div>
  );
}
