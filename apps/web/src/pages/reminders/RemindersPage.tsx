import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { BellRing, CheckCircle, MessageSquare, Mail, CalendarPlus, Filter, Phone, X } from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

interface ReminderPatient {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  next_visit_date: string;
  last_reminder_sent_at?: string;
  last_specialist: string;
}

export default function RemindersPage() {
  const [patients, setPatients] = useState<ReminderPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"7" | "15" | "30" | "overdue">("7");
  const [clinicName, setClinicName] = useState("PodoClinic");

  // Modals state
  const [whatsappPatient, setWhatsappPatient] = useState<ReminderPatient | null>(null);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const [emailPatient, setEmailPatient] = useState<ReminderPatient | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    apiFetch<{ name: string }>("/clinic").then(res => setClinicName(res.name)).catch(() => {});
  }, []);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const endpoint = filter === "overdue" ? `/reminders/overdue` : `/reminders?range=${filter}`;
      const data = await apiFetch<ReminderPatient[]>(endpoint);
      setPatients(data);
    } catch {
      toast.error("Error al cargar recordatorios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleMarkContacted = async (patientId: string) => {
    try {
      await apiFetch(`/reminders/${patientId}/mark-contacted`, { method: "PATCH" });
      toast.success("Marcado como contactado");
      fetchReminders();
    } catch {
      toast.error("Error al marcar");
    }
  };

  const handleSendWhatsApp = (patient: ReminderPatient) => {
    const formattedDate = new Date(patient.next_visit_date).toLocaleDateString("es-CL");
    const defaultMsg = `Hola ${patient.full_name}, le recordamos que tiene una cita sugerida en ${clinicName} para el ${formattedDate}. Para confirmar o agendar su hora exacta, por favor respóndanos este mensaje o llámenos al teléfono de la clínica.`;
    setWhatsappPatient(patient);
    setWhatsappMessage(defaultMsg);
  };

  const handleConfirmSendWhatsApp = async () => {
    if (!whatsappPatient) return;
    setSendingWhatsapp(true);
    try {
      const res = await apiFetch<{ url: string }>(`/reminders/${whatsappPatient.id}/send-whatsapp`, {
        method: "POST",
        body: JSON.stringify({ message: whatsappMessage })
      });
      window.open(res.url, "_blank");
      toast.success("Enlace de WhatsApp abierto");
      setWhatsappPatient(null);
      fetchReminders(); 
    } catch {
      toast.error("Error al preparar WhatsApp");
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const handleSendEmail = (patient: ReminderPatient) => {
    const formattedDate = new Date(patient.next_visit_date).toLocaleDateString("es-CL");
    const defaultMsg = `Hola ${patient.full_name},\n\nLe recordamos que tiene una cita sugerida en ${clinicName} alrededor del ${formattedDate}.\n\nPara confirmar su hora, por favor contáctenos.\n\nSaludos,\nEl equipo de ${clinicName}`;
    setEmailPatient(patient);
    setEmailSubject("Recordatorio de su próxima consulta");
    setEmailMessage(defaultMsg);
  };

  const handleConfirmSendEmail = async () => {
    if (!emailPatient) return;
    setSendingEmail(true);
    try {
      await apiFetch(`/reminders/${emailPatient.id}/send-email`, {
        method: "POST",
        body: JSON.stringify({ subject: emailSubject, message: emailMessage })
      });
      toast.success("Correo enviado");
      setEmailPatient(null);
      fetchReminders();
    } catch {
      toast.error("Error al enviar correo");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BellRing className="text-emerald-600" size={24} />
            Recordatorios
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Gestión de pacientes con próximas visitas sugeridas
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800 rounded-lg">
          <Filter size={16} className="text-slate-400 ml-2" />
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value as any)}
            className="bg-transparent border-none text-sm outline-none px-2 py-1 cursor-pointer dark:text-slate-200"
          >
            <option value="7">Próximos 7 días</option>
            <option value="15">Próximos 15 días</option>
            <option value="30">Próximos 30 días</option>
            <option value="overdue">Vencidos</option>
          </select>
        </div>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium">Paciente</th>
                <th className="px-6 py-4 font-medium">Próxima Visita Sugerida</th>
                <th className="px-6 py-4 font-medium">Último Especialista</th>
                <th className="px-6 py-4 font-medium">Último Aviso</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    Cargando recordatorios...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    No hay pacientes que requieran recordatorio en este periodo.
                  </td>
                </tr>
              ) : (
                patients.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">{p.full_name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        {p.phone && <span className="flex items-center gap-1"><Phone size={10} /> {p.phone}</span>}
                        {p.email && <span className="flex items-center gap-1"><Mail size={10} /> {p.email}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={filter === "overdue" ? "destructive" : "secondary"}>
                        {new Date(p.next_visit_date).toLocaleDateString("es-CL")}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {p.last_specialist}
                    </td>
                    <td className="px-6 py-4">
                      {p.last_reminder_sent_at ? (
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1">
                          <CheckCircle size={12} />
                          {new Date(p.last_reminder_sent_at).toLocaleDateString("es-CL")}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">Sin contactar</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.phone && (
                          <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200 hover:bg-green-50 dark:border-green-900/50 dark:hover:bg-green-900/20" onClick={() => handleSendWhatsApp(p)} title="Enviar WhatsApp">
                            <MessageSquare size={14} />
                          </Button>
                        )}
                        {p.email && (
                          <Button size="sm" variant="outline" className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900/50 dark:hover:bg-blue-900/20" onClick={() => handleSendEmail(p)} title="Enviar Correo">
                            <Mail size={14} />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-8 text-slate-600" onClick={() => handleMarkContacted(p.id)} title="Marcar como contactado">
                          <CheckCircle size={14} />
                        </Button>
                        <Link to={`/consultations/new?patient_id=${p.id}`}>
                          <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" title="Agendar Consulta">
                            <CalendarPlus size={14} />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* WhatsApp Reminder Modal */}
      {whatsappPatient && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="text-green-500" size={20} />
                Enviar Recordatorio (WhatsApp)
              </h2>
              <button
                onClick={() => setWhatsappPatient(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Se abrirá WhatsApp Web o la App con un mensaje preparado para el paciente <strong className="text-slate-700 dark:text-slate-200">{whatsappPatient.full_name}</strong>.
            </p>

            <Textarea
              label="Mensaje de WhatsApp"
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              rows={5}
              className="w-full text-slate-800 dark:text-slate-100"
            />

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setWhatsappPatient(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleConfirmSendWhatsApp}
                isLoading={sendingWhatsapp}
                disabled={!whatsappMessage.trim()}
              >
                <MessageSquare size={14} className="mr-1.5" />
                Enviar a WhatsApp
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Email Reminder Modal */}
      {emailPatient && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="text-blue-500" size={20} />
                Enviar Recordatorio (Correo)
              </h2>
              <button
                onClick={() => setEmailPatient(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Se enviará un correo electrónico directamente al paciente <strong className="text-slate-700 dark:text-slate-200">{emailPatient.full_name}</strong> ({emailPatient.email}).
            </p>

            <div className="space-y-3">
              <Input
                label="Asunto del correo"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full text-slate-800 dark:text-slate-100"
              />

              <Textarea
                label="Mensaje del correo"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={6}
                className="w-full text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEmailPatient(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleConfirmSendEmail}
                isLoading={sendingEmail}
                disabled={!emailSubject.trim() || !emailMessage.trim()}
              >
                <Mail size={14} className="mr-1.5" />
                Enviar Correo
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
