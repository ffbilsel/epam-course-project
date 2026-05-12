import { afterEach } from "vitest";
import { sqliteClient } from "@/db/client";

/**
 * Per-test cleanup: empty user-data tables but keep seeded
 * categories so each test starts from the same baseline.
 */
afterEach(() => {
  sqliteClient.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM status_transitions;
    DELETE FROM attachments;
    DELETE FROM ideas;
    DELETE FROM sessions;
    DELETE FROM accounts;
    DELETE FROM verification_tokens;
    DELETE FROM categories WHERE state = 'PROPOSED' OR state = 'REJECTED';
    DELETE FROM bootstrap_admin_marker;
    DELETE FROM users;
    PRAGMA foreign_keys = ON;
  `);
});
