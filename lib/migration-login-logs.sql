CREATE TABLE IF NOT EXISTS login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  school_name text,
  is_admin boolean DEFAULT false,
  logged_in_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_logs_email_idx ON login_logs(email);
CREATE INDEX IF NOT EXISTS login_logs_logged_in_at_idx ON login_logs(logged_in_at DESC);
