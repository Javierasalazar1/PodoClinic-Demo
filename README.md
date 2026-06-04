# 🦶 PodoClinic

**Sistema de Historial Clínico Podológico Digital** — PWA para clínicas podológicas (Chile / LATAM)

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite 8 |
| Estilos | Tailwind CSS 3 + shadcn/ui |
| Estado | Zustand |
| Formularios | React Hook Form + Zod |
| Backend | Express.js + TypeScript |
| ORM | Prisma 5 + PostgreSQL 15 |
| Auth | JWT (15 min) + Refresh tokens + 2FA TOTP |
| Cifrado | AES-256-GCM para secretos TOTP y SMTP |

---

## Estructura del Repositorio

```
podo-clinic/
  apps/
    web/           ← React PWA (frontend)  :5173
    api/           ← Express API (backend) :3001
  packages/
    shared/        ← tipos TypeScript compartidos (Fase 2)
    pdf-templates/ ← plantillas PDF (Fase 2)
  docker-compose.yml
```

---

## Inicio Rápido (Desarrollo Local)

### 1. Requisitos previos
- Node.js 20 LTS
- Docker Desktop (para PostgreSQL local)

### 2. Base de datos
```bash
docker-compose up -d
```
Esto levanta PostgreSQL en `localhost:5432`.

### 3. Variables de entorno

**Backend:**
```bash
cp apps/api/.env.example apps/api/.env
```
Edita `apps/api/.env` y completa los valores. La `DATABASE_URL` para Docker local es:
```
DATABASE_URL=postgresql://podoclinic:podoclinic_dev@localhost:5432/podoclinic
```

Genera las claves seguras:
```bash
# JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# AES-256 key (exactamente 32 bytes = 64 chars hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Frontend:**
```bash
cp apps/web/.env.example apps/web/.env
```

### 4. API — Migraciones y seed
```bash
cd apps/api
npm run db:migrate     # aplica migraciones
npm run db:seed        # crea clínica demo + usuarios
```

### 5. Ejecutar en desarrollo
```bash
# Terminal 1 — Backend
cd apps/api && npm run dev

# Terminal 2 — Frontend
cd apps/web && npm run dev
```

Abre: **http://localhost:5173**

### 6. Credenciales demo (después del seed)

| Rol | Email | Contraseña |
|---|---|---|
| Admin | `admin@podoclinic-demo.cl` | `Admin1234!` |
| Especialista | `especialista@podoclinic-demo.cl` | `Specialist1234!` |

---

## Hoja de Ruta

| Fase | Estado | Contenido |
|---|---|---|
| **Fase 1** | ✅ MVP | Auth completo (JWT + 2FA), CRUD pacientes, formulario consulta (secciones 1-4 y 9), generación básica de PDF |
| **Fase 2** | ✅ Completado | Secciones 5-8 (exploración, biomecánica, vascular, fotografía), firma digital, PDF completo, envío email |
| **Fase 3** | ✅ Completado | WhatsApp, auditoría completa, rate limiting avanzado, SMTP personalizado |
| **Fase 4** | 🔄 Pendiente | PWA offline, tests E2E, Swagger/OpenAPI, CI/CD |

---

## API Endpoints (Fase 1)

Base URL: `http://localhost:3001/api/v1`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | No | Health check |
| POST | `/auth/login` | No | Login + 2FA |
| POST | `/auth/refresh` | No | Renovar token |
| POST | `/auth/logout` | Sí | Cerrar sesión |
| POST | `/auth/2fa/setup` | Sí | Configurar 2FA |
| POST | `/auth/2fa/verify` | Sí | Activar 2FA |
| GET | `/patients` | Sí | Listar pacientes |
| POST | `/patients` | Sí | Crear paciente |
| GET | `/patients/:id` | Sí | Detalle paciente |
| PATCH | `/patients/:id` | Sí | Actualizar paciente |
| GET | `/patients/:id/consultations` | Sí | Consultas del paciente |
| GET | `/consultations` | Sí | Listar consultas |
| POST | `/consultations` | Sí | Crear consulta (borrador) |
| GET | `/consultations/:id` | Sí | Detalle consulta |
| PATCH | `/consultations/:id` | Sí | Guardar borrador |
| POST | `/consultations/:id/finalize` | Sí | Finalizar consulta |
| POST | `/consultations/:id/generate-pdf` | Sí | Generar PDF |
| GET | `/stats/dashboard` | Sí | Estadísticas dashboard |

---

## Seguridad implementada (Fase 1)

- ✅ Contraseñas con bcrypt (12 rondas)
- ✅ JWT access token (15 min) + refresh token rotado (7 días)
- ✅ 2FA TOTP opcional (Google Authenticator compatible)
- ✅ Secretos TOTP cifrados con AES-256-GCM en BD
- ✅ Rate limiting en auth (5 intentos / 15 min por IP)
- ✅ Aislamiento por `clinic_id` en todos los queries
- ✅ Especialistas solo ven sus propias consultas
- ✅ Audit log en acciones críticas
- ✅ Headers de seguridad con Helmet (CSP, HSTS, etc.)
- ✅ RBAC verificado en el backend

---

*PodoClinic v1.0 — Fase 1 MVP*
