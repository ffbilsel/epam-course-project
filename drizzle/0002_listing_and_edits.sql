-- Phase 3: idea listing + author edit support.
--
-- The existing `status_transitions` CHECK constraints permit any of
-- the five lifecycle states on both `from_state` and `to_state`, so
-- the `from = to = SUBMITTED` audit-marker rows required by
-- ADR-0015 are already legal at the schema level. The invariant
-- "edit markers only have `from = to`, real transitions have
-- `from != to`" is enforced by code in `editIdea` and `applyTransition`.
--
-- This migration only adds a composite index that makes the new
-- listing query plan covering for the most common filter sets.
CREATE INDEX IF NOT EXISTS `idx_ideas_search`
  ON `ideas` (`status`, `category_id`, `created_at`);
