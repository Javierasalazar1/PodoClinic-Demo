import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { UserPlus, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { RutInput, PhoneInput, LettersInput } from "@/components/ui/MaskedInputs";
import { apiFetch } from "@/lib/api";

/** Advertencia visual si no parece un RUT chileno (no bloquea) */
function looksLikeRut(val: string): boolean {
  const clean = val.replace(/[.\-]/g, "").toUpperCase();
  return /^\d{7,8}[0-9K]$/.test(clean);
}

const patientSchema = z.object({
  // Acepta cualquier identificación: RUT, pasaporte, cédula extranjera, etc.
  national_id: z
    .string()
    .min(1, "Identificación obligatoria"),
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

interface PatientResponse {
  id: string;
}

export default function PatientFormPage() {
  const navigate = useNavigate();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: { biological_sex: "FEMALE" },
  });

  const watchedId = watch("national_id") ?? "";

  const onSubmit = async (data: PatientForm) => {
    try {
      const res = await apiFetch<PatientResponse>("/patients", {
        method: "POST",
        body: JSON.stringify(data),
      });
      toast.success("Paciente registrado correctamente");
      navigate(`/patients/${res.id}`);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      toast.error(apiErr.error ?? "Error al registrar paciente");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          aria-label="Volver"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserPlus className="text-emerald-600" size={22} />
            Nuevo Paciente
          </h1>
          <p className="text-slate-500 text-sm">
            Completa los datos del paciente
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} id="patient-form" className="space-y-5">
        {/* Identificación */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">
              Identificación
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Controller
              control={control}
              name="national_id"
              render={({ field }) => (
                <RutInput
                  id="patient-national-id"
                  label="RUT / Identificación"
                  required
                  error={errors.national_id?.message}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              )}
            />
            {/* Advertencia suave si no parece RUT chileno */}
            {watchedId && !looksLikeRut(watchedId) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 -mt-2 col-span-2">
                ⚠️ Formato no reconocido como RUT chileno. Si es otro tipo de ID, puede continuar.
              </p>
            )}
            <Controller
              control={control}
              name="full_name"
              render={({ field }) => (
                <LettersInput
                  id="patient-full-name"
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
                  id="patient-dob"
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
                  id="patient-sex"
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
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Input
                  id="patient-gender"
                  label="Género (opcional)"
                  placeholder="Identidad de género"
                  {...field}
                />
              )}
            />
          </CardContent>
        </Card>

        {/* Contacto */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">
              Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  id="patient-phone"
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
                  id="patient-email"
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
                    id="patient-address"
                    label="Dirección"
                    placeholder="Av. Providencia 123, Santiago"
                    {...field}
                  />
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Emergencia */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">
              Contacto de emergencia
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Controller
              control={control}
              name="emergency_contact_name"
              render={({ field }) => (
                <LettersInput
                  id="patient-emergency-name"
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
                  id="patient-emergency-phone"
                  label="Teléfono contacto"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              )}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </Button>
          <Button
            id="save-patient-btn"
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            isLoading={isSubmitting}
          >
            Guardar Paciente
          </Button>
        </div>
      </form>
    </div>
  );
}
