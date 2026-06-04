import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import SignaturePad from "@/components/consultation/SignaturePad";
import PhotoUpload from "@/components/consultation/PhotoUpload";
import type { PhotoItem } from "@/components/consultation/PhotoUpload";

const STORAGE_KEY = "podoclinic_draft_consultation";
const AUTOSAVE_INTERVAL = 60_000;

const radioBoolean = z.preprocess((val) => {
  if (val === "true") return true;
  if (val === "false") return false;
  if (val === "") return undefined;
  return val;
}, z.boolean().optional());

const consultationSchema = z.object({
  patient_id: z.string().min(1, "Selecciona un paciente"),
  consultation_date: z.string().min(1, "Fecha requerida"),
  consultation_type: z.enum(["FIRST_TIME", "FOLLOW_UP", "URGENT"]),
  chief_complaint: z.string().max(500).optional(),
  // Section 1 - Podiatric history
  prev_consultations: radioBoolean,
  prev_consultations_desc: z.string().optional(),
  prev_pathologies: z.array(z.string()).optional(),
  prev_pathologies_other: z.string().optional(),
  prev_treatments: z.string().optional(),
  prev_orthotics: radioBoolean,
  // Section 2 - Medical history
  systemic_diseases: z.array(z.string()).optional(),
  systemic_diseases_other: z.string().optional(),
  allergies: z.string().optional(),
  current_medication: z.string().optional(),
  prev_foot_surgery: radioBoolean,
  prev_foot_surgery_desc: z.string().optional(),
  current_pregnancy: z.enum(["YES", "NO", "NA"]).optional(),
  // Section 3 - Lifestyle
  occupation: z.string().optional(),
  physical_activity: z.enum(["SEDENTARY", "MODERATE", "INTENSE"]).optional(),
  sport: z.string().optional(),
  footwear_types: z.array(z.string()).optional(),
  hours_standing: z.enum(["LT4", "4TO8", "GT8"]).optional(),
  // Section 4 - Clinical Examination
  dermatological_inspection: z.string().optional(),
  nail_status: z.string().optional(),
  skin_temperature_right: z.enum(["NORMAL", "INCREASED", "DECREASED"]).optional(),
  skin_temperature_left: z.enum(["NORMAL", "INCREASED", "DECREASED"]).optional(),
  edema: z.enum(["ABSENT", "PRESENT"]).optional(),
  edema_desc: z.string().optional(),
  structural_deformities: z.array(z.string()).optional(),
  pressure_zones: z.string().optional(),
  // Section 5 - Biomechanical Evaluation
  footprint_type_right: z.enum(["SUPINATOR", "NEUTRAL", "PRONATOR"]).optional(),
  footprint_type_left: z.enum(["SUPINATOR", "NEUTRAL", "PRONATOR"]).optional(),
  beighton_score: z.string().optional(),
  jack_test: z.enum(["NORMAL", "ALTERED"]).optional(),
  fick_angle: z.string().optional(),
  leg_length: z.enum(["SYMMETRIC", "ASYMMETRIC"]).optional(),
  leg_length_desc: z.string().optional(),
  calcaneal_angle: z.string().optional(),
  gait_observations: z.string().optional(),
  // Section 6 - Vascular and Neurological
  pedal_pulse_right: z.enum(["PRESENT", "DECREASED", "ABSENT"]).optional(),
  pedal_pulse_left: z.enum(["PRESENT", "DECREASED", "ABSENT"]).optional(),
  tibial_pulse_right: z.enum(["PRESENT", "DECREASED", "ABSENT"]).optional(),
  tibial_pulse_left: z.enum(["PRESENT", "DECREASED", "ABSENT"]).optional(),
  abi_index: z.string().optional(),
  sensitivity_test_right: z.enum(["NORMAL", "ALTERED"]).optional(),
  sensitivity_test_left: z.enum(["NORMAL", "ALTERED"]).optional(),
  vibratory_sensitivity: z.enum(["NORMAL", "ALTERED"]).optional(),
  achilles_reflex: z.enum(["PRESENT", "DECREASED", "ABSENT"]).optional(),
  temperature_eval: z.string().optional(),
  vascular_obs: z.string().optional(),
  // Section 8 - Treatment
  diagnosis: z.string().max(1000).optional(),
  treatment_objectives: z.string().optional(),
  procedures: z.array(z.string()).optional(),
  procedures_other: z.string().optional(),
  materials_used: z.string().optional(),
  next_session_plan: z.string().optional(),
  referrals: z.string().optional(),
  next_appointment: z.string().optional(),
  // Section 9 - Consent
  patient_signature_name: z.string().optional().or(z.literal("")),
  patient_signature_rut: z.string().optional().or(z.literal("")),
  signature_data_url: z.string().optional().or(z.literal("")),
  consent_accepted: z.boolean().refine(val => val === true, "Debe aceptar el consentimiento").optional(),
});

type ConsultationForm = z.infer<typeof consultationSchema>;

const PATHOLOGIES = [
  "Hallux valgus (juanete)",
  "Pie plano / cavo",
  "Onicocriptosis (uña incarnada)",
  "Verrugas plantares",
  "Micosis ungual / interdigital",
  "Metatarsalgia",
  "Fascitis plantar",
  "Neuroma de Morton",
];

const SYSTEMIC_DISEASES = [
  "Diabetes mellitus",
  "Hipertensión arterial",
  "Artritis reumatoide",
  "Gota",
  "Insuficiencia venosa / várices",
  "Neuropatía periférica",
  "Enfermedad renal crónica",
  "Psoriasis",
];

const FOOTWEAR = [
  "Zapatilla deportiva",
  "Zapato de tacón",
  "Zapato plano",
  "Sandalia",
  "Bota",
];

const PROCEDURES = [
  "Quiropodía / podología preventiva",
  "Tratamiento de onicomicosis",
  "Tratamiento de onicocriptosis",
  "Eliminación de hiperqueratosis",
  "Vendaje funcional",
  "Confección de plantilla / órtesis",
  "Aplicación de tópico / medicación",
];

const DEFORMITIES = [
  "Dedos en garra/martillo",
  "Hallux rigidus",
  "Sastrecillo (Bunionette)",
  "Espolón calcáneo",
];

const SECTIONS = [
  "Datos consulta",
  "Antec. podológicos",
  "Antec. médicos",
  "Estilo de vida",
  "Exploración clínica",
  "Biomecánica",
  "Vascular/Neurológico",
  "Fotografía",
  "Plan de tratamiento",
  "Consentimiento"
];

interface PatientOption { id: string; full_name: string; national_id: string; }

function CheckboxGroup({
  options,
  name,
  value = [],
  onChange,
}: {
  options: string[];
  name: string;
  value?: string[];
  onChange: (val: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name={name}
            value={opt}
            checked={value.includes(opt)}
            onChange={() => toggle(opt)}
            className="accent-emerald-600 w-4 h-4"
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

export default function ConsultationFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [section, setSection] = React.useState(0);
  const [patients, setPatients] = React.useState<PatientOption[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [draftId, setDraftId] = React.useState<string | null>(null);
  
  // Phase 2 state
  const [photos, setPhotos] = React.useState<PhotoItem[]>([]);
  const [patientSearch, setPatientSearch] = React.useState("");
  const [showPatientDropdown, setShowPatientDropdown] = React.useState(false);
  const [selectedPatientName, setSelectedPatientName] = React.useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ConsultationForm>({
    resolver: zodResolver(consultationSchema) as any,
    defaultValues: {
      consultation_date: new Date().toISOString().slice(0, 16),
      consultation_type: "FIRST_TIME",
      patient_id: searchParams.get("patient_id") ?? "",
      prev_pathologies: [],
      systemic_diseases: [],
      footwear_types: [],
      structural_deformities: [],
      procedures: [],
      patient_signature_name: "",
      patient_signature_rut: "",
      signature_data_url: "",
      consent_accepted: false,
    },
  });

  // Fetch patients dynamically as user types
  React.useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      apiFetch<{ data: PatientOption[] }>(`/patients?search=${encodeURIComponent(patientSearch)}&limit=15`)
        .then((r) => setPatients(r.data))
        .catch(() => {});
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [patientSearch]);

  // Load selected patient details to show full name
  const selectedPatientId = watch("patient_id");
  React.useEffect(() => {
    if (selectedPatientId) {
      apiFetch<any>(`/patients/${selectedPatientId}`)
        .then((p) => {
          setSelectedPatientName(`${p.full_name} — ${p.national_id}`);
        })
        .catch(() => {});
    } else {
      setSelectedPatientName("");
    }
  }, [selectedPatientId]);

  // Handle clicking outside the custom dropdown to close it
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#consultation-patient") && !target.closest(".patient-dropdown")) {
        setShowPatientDropdown(false);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Load existing consultation when ?edit=ID is present (editing a draft)
  React.useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;

    setDraftId(editId);
    apiFetch<any>(`/consultations/${editId}`)
      .then((c) => {
        // Restore base fields
        setValue("patient_id", c.patient_id || c.patient?.id || "");
        setValue("consultation_date", new Date(c.consultation_date).toISOString().slice(0, 16));
        setValue("consultation_type", c.consultation_type);
        if (c.chief_complaint) setValue("chief_complaint", c.chief_complaint);

        // Restore JSON sections
        const flatten = (obj: Record<string, any>) => {
          if (!obj) return;
          Object.entries(obj).forEach(([k, v]) => {
            if (v !== null && v !== undefined) setValue(k as keyof ConsultationForm, v as never);
          });
        };
        flatten(c.podiatric_history);
        flatten(c.medical_history);
        flatten(c.lifestyle);
        flatten(c.clinical_examination);
        flatten(c.biomechanical_evaluation);
        flatten(c.vascular_neurological);
        flatten(c.treatment_plan);

        // Restore photos
        if (c.photos) setPhotos(c.photos);

        // Restore consent & signature fields if they exist
        if (c.consent) {
          setValue("patient_signature_name", c.consent.patient_full_name || "");
          setValue("patient_signature_rut", c.consent.patient_national_id || "");
          setValue("signature_data_url", c.consent.signature_url || "");
          setValue("consent_accepted", !!c.consent.signature_url);
        }
      })
      .catch(() => toast.error("No se pudo cargar el borrador"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch draft photos if draftId set without edit param
  React.useEffect(() => {
    const editId = searchParams.get("edit");
    if (draftId && !editId) {
      apiFetch<{ photos: PhotoItem[] }>(`/consultations/${draftId}`)
        .then((r) => {
          if (r.photos) setPhotos(r.photos);
        })
        .catch(() => {});
    }
  }, [draftId]);

  // Restore localStorage draft (only when NOT editing an existing consultation)
  React.useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId) return; // Skip localStorage restore when editing a saved draft
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Partial<ConsultationForm>;
        const currentPatientId = getValues("patient_id");
        if (currentPatientId && saved.patient_id !== currentPatientId) {
          return; // Ignore draft for a different patient
        }
        Object.entries(saved).forEach(([k, v]) =>
          setValue(k as keyof ConsultationForm, v as never)
        );
      } catch { /* ignore */ }
    }
  }, [setValue, getValues, searchParams]);

  // Autosave to localStorage every 60s
  React.useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getValues()));
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [getValues]);

  const saveDraft = async (): Promise<string | null> => {
    const data = getValues();
    if (!data.patient_id) {
      toast.error("Seleccione un paciente antes de guardar");
      return null;
    }
    setSaving(true);
    try {
      const payload = {
        patient_id: data.patient_id,
        consultation_date: data.consultation_date,
        consultation_type: data.consultation_type,
        chief_complaint: data.chief_complaint,
        podiatric_history: {
          prev_consultations: data.prev_consultations,
          prev_consultations_desc: data.prev_consultations_desc,
          prev_pathologies: data.prev_pathologies,
          prev_pathologies_other: data.prev_pathologies_other,
          prev_treatments: data.prev_treatments,
          prev_orthotics: data.prev_orthotics,
        },
        medical_history: {
          systemic_diseases: data.systemic_diseases,
          systemic_diseases_other: data.systemic_diseases_other,
          allergies: data.allergies,
          current_medication: data.current_medication,
          prev_foot_surgery: data.prev_foot_surgery,
          prev_foot_surgery_desc: data.prev_foot_surgery_desc,
          current_pregnancy: data.current_pregnancy,
        },
        lifestyle: {
          occupation: data.occupation,
          physical_activity: data.physical_activity,
          sport: data.sport,
          footwear_types: data.footwear_types,
          hours_standing: data.hours_standing,
        },
        clinical_examination: {
          dermatological_inspection: data.dermatological_inspection,
          nail_status: data.nail_status,
          skin_temperature_right: data.skin_temperature_right,
          skin_temperature_left: data.skin_temperature_left,
          edema: data.edema,
          edema_desc: data.edema_desc,
          structural_deformities: data.structural_deformities,
          pressure_zones: data.pressure_zones,
        },
        biomechanical_evaluation: {
          footprint_type_right: data.footprint_type_right,
          footprint_type_left: data.footprint_type_left,
          beighton_score: data.beighton_score,
          jack_test: data.jack_test,
          fick_angle: data.fick_angle,
          leg_length: data.leg_length,
          leg_length_desc: data.leg_length_desc,
          calcaneal_angle: data.calcaneal_angle,
          gait_observations: data.gait_observations,
        },
        vascular_neurological: {
          pedal_pulse_right: data.pedal_pulse_right,
          pedal_pulse_left: data.pedal_pulse_left,
          tibial_pulse_right: data.tibial_pulse_right,
          tibial_pulse_left: data.tibial_pulse_left,
          abi_index: data.abi_index,
          sensitivity_test_right: data.sensitivity_test_right,
          sensitivity_test_left: data.sensitivity_test_left,
          vibratory_sensitivity: data.vibratory_sensitivity,
          achilles_reflex: data.achilles_reflex,
          temperature_eval: data.temperature_eval,
          vascular_obs: data.vascular_obs,
        },
        treatment_plan: {
          diagnosis: data.diagnosis,
          treatment_objectives: data.treatment_objectives,
          procedures: data.procedures,
          procedures_other: data.procedures_other,
          materials_used: data.materials_used,
          next_session_plan: data.next_session_plan,
          referrals: data.referrals,
          next_appointment: data.next_appointment,
        },
      };

      if (draftId) {
        await apiFetch(`/consultations/${draftId}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Borrador guardado");
        return draftId;
      } else {
        const res = await apiFetch<{ id: string }>("/consultations", { method: "POST", body: JSON.stringify(payload) });
        setDraftId(res.id);
        toast.success("Borrador creado");
        return res.id;
      }
    } catch (e: any) {
      // Mostrar el error más detallado posible
      let msg = e?.error || "Error al guardar borrador";
      if (e?.details) {
        const fieldErrors = Object.entries(e.details.fieldErrors || {})
          .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
          .join(" | ");
        if (fieldErrors) msg += ` (${fieldErrors})`;
      }
      toast.error(msg);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (_data: ConsultationForm) => {
    // Read all values directly (including those set via setValue without register)
    const data = getValues();

    // 1. Ensure draft is saved with all text data
    const activeDraftId = await saveDraft();
    if (!activeDraftId) return;

    // 2. Validate consent fields individually for clear error messages
    if (!data.consent_accepted) {
      toast.error("Falta aceptar la casilla de consentimiento informado");
      setSection(9);
      return;
    }
    if (!data.signature_data_url) {
      toast.error("Falta dibujar la firma digital");
      setSection(9);
      return;
    }
    if (!data.patient_signature_name) {
      toast.error("Falta el nombre de quien firma");
      setSection(9);
      return;
    }
    if (!data.patient_signature_rut) {
      toast.error("Falta el RUT de quien firma");
      setSection(9);
      return;
    }

    try {
      await apiFetch(`/consultations/${activeDraftId}/consent`, {
        method: "POST",
        body: JSON.stringify({
          patient_signature_name: data.patient_signature_name,
          patient_signature_rut: data.patient_signature_rut,
          signature_data_url: data.signature_data_url,
          consent_accepted: data.consent_accepted,
        }),
      });

      // 3. Finalize consultation
      await apiFetch(`/consultations/${activeDraftId}/finalize`, { method: "POST" });
      
      toast.success("Consulta finalizada correctamente");
      navigate(`/consultations/${activeDraftId}`);
      localStorage.removeItem(STORAGE_KEY);
    } catch (e: any) {
      toast.error(e?.error || "Error al finalizar consulta. Asegúrate de tener guardada la firma.");
    }
  };

  const onError = (errors: any) => {
    console.error("Form validation errors:", errors);
    toast.error("Hay errores en el formulario. Faltan campos requeridos.", { duration: 5000 });
    
    if (errors.patient_id || errors.consultation_date || errors.consultation_type) {
      setSection(0);
    } else if (errors.patient_signature_name || errors.patient_signature_rut || errors.signature_data_url || errors.consent_accepted) {
      setSection(9);
    }
  };

  const prevConsultations = watch("prev_consultations");
  const prevFootSurgery = watch("prev_foot_surgery");
  const edema = watch("edema");

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-700 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nueva Consulta</h1>
          <p className="text-slate-500 text-sm">Sección {section + 1} de {SECTIONS.length}: {SECTIONS[section]}</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {SECTIONS.map((s, i) => (
          <div key={s} className="flex-1 flex flex-col items-center gap-1 cursor-pointer" onClick={() => setSection(i)}>
            <div
              className={`h-1.5 w-full rounded-full transition-colors ${i <= section ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
            />
            <span className={`text-[10px] hidden sm:block truncate w-full text-center ${i <= section ? "text-slate-700 dark:text-slate-300 font-medium" : "text-slate-400"}`}>{s}</span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit, onError)} id="consultation-form">
        <div className={section === 0 ? "block" : "hidden"}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-slate-700 dark:text-slate-300">Datos de la Consulta</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Controller
                name="patient_id"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-1.5 w-full relative">
                    <label htmlFor="consultation-patient" className="text-sm font-medium text-foreground">
                      Paciente <span className="text-destructive ml-1">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="consultation-patient"
                        type="text"
                        placeholder="Buscar paciente por nombre o RUT..."
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={showPatientDropdown ? patientSearch : (selectedPatientName || patientSearch)}
                        onChange={(e) => {
                          setPatientSearch(e.target.value);
                          setShowPatientDropdown(true);
                          if (!e.target.value) {
                            field.onChange("");
                            setSelectedPatientName("");
                          }
                        }}
                        onFocus={() => setShowPatientDropdown(true)}
                        disabled={!!searchParams.get("edit")} // Lock patient when editing
                      />
                      {field.value && !searchParams.get("edit") && (
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                          onClick={() => {
                            field.onChange("");
                            setSelectedPatientName("");
                            setPatientSearch("");
                          }}
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    {showPatientDropdown && (
                      <div className="absolute top-[100%] left-0 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto mt-1 patient-dropdown">
                        {patients.length > 0 ? (
                          patients.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-800"
                              onClick={() => {
                                field.onChange(p.id);
                                setSelectedPatientName(`${p.full_name} — ${p.national_id}`);
                                setPatientSearch("");
                                setShowPatientDropdown(false);
                              }}
                            >
                              <p className="font-medium text-slate-900 dark:text-white">{p.full_name}</p>
                              <p className="text-xs text-slate-500">{p.national_id}</p>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-sm text-slate-500 text-center">
                            No se encontraron pacientes.
                          </div>
                        )}
                      </div>
                    )}
                    {errors.patient_id && (
                      <p className="text-xs text-destructive">{errors.patient_id.message}</p>
                    )}
                  </div>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input id="consultation-date" label="Fecha y hora" type="datetime-local" required error={errors.consultation_date?.message} {...register("consultation_date")} />
                <Select
                  id="consultation-type"
                  label="Tipo de consulta"
                  required
                  options={[
                    { value: "FIRST_TIME", label: "Primera vez" },
                    { value: "FOLLOW_UP", label: "Seguimiento" },
                    { value: "URGENT", label: "Urgencia" },
                  ]}
                  error={errors.consultation_type?.message}
                  {...register("consultation_type")}
                />
              </div>
              <Textarea id="consultation-complaint" label="Motivo de consulta" placeholder="Describe el motivo principal de la consulta..." {...register("chief_complaint")} />
              <p className="text-xs text-slate-400">Especialista: <span className="font-medium text-slate-600 dark:text-slate-300">{user?.full_name}</span></p>
            </CardContent>
          </Card>
        </div>

        <div className={section === 1 ? "block" : "hidden"}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-slate-700 dark:text-slate-300">Antecedentes Podológicos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Consultas podológicas previas</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" value="true" {...register("prev_consultations", { setValueAs: (v) => v === "true" })} className="accent-emerald-600" /> Sí
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" value="false" {...register("prev_consultations", { setValueAs: (v) => v === "true" })} className="accent-emerald-600" /> No
                  </label>
                </div>
              </div>
              {prevConsultations && (
                <Textarea label="Descripción" placeholder="Detalle las consultas previas..." {...register("prev_consultations_desc")} />
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Patologías podológicas previas</label>
                <CheckboxGroup
                  options={PATHOLOGIES}
                  name="prev_pathologies"
                  value={watch("prev_pathologies") ?? []}
                  onChange={(v) => setValue("prev_pathologies", v)}
                />
                <Input placeholder="Otro (especificar)" {...register("prev_pathologies_other")} />
              </div>
              <Textarea label="Tratamientos podológicos previos" placeholder="Describe los tratamientos anteriores..." {...register("prev_treatments")} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Uso previo de plantillas ortopédicas</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" value="true" {...register("prev_orthotics", { setValueAs: (v) => v === "true" })} className="accent-emerald-600" /> Sí</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" value="false" {...register("prev_orthotics", { setValueAs: (v) => v === "true" })} className="accent-emerald-600" /> No</label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className={section === 2 ? "block" : "hidden"}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-slate-700 dark:text-slate-300">Antecedentes Médicos Generales</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Enfermedades sistémicas</label>
                <CheckboxGroup options={SYSTEMIC_DISEASES} name="systemic_diseases" value={watch("systemic_diseases") ?? []} onChange={(v) => setValue("systemic_diseases", v)} />
                <Input placeholder="Otra (especificar)" {...register("systemic_diseases_other")} />
              </div>
              <Textarea label="Alergias conocidas" placeholder="Látex, medicamentos, apósitos..." {...register("allergies")} />
              <Textarea label="Medicación actual" placeholder="Lista de medicamentos actuales..." {...register("current_medication")} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Cirugías previas en pie o tobillo</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" value="true" {...register("prev_foot_surgery", { setValueAs: (v) => v === "true" })} className="accent-emerald-600" /> Sí</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" value="false" {...register("prev_foot_surgery", { setValueAs: (v) => v === "true" })} className="accent-emerald-600" /> No</label>
                </div>
                {prevFootSurgery && <Textarea placeholder="Descripción de la cirugía..." {...register("prev_foot_surgery_desc")} />}
              </div>
              <Select
                id="pregnancy"
                label="Embarazo actual"
                options={[
                  { value: "YES", label: "Sí" },
                  { value: "NO", label: "No" },
                  { value: "NA", label: "No aplica" },
                ]}
                {...register("current_pregnancy")}
              />
            </CardContent>
          </Card>
        </div>

        <div className={section === 3 ? "block" : "hidden"}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-slate-700 dark:text-slate-300">Estilo de Vida y Hábitos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Ocupación o actividad laboral" placeholder="Ej: Enfermera, Docente..." {...register("occupation")} />
              <Select
                id="physical-activity"
                label="Actividad física"
                options={[
                  { value: "SEDENTARY", label: "Sedentario" },
                  { value: "MODERATE", label: "Moderada (1-3 días/semana)" },
                  { value: "INTENSE", label: "Intensa (4+ días/semana)" },
                ]}
                {...register("physical_activity")}
              />
              <Input label="Deporte practicado" placeholder="Fútbol, natación, ciclismo..." {...register("sport")} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Tipo de calzado habitual</label>
                <CheckboxGroup options={FOOTWEAR} name="footwear_types" value={watch("footwear_types") ?? []} onChange={(v) => setValue("footwear_types", v)} />
              </div>
              <Select
                id="hours-standing"
                label="Horas promedio de pie al día"
                options={[
                  { value: "LT4", label: "Menos de 4h" },
                  { value: "4TO8", label: "4 a 8h" },
                  { value: "GT8", label: "Más de 8h" },
                ]}
                {...register("hours_standing")}
              />
            </CardContent>
          </Card>
        </div>

        <div className={section === 4 ? "block" : "hidden"}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-slate-700 dark:text-slate-300">Exploración Clínica</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea label="Inspección dermatológica" placeholder="Estado de la piel..." {...register("dermatological_inspection")} />
              <Textarea label="Estado de las uñas" placeholder="Onicomicosis, onicocriptosis, etc..." {...register("nail_status")} />
              
              <div className="grid grid-cols-2 gap-4">
                <Select label="Temperatura cutánea (Der)" options={[{value:"NORMAL", label:"Normal"}, {value:"INCREASED", label:"Aumentada"}, {value:"DECREASED", label:"Disminuida"}]} {...register("skin_temperature_right")} />
                <Select label="Temperatura cutánea (Izq)" options={[{value:"NORMAL", label:"Normal"}, {value:"INCREASED", label:"Aumentada"}, {value:"DECREASED", label:"Disminuida"}]} {...register("skin_temperature_left")} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Edema</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" value="PRESENT" {...register("edema")} className="accent-emerald-600" /> Presente</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" value="ABSENT" {...register("edema")} className="accent-emerald-600" /> Ausente</label>
                </div>
                {edema === "PRESENT" && <Input placeholder="Descripción del edema..." {...register("edema_desc")} />}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Deformidades estructurales</label>
                <CheckboxGroup options={DEFORMITIES} name="structural_deformities" value={watch("structural_deformities") ?? []} onChange={(v) => setValue("structural_deformities", v)} />
              </div>

              <Textarea label="Zonas de presión o carga anómala" placeholder="Hiperqueratosis, helomas..." {...register("pressure_zones")} />
            </CardContent>
          </Card>
        </div>

        <div className={section === 5 ? "block" : "hidden"}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-slate-700 dark:text-slate-300">Evaluación Biomecánica</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select label="Tipo de pisada (Der)" options={[{value:"NEUTRAL", label:"Neutra"}, {value:"SUPINATOR", label:"Supinadora"}, {value:"PRONATOR", label:"Pronadora"}]} {...register("footprint_type_right")} />
                <Select label="Tipo de pisada (Izq)" options={[{value:"NEUTRAL", label:"Neutra"}, {value:"SUPINATOR", label:"Supinadora"}, {value:"PRONATOR", label:"Pronadora"}]} {...register("footprint_type_left")} />
              </div>
              
              <Input label="Índice de Beighton (0-9)" type="number" min="0" max="9" {...register("beighton_score")} />
              
              <Select label="Test de Jack" options={[{value:"NORMAL", label:"Normal"}, {value:"ALTERED", label:"Alterado"}]} {...register("jack_test")} />
              
              <Input label="Ángulo de Fick" placeholder="Valor numérico o descripción" {...register("fick_angle")} />
              
              <div className="grid grid-cols-2 gap-4">
                <Select label="Longitud miembros" options={[{value:"SYMMETRIC", label:"Simétrica"}, {value:"ASYMMETRIC", label:"Asimetría"}]} {...register("leg_length")} />
                <Input label="Descripción (si asimétrico)" {...register("leg_length_desc")} />
              </div>

              <Input label="Ángulo inclinación calcáneo" placeholder="Varo / valgo..." {...register("calcaneal_angle")} />
              <Textarea label="Observaciones de la marcha" placeholder="Describa el ciclo de marcha..." {...register("gait_observations")} />
            </CardContent>
          </Card>
        </div>

        <div className={section === 6 ? "block" : "hidden"}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-slate-700 dark:text-slate-300">Vascular y Neurológico</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select label="Pulso pedio (Der)" options={[{value:"PRESENT", label:"Presente"}, {value:"DECREASED", label:"Disminuido"}, {value:"ABSENT", label:"Ausente"}]} {...register("pedal_pulse_right")} />
                <Select label="Pulso pedio (Izq)" options={[{value:"PRESENT", label:"Presente"}, {value:"DECREASED", label:"Disminuido"}, {value:"ABSENT", label:"Ausente"}]} {...register("pedal_pulse_left")} />
                <Select label="Pulso tibial post (Der)" options={[{value:"PRESENT", label:"Presente"}, {value:"DECREASED", label:"Disminuido"}, {value:"ABSENT", label:"Ausente"}]} {...register("tibial_pulse_right")} />
                <Select label="Pulso tibial post (Izq)" options={[{value:"PRESENT", label:"Presente"}, {value:"DECREASED", label:"Disminuido"}, {value:"ABSENT", label:"Ausente"}]} {...register("tibial_pulse_left")} />
              </div>

              <Input label="Índice Tobillo-Brazo (ITB)" {...register("abi_index")} />

              <div className="grid grid-cols-2 gap-4">
                <Select label="Test sensibilidad (Der)" options={[{value:"NORMAL", label:"Normal"}, {value:"ALTERED", label:"Alterado"}]} {...register("sensitivity_test_right")} />
                <Select label="Test sensibilidad (Izq)" options={[{value:"NORMAL", label:"Normal"}, {value:"ALTERED", label:"Alterado"}]} {...register("sensitivity_test_left")} />
              </div>

              <Select label="Sensibilidad vibratoria (Diapasón)" options={[{value:"NORMAL", label:"Normal"}, {value:"ALTERED", label:"Alterado"}]} {...register("vibratory_sensitivity")} />
              <Select label="Reflejo aquíleo" options={[{value:"PRESENT", label:"Presente"}, {value:"DECREASED", label:"Disminuido"}, {value:"ABSENT", label:"Ausente"}]} {...register("achilles_reflex")} />
              
              <Textarea label="Observaciones vascular/neurológicas" {...register("vascular_obs")} />
            </CardContent>
          </Card>
        </div>

        <div className={section === 7 ? "block" : "hidden"}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-slate-700 dark:text-slate-300">Fotografía Clínica</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <PhotoUpload 
                consultationId={draftId} 
                photos={photos} 
                onPhotosChange={setPhotos} 
                disabled={!draftId}
              />
              {!draftId && (
                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 p-3 rounded-lg text-sm flex gap-2 items-center">
                  Por favor guarda el borrador primero para habilitar la subida de fotografías.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className={section === 8 ? "block" : "hidden"}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-slate-700 dark:text-slate-300">Plan de Tratamiento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea label="Diagnóstico podológico" placeholder="Describe el diagnóstico..." {...register("diagnosis")} />
              <Textarea label="Objetivos del tratamiento" placeholder="Metas a corto y largo plazo..." {...register("treatment_objectives")} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Procedimientos realizados</label>
                <CheckboxGroup options={PROCEDURES} name="procedures" value={watch("procedures") ?? []} onChange={(v) => setValue("procedures", v)} />
                <Input placeholder="Otro (especificar)" {...register("procedures_other")} />
              </div>
              <Textarea label="Materiales o productos utilizados" placeholder="Describe materiales usados..." {...register("materials_used")} />
              <Textarea label="Plan para próxima sesión" placeholder="Indica qué se hará en la próxima consulta..." {...register("next_session_plan")} />
              <Textarea label="Derivaciones" placeholder="Médico, traumatólogo, angiólogo..." {...register("referrals")} />
              <Input id="next-appointment" label="Fecha sugerida próxima consulta" type="date" {...register("next_appointment")} />
            </CardContent>
          </Card>
        </div>

        <div className={section === 9 ? "block" : "hidden"}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-slate-700 dark:text-slate-300">Consentimiento y Firma</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 max-h-48 overflow-y-auto text-sm text-slate-600 dark:text-slate-400">
                Al firmar este documento, otorgo mi consentimiento libre, previo e informado para que el especialista en podología de esta clínica evalúe, diagnostique y aplique el plan de tratamiento correspondiente. 
                Comprendo los procedimientos, posibles riesgos y alternativas explicados por el profesional.
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nombre de quien firma" required error={errors.patient_signature_name?.message} {...register("patient_signature_name")} />
                <Input label="RUT / Identificación" required error={errors.patient_signature_rut?.message} {...register("patient_signature_rut")} />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Firma digital</label>
                <Controller
                  control={control}
                  name="signature_data_url"
                  render={({ field: { onChange, value } }) => (
                    <SignaturePad 
                      onSave={onChange} 
                      existingDataUrl={value || ""}
                      isActive={section === 9}
                    />
                  )}
                />
                {errors.signature_data_url && <span className="text-xs text-red-500">{errors.signature_data_url.message}</span>}
              </div>

              <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
                <input type="checkbox" className="w-5 h-5 accent-emerald-600 rounded" {...register("consent_accepted")} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">He leído y acepto el consentimiento informado</span>
              </label>
              {errors.consent_accepted && <span className="text-xs text-red-500">{errors.consent_accepted.message}</span>}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between gap-3 mt-4">
          <Button type="button" variant="outline" onClick={() => setSection((s) => Math.max(0, s - 1))} disabled={section === 0}>
            <ChevronLeft size={16} /> Anterior
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={saveDraft} isLoading={saving} id="save-draft-btn">
              <Save size={16} className="mr-1" /> Guardar borrador
            </Button>
            {section < SECTIONS.length - 1 ? (
              <Button type="button" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setSection((s) => s + 1)}>
                Siguiente <ChevronRight size={16} />
              </Button>
            ) : (
              <Button id="submit-consultation-btn" type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white" isLoading={isSubmitting}>
                Finalizar Consulta
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
