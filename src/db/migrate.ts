import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";

migrate(db, { migrationsFolder: "./drizzle" });
console.log("[db] migrations applied");
