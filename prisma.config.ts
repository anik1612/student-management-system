import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moves the connection URL and the seed command out of schema.prisma into this file.
 *
 * `DATABASE_URL` is read leniently rather than with prisma's `env()` helper: `prisma generate`
 * runs on `npm install`, before anyone has copied `.env.example` to `.env`, and it does not need a
 * database. Commands that genuinely need a connection fail with the message below instead.
 */
const url =
  process.env.DATABASE_URL ??
  "postgresql://DATABASE_URL-is-not-set-copy-.env.example-to-.env@localhost:5432/unset";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url },
});
