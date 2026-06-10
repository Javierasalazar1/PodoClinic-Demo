import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import { authRouter } from "./routes/auth";
import { patientsRouter } from "./routes/patients";
import { consultationsRouter } from "./routes/consultations";
import { statsRouter } from "./routes/stats";
import { clinicRouter } from "./routes/clinic";
import { specialistsRouter } from "./routes/specialists";
import { remindersRouter } from "./routes/reminders";
import { errorHandler } from "./middleware/errorHandler";
import logger from "./lib/logger";
import { setupSwagger } from "./swagger";
import { startDemoResetJob } from "./jobs/demoReset";

dotenv.config();

const app = express();
const port = process.env.PORT ?? 3001;

// Moved below CORS

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

app.use(
  cors({
    origin: [
      "https://podo-clinic-demo-web.vercel.app",
      "http://localhost:5173"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);


app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Rate limiting global (200 req / 15 min por IP)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes, intenta en unos minutos.", code: "RATE_LIMITED" },
  })
);

// Rate limiting estricto para autenticación (5 req / 15 min por IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de autenticación. Intenta en 15 minutos.", code: "AUTH_RATE_LIMITED" },
  skipSuccessfulRequests: true, // Solo cuenta las fallidas
});

// Health check
app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Swagger
setupSwagger(app);

// Routes
// Apply strict auth rate limiting only to credential-based endpoints, not refresh
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/forgot-password", authLimiter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/patients", patientsRouter);
app.use("/api/v1/consultations", consultationsRouter);
app.use("/api/v1/stats", statsRouter);
app.use("/api/v1/clinic", clinicRouter);
app.use("/api/v1/specialists", specialistsRouter);
app.use("/api/v1/reminders", remindersRouter);

// Error handler (must be last)
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    logger.info(`Podelyx API running on port ${port}`);
    if (process.env.DEMO_MODE === "true") {
      logger.info("[DEMO] 🎭 Modo demo activo — datos se reinician automáticamente cada 24h");
      startDemoResetJob();
    }
  });
}

export default app;
