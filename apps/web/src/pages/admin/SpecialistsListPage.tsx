import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  UserPlus,
  Pencil,
  Ban,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";

interface Specialist {
  id: string;
  full_name: string;
  professional_title: string | null;
  license_number: string | null;
  email: string;
  is_active: boolean;
  profile_photo_url: string | null;
  created_at: string;
  total_consultations: number;
}

const specialistSchema = z.object({
  full_name: z.string().min(1, "Requerido"),
  professional_title: z.string().optional(),
  license_number: z.string().optional(),
  email: z.string().email("Correo inválido"),
});

const editSpecialistSchema = z.object({
  full_name: z.string().min(1, "Requerido").optional(),
  professional_title: z.string().optional(),
  license_number: z.string().optional(),
  email: z.string().email("Correo inválido").optional(),
});

type SpecialistForm = z.infer<typeof specialistSchema>;
type EditSpecialistForm = z.infer<typeof editSpecialistSchema>;

export default function SpecialistsListPage() {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSpecialist, setEditingSpecialist] = useState<Specialist | null>(null);

  const createForm = useForm<SpecialistForm>({ resolver: zodResolver(specialistSchema) });
  const editForm = useForm<EditSpecialistForm>({ resolver: zodResolver(editSpecialistSchema) });

  const fetchSpecialists = async () => {
    try {
      const data = await apiFetch<Specialist[]>("/specialists");
      setSpecialists(data);
    } catch (err: any) {
      toast.error(err.error || "Error al cargar especialistas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecialists();
  }, []);

  const handleCreate = async (data: SpecialistForm) => {
    try {
      const res = await apiFetch<any>("/specialists", {
        method: "POST",
        body: JSON.stringify(data),
      });
      toast.success("Especialista creado. Se envió un correo de bienvenida.");
      setIsCreateModalOpen(false);
      createForm.reset();
      fetchSpecialists();
    } catch (err: any) {
      toast.error(err.error || "Error al crear especialista");
    }
  };

  const handleEdit = async (data: EditSpecialistForm) => {
    if (!editingSpecialist) return;
    try {
      await apiFetch(`/specialists/${editingSpecialist.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      toast.success("Especialista actualizado");
      setEditingSpecialist(null);
      editForm.reset();
      fetchSpecialists();
    } catch (err: any) {
      toast.error(err.error || "Error al actualizar");
    }
  };

  const toggleStatus = async (specialist: Specialist) => {
    const action = specialist.is_active ? "deactivate" : "reactivate";
    try {
      await apiFetch(`/specialists/${specialist.id}/${action}`, {
        method: "POST",
      });
      toast.success(`Especialista ${specialist.is_active ? "desactivado" : "reactivado"}`);
      fetchSpecialists();
    } catch (err: any) {
      toast.error(err.error || "Error al cambiar estado");
    }
  };

  const openEditModal = (specialist: Specialist) => {
    setEditingSpecialist(specialist);
    editForm.reset({
      full_name: specialist.full_name,
      professional_title: specialist.professional_title || "",
      license_number: specialist.license_number || "",
      email: specialist.email,
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Especialistas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Administra el equipo médico de la clínica
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
          <UserPlus size={16} />
          Nuevo Especialista
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Nombre</th>
                  <th className="px-6 py-4 font-medium">Título / Colegiatura</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium">Registro</th>
                  <th className="px-6 py-4 font-medium text-center">Consultas</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      Cargando especialistas...
                    </td>
                  </tr>
                ) : specialists.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No hay especialistas registrados.
                    </td>
                  </tr>
                ) : (
                  specialists.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-white">{s.full_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 dark:text-slate-200">{s.professional_title || "-"}</div>
                        <div className="text-xs text-slate-500">{s.license_number || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        {s.email}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            s.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {s.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold px-2.5 py-1 rounded-md text-xs">
                          {s.total_consultations}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(s)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors inline-block"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => toggleStatus(s)}
                          className={`p-1.5 transition-colors inline-block ${
                            s.is_active
                              ? "text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                              : "text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                          }`}
                          title={s.is_active ? "Desactivar" : "Reactivar"}
                        >
                          {s.is_active ? <Ban size={18} /> : <CheckCircle2 size={18} />}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Modal */}
      {isCreateModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>Nuevo Especialista</CardTitle>
              <CardDescription>
                Se enviará un correo con un enlace para establecer la contraseña.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                <Input
                  label="Nombre Completo"
                  {...createForm.register("full_name")}
                  error={createForm.formState.errors.full_name?.message}
                />
                <Input
                  label="Email"
                  type="email"
                  {...createForm.register("email")}
                  error={createForm.formState.errors.email?.message}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Título Profesional"
                    {...createForm.register("professional_title")}
                    error={createForm.formState.errors.professional_title?.message}
                  />
                  <Input
                    label="Nº Colegiación"
                    {...createForm.register("license_number")}
                    error={createForm.formState.errors.license_number?.message}
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" isLoading={createForm.formState.isSubmitting}>
                    Crear y Enviar Acceso
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {editingSpecialist && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>Editar Especialista</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
                <Input
                  label="Nombre Completo"
                  {...editForm.register("full_name")}
                  error={editForm.formState.errors.full_name?.message}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Título Profesional"
                    {...editForm.register("professional_title")}
                    error={editForm.formState.errors.professional_title?.message}
                  />
                  <Input
                    label="Nº Colegiación"
                    {...editForm.register("license_number")}
                    error={editForm.formState.errors.license_number?.message}
                  />
                </div>
                <Input
                  label="Email"
                  type="email"
                  {...editForm.register("email")}
                  error={editForm.formState.errors.email?.message}
                />
                <div className="flex justify-end gap-3 mt-6">
                  <Button type="button" variant="outline" onClick={() => setEditingSpecialist(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" isLoading={editForm.formState.isSubmitting}>
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
