import { sql } from "drizzle-orm";
import { db, sqliteClient } from "./client";
import { categories } from "./schema";
import {
  type CategoryFieldDefinition,
  CategoryFieldSchema,
} from "@/lib/validation/category-fields";

const PROCESS_IMPROVEMENT_ID = "11111111-1111-4111-8111-111111111101";
const TOOLING_ID = "11111111-1111-4111-8111-111111111102";
const CUSTOMER_EXPERIENCE_ID = "11111111-1111-4111-8111-111111111103";
const COST_SAVINGS_ID = "11111111-1111-4111-8111-111111111104";
const OTHER_ID = "11111111-1111-4111-8111-1111111111ff";
const PRODUCT_INNOVATION_ID = "11111111-1111-4111-8111-111111111105";

const SEED_CATEGORIES: Array<{ id: string; name: string; isProtected: number }> = [
  { id: PROCESS_IMPROVEMENT_ID, name: "Process Improvement", isProtected: 0 },
  { id: PRODUCT_INNOVATION_ID, name: "Product Innovation", isProtected: 0 },
  { id: TOOLING_ID, name: "Tooling", isProtected: 0 },
  { id: CUSTOMER_EXPERIENCE_ID, name: "Customer Experience", isProtected: 0 },
  { id: COST_SAVINGS_ID, name: "Cost Savings", isProtected: 0 },
  { id: OTHER_ID, name: "Other", isProtected: 1 },
];

/**
 * Per-category structured field schemas (Phase 2). Asserted by the
 * integration suites in `tests/integration/` so seed content and
 * test fixtures cannot drift (FR-009).
 */
const SEED_SCHEMAS: Record<string, CategoryFieldDefinition[]> = {
  [PROCESS_IMPROVEMENT_ID]: [
    {
      key: "current_process",
      label: "Describe the current process",
      type: "LONG_TEXT",
      required: true,
    },
    {
      key: "pain_point",
      label: "What is the main pain point?",
      type: "LONG_TEXT",
      required: true,
    },
    {
      key: "estimated_hours_saved_per_week",
      label: "Estimated hours saved per week",
      type: "NUMBER",
      required: true,
      min: 0,
      max: 168,
    },
    {
      key: "customer_facing",
      label: "Is the impact customer-facing?",
      type: "YES_NO",
      required: false,
    },
  ],
  [PRODUCT_INNOVATION_ID]: [
    {
      key: "target_users",
      label: "Who are the target users?",
      type: "SHORT_TEXT",
      required: true,
    },
    {
      key: "differentiator",
      label: "What makes this different from existing solutions?",
      type: "LONG_TEXT",
      required: true,
    },
    {
      key: "audience",
      label: "Who benefits most?",
      type: "SINGLE_CHOICE",
      required: false,
      options: [
        { value: "engineering", label: "Engineering teams" },
        { value: "delivery", label: "Delivery teams" },
        { value: "everyone", label: "Everyone" },
      ],
    },
  ],
  [TOOLING_ID]: [
    {
      key: "tool_name",
      label: "Tool name",
      type: "SHORT_TEXT",
      required: true,
    },
    {
      key: "replaces_what",
      label: "What does it replace?",
      type: "LONG_TEXT",
      required: false,
    },
    {
      key: "estimated_setup_hours",
      label: "Estimated setup hours",
      type: "NUMBER",
      required: false,
      min: 0,
      max: 40,
    },
  ],
  [CUSTOMER_EXPERIENCE_ID]: [
    {
      key: "customer_segment",
      label: "Which customer segment is affected?",
      type: "SHORT_TEXT",
      required: true,
    },
    {
      key: "current_pain",
      label: "What is the current customer pain?",
      type: "LONG_TEXT",
      required: true,
    },
    {
      key: "expected_impact",
      label: "Expected impact on the segment",
      type: "LONG_TEXT",
      required: true,
    },
  ],
  [COST_SAVINGS_ID]: [],
  [OTHER_ID]: [],
};

/**
 * Idempotent seed of the six default categories (FR-014). Safe to
 * re-run; categories upsert by id (insert-or-ignore on lower-name)
 * and the structured-field schema is always overwritten to match
 * the canonical Phase 2 fixtures.
 */
function seed(): void {
  const now = Date.now();
  for (const c of SEED_CATEGORIES) {
    const fields = SEED_SCHEMAS[c.id] ?? [];
    const serialised = JSON.stringify(CategoryFieldSchema.parse(fields));
    db.insert(categories)
      .values({
        id: c.id,
        name: c.name,
        state: "ACTIVE",
        proposedById: null,
        decidedById: null,
        decidedAt: null,
        createdAt: now,
        isProtected: c.isProtected,
        fieldSchema: serialised,
      })
      .onConflictDoNothing({ target: sql`(lower(name))` })
      .run();
    // Always overwrite the schema on existing rows so re-seeding
    // brings stale schemas into line with the spec (FR-014).
    db.update(categories)
      .set({ fieldSchema: serialised })
      .where(sql`lower(${categories.name}) = lower(${c.name})`)
      .run();
  }
  console.log(`[db] seeded ${SEED_CATEGORIES.length} default categories`);
  sqliteClient.close();
}

seed();
