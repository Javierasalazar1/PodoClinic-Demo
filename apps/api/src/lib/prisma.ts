import { PrismaClient } from "@prisma/client";

/** Singleton de PrismaClient para toda la aplicación */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
});

export default prisma;
