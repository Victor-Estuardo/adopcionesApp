import { Prisma, PrismaClient } from "@prisma/client";
import { LOG_COLORS } from "~/utils/common";

export type PrismaUtilResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function createPrismaClient() {
  return new PrismaClient().$extends({
    query: {
      $allOperations: async ({ operation, model, args, query }) => {
        const startTime = Date.now();
        console.log(
          `${LOG_COLORS.FgGreen}%s%s${LOG_COLORS.Reset}`,
          `[PRISMA] ${model}.${operation} - Args: `,
          JSON.stringify(args),
        );

        try {
          const result = await query(args);
          const duration = Date.now() - startTime;

          console.log(
            `${LOG_COLORS.FgGreen}%s${LOG_COLORS.Reset}`,
            `[PRISMA SUCCESS] ${model}.${operation} completado en ${duration}ms`,
          );

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(
            `[PRISMA ERROR] ${model}.${operation} falló en ${duration}ms:`,
            error,
          );
          throw error;
        }
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
  var __db__: ExtendedPrismaClient | undefined;
}

let prisma: ExtendedPrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = createPrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = createPrismaClient();
  }
  prisma = global.__db__;
}

// Manejo de señales para cerrar conexiones limpiamente
const gracefulShutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

export async function handlePosiblePrismaError<T>(
  action: () => Promise<T>,
): Promise<PrismaUtilResponse<T>> {
  try {
    const result = await action();

    return { success: true, data: result };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Error
    ) {
      // Errores conocidos (por ejemplo, violación de clave única)
      return { success: false, error: error.message };
    } else {
      return { success: false, error: String(error) };
    }
  }
}

export default prisma;
