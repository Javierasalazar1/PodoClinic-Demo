import React from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";
import { ChevronLeft, FileText, Download, AlertCircle, Calendar, User, Camera, ShieldCheck, Mail, X, MessageCircle, Share2, ExternalLink, Trash2 } from "lucide-react";
import Lightbox from "@/components/consultation/Lightbox";

interface Consultation {
  id: string;
  consultation_date: string;
  consultation_type: "FIRST_TIME" | "FOLLOW_UP" | "URGENT";
  status: "DRAFT" | "FINALIZED";
  chief_complaint?: string;
  podiatric_history?: Record<string, unknown>;
  medical_history?: Record<string, unknown>;
  lifestyle?: Record<string, unknown>;
  clinical_examination?: Record<string, unknown>;
  biomechanical_evaluation?: Record<string, unknown>;
  vascular_neurological?: Record<string, unknown>;
  treatment_plan?: Record<string, unknown>;
  report_pdf_url?: string;
  patient: { id: string; full_name: string; national_id: string; email?: string };
  specialist: { full_name: string; professional_title?: string };
  photos?: { id: string; url: string; label: string }[];
  consent?: { patient_full_name: string; patient_national_id: string; signed_at: string; signature_url: string };
}

const TYPE_LABEL: Record<string, string> = {
  FIRST_TIME: "Primera vez",
  FOLLOW_UP: "Seguimiento",
  URGENT: "Urgencia",
};

const FIELD_LABELS: Record<string, string> = {
  prev_consultations: "Consultas previas",
  prev_consultations_desc: "Descripción consultas previas",
  prev_pathologies: "Patologías previas",
  prev_pathologies_other: "Otras patologías",
  prev_treatments: "Tratamientos previos",
  prev_orthotics: "Uso de plantillas",
  systemic_diseases: "Enfermedades sistémicas",
  systemic_diseases_other: "Otras enf. sistémicas",
  allergies: "Alergias",
  current_medication: "Medicación actual",
  prev_foot_surgery: "Cirugía previa de pie",
  prev_foot_surgery_desc: "Desc. cirugía previa",
  current_pregnancy: "Embarazo actual",
  occupation: "Ocupación",
  physical_activity: "Actividad física",
  sport: "Deporte",
  footwear_types: "Tipos de calzado",
  hours_standing: "Horas de pie",
  dermatological_inspection: "Inspección dermatológica",
  nail_status: "Estado de uñas",
  skin_temperature_right: "Temp. piel (Derecha)",
  skin_temperature_left: "Temp. piel (Izquierda)",
  edema: "Edema",
  edema_desc: "Descripción edema",
  structural_deformities: "Deformidades estructurales",
  pressure_zones: "Zonas de presión",
  footprint_type_right: "Tipo pisada (Derecha)",
  footprint_type_left: "Tipo pisada (Izquierda)",
  beighton_score: "Índice de Beighton",
  jack_test: "Test de Jack",
  fick_angle: "Ángulo de Fick",
  leg_length: "Longitud miembros",
  leg_length_desc: "Desc. longitud miembros",
  calcaneal_angle: "Ángulo calcáneo",
  gait_observations: "Observaciones de marcha",
  pedal_pulse_right: "Pulso pedio (Derecho)",
  pedal_pulse_left: "Pulso pedio (Izquierdo)",
  tibial_pulse_right: "Pulso tibial (Derecho)",
  tibial_pulse_left: "Pulso tibial (Izquierdo)",
  abi_index: "Índice tobillo-brazo",
  sensitivity_test_right: "Test sensibilidad (Derecha)",
  sensitivity_test_left: "Test sensibilidad (Izquierda)",
  vibratory_sensitivity: "Sensibilidad vibratoria",
  achilles_reflex: "Reflejo aquíleo",
  temperature_eval: "Eval. temperatura",
  vascular_obs: "Observaciones vasculares",
  diagnosis: "Diagnóstico",
  treatment_objectives: "Objetivos tratamiento",
  procedures: "Procedimientos",
  procedures_other: "Otros procedimientos",
  materials_used: "Materiales utilizados",
  next_session_plan: "Plan próxima sesión",
  referrals: "Derivaciones",
  next_appointment: "Próxima cita",
};

const VALUE_LABELS: Record<string, string> = {
  YES: "Sí",
  NO: "No",
  NA: "No aplica",
  SEDENTARY: "Sedentario",
  MODERATE: "Moderada",
  INTENSE: "Intensa",
  LT4: "Menos de 4h",
  "4TO8": "4 a 8h",
  GT8: "Más de 8h",
  NORMAL: "Normal",
  INCREASED: "Aumentada",
  DECREASED: "Disminuida",
  ABSENT: "Ausente",
  PRESENT: "Presente",
  SUPINATOR: "Supinadora",
  NEUTRAL: "Neutra",
  PRONATOR: "Pronadora",
  ALTERED: "Alterado",
  SYMMETRIC: "Simétrica",
  ASYMMETRIC: "Asimetría",
  "true": "Sí",
  "false": "No"
};

function formatValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) {
    return v.map(item => VALUE_LABELS[String(item)] || String(item)).join(", ");
  }
  return VALUE_LABELS[String(v)] || String(v);
}

function JsonSection({ title, data }: { title: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => {
    if (v === null || v === undefined || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
  if (entries.length === 0) return null;
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader><CardTitle className="text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wider">{title}</CardTitle></CardHeader>
      <CardContent>
        <dl className="space-y-2">
          {entries.map(([k, v]) => (
            <div key={k} className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:w-48 flex-shrink-0">
                {FIELD_LABELS[k] || k.replace(/_/g, " ")}
              </dt>
              <dd className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                {formatValue(v)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export default function ConsultationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [consultation, setConsultation] = React.useState<Consultation | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generatingPdf, setGeneratingPdf] = React.useState(false);
  const [showEmailModal, setShowEmailModal] = React.useState(false);
  const [emailTo, setEmailTo] = React.useState("");
  const [sendingEmail, setSendingEmail] = React.useState(false);
  const [etherealPreviewUrl, setEtherealPreviewUrl] = React.useState<string | null>(null);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [generatingShare, setGeneratingShare] = React.useState(false);
  const [shareData, setShareData] = React.useState<{ share_url: string; whatsapp_url: string } | null>(null);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleDownloadPhoto = async (photo: { id: string; url: string; label: string }) => {
    try {
      const res = await apiFetch<{ url: string }>(`/consultations/${id}/photos/${photo.id}/download-url`);
      const imgRes = await fetch(res.url);
      const blob = await imgRes.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const safeName = consultation?.patient.full_name.replace(/\s+/g, "_") || "paciente";
      const safeLabel = (photo.label || "foto").replace(/\s+/g, "_");
      const dateStr = new Date(consultation!.consultation_date).toISOString().split("T")[0];
      link.download = `${safeName}_${safeLabel}_${dateStr}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success("Descarga iniciada");
    } catch {
      toast.error("Error al descargar la imagen");
    }
  };

  React.useEffect(() => {
    if (!id) return;
    apiFetch<Consultation>(`/consultations/${id}`)
      .then((c) => {
        setConsultation(c);
        setEmailTo(c.patient.email ?? "");
      })
      .catch(() => toast.error("Error al cargar la consulta"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleGeneratePdf = async () => {
    if (!id) return;
    setGeneratingPdf(true);
    try {
      const res = await apiFetch<{ url: string }>(`/consultations/${id}/generate-pdf`, { method: "POST" });
      window.open(res.url, "_blank");
      toast.success("PDF generado correctamente");
      setConsultation((prev) => prev ? { ...prev, report_pdf_url: res.url } : prev);
    } catch {
      toast.error("Error al generar el PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    if (!id || !emailTo) return;
    setSendingEmail(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string; preview_url?: string; pdf_url?: string }>(
        `/consultations/${id}/send-email`,
        { method: "POST", body: JSON.stringify({ to_email: emailTo }) }
      );
      toast.success(res.message || "Correo enviado correctamente");
      // Actualizar el PDF URL local si fue generado en el envío
      if (res.pdf_url) {
        setConsultation((prev) => prev ? { ...prev, report_pdf_url: res.pdf_url } : prev);
      }
      // Guardar preview URL de Ethereal para mostrarlo persistentemente
      if (res.preview_url) {
        setEtherealPreviewUrl(res.preview_url);
      }
      setShowEmailModal(false);
    } catch (e: any) {
      toast.error(e.error || "Error al enviar el correo");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!id) return;
    setGeneratingShare(true);
    try {
      const res = await apiFetch<{ share_url: string; whatsapp_url: string; pdf_url?: string }>(
        `/consultations/${id}/share-link`,
        { method: "POST" }
      );
      if (res.pdf_url) {
        setConsultation((prev) => prev ? { ...prev, report_pdf_url: res.pdf_url } : prev);
      }
      setShareData({ share_url: res.share_url, whatsapp_url: res.whatsapp_url });
      setShowShareModal(true);
    } catch {
      toast.error("Error al generar el enlace de compartir");
    } finally {
      setGeneratingShare(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await apiFetch(`/consultations/${id}`, { method: "DELETE" });
      toast.success("Consulta eliminada correctamente");
      setShowDeleteModal(false);
      navigate(-1);
    } catch (err: any) {
      toast.error(err.error || "Error al eliminar la consulta");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <p className="text-slate-600">Consulta no encontrada</p>
        <Button onClick={() => navigate("/consultations")} className="mt-4">Volver</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mt-1">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Consulta Clínica</h1>
            <Badge variant={consultation.status === "FINALIZED" ? "success" : "secondary"}>
              {consultation.status === "FINALIZED" ? "Finalizada" : "Borrador"}
            </Badge>
            <Badge variant={consultation.consultation_type === "URGENT" ? "destructive" : "outline"}>
              {TYPE_LABEL[consultation.consultation_type]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              {new Date(consultation.consultation_date).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="flex items-center gap-1">
              <User size={13} />
              <Link to={`/patients/${consultation.patient.id}`} className="text-emerald-600 hover:underline">
                {consultation.patient.full_name}
              </Link>
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          {consultation.status === "DRAFT" && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 size={14} className="mr-1" />
                Eliminar
              </Button>
              <Link to={`/consultations/new?edit=${consultation.id}`}>
                <Button variant="outline" size="sm">Editar</Button>
              </Link>
            </>
          )}
          <Button
            id="generate-pdf-btn"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleGeneratePdf}
            isLoading={generatingPdf}
          >
            <FileText size={14} className="mr-1" />
            {consultation.report_pdf_url ? "Regenerar PDF" : "Generar PDF"}
          </Button>
          {consultation.report_pdf_url && (
            <a href={consultation.report_pdf_url} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">
                <Download size={14} className="mr-1" />
                Descargar
              </Button>
            </a>
          )}
          <Button
            id="send-email-btn"
            size="sm"
            variant="outline"
            onClick={() => setShowEmailModal(true)}
          >
            <Mail size={14} className="mr-1" />
            Enviar correo
          </Button>
          <Button
            id="share-whatsapp-btn"
            size="sm"
            variant="outline"
            className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
            onClick={handleShareWhatsApp}
            isLoading={generatingShare}
          >
            <MessageCircle size={14} className="mr-1" />
            WhatsApp
          </Button>
        </div>
      </div>

      {/* Chief complaint */}
      {consultation.chief_complaint && (
        <Card className="border-slate-200 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Motivo de Consulta</p>
            <p className="text-slate-800 dark:text-slate-200">{consultation.chief_complaint}</p>
          </CardContent>
        </Card>
      )}

      {/* Clinical sections */}
      {consultation.podiatric_history && Object.keys(consultation.podiatric_history).length > 0 && (
        <JsonSection title="Antecedentes Podológicos" data={consultation.podiatric_history as Record<string, unknown>} />
      )}
      {consultation.medical_history && Object.keys(consultation.medical_history).length > 0 && (
        <JsonSection title="Antecedentes Médicos" data={consultation.medical_history as Record<string, unknown>} />
      )}
      {consultation.lifestyle && Object.keys(consultation.lifestyle).length > 0 && (
        <JsonSection title="Estilo de Vida" data={consultation.lifestyle as Record<string, unknown>} />
      )}
      {consultation.clinical_examination && Object.keys(consultation.clinical_examination).length > 0 && (
        <JsonSection title="Exploración Clínica" data={consultation.clinical_examination as Record<string, unknown>} />
      )}
      {consultation.biomechanical_evaluation && Object.keys(consultation.biomechanical_evaluation).length > 0 && (
        <JsonSection title="Evaluación Biomecánica" data={consultation.biomechanical_evaluation as Record<string, unknown>} />
      )}
      {consultation.vascular_neurological && Object.keys(consultation.vascular_neurological).length > 0 && (
        <JsonSection title="Vascular y Neurológico" data={consultation.vascular_neurological as Record<string, unknown>} />
      )}
      {consultation.treatment_plan && Object.keys(consultation.treatment_plan).length > 0 && (
        <JsonSection title="Plan de Tratamiento" data={consultation.treatment_plan as Record<string, unknown>} />
      )}

      {/* Photos */}
      {consultation.photos && consultation.photos.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Camera size={16} /> Fotografías Clínicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {consultation.photos.map((p, index) => (
                <div key={p.id} className="space-y-1">
                  <div 
                    className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer"
                    onClick={() => setLightboxIndex(index)}
                  >
                    <img src={p.url} alt={p.label || "Foto clínica"} className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="rounded-full w-10 h-10 p-0"
                        onClick={(e) => { e.stopPropagation(); handleDownloadPhoto(p); }}
                        title="Descargar imagen"
                      >
                        <Download size={18} />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-center text-slate-500 dark:text-slate-400 truncate px-1">{p.label || "Sin etiqueta"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {lightboxIndex !== null && consultation.photos && (
        <Lightbox
          photos={consultation.photos as any}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDownload={handleDownloadPhoto}
        />
      )}

      {/* Consent */}
      {consultation.consent && (
        <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10">
          <CardHeader>
            <CardTitle className="text-sm text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} /> Consentimiento Informado
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-6 items-center">
            <div className="flex-1 space-y-1">
              <p className="text-sm text-slate-800 dark:text-slate-200"><span className="font-medium text-slate-500 dark:text-slate-400">Firmado por:</span> {consultation.consent.patient_full_name}</p>
              <p className="text-sm text-slate-800 dark:text-slate-200"><span className="font-medium text-slate-500 dark:text-slate-400">RUT:</span> {consultation.consent.patient_national_id}</p>
              <p className="text-sm text-slate-800 dark:text-slate-200"><span className="font-medium text-slate-500 dark:text-slate-400">Fecha de firma:</span> {new Date(consultation.consent.signed_at).toLocaleString("es-CL")}</p>
            </div>
            <div className="w-48 bg-white border border-slate-200 rounded-lg p-2">
              <img src={consultation.consent.signature_url} alt="Firma del paciente" className="w-full h-auto" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Specialist */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="pt-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Especialista Responsable</p>
          <p className="font-medium text-slate-800 dark:text-slate-200">{consultation.specialist.full_name}</p>
          {consultation.specialist.professional_title && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{consultation.specialist.professional_title}</p>
          )}
        </CardContent>
      </Card>

      {/* Ethereal preview banner — persiste tras enviar en desarrollo */}
      {etherealPreviewUrl && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <Mail size={16} />
            <span className="text-sm font-medium">Correo enviado (modo desarrollo)</span>
            <span className="text-xs text-amber-600 dark:text-amber-400">Ver previsualización en Ethereal Mail:</span>
          </div>
          <a
            href={etherealPreviewUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
          >
            Abrir correo <ExternalLink size={13} />
          </a>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail size={18} className="text-emerald-600" />
                Enviar informe por correo
              </h2>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Se generará y enviará el PDF del informe clínico de{" "}
              <strong className="text-slate-700 dark:text-slate-200">{consultation.patient.full_name}</strong>{" "}
              al correo indicado.
            </p>
            <Input
              id="email-to-input"
              label="Correo electrónico del destinatario"
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="paciente@ejemplo.com"
            />
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              💡 En modo desarrollo se usa <strong>Ethereal Mail</strong>. Verás un enlace de previsualización tras enviar.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowEmailModal(false)}>
                Cancelar
              </Button>
              <Button
                id="confirm-send-email-btn"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleSendEmail}
                isLoading={sendingEmail}
                disabled={!emailTo}
              >
                <Mail size={14} className="mr-1" />
                Enviar
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* WhatsApp Share Modal */}
      {showShareModal && shareData && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Share2 size={18} className="text-green-600" />
                Compartir por WhatsApp
              </h2>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Se abrirá WhatsApp con un mensaje predefinido y el enlace al informe de{" "}
              <strong className="text-slate-700 dark:text-slate-200">{consultation.patient.full_name}</strong>.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Enlace del informe</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-emerald-600 dark:text-emerald-400 break-all flex-1">{shareData.share_url}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(shareData.share_url); toast.success("Enlace copiado"); }}
                  className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                  title="Copiar enlace"
                >
                  <Share2 size={14} />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">
              ⏱ Este enlace es válido por <strong>72 horas</strong>.
            </p>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowShareModal(false)}>
                Cerrar
              </Button>
              <a href={shareData.whatsapp_url} target="_blank" rel="noreferrer" className="flex-1">
                <Button
                  id="open-whatsapp-btn"
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => setShowShareModal(false)}
                >
                  <MessageCircle size={14} className="mr-1" />
                  Abrir WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <AlertCircle size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">¿Eliminar borrador?</CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Esta acción no se puede deshacer</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                La consulta del paciente <strong className="text-slate-800 dark:text-slate-100">{consultation.patient.full_name}</strong> será eliminada de forma permanente.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="outline" onClick={() => setShowDeleteModal(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="button" 
                  className="bg-red-600 hover:bg-red-700 text-white" 
                  onClick={handleDelete}
                  isLoading={deleting}
                >
                  Eliminar
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
