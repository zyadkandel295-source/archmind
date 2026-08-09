-- Migration 010: AGENTIA AI BASE Database Schema

create table if not exists ai_base_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text,
  category text not null, -- 'fundamentals' | 'math' | 'ml' | 'deep-learning' | 'llms' | 'cv' | 'nlp' | 'agents' | 'build'
  difficulty text not null default 'intermediate', -- 'beginner' | 'intermediate' | 'advanced'
  overview text not null,
  intuition text,
  mathematical_formulation jsonb default '[]'::jsonb,
  architecture text,
  algorithm text,
  pseudocode text,
  python_implementation text,
  bash_commands jsonb default '[]'::jsonb,
  complexity jsonb default '{}'::jsonb,
  failure_modes jsonb default '[]'::jsonb,
  real_world_applications jsonb default '[]'::jsonb,
  research_directions jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ai_base_articles_category on ai_base_articles(category);
create index if not exists idx_ai_base_articles_slug on ai_base_articles(slug);

create table if not exists ai_base_science (
  id uuid primary key default gen_random_uuid(),
  domain text unique not null, -- 'biology' | 'medicine' | 'chemistry' | 'physics' | 'astronomy' | 'climate' | 'materials' | 'neuroscience' | 'quantum'
  title text not null,
  overview text not null,
  key_algorithms jsonb default '[]'::jsonb,
  models_used jsonb default '[]'::jsonb,
  datasets jsonb default '[]'::jsonb,
  workflows jsonb default '[]'::jsonb,
  breakthroughs jsonb default '[]'::jsonb,
  open_problems jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists ai_base_papers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors jsonb default '[]'::jsonb,
  year int not null,
  venue text,
  arxiv_id text,
  doi text,
  abstract text not null,
  category text not null,
  methodology text,
  equations jsonb default '[]'::jsonb,
  dataset text,
  model text,
  main_result text,
  limitations text,
  code_url text,
  created_at timestamptz default now()
);

create index if not exists idx_ai_base_papers_category on ai_base_papers(category);

create table if not exists ai_base_timeline (
  id uuid primary key default gen_random_uuid(),
  year text not null,
  title text not null,
  category text not null,
  description text not null,
  significance text not null,
  key_paper_title text,
  created_at timestamptz default now()
);
