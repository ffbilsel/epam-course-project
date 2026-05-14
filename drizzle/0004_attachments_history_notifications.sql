-- Phase 5 — Attachments, Version History & Notifications (feature 005)
-- See specs/005-attachments-history-notifications/data-model.md §1.

PRAGMA foreign_keys = OFF;
--> statement-breakpoint
DROP INDEX IF EXISTS uniq_attachments_idea;
--> statement-breakpoint
ALTER TABLE attachments ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX idx_attachments_idea_order ON attachments(idea_id, display_order);
--> statement-breakpoint
CREATE TABLE idea_versions (
  id               TEXT PRIMARY KEY,
  idea_id          TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  version_no       INTEGER NOT NULL,
  actor_id         TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at       INTEGER NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  category_id      TEXT REFERENCES categories(id) ON DELETE SET NULL,
  category_answers TEXT NOT NULL DEFAULT '[]',
  attachment_ids   TEXT NOT NULL DEFAULT '[]',
  UNIQUE (idea_id, version_no)
);
--> statement-breakpoint
CREATE INDEX idx_idea_versions_idea_created ON idea_versions(idea_id, created_at);
--> statement-breakpoint
CREATE TABLE notification_events (
  id            TEXT PRIMARY KEY,
  recipient_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  idea_id       TEXT REFERENCES ideas(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN (
                  'STATUS_CHANGED','COMMENT_ADDED','RATING_ADDED',
                  'REPLY_ON_REVIEW','BULK_DIGEST')),
  payload       TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  read_at       INTEGER
);
--> statement-breakpoint
CREATE INDEX idx_notifications_recipient_created
  ON notification_events(recipient_id, created_at);
--> statement-breakpoint
CREATE INDEX idx_notifications_recipient_unread
  ON notification_events(recipient_id) WHERE read_at IS NULL;
--> statement-breakpoint
CREATE TABLE email_deliveries (
  id               TEXT PRIMARY KEY,
  event_id         TEXT NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                     'pending','sent','failed','suppressed')),
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  last_attempt_at  INTEGER,
  next_attempt_at  INTEGER,
  created_at       INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_email_deliveries_due ON email_deliveries(status, next_attempt_at);
--> statement-breakpoint
CREATE TABLE email_preferences (
  user_id                      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status_changes               INTEGER NOT NULL DEFAULT 1 CHECK (status_changes IN (0, 1)),
  comments_on_my_ideas         INTEGER NOT NULL DEFAULT 1 CHECK (comments_on_my_ideas IN (0, 1)),
  ratings_on_my_ideas          INTEGER NOT NULL DEFAULT 1 CHECK (ratings_on_my_ideas IN (0, 1)),
  replies_on_ideas_i_review    INTEGER NOT NULL DEFAULT 1 CHECK (replies_on_ideas_i_review IN (0, 1)),
  updated_at                   INTEGER NOT NULL
);
--> statement-breakpoint
INSERT INTO idea_versions (id, idea_id, version_no, actor_id, created_at,
                           title, description, category_id, category_answers, attachment_ids)
SELECT
  lower(hex(randomblob(16))),
  i.id, 1, i.author_id, i.created_at,
  i.title, i.description, i.category_id, i.category_answers,
  IFNULL((
    SELECT '[' || group_concat('"' || a.id || '"', ',') || ']'
    FROM (SELECT id FROM attachments
          WHERE idea_id = i.id
          ORDER BY display_order, uploaded_at) a
  ), '[]')
FROM ideas i;
--> statement-breakpoint
PRAGMA foreign_keys = ON;
