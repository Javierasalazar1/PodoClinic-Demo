# PODOCLINIC
## Sistema de Historial Clínico Podológico Digital
### Especificación Técnica Completa para Desarrollo

| Campo | Valor |
|---|---|
| Versión | 1.0 — Mayo 2025 |
| Destinatario | IA / Equipo de desarrollo |
| Plataforma objetivo | Web (PWA) — multidispositivo |
| Ámbito | Clínicas podológicas (Chile / LATAM) |

---

## 1. Descripción General del Proyecto

PodoClinic es una aplicación web progresiva (PWA) diseñada para clínicas podológicas que necesitan digitalizar y gestionar historiales clínicos de pacientes. La aplicación permite crear, editar, almacenar y exportar fichas clínicas completas en formato PDF, con soporte de firma digital, fotografía clínica y personalización de marca por clínica.

> **Objetivo principal:** reemplazar el papel en el consultorio podológico con una herramienta simple, segura y profesional que cualquier especialista pueda usar sin formación técnica previa.

### 1.1 Problema que resuelve

- Los especialistas en podología trabajan con formularios en papel propensos a deterioro y pérdida.
- No existe software especializado asequible para clínicas podológicas pequeñas y medianas.
- Los reportes actuales no incluyen fotografía clínica integrada ni firma digital.
- La trazabilidad legal de consentimientos informados es precaria en papel.

### 1.2 Usuarios del sistema

| Rol | Descripción |
|---|---|
| Administrador de clínica | Configura logotipo, datos de la clínica, crea cuentas de especialistas. Acceso total. |
| Especialista (podólog@) | Crea y edita fichas clínicas, genera reportes, ve solo sus propios pacientes. |
| Recepción (opcional) | Solo puede ver nombre del paciente y fecha de consulta. Sin acceso a datos clínicos. |

### 1.3 Alcance de la versión 1.0

- Gestión de una sola clínica por instalación (multi-clínica en v2.0).
- Formulario clínico podológico completo con 10 secciones.
- Generación de PDF del reporte listo para imprimir.
- Envío del reporte por correo electrónico directamente desde la app.
- Compartir enlace temporal del reporte por WhatsApp.
- Autenticación segura con doble factor (2FA).
- Almacenamiento de fotografía clínica.
- Firma digital del paciente capturada en pantalla.

---

## 2. Stack Tecnológico Recomendado

> **Instrucción para la IA desarrolladora:** usar exactamente este stack. No sustituir por alternativas sin justificación técnica documentada.

### 2.1 Frontend

| Elemento | Tecnología |
|---|---|
| Framework | React 18+ con TypeScript |
| Bundler / tooling | Vite 5+ |
| Estilos | Tailwind CSS 3+ con shadcn/ui para componentes base |
| Formularios | React Hook Form + Zod para validación de esquemas |
| Firma digital | signature_pad (npm: signature_pad) |
| Generación PDF cliente | react-pdf / @react-pdf/renderer o pdfmake |
| Cámara y archivos | API nativa del navegador (getUserMedia, FileReader) |
| PWA | Vite PWA plugin (vite-plugin-pwa) con workbox |
| Estado global | Zustand o Context API (sin Redux — demasiado complejo) |
| Enrutamiento | React Router v6 |
| Notificaciones | react-hot-toast |

### 2.2 Backend

| Elemento | Tecnología |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express.js con TypeScript (o Fastify para mayor rendimiento) |
| ORM | Prisma ORM |
| Autenticación | JWT (access + refresh tokens) + speakeasy para 2FA TOTP |
| Validación | Zod (compartido entre frontend y backend en monorepo) |
| Envío de correo | Nodemailer con cuenta SMTP configurable por clínica |
| Carga de archivos | Multer para recibir imágenes y PDFs |
| Generación PDF servidor | Puppeteer (renderiza HTML a PDF) o @react-pdf/renderer SSR |

### 2.3 Base de datos y almacenamiento

| Elemento | Tecnología |
|---|---|
| Base de datos principal | PostgreSQL 15+ (Railway, Supabase, o instancia propia) |
| Almacenamiento de archivos | Supabase Storage, Cloudflare R2 o AWS S3 (compatible S3) |
| Caché (opcional v1) | Redis para sesiones y rate limiting |
| Backups | pg_dump automatizado diario con retención 30 días mínimo |

### 2.4 Infraestructura y despliegue

| Elemento | Tecnología |
|---|---|
| Frontend hosting | Vercel (deploy automático desde GitHub) |
| Backend hosting | Railway o Render (free tier suficiente para inicio) |
| Dominio y SSL | Cloudflare (SSL automático, protección DDoS gratuita) |
| CI/CD | GitHub Actions (lint + tests + deploy en push a main) |
| Variables de entorno | .env local, secrets en plataforma de deploy (nunca en repositorio) |

### 2.5 Estructura de repositorio

Monorepo con la siguiente estructura:

```
podo-clinic/
  apps/
    web/           <- React PWA (frontend)
    api/           <- Express API (backend)
  packages/
    shared/        <- tipos TypeScript, esquemas Zod compartidos
    pdf-templates/ <- plantillas de reporte PDF
  .github/
    workflows/     <- CI/CD pipelines
  docker-compose.yml   <- para desarrollo local
  README.md
```

---

## 3. Módulos del Sistema

### 3.1 Módulo de autenticación y sesión

- Login con email + contraseña (bcrypt, mín. 12 rondas).
- Doble factor obligatorio (2FA-TOTP): al activar cuenta, el especialista escanea QR en Google Authenticator o similar.
- JWT access token (duración: 15 minutos) + refresh token (duración: 7 días, rotado en cada uso).
- Cierre automático de sesión tras 30 minutos de inactividad.
- Registro de cada inicio de sesión (IP, dispositivo, timestamp) en tabla `audit_logs`.
- Recuperación de contraseña por email con enlace de un solo uso (expira en 1 hora).

### 3.2 Módulo de configuración de clínica

Solo accesible por el rol Administrador. Permite personalizar la aplicación para cada clínica:

- Nombre legal de la clínica.
- Logo (imagen PNG/JPG, max 2MB, almacenada en bucket S3).
- Dirección, teléfono, correo institucional y sitio web.
- Número de registro sanitario o colegiación de la clínica (aparece en el PDF).
- Texto del consentimiento informado (editor de texto enriquecido, guardado como HTML).
- Colores corporativos para el PDF (color primario en formato hex).
- Configuración SMTP para envío de correos desde el dominio de la clínica.

### 3.3 Módulo de gestión de especialistas

- El administrador crea cuentas de especialistas con: nombre completo, título profesional, número de colegiación, email, foto de perfil (opcional).
- Cada especialista ve solo los pacientes que él mismo ha atendido (aislamiento de datos).
- El administrador puede desactivar cuentas (sin borrar datos históricos).

### 3.4 Módulo de pacientes

Ficha de paciente (tabla `patients` en la BD):

- RUT (validado con algoritmo chileno) o identificación nacional según país.
- Nombre completo, fecha de nacimiento, sexo biológico, género (opcional).
- Teléfono, correo electrónico, dirección.
- Contacto de emergencia (nombre y teléfono).
- Foto del paciente (opcional, max 1MB).
- Fecha de creación y última modificación (timestamps automáticos).

> El módulo de pacientes es independiente del módulo de consultas. Un paciente puede tener múltiples consultas (relación 1:N en la base de datos).

### 3.5 Módulo de consulta / historial clínico (núcleo del sistema)

Cada consulta genera un registro en la tabla `consultations`. El formulario se presenta en pestañas o secciones colapsables. El especialista puede guardar como borrador y completar más tarde.

> **IMPORTANTE para la IA desarrolladora:** el formulario debe autoguardarse cada 60 segundos en `localStorage` como respaldo, y sincronizarse con la API solo al hacer clic en "Guardar borrador" o "Finalizar consulta". Esto evita pérdida de datos ante cierres accidentales del navegador.

---

#### Sección 1 — Datos de la consulta

- Fecha y hora de la consulta (prellenada con la fecha actual, editable).
- Especialista responsable (prellenado con el usuario en sesión).
- Tipo de consulta: `Primera vez` / `Seguimiento` / `Urgencia`.
- Motivo de consulta (campo de texto libre, max 500 caracteres).

---

#### Sección 2 — Antecedentes podológicos

- Consultas podológicas previas: Sí / No. Si es Sí, descripción libre.
- Patologías podológicas previas: lista de checkboxes con texto libre adicional:
  - Hallux valgus (juanete)
  - Pie plano / cavo
  - Onicocriptosis (uña incarnada)
  - Verrugas plantares
  - Micosis ungual / interdigital
  - Metatarsalgia
  - Fascitis plantar
  - Neuroma de Morton
  - Otro (campo libre)
- Tratamientos podológicos previos (texto libre).
- Uso previo de plantillas ortopédicas: Sí / No.

---

#### Sección 3 — Antecedentes médicos generales

- Enfermedades sistémicas relevantes: checkboxes + texto libre:
  - Diabetes mellitus (tipo 1 / tipo 2)
  - Hipertensión arterial
  - Artritis reumatoide / artritis
  - Gota
  - Insuficiencia venosa / várices
  - Neuropatía periférica
  - Enfermedad renal crónica
  - Psoriasis
  - Otra (campo libre)
- Alergias conocidas (látex, medicamentos, apósitos) — texto libre.
- Medicación actual (texto libre).
- Cirugías previas en pie o tobillo: Sí / No. Si es Sí, descripción.
- Embarazo actual: Sí / No / No aplica.

---

#### Sección 4 — Estilo de vida y hábitos

- Ocupación o actividad laboral principal (texto libre).
- Actividad física: `Sedentario` / `Moderada (1-3 días/semana)` / `Intensa (4+ días/semana)`.
- Deporte practicado (texto libre, puede quedar vacío).
- Tipo de calzado habitual: checkboxes (zapatilla deportiva, zapato de tacón, zapato plano, sandalia, bota, otro).
- Horas promedio de pie al día: menú desplegable (`menos de 4h` / `4-8h` / `más de 8h`).
- Hábitos de higiene del pie: checkboxes (corte de uñas propio, uso de cremas, baño diario, otro).

---

#### Sección 5 — Exploración clínica podológica

Esta sección captura la evaluación visual y clínica del pie. Todos los campos son texto libre o selección múltiple para máxima flexibilidad del especialista.

- Inspección dermatológica: estado de la piel (seca, hidratada, hiperqueratósica, fisuras, úlceras, lesiones — descripción libre por zona anatómica).
- Estado de las uñas: descripción libre por dedo (engrosamiento, onicomicosis, onicocriptosis, coloración anómala, ausencia).
- Temperatura cutánea: `Normal` / `Aumentada` / `Disminuida` — pie derecho e izquierdo separados.
- Edema: `Ausente` / `Presente` (localizado / generalizado, descripción libre).
- Deformidades estructurales observadas: checkboxes con descripción libre.
- Zonas de presión o carga anómala: descripción libre.

---

#### Sección 6 — Evaluación biomecánica

- Tipo de pisada: `Supinadora` / `Neutra` / `Pronadora` — pie derecho e izquierdo.
- Índice de Beighton (hiperlaxitud ligamentosa): puntuación de 0 a 9.
- Test de Jack (valoración de fascia plantar): `Normal` / `Alterado`.
- Ángulo de Fick (rotación de pie durante la marcha): descripción o valor numérico.
- Longitud de miembros inferiores: `Simétrica` / `Asimetría` (descripción).
- Ángulo de inclinación del calcáneo (varo / valgo): descripción libre.
- Observaciones de la marcha (texto libre).

---

#### Sección 7 — Evaluación vascular y neurológica

- Pulso pedio: `Presente` / `Disminuido` / `Ausente` — pie derecho e izquierdo.
- Pulso tibial posterior: `Presente` / `Disminuido` / `Ausente` — pie derecho e izquierdo.
- Índice tobillo-brazo (ITB): valor numérico opcional.
- Test de sensibilidad (monofilamento 10g): `Normal` / `Alterado` — pie derecho e izquierdo.
- Sensibilidad vibratoria (diapasón): `Normal` / `Alterado`.
- Reflejo aquíleo: `Presente` / `Disminuido` / `Ausente`.
- Temperatura: valoración subjetiva o con termómetro (texto libre).
- Observaciones vasculares/neurológicas (texto libre).

---

#### Sección 8 — Fotografía clínica

- Permite subir hasta 10 fotografías por consulta.
- Formatos aceptados: JPG, PNG, HEIC. Tamaño máximo: 5MB por imagen.
- En dispositivos móviles, permite captura directa desde la cámara.
- Cada imagen puede llevar un título/etiqueta (ej: `Pie derecho dorsal`, `Onicomicosis dedo 1 izquierdo`).
- Las imágenes se almacenan en el bucket S3 con nombre de archivo UUID. No se almacenan datos del paciente en el nombre del archivo.
- Se genera miniatura (thumbnail) de 300×300px para visualización rápida.

---

#### Sección 9 — Plan de tratamiento

- Diagnóstico podológico (texto libre, max 1000 caracteres).
- Objetivos del tratamiento (texto libre).
- Procedimientos realizados en esta sesión: checkboxes:
  - Quiropodía / podología preventiva
  - Tratamiento de onicomicosis
  - Tratamiento de onicocriptosis
  - Eliminación de hiperqueratosis
  - Vendaje funcional
  - Confección de plantilla / órtesis
  - Aplicación de tópico / medicación
  - Otro (campo libre)
- Materiales o productos utilizados (texto libre).
- Plan para próxima sesión (texto libre).
- Derivaciones: a médico / traumatólogo / angiólogo / nutricionista / otro (texto libre).
- Fecha sugerida próxima consulta (selector de fecha, opcional).

---

#### Sección 10 — Consentimiento informado y firma

- Se muestra el texto del consentimiento informado configurado por la clínica (no editable en esta pantalla).
- Campo de firma digital del paciente: canvas interactivo donde el paciente firma con dedo (móvil) o mouse (escritorio).
- Nombre completo del paciente confirmado (texto, obligatorio).
- RUT o identificación del paciente (texto, obligatorio).
- Checkbox de confirmación: `"He leído y acepto el consentimiento informado"`.
- La firma se guarda como imagen PNG en el bucket S3.
- Se registra timestamp exacto (UTC) de la firma en la base de datos.
- La consulta solo puede marcarse como FINALIZADA si esta sección está completa.

---

## 4. Generación del Reporte Clínico PDF

El reporte PDF se genera en el servidor (backend) usando Puppeteer renderizando una plantilla HTML. Se almacena en S3 con un nombre UUID y se ofrece descarga directa o compartición por enlace temporal.

### 4.1 Contenido del PDF (en orden)

1. Encabezado de página: logo de la clínica (alineado a la izquierda) + nombre, dirección y teléfono de la clínica (alineado a la derecha).
2. Título del documento: `INFORME CLÍNICO PODOLÓGICO`.
3. Número de informe (autogenerado: `AAAA-MM-DD-NNNN`, ej: `2025-05-0042`).
4. Datos del especialista: nombre, título, número de colegiación.
5. Datos del paciente: nombre, RUT, fecha de nacimiento, edad calculada, teléfono, correo.
6. Sección por sección del formulario (solo secciones con contenido; las vacías se omiten).
7. Galería de fotografías clínicas (miniatura + etiqueta, máx. 2 por fila).
8. Plan de tratamiento y derivaciones.
9. Consentimiento informado: texto completo + imagen de la firma del paciente + nombre y RUT del firmante + fecha y hora de firma.
10. Firma del especialista: nombre, título, número de colegiación y espacio para firma física si se imprime.
11. Pie de cada página: nombre de la clínica + número de página + `"Documento generado electrónicamente — PodoClinic"`.

### 4.2 Canales de distribución del reporte

| Canal | Comportamiento |
|---|---|
| Descarga directa | Botón "Descargar PDF" en la interfaz. Genera el PDF y lo descarga al dispositivo del especialista. |
| Correo electrónico | El especialista ingresa el email del paciente y hace clic en "Enviar por correo". El backend usa el SMTP de la clínica para enviar el PDF como adjunto. |
| Enlace por WhatsApp | Se genera un enlace temporal (expira en 72 horas) con URL firmada de S3. Se abre WhatsApp Web con el número del paciente y el enlace pre-escrito en el mensaje. |

---

## 5. Esquema de Base de Datos

> Usar Prisma ORM. El esquema completo debe definirse en `schema.prisma`.

### Tabla: `clinics`

```prisma
model Clinic {
  id                  String   @id @default(uuid())
  name                String
  logo_url            String?
  address             String?
  phone               String?
  email               String?
  website             String?
  registration_number String?
  primary_color       String   @default("#0F6E56")
  consent_text        String   @db.Text
  smtp_host           String?  // cifrado en BD
  smtp_port           Int?
  smtp_user           String?  // cifrado en BD
  smtp_pass           String?  // cifrado en BD
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
}
```

### Tabla: `users`

```prisma
model User {
  id                   String   @id @default(uuid())
  clinic_id            String
  role                 Role     // enum: ADMIN, SPECIALIST, RECEPTION
  full_name            String
  professional_title   String?
  license_number       String?
  email                String   @unique
  password_hash        String
  totp_secret          String?  // cifrado en BD
  totp_enabled         Boolean  @default(false)
  profile_photo_url    String?
  is_active            Boolean  @default(true)
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt
}
```

### Tabla: `patients`

```prisma
model Patient {
  id                      String   @id @default(uuid())
  clinic_id               String
  national_id             String
  full_name               String
  date_of_birth           DateTime @db.Date
  biological_sex          BiologicalSex  // enum: MALE, FEMALE, OTHER
  gender                  String?
  phone                   String?
  email                   String?
  address                 String?
  emergency_contact_name  String?
  emergency_contact_phone String?
  photo_url               String?
  created_at              DateTime @default(now())
  updated_at              DateTime @updatedAt
}
```

### Tabla: `consultations`

```prisma
model Consultation {
  id                      String            @id @default(uuid())
  clinic_id               String
  patient_id              String
  specialist_id           String
  status                  ConsultationStatus  // enum: DRAFT, FINALIZED
  consultation_date       DateTime
  consultation_type       ConsultationType    // enum: FIRST_TIME, FOLLOW_UP, URGENT
  chief_complaint         String?
  podiatric_history       Json?
  medical_history         Json?
  lifestyle               Json?
  clinical_examination    Json?
  biomechanical_evaluation Json?
  vascular_neurological   Json?
  treatment_plan          Json?
  report_pdf_url          String?
  created_at              DateTime          @default(now())
  updated_at              DateTime          @updatedAt
}
```

### Tabla: `consultation_photos`

```prisma
model ConsultationPhoto {
  id               String   @id @default(uuid())
  consultation_id  String
  url              String
  thumbnail_url    String
  label            String?
  order_index      Int
  created_at       DateTime @default(now())
}
```

### Tabla: `consent_records`

```prisma
model ConsentRecord {
  id                     String   @id @default(uuid())
  consultation_id        String   @unique
  patient_full_name      String
  patient_national_id    String
  consent_text_snapshot  String   @db.Text
  signature_url          String
  signed_at              DateTime
  ip_address             String
}
```

### Tabla: `audit_logs`

```prisma
model AuditLog {
  id            String   @id @default(uuid())
  user_id       String?
  clinic_id     String?
  action        String   // LOGIN, LOGOUT, CREATE_CONSULTATION, FINALIZE_CONSULTATION, GENERATE_PDF, SEND_EMAIL, etc.
  resource_type String?
  resource_id   String?
  ip_address    String
  user_agent    String
  created_at    DateTime @default(now())
}
```

### Tabla: `refresh_tokens`

```prisma
model RefreshToken {
  id          String   @id @default(uuid())
  user_id     String
  token_hash  String   // hash del token, nunca el token en claro
  expires_at  DateTime
  revoked     Boolean  @default(false)
  created_at  DateTime @default(now())
}
```

---

## 6. API REST — Endpoints

> Prefijo base: `/api/v1`. Todos los endpoints (salvo auth) requieren header `Authorization: Bearer {accessToken}`.

### 6.1 Autenticación — `/api/v1/auth`

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/login` | Recibe `{email, password, totp_code?}`. Devuelve `{accessToken, refreshToken, user}`. |
| POST | `/refresh` | Recibe `{refreshToken}`. Devuelve nuevo `{accessToken, refreshToken}`. |
| POST | `/logout` | Revoca el refreshToken. Requiere auth. |
| POST | `/forgot-password` | Envía email de recuperación. No requiere auth. |
| POST | `/reset-password` | Recibe `{token, newPassword}`. Valida token de un solo uso. |
| POST | `/2fa/setup` | Genera QR y secret TOTP para el usuario autenticado. |
| POST | `/2fa/verify` | Activa el 2FA validando el primer código. |

### 6.2 Clínica — `/api/v1/clinic`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Devuelve configuración de la clínica del usuario en sesión. |
| PATCH | `/` | Actualiza configuración de la clínica. Solo `ADMIN`. |
| POST | `/logo` | Sube nuevo logo (multipart/form-data). Solo `ADMIN`. |

### 6.3 Usuarios — `/api/v1/users`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Lista usuarios de la clínica. Solo `ADMIN`. |
| POST | `/` | Crea nuevo usuario especialista. Solo `ADMIN`. |
| PATCH | `/:id` | Actualiza datos del usuario. `ADMIN` puede editar cualquiera; `SPECIALIST` solo sus propios datos. |
| DELETE | `/:id` | Desactiva usuario (`is_active=false`). Solo `ADMIN`. No elimina datos. |

### 6.4 Pacientes — `/api/v1/patients`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Lista pacientes de la clínica con paginación y búsqueda por nombre/RUT. |
| POST | `/` | Crea nuevo paciente. |
| GET | `/:id` | Devuelve ficha completa del paciente. |
| PATCH | `/:id` | Actualiza datos del paciente. |
| GET | `/:id/consultations` | Lista consultas del paciente (solo metadatos, sin datos clínicos). |

### 6.5 Consultas — `/api/v1/consultations`

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/` | Crea consulta en estado `DRAFT`. Devuelve el ID. |
| GET | `/:id` | Devuelve consulta completa. Solo el especialista que la creó o `ADMIN`. |
| PATCH | `/:id` | Guarda borrador. Actualiza cualquier sección parcialmente. |
| POST | `/:id/finalize` | Valida que el consentimiento esté firmado y cambia estado a `FINALIZED`. |
| POST | `/:id/photos` | Sube fotos (multipart, max 10 archivos). Devuelve URLs. |
| DELETE | `/:id/photos/:photoId` | Elimina una foto. |
| POST | `/:id/consent` | Guarda firma y datos del consentimiento informado. |
| POST | `/:id/generate-pdf` | Genera PDF en servidor y devuelve URL. |
| POST | `/:id/send-email` | Envía PDF por correo. Body: `{to_email}`. |
| POST | `/:id/share-link` | Genera enlace temporal firmado (72h). Devuelve URL. |

---

## 7. Seguridad — Requisitos Obligatorios

> ⚠️ **CRÍTICO:** Todos estos requisitos son obligatorios. No implementar como "mejora futura".

### 7.1 Autenticación y autorización

- Contraseñas hasheadas con bcrypt, mínimo 12 rondas de salt.
- 2FA con TOTP (RFC 6238) obligatorio para roles `ADMIN` y `SPECIALIST`.
- JWT access token de corta duración (15 min). Refresh token rotado en cada uso.
- Lista negra de refresh tokens revocados en base de datos.
- Rate limiting en endpoints de autenticación: máx. 5 intentos por IP cada 15 minutos. Bloqueo temporal al exceder el límite.
- Control de acceso basado en roles (RBAC) verificado en el backend, nunca solo en el frontend.

### 7.2 Cifrado y transporte

- HTTPS obligatorio en todos los entornos (no existe modo HTTP en producción).
- Certificado TLS gestionado por Cloudflare (renovación automática).
- Headers de seguridad HTTP obligatorios: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`.
- Credenciales SMTP almacenadas cifradas en la base de datos (AES-256-GCM, clave de cifrado en variable de entorno).
- Secretos TOTP almacenados cifrados en la base de datos.

### 7.3 Protección de datos de salud

- Aislamiento por clínica: cada query a la BD debe incluir `clinic_id` del usuario en sesión para evitar acceso cruzado entre clínicas.
- Los especialistas no pueden ver consultas de otros especialistas de la misma clínica (salvo el administrador).
- Las URLs de S3 son privadas. El acceso se realiza mediante URLs firmadas de tiempo limitado (máx. 1 hora para imágenes, 72 horas para PDFs compartidos).
- Las imágenes clínicas y firmas nunca tienen el nombre del paciente en el nombre del archivo (usar UUID).
- Soft delete: nunca se eliminan físicamente datos clínicos. Se marcan como eliminados con un timestamp `deleted_at`.

### 7.4 Auditoría y trazabilidad

- Toda acción significativa debe registrarse en `audit_logs`: creación de consulta, finalización, generación de PDF, envío de correo, cambio de configuración, login/logout.
- Los logs incluyen siempre: `user_id`, `ip_address`, `user_agent`, `timestamp` y descripción de la acción.
- Los logs son de solo escritura. No existe endpoint para borrarlos.
- Los consentimientos firmados incluyen timestamp UTC y dirección IP del dispositivo que firmó.

### 7.5 Cumplimiento legal (Chile)

- La aplicación cumple con la **Ley 19.628** de protección de datos personales de Chile y su actualización vigente.
- Los datos de salud son datos sensibles y requieren consentimiento explícito para su tratamiento.
- La política de privacidad de la clínica debe ser configurable y visible para el paciente al firmar el consentimiento.
- Retención de datos: los historiales clínicos deben conservarse mínimo 5 años (configurable por la clínica hasta 15 años).
- El paciente tiene derecho a solicitar sus datos. Implementar endpoint de exportación en formato PDF o JSON.

---

## 8. Interfaz de Usuario — Directrices

### 8.1 Principios de diseño

- La interfaz es limpia, profesional y minimalista. Paleta de colores neutros con el color primario de la clínica como acento.
- El logo de la clínica aparece en la barra de navegación superior izquierda.
- El formulario de consulta usa pestañas o acordeón por sección. El progreso de completado es visible (barra de progreso o indicadores de sección).
- Todos los campos obligatorios están marcados con asterisco rojo.
- Los errores de validación se muestran junto al campo, no solo al enviar el formulario.
- La aplicación es totalmente responsive: funciona en escritorio (1200px+), tablet (768px) y móvil (375px).

### 8.2 Flujo principal del especialista

1. Login con email, contraseña y código 2FA.
2. Dashboard: acceso rápido a "Nueva consulta", lista de últimas consultas y buscador de pacientes.
3. Nueva consulta: buscar paciente existente por nombre/RUT o crear nuevo paciente.
4. Formulario de consulta: navegar entre secciones, autoguardado cada 60 seg.
5. Fotografía: capturar o subir imágenes directamente desde el formulario.
6. Consentimiento: el paciente firma en pantalla táctil o con mouse.
7. Finalizar: revisión de la consulta completa y botón "Finalizar y generar PDF".
8. Distribución: botones para descargar, enviar por correo o compartir por WhatsApp.

### 8.3 PWA — Capacidades offline parciales

- La aplicación debe poder abrirse sin conexión (caché del shell de la app con service worker).
- Sin conexión, se puede ver consultas ya cargadas (cached) pero no crear nuevas.
- Un banner visible informa al usuario cuando está sin conexión.
- Las fotos capturadas sin conexión se encolan y sincronizan al recuperar conexión (IndexedDB como cola).

---

## 9. Hoja de Ruta de Desarrollo

### Fase 1 — MVP (semanas 1-6)

- Autenticación completa (login, 2FA, refresh tokens).
- CRUD de pacientes.
- Formulario de consulta (secciones 1-4 y 9).
- Generación de PDF básico.
- Descarga directa del PDF.

### Fase 2 — Consulta completa (semanas 7-10)

- Secciones 5-8 del formulario (exploración, biomecánica, vascular, fotografía).
- Firma digital del consentimiento.
- PDF completo con fotos y firma.
- Envío por correo electrónico.

### Fase 3 — Distribución y seguridad (semanas 11-13)

- Enlace temporal por WhatsApp.
- Auditoría completa (`audit_logs`).
- Rate limiting y protecciones avanzadas.
- Configuración SMTP personalizada por clínica.

### Fase 4 — Pulido y despliegue (semanas 14-16)

- PWA completa con service worker y capacidades offline.
- Tests automatizados (Jest + Playwright para E2E críticos).
- Documentación de la API (Swagger/OpenAPI).
- Despliegue en producción con CI/CD.

---

## 10. Variables de Entorno Requeridas

> Nunca incluir valores reales en el repositorio. Usar `.env.example` con valores de ejemplo vacíos.

### Backend (`.env`)

```env
DATABASE_URL=postgresql://user:password@host:5432/podoclinic
JWT_ACCESS_SECRET=<string-aleatorio-min-64-chars>
JWT_REFRESH_SECRET=<string-aleatorio-diferente-min-64-chars>
ENCRYPTION_KEY=<string-aleatorio-exactamente-32-chars-para-AES-256>
S3_BUCKET=podoclinic-files
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=<clave-S3>
S3_SECRET_ACCESS_KEY=<secreto-S3>
S3_ENDPOINT=https://...   # solo si no es AWS, ej: Cloudflare R2
FRONTEND_URL=https://app.podoclinic.cl
NODE_ENV=production
PORT=3001
```

### Frontend (`.env`)

```env
VITE_API_URL=https://api.podoclinic.cl/api/v1
VITE_APP_NAME=PodoClinic
```

---

## 11. Instrucciones Directas para la IA Desarrolladora

> Lee esta sección con atención antes de escribir cualquier línea de código.

- Usa **TypeScript estricto** en todo el proyecto. Sin `any` implícitos. Configura `tsconfig` con `strict: true`.
- Todas las rutas de la API deben **validar el body de entrada con Zod** antes de procesarlo.
- Nunca devuelvas `password_hash`, `totp_secret` ni datos sensibles en las respuestas de la API.
- Cada endpoint debe verificar que el usuario tiene permisos sobre el recurso que solicita (no confiar solo en el token).
- Usa **transacciones de base de datos** cuando una operación involucre múltiples escrituras relacionadas.
- Todos los errores deben devolver un formato consistente: `{ error: string, code: string, details?: any }`.
- Implementa el **patrón Repository** para acceso a datos (no queries Prisma directas en los controladores).
- El frontend debe manejar estados de **carga, error y vacío** en cada vista. Sin pantallas en blanco sin información.
- Las imágenes subidas deben **comprimirse en el frontend** antes de enviar (máx. 1200px de ancho, quality 0.85 con canvas API).
- Implementa **CSP (Content Security Policy)** estricta en el backend usando el header correspondiente.
- Escribe al menos un **test de integración por endpoint crítico** (autenticación, crear consulta, generar PDF).
- Documenta cada función compleja con **JSDoc en español**.

> Si encuentras ambigüedad en alguna especificación, implementa la opción más conservadora en términos de seguridad y privacidad, y deja un comentario `TODO` en el código explicando la decisión.

---

*Fin del documento de especificación — PodoClinic v1.0*
