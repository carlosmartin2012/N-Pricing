-- Deal Comments for Approval Workflow
-- Enables audit trail of approval decisions with mandatory reasons.

CREATE TABLE IF NOT EXISTS deal_comments (
  id SERIAL PRIMARY KEY,
  deal_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  action TEXT NOT NULL,         -- 'COMMENT', 'APPROVE', 'REJECT', 'SUBMIT', 'REWORK'
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_comments_read" ON deal_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "deal_comments_insert" ON deal_comments
  FOR INSERT TO authenticated WITH CHECK (true);

-- Immutable: no updates or deletes
CREATE POLICY "deal_comments_no_update" ON deal_comments FOR UPDATE USING (false);
CREATE POLICY "deal_comments_no_delete" ON deal_comments FOR DELETE USING (false);

CREATE INDEX idx_deal_comments_deal ON deal_comments(deal_id);
ALTER PUBLICATION supabase_realtime ADD TABLE deal_comments;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  sender_email TEXT,
  type TEXT NOT NULL,           -- 'APPROVAL_REQUEST', 'APPROVED', 'REJECTED', 'COMMENT'
  title TEXT NOT NULL,
  message TEXT,
  deal_id TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_read_own" ON notifications
  FOR SELECT TO authenticated
  USING (recipient_email = auth.jwt()->>'email');

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (recipient_email = auth.jwt()->>'email');

CREATE INDEX idx_notifications_recipient ON notifications(recipient_email, is_read);
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
