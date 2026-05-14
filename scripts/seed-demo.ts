/* eslint-disable no-console */
/**
 * Seeds demo content for screenshots: an EVALUATOR, an EMPLOYEE,
 * and three submitted ideas (one per common category) so the
 * reviewer queue, my-ideas, and detail screens are non-empty.
 *
 * Idempotent — safe to re-run after `db:reset && db:migrate && db:seed`.
 */
import { sql } from "drizzle-orm";
import { db, sqliteClient } from "@/db/client";
import { users, ideas, categories } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { createIdea, applyTransition, editIdea } from "@/server/idea-service";
import { listDimensionsForCategory } from "@/db/repositories/dimension-repo";
import { putRatings } from "@/server/rating-service";

async function ensureUser(opts: {
  email: string;
  displayName: string;
  role: "EMPLOYEE" | "EVALUATOR" | "ADMIN";
  password: string;
}): Promise<string> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${opts.email})`)
    .limit(1);
  if (existing[0]) {
    await db
      .update(users)
      .set({ role: opts.role, updatedAt: Date.now() })
      .where(sql`${users.id} = ${existing[0].id}`)
      .run();
    console.log(`[demo] user ${opts.email} exists -> role=${opts.role}`);
    return existing[0].id;
  }
  const id = crypto.randomUUID();
  const hash = await hashPassword(opts.password);
  const now = Date.now();
  await db
    .insert(users)
    .values({
      id,
      email: opts.email,
      passwordHash: hash,
      displayName: opts.displayName,
      role: opts.role,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  console.log(`[demo] created user ${opts.email} as ${opts.role}`);
  return id;
}

async function ensureIdea(opts: {
  title: string;
  description: string;
  categoryName: string;
  authorId: string;
  answers?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const existing = await db
    .select({ id: ideas.id })
    .from(ideas)
    .where(sql`lower(${ideas.title}) = lower(${opts.title})`)
    .limit(1);
  if (existing[0]) {
    console.log(`[demo] idea exists: ${opts.title}`);
    return;
  }
  const cat = await db
    .select({ id: categories.id })
    .from(categories)
    .where(sql`lower(${categories.name}) = lower(${opts.categoryName})`)
    .limit(1);
  if (!cat[0]) throw new Error(`category not found: ${opts.categoryName}`);
  await createIdea(
    {
      title: opts.title,
      description: opts.description,
      categoryId: cat[0].id,
      attachmentId: null,
      answers: opts.answers ?? {},
    },
    opts.authorId,
  );
  console.log(`[demo] created idea: ${opts.title}`);
}

async function main(): Promise<void> {
  await ensureUser({
    email: "evaluator@innovatepam.test",
    displayName: "Eva Reviewer",
    role: "EVALUATOR",
    password: "Passw0rd!2024",
  });
  const employeeId = await ensureUser({
    email: "employee@innovatepam.test",
    displayName: "Sam Submitter",
    role: "EMPLOYEE",
    password: "Passw0rd!2024",
  });

  await ensureIdea({
    title: "Automate weekly status reports",
    description:
      "Replace manual Friday status emails with an auto-generated digest pulling from Jira and Confluence.",
    categoryName: "Process Improvement",
    authorId: employeeId,
    answers: {
      current_process:
        "Each lead writes a status email manually every Friday by collating Jira tickets and Confluence updates.",
      pain_point:
        "Takes ~45 minutes per lead, formatting drifts, and recipients get inconsistent detail.",
      estimated_hours_saved_per_week: 6,
      customer_facing: false,
    },
  });

  await ensureIdea({
    title: "Self-service Postman collection generator",
    description:
      "Generate up-to-date Postman collections for every internal API on each merge to main.",
    categoryName: "Tooling",
    authorId: employeeId,
    answers: {
      tool_name: "postman-collection-bot",
      replaces_what: "Manual Postman collection updates that lag behind API changes.",
      estimated_setup_hours: 8,
    },
  });

  await ensureIdea({
    title: "Inline customer onboarding checklist",
    description:
      "Show new customers a contextual onboarding checklist directly inside the product instead of via email.",
    categoryName: "Customer Experience",
    authorId: employeeId,
    answers: {
      customer_segment: "New SMB customers in their first 30 days.",
      current_pain:
        "Onboarding emails are skipped; users get stuck on configuration steps and contact support.",
      expected_impact: "Drop time-to-first-value by ~30% and reduce onboarding support tickets.",
    },
  });

  // Phase 3 demo data: extra ideas + a couple of transitions/edits so
  // the filter bar, pagination, and history tab all have content.
  await ensureIdea({
    title: "Dark mode for the portal",
    description: "Add a token-driven dark theme toggle persisted per user.",
    categoryName: "Product Innovation",
    authorId: employeeId,
    answers: {
      target_users: "All portal users, particularly those working in low-light environments.",
      differentiator:
        "Token-driven theming respects OS preference, persists per user, and meets WCAG AA contrast in both modes.",
      audience: "everyone",
    },
  });
  await ensureIdea({
    title: "Bulk category re-tag",
    description: "Let admins move a batch of ideas to a different category in one action.",
    categoryName: "Tooling",
    authorId: employeeId,
    answers: {
      tool_name: "bulk-retagger",
      replaces_what: "Manual one-by-one category edits.",
      estimated_setup_hours: 4,
    },
  });

  // Run a couple of state transitions so the queue is non-trivial.
  const evaluator = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.email} = 'evaluator@innovatepam.test'`)
    .limit(1);
  const evaluatorId = evaluator[0]?.id;
  const tooling = await db
    .select({ id: ideas.id, status: ideas.status })
    .from(ideas)
    .where(sql`lower(${ideas.title}) = 'self-service postman collection generator'`)
    .limit(1);
  if (evaluatorId && tooling[0] && tooling[0].status === "SUBMITTED") {
    await applyTransition(tooling[0].id, "START_REVIEW", null, {
      id: evaluatorId,
      role: "EVALUATOR",
    });
    // Phase 4: score required dimensions before deciding.
    const toolingCat = await db
      .select({ categoryId: ideas.categoryId })
      .from(ideas)
      .where(sql`${ideas.id} = ${tooling[0].id}`)
      .limit(1);
    if (toolingCat[0]) {
      const dims = await listDimensionsForCategory(toolingCat[0].categoryId);
      await putRatings(
        tooling[0].id,
        { id: evaluatorId, role: "EVALUATOR" },
        { scores: dims.map((d) => ({ dimensionId: d.id, score: 4 })) },
      );
    }
    await applyTransition(tooling[0].id, "APPROVE", "Solid uplift, low risk.", {
      id: evaluatorId,
      role: "EVALUATOR",
    });
  }

  // Author-side edit so the history tab has an EDITED row.
  const inlineChecklist = await db
    .select({ id: ideas.id, status: ideas.status, categoryId: ideas.categoryId })
    .from(ideas)
    .where(sql`lower(${ideas.title}) = 'inline customer onboarding checklist'`)
    .limit(1);
  if (inlineChecklist[0] && inlineChecklist[0].status === "SUBMITTED") {
    await editIdea(
      inlineChecklist[0].id,
      {
        title: "Inline customer onboarding checklist (updated)",
        description:
          "Show new customers a contextual onboarding checklist directly inside the product, with progressive disclosure for power-user steps.",
        categoryId: inlineChecklist[0].categoryId,
        answers: {
          customer_segment: "New SMB customers in their first 30 days.",
          current_pain:
            "Onboarding emails are skipped; users get stuck on configuration steps and contact support.",
          expected_impact:
            "Drop time-to-first-value by ~30% and cut onboarding support tickets by half.",
        },
      },
      { id: employeeId, role: "EMPLOYEE" },
    );
  }
}

main()
  .then(() => {
    sqliteClient.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("[demo] failed:", err);
    process.exit(1);
  });
