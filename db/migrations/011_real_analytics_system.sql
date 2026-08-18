-- Migration 011: Real-Data Analytics System Schema

CREATE TABLE IF NOT EXISTS analytics_visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id VARCHAR(128) UNIQUE NOT NULL,
    first_user_id VARCHAR(128),
    latest_user_id VARCHAR(128),
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_visits INT NOT NULL DEFAULT 1,
    total_pageviews INT NOT NULL DEFAULT 0,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    browser VARCHAR(64),
    os VARCHAR(64),
    device_category VARCHAR(32),
    country VARCHAR(64),
    region VARCHAR(64),
    first_referrer TEXT,
    first_utm_source VARCHAR(128),
    first_utm_medium VARCHAR(128),
    first_utm_campaign VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(128) UNIQUE NOT NULL,
    visitor_id VARCHAR(128) NOT NULL,
    user_id VARCHAR(128),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    entry_page TEXT NOT NULL,
    exit_page TEXT,
    page_view_count INT NOT NULL DEFAULT 1,
    event_count INT NOT NULL DEFAULT 0,
    engagement_duration INT NOT NULL DEFAULT 0,
    is_engaged BOOLEAN NOT NULL DEFAULT FALSE,
    referrer TEXT,
    referrer_domain VARCHAR(255),
    traffic_source VARCHAR(64) NOT NULL DEFAULT 'Direct',
    utm_source VARCHAR(128),
    utm_medium VARCHAR(128),
    utm_campaign VARCHAR(128),
    utm_term VARCHAR(128),
    utm_content VARCHAR(128),
    browser VARCHAR(64),
    os VARCHAR(64),
    device_category VARCHAR(32),
    country VARCHAR(64),
    region VARCHAR(64),
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_pageviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(128) NOT NULL,
    user_id VARCHAR(128),
    pathname TEXT NOT NULL,
    title TEXT,
    referrer TEXT,
    engagement_time INT NOT NULL DEFAULT 0,
    is_entry BOOLEAN NOT NULL DEFAULT FALSE,
    is_exit BOOLEAN NOT NULL DEFAULT FALSE,
    is_bounce BOOLEAN NOT NULL DEFAULT FALSE,
    device_category VARCHAR(32),
    browser VARCHAR(64),
    os VARCHAR(64),
    country VARCHAR(64),
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name VARCHAR(128) NOT NULL,
    visitor_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(128) NOT NULL,
    user_id VARCHAR(128),
    pathname TEXT NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    total_visitors INT NOT NULL DEFAULT 0,
    unique_visitors INT NOT NULL DEFAULT 0,
    new_visitors INT NOT NULL DEFAULT 0,
    returning_visitors INT NOT NULL DEFAULT 0,
    sessions INT NOT NULL DEFAULT 0,
    page_views INT NOT NULL DEFAULT 0,
    total_events INT NOT NULL DEFAULT 0,
    avg_session_duration NUMERIC(10, 2) NOT NULL DEFAULT 0,
    bounce_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_visitors_visitor_id ON analytics_visitors(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_visitors_last_seen ON analytics_visitors(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_visitors_is_bot ON analytics_visitors(is_bot);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_session_id ON analytics_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor_id ON analytics_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_id ON analytics_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started_at ON analytics_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_last_activity ON analytics_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_traffic_source ON analytics_sessions(traffic_source);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_is_bot ON analytics_sessions(is_bot);

CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_visitor_id ON analytics_pageviews(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_session_id ON analytics_pageviews(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_pathname ON analytics_pageviews(pathname);
CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_created_at ON analytics_pageviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_is_bot ON analytics_pageviews(is_bot);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id ON analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_is_bot ON analytics_events(is_bot);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_stats_date ON analytics_daily_stats(date DESC);
