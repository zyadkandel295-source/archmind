-- Isolated synthetic-load telemetry for AGENTIA Analytics Center.
-- Customer-facing reports exclude these records unless a test run is selected.

ALTER TABLE analytics_visitors
  ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS test_run_id UUID,
  ADD COLUMN IF NOT EXISTS test_persona VARCHAR(64),
  ADD COLUMN IF NOT EXISTS test_scenario VARCHAR(96);

ALTER TABLE analytics_sessions
  ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS test_run_id UUID,
  ADD COLUMN IF NOT EXISTS test_persona VARCHAR(64),
  ADD COLUMN IF NOT EXISTS test_scenario VARCHAR(96);

ALTER TABLE analytics_pageviews
  ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS test_run_id UUID,
  ADD COLUMN IF NOT EXISTS test_persona VARCHAR(64),
  ADD COLUMN IF NOT EXISTS test_scenario VARCHAR(96);

ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS test_run_id UUID,
  ADD COLUMN IF NOT EXISTS test_persona VARCHAR(64),
  ADD COLUMN IF NOT EXISTS test_scenario VARCHAR(96);

CREATE TABLE IF NOT EXISTS analytics_load_test_runs (
  id UUID PRIMARY KEY,
  created_by_user_id VARCHAR(128) NOT NULL,
  target_origin TEXT NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('queued', 'running', 'stopped', 'completed', 'failed')),
  configuration JSONB NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  report JSONB,
  stop_reason TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_load_test_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL REFERENCES analytics_load_test_runs(id) ON DELETE CASCADE,
  error_name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  feature VARCHAR(96),
  status_code INTEGER,
  occurrences INTEGER NOT NULL DEFAULT 1,
  severity VARCHAR(16) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  likely_cause TEXT,
  recommended_fix TEXT,
  first_occurrence TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_occurrence TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_test_run ON analytics_events(test_run_id, created_at DESC) WHERE is_test_user;
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_test_run ON analytics_sessions(test_run_id, started_at DESC) WHERE is_test_user;
CREATE INDEX IF NOT EXISTS idx_analytics_load_test_runs_created_at ON analytics_load_test_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_load_test_errors_run ON analytics_load_test_errors(test_run_id, severity);

-- The application uses the limited `agentia_worker` database role. RLS keeps
-- browser clients out; this policy permits only the server-side worker to
-- persist and remove isolated test telemetry.
GRANT SELECT, INSERT, UPDATE, DELETE ON analytics_load_test_runs, analytics_load_test_errors TO agentia_worker;
DROP POLICY IF EXISTS agentia_worker_load_test_runs ON analytics_load_test_runs;
CREATE POLICY agentia_worker_load_test_runs ON analytics_load_test_runs FOR ALL TO agentia_worker USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS agentia_worker_load_test_errors ON analytics_load_test_errors;
CREATE POLICY agentia_worker_load_test_errors ON analytics_load_test_errors FOR ALL TO agentia_worker USING (true) WITH CHECK (true);

-- A single, recoverable cleanup command for a finished test run:
-- DELETE FROM analytics_load_test_runs WHERE id = '<test-run-id>';
-- DELETE FROM analytics_events WHERE is_test_user AND test_run_id = '<test-run-id>';
-- DELETE FROM analytics_pageviews WHERE is_test_user AND test_run_id = '<test-run-id>';
-- DELETE FROM analytics_sessions WHERE is_test_user AND test_run_id = '<test-run-id>';
-- DELETE FROM analytics_visitors WHERE is_test_user AND test_run_id = '<test-run-id>';
