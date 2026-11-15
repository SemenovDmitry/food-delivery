import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * postgres-js без mkdir/WAL — это было для SQLite (§5.5).
 * Dev-фолбэк совпадает с docker-compose.dev.yml (хост-порт 5560, §5.20).
 */
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5560/food_delivery";

// max: 1 — чтобы drizzle-kit migrate не исчерпывал соединения
const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });
