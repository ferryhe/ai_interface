CREATE TYPE mission_status AS ENUM (
  'draft',
  'needs_confirmation',
  'approved',
  'executing',
  'completed',
  'failed'
);

CREATE TYPE mission_risk_level AS ENUM (
  'low',
  'medium',
  'high'
);

CREATE TYPE mission_plan_revision_status AS ENUM (
  'draft',
  'approved',
  'superseded',
  'executed'
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE missions (
  mission_id text PRIMARY KEY,
  title text NOT NULL,
  user_goal text NOT NULL,
  status mission_status NOT NULL DEFAULT 'draft',
  risk_level mission_risk_level NOT NULL,
  approved_at timestamp with time zone,
  approved_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE mission_plan_revisions (
  revision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id text NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  status mission_plan_revision_status NOT NULL DEFAULT 'draft',
  plan_json jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mission_plan_revisions_mission_revision_number_unique_idx
  ON mission_plan_revisions (mission_id, revision_number);
CREATE INDEX mission_plan_revisions_mission_status_idx
  ON mission_plan_revisions (mission_id, status);

CREATE TABLE mission_execution_links (
  mission_id text NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
  revision_id uuid NOT NULL REFERENCES mission_plan_revisions(revision_id) ON DELETE CASCADE,
  thread_id uuid REFERENCES agent_threads(id) ON DELETE SET NULL,
  pipeline_run_id uuid REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  source_agent_run_id text,
  executed_at timestamp with time zone
 );

CREATE UNIQUE INDEX mission_execution_links_mission_revision_unique_idx
  ON mission_execution_links (mission_id, revision_id);
CREATE INDEX mission_execution_links_pipeline_idx
  ON mission_execution_links (pipeline_run_id);
