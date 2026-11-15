import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // dev-фолбэк совпадает с docker-compose.dev.yml (хост-порт 5560, §5.20)
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5560/food_delivery",
  },
});
