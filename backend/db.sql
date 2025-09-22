-- Create tables in dependency order

-- Users table (no dependencies)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_token TEXT,
    password_reset_token TEXT,
    password_reset_expires TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Workspaces table (no dependencies)
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    default_currency TEXT NOT NULL DEFAULT 'USD',
    default_revenue_per_conversion NUMERIC,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    data_retention_days INTEGER NOT NULL DEFAULT 730,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Memberships table (depends on users and workspaces)
CREATE TABLE memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    invited_by TEXT REFERENCES users(id),
    invitation_token TEXT,
    invitation_expires TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Accounts table (depends on workspaces)
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    platform TEXT NOT NULL,
    account_id TEXT NOT NULL,
    account_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    currency TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Campaigns table (depends on accounts)
CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    campaign_id TEXT NOT NULL,
    campaign_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    objective TEXT,
    buying_type TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Ad sets table (depends on campaigns)
CREATE TABLE ad_sets (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    adset_id TEXT NOT NULL,
    adset_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    bid_strategy TEXT,
    optimization_goal TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Ads table (depends on ad_sets)
CREATE TABLE ads (
    id TEXT PRIMARY KEY,
    adset_id TEXT NOT NULL REFERENCES ad_sets(id),
    ad_id TEXT NOT NULL,
    ad_name TEXT,
    creative_name TEXT,
    creative_thumb_url TEXT,
    creative_tags TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    ad_format TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Mapping templates table (depends on workspaces and users)
CREATE TABLE mapping_templates (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    mapping JSONB NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT NOT NULL REFERENCES users(id),
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Metrics daily table (depends on accounts, campaigns, ad_sets, ads)
CREATE TABLE metrics_daily (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    platform TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    campaign_id TEXT REFERENCES campaigns(id),
    adset_id TEXT REFERENCES ad_sets(id),
    ad_id TEXT REFERENCES ads(id),
    spend NUMERIC DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue NUMERIC DEFAULT 0,
    ctr NUMERIC,
    cpm NUMERIC,
    cpc NUMERIC,
    cpa NUMERIC,
    cvr NUMERIC,
    roas NUMERIC,
    frequency NUMERIC,
    reach INTEGER,
    video_views INTEGER,
    video_view_rate NUMERIC,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Upload jobs table (depends on workspaces, users, mapping_templates)
CREATE TABLE upload_jobs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    platform TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    rows_processed INTEGER NOT NULL DEFAULT 0,
    rows_total INTEGER NOT NULL DEFAULT 0,
    rows_success INTEGER NOT NULL DEFAULT 0,
    rows_error INTEGER NOT NULL DEFAULT 0,
    error_text TEXT,
    error_log_url TEXT,
    mapping_template_id TEXT REFERENCES mapping_templates(id),
    date_from TEXT,
    date_to TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Alert rules table (depends on workspaces and users)
CREATE TABLE alert_rules (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    metric TEXT NOT NULL,
    condition TEXT NOT NULL,
    threshold NUMERIC,
    threshold_percentage NUMERIC,
    time_window TEXT NOT NULL DEFAULT 'daily',
    platform_filter JSONB,
    account_filter JSONB,
    campaign_filter JSONB,
    severity TEXT NOT NULL DEFAULT 'warning',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notification_email BOOLEAN NOT NULL DEFAULT TRUE,
    notification_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    cooldown_minutes INTEGER NOT NULL DEFAULT 60,
    last_triggered_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Alert triggers table (depends on alert_rules, workspaces, users)
CREATE TABLE alert_triggers (
    id TEXT PRIMARY KEY,
    alert_rule_id TEXT NOT NULL REFERENCES alert_rules(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    triggered_at TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    threshold_value NUMERIC NOT NULL,
    condition_met TEXT NOT NULL,
    affected_entity_type TEXT NOT NULL,
    affected_entity_id TEXT NOT NULL,
    affected_entity_name TEXT,
    platform TEXT NOT NULL,
    details JSONB,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TEXT,
    resolved_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL
);

-- Notifications table (depends on users, workspaces, alert_triggers)
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    alert_trigger_id TEXT REFERENCES alert_triggers(id),
    related_entity_type TEXT,
    related_entity_id TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    action_url TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL
);

-- User preferences table (depends on users)
CREATE TABLE user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    email_frequency TEXT NOT NULL DEFAULT 'immediate',
    reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
    date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    number_format TEXT NOT NULL DEFAULT 'US',
    default_dashboard_view TEXT NOT NULL DEFAULT 'overview',
    theme_preference TEXT NOT NULL DEFAULT 'dark',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Shared links table (depends on workspaces and users)
CREATE TABLE shared_links (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    link_token TEXT UNIQUE NOT NULL,
    link_type TEXT NOT NULL,
    dashboard_config JSONB,
    access_level TEXT NOT NULL DEFAULT 'read_only',
    password_protected BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash TEXT,
    expires_at TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    view_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Export jobs table (depends on workspaces and users)
CREATE TABLE export_jobs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    export_type TEXT NOT NULL,
    format TEXT NOT NULL,
    filters JSONB,
    date_from TEXT,
    date_to TEXT,
    platforms JSONB,
    accounts JSONB,
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    file_url TEXT,
    file_size INTEGER,
    row_count INTEGER,
    error_message TEXT,
    expires_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Anomaly detections table (depends on workspaces and users)
CREATE TABLE anomaly_detections (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    metric TEXT NOT NULL,
    platform TEXT NOT NULL,
    date TEXT NOT NULL,
    current_value NUMERIC NOT NULL,
    expected_value NUMERIC NOT NULL,
    z_score NUMERIC NOT NULL,
    deviation_percentage NUMERIC NOT NULL,
    anomaly_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    review_notes TEXT,
    created_at TEXT NOT NULL
);

-- Creative performance table (depends on workspaces)
CREATE TABLE creative_performance (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    creative_name TEXT NOT NULL,
    creative_thumb_url TEXT,
    creative_tags TEXT,
    ad_format TEXT,
    platforms JSONB NOT NULL,
    total_spend NUMERIC NOT NULL DEFAULT 0,
    total_impressions INTEGER NOT NULL DEFAULT 0,
    total_clicks INTEGER NOT NULL DEFAULT 0,
    total_conversions INTEGER NOT NULL DEFAULT 0,
    total_revenue NUMERIC NOT NULL DEFAULT 0,
    avg_ctr NUMERIC,
    avg_cpm NUMERIC,
    avg_cpc NUMERIC,
    avg_cpa NUMERIC,
    avg_cvr NUMERIC,
    avg_roas NUMERIC,
    campaign_count INTEGER NOT NULL DEFAULT 0,
    performance_rank TEXT,
    first_seen_date TEXT NOT NULL,
    last_seen_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Workspace invitations table (depends on workspaces and users)
CREATE TABLE workspace_invitations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    invited_by TEXT NOT NULL REFERENCES users(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    invitation_token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    accepted_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Audit logs table (depends on workspaces and users)
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
);

-- User sessions table (depends on users)
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_activity_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Seed data

-- Insert users
INSERT INTO users (id, email, name, password_hash, email_verified, created_at, updated_at) VALUES
('user_001', 'john.doe@example.com', 'John Doe', 'password123', TRUE, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('user_002', 'jane.smith@example.com', 'Jane Smith', 'password123', TRUE, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('user_003', 'bob.johnson@example.com', 'Bob Johnson', 'admin123', TRUE, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('user_004', 'alice.brown@example.com', 'Alice Brown', 'user123', FALSE, '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('user_005', 'mike.wilson@example.com', 'Mike Wilson', 'password123', TRUE, '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('user_006', 'sarah.davis@example.com', 'Sarah Davis', 'admin123', TRUE, '2024-01-03T00:00:00Z', '2024-01-03T00:00:00Z'),
('user_007', 'tom.miller@example.com', 'Tom Miller', 'user123', TRUE, '2024-01-03T00:00:00Z', '2024-01-03T00:00:00Z'),
('user_008', 'emma.garcia@example.com', 'Emma Garcia', 'password123', FALSE, '2024-01-04T00:00:00Z', '2024-01-04T00:00:00Z');

-- Insert workspaces
INSERT INTO workspaces (id, name, default_currency, default_revenue_per_conversion, timezone, created_at, updated_at) VALUES
('workspace_001', 'Acme Marketing Agency', 'USD', 25.50, 'America/New_York', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('workspace_002', 'Digital Growth Co', 'EUR', 30.00, 'Europe/London', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('workspace_003', 'Performance Ads Ltd', 'GBP', 22.75, 'Europe/London', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('workspace_004', 'Global Media Solutions', 'USD', 28.00, 'America/Los_Angeles', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('workspace_005', 'E-commerce Boost', 'CAD', 35.25, 'America/Toronto', '2024-01-03T00:00:00Z', '2024-01-03T00:00:00Z');

-- Insert memberships
INSERT INTO memberships (id, user_id, workspace_id, role, status, created_at, updated_at) VALUES
('membership_001', 'user_001', 'workspace_001', 'owner', 'active', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('membership_002', 'user_002', 'workspace_001', 'admin', 'active', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('membership_003', 'user_003', 'workspace_002', 'owner', 'active', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('membership_004', 'user_004', 'workspace_002', 'member', 'active', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('membership_005', 'user_005', 'workspace_003', 'owner', 'active', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('membership_006', 'user_006', 'workspace_004', 'owner', 'active', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('membership_007', 'user_007', 'workspace_004', 'admin', 'active', '2024-01-03T00:00:00Z', '2024-01-03T00:00:00Z'),
('membership_008', 'user_008', 'workspace_005', 'owner', 'active', '2024-01-04T00:00:00Z', '2024-01-04T00:00:00Z'),
('membership_009', 'user_001', 'workspace_003', 'member', 'active', '2024-01-05T00:00:00Z', '2024-01-05T00:00:00Z'),
('membership_010', 'user_002', 'workspace_004', 'member', 'active', '2024-01-05T00:00:00Z', '2024-01-05T00:00:00Z');

-- Insert accounts
INSERT INTO accounts (id, workspace_id, platform, account_id, account_name, status, currency, created_at, updated_at) VALUES
('account_001', 'workspace_001', 'facebook', 'fb_123456789', 'Acme Facebook Ads', 'active', 'USD', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('account_002', 'workspace_001', 'google', 'ga_987654321', 'Acme Google Ads', 'active', 'USD', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('account_003', 'workspace_002', 'facebook', 'fb_555666777', 'Digital Growth FB', 'active', 'EUR', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('account_004', 'workspace_002', 'tiktok', 'tt_111222333', 'Digital Growth TikTok', 'active', 'EUR', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('account_005', 'workspace_003', 'google', 'ga_444555666', 'Performance Google', 'active', 'GBP', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('account_006', 'workspace_004', 'facebook', 'fb_777888999', 'Global Media FB', 'active', 'USD', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('account_007', 'workspace_004', 'snapchat', 'sc_222333444', 'Global Media Snap', 'active', 'USD', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('account_008', 'workspace_005', 'google', 'ga_666777888', 'E-commerce Google', 'active', 'CAD', '2024-01-03T00:00:00Z', '2024-01-03T00:00:00Z');

-- Insert campaigns
INSERT INTO campaigns (id, account_id, campaign_id, campaign_name, status, objective, buying_type, created_at, updated_at) VALUES
('campaign_001', 'account_001', 'fbcamp_001', 'Summer Sale 2024', 'active', 'CONVERSIONS', 'AUCTION', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('campaign_002', 'account_001', 'fbcamp_002', 'Brand Awareness Q1', 'active', 'BRAND_AWARENESS', 'AUCTION', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('campaign_003', 'account_002', 'gacamp_001', 'Search Campaign - Electronics', 'active', 'CONVERSIONS', 'AUCTION', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('campaign_004', 'account_003', 'fbcamp_003', 'Lead Generation Europe', 'active', 'LEAD_GENERATION', 'AUCTION', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('campaign_005', 'account_004', 'ttcamp_001', 'TikTok Video Ads', 'active', 'VIDEO_VIEWS', 'AUCTION', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('campaign_006', 'account_005', 'gacamp_002', 'Shopping Campaign UK', 'active', 'SALES', 'AUCTION', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('campaign_007', 'account_006', 'fbcamp_004', 'Retargeting Campaign', 'active', 'CONVERSIONS', 'AUCTION', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('campaign_008', 'account_007', 'sccamp_001', 'Snapchat Stories', 'active', 'APP_INSTALLS', 'AUCTION', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('campaign_009', 'account_008', 'gacamp_003', 'Display Campaign Canada', 'active', 'TRAFFIC', 'AUCTION', '2024-01-03T00:00:00Z', '2024-01-03T00:00:00Z');

-- Insert ad sets
INSERT INTO ad_sets (id, campaign_id, adset_id, adset_name, status, bid_strategy, optimization_goal, created_at, updated_at) VALUES
('adset_001', 'campaign_001', 'fbadset_001', 'Summer Sale - Desktop', 'active', 'LOWEST_COST_WITHOUT_CAP', 'CONVERSIONS', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('adset_002', 'campaign_001', 'fbadset_002', 'Summer Sale - Mobile', 'active', 'LOWEST_COST_WITHOUT_CAP', 'CONVERSIONS', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('adset_003', 'campaign_002', 'fbadset_003', 'Brand Awareness - 25-45', 'active', 'LOWEST_COST_WITHOUT_CAP', 'REACH', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('adset_004', 'campaign_003', 'gaadset_001', 'Electronics - Exact Match', 'active', 'TARGET_CPA', 'CONVERSIONS', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('adset_005', 'campaign_004', 'fbadset_004', 'Lead Gen - Lookalike', 'active', 'LOWEST_COST_WITHOUT_CAP', 'LEAD_GENERATION', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('adset_006', 'campaign_005', 'ttadset_001', 'TikTok Video - Young Adults', 'active', 'LOWEST_COST', 'VIDEO_VIEWS', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('adset_007', 'campaign_006', 'gaadset_002', 'Shopping - High Value', 'active', 'TARGET_ROAS', 'CONVERSIONS', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('adset_008', 'campaign_007', 'fbadset_005', 'Retargeting - Cart Abandoners', 'active', 'LOWEST_COST_WITHOUT_CAP', 'CONVERSIONS', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('adset_009', 'campaign_008', 'scadset_001', 'Snapchat App Install', 'active', 'AUTO_BID', 'APP_INSTALLS', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('adset_010', 'campaign_009', 'gaadset_003', 'Display - Broad Targeting', 'active', 'MAXIMIZE_CLICKS', 'CLICKS', '2024-01-03T00:00:00Z', '2024-01-03T00:00:00Z');

-- Insert ads
INSERT INTO ads (id, adset_id, ad_id, ad_name, creative_name, creative_thumb_url, creative_tags, status, ad_format, created_at, updated_at) VALUES
('ad_001', 'adset_001', 'fbad_001', 'Summer Sale Video Ad', 'Summer Collection Video', 'https://picsum.photos/500/300?random=1', 'summer,sale,video', 'active', 'SINGLE_VIDEO', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('ad_002', 'adset_001', 'fbad_002', 'Summer Sale Carousel', 'Product Carousel Creative', 'https://picsum.photos/500/300?random=2', 'summer,sale,carousel', 'active', 'CAROUSEL', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('ad_003', 'adset_002', 'fbad_003', 'Mobile Summer Ad', 'Mobile Optimized Creative', 'https://picsum.photos/500/300?random=3', 'mobile,summer,vertical', 'active', 'SINGLE_IMAGE', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('ad_004', 'adset_003', 'fbad_004', 'Brand Video Campaign', 'Brand Story Video', 'https://picsum.photos/500/300?random=4', 'brand,awareness,story', 'active', 'SINGLE_VIDEO', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('ad_005', 'adset_004', 'gaad_001', 'Electronics Search Ad', 'Text Ad Electronics', NULL, 'electronics,search,text', 'active', 'TEXT_AD', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('ad_006', 'adset_005', 'fbad_005', 'Lead Gen Form Ad', 'Lead Generation Creative', 'https://picsum.photos/500/300?random=5', 'leadgen,form,signup', 'active', 'SINGLE_IMAGE', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('ad_007', 'adset_006', 'ttad_001', 'TikTok Viral Video', 'Trending Video Creative', 'https://picsum.photos/500/300?random=6', 'tiktok,viral,trending', 'active', 'VIDEO', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('ad_008', 'adset_007', 'gaad_002', 'Shopping Product Ad', 'Product Showcase', 'https://picsum.photos/500/300?random=7', 'shopping,product,showcase', 'active', 'SHOPPING_AD', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('ad_009', 'adset_008', 'fbad_006', 'Retargeting Dynamic Ad', 'Dynamic Product Ad', 'https://picsum.photos/500/300?random=8', 'retargeting,dynamic,product', 'active', 'DYNAMIC_PRODUCT_AD', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('ad_010', 'adset_009', 'scad_001', 'Snapchat AR Filter', 'AR Experience Creative', 'https://picsum.photos/500/300?random=9', 'snapchat,ar,filter', 'active', 'AR_AD', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z');

-- Insert mapping templates
INSERT INTO mapping_templates (id, workspace_id, name, platform, mapping, is_default, is_shared, created_by, usage_count, created_at, updated_at) VALUES
('template_001', 'workspace_001', 'Facebook Standard Mapping', 'facebook', '{"date": "date", "spend": "amount_spent", "impressions": "impressions", "clicks": "clicks", "conversions": "actions"}', TRUE, TRUE, 'user_001', 15, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('template_002', 'workspace_001', 'Google Ads Mapping', 'google', '{"date": "date", "spend": "cost", "impressions": "impressions", "clicks": "clicks", "conversions": "conversions"}', TRUE, TRUE, 'user_001', 8, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('template_003', 'workspace_002', 'TikTok Custom Mapping', 'tiktok', '{"date": "stat_time_day", "spend": "spend", "impressions": "show_cnt", "clicks": "click_cnt", "conversions": "convert_cnt"}', FALSE, FALSE, 'user_003', 3, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('template_004', 'workspace_003', 'Snapchat Mapping', 'snapchat', '{"date": "start_time", "spend": "spend", "impressions": "impressions", "clicks": "swipes", "conversions": "conversion"}', TRUE, TRUE, 'user_005', 5, '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z');

-- Insert daily metrics data
INSERT INTO metrics_daily (id, date, platform, account_id, campaign_id, adset_id, ad_id, spend, impressions, clicks, conversions, revenue, ctr, cpm, cpc, cpa, cvr, roas, frequency, reach, created_at, updated_at) VALUES
('metric_001', '2024-01-15', 'facebook', 'account_001', 'campaign_001', 'adset_001', 'ad_001', 250.75, 12500, 625, 25, 637.50, 5.0, 20.06, 0.40, 10.03, 4.0, 2.54, 1.8, 6944, '2024-01-16T00:00:00Z', '2024-01-16T00:00:00Z'),
('metric_002', '2024-01-15', 'facebook', 'account_001', 'campaign_001', 'adset_001', 'ad_002', 180.25, 9500, 380, 18, 459.00, 4.0, 18.97, 0.47, 10.01, 4.7, 2.55, 1.5, 6333, '2024-01-16T00:00:00Z', '2024-01-16T00:00:00Z'),
('metric_003', '2024-01-15', 'facebook', 'account_001', 'campaign_001', 'adset_002', 'ad_003', 320.50, 15800, 790, 32, 816.00, 5.0, 20.28, 0.41, 10.02, 4.1, 2.55, 2.1, 7523, '2024-01-16T00:00:00Z', '2024-01-16T00:00:00Z'),
('metric_004', '2024-01-15', 'google', 'account_002', 'campaign_003', 'adset_004', 'ad_005', 450.80, 8950, 448, 35, 892.50, 5.0, 50.36, 1.01, 12.88, 7.8, 1.98, 1.3, 6885, '2024-01-16T00:00:00Z', '2024-01-16T00:00:00Z'),
('metric_005', '2024-01-15', 'tiktok', 'account_004', 'campaign_005', 'adset_006', 'ad_007', 125.30, 25600, 512, 20, 510.00, 2.0, 4.89, 0.24, 6.27, 3.9, 4.07, 2.8, 9142, '2024-01-16T00:00:00Z', '2024-01-16T00:00:00Z'),
('metric_006', '2024-01-16', 'facebook', 'account_001', 'campaign_001', 'adset_001', 'ad_001', 275.25, 13200, 660, 28, 714.00, 5.0, 20.85, 0.42, 9.83, 4.2, 2.59, 1.9, 6947, '2024-01-17T00:00:00Z', '2024-01-17T00:00:00Z'),
('metric_007', '2024-01-16', 'google', 'account_002', 'campaign_003', 'adset_004', 'ad_005', 485.60, 9250, 462, 38, 969.00, 5.0, 52.49, 1.05, 12.78, 8.2, 2.00, 1.4, 6615, '2024-01-17T00:00:00Z', '2024-01-17T00:00:00Z'),
('metric_008', '2024-01-16', 'snapchat', 'account_007', 'campaign_008', 'adset_009', 'ad_010', 95.75, 18500, 370, 15, 382.50, 2.0, 5.18, 0.26, 6.38, 4.1, 3.99, 2.5, 7400, '2024-01-17T00:00:00Z', '2024-01-17T00:00:00Z'),
('metric_009', '2024-01-17', 'facebook', 'account_003', 'campaign_004', 'adset_005', 'ad_006', 195.40, 11800, 590, 24, 612.00, 5.0, 16.56, 0.33, 8.14, 4.1, 3.13, 1.7, 6941, '2024-01-18T00:00:00Z', '2024-01-18T00:00:00Z'),
('metric_010', '2024-01-17', 'google', 'account_005', 'campaign_006', 'adset_007', 'ad_008', 380.90, 7650, 383, 31, 790.50, 5.0, 49.79, 0.99, 12.29, 8.1, 2.08, 1.2, 6375, '2024-01-18T00:00:00Z', '2024-01-18T00:00:00Z');

-- Insert upload jobs
INSERT INTO upload_jobs (id, workspace_id, user_id, filename, original_filename, file_size, platform, status, progress, rows_processed, rows_total, rows_success, rows_error, mapping_template_id, date_from, date_to, created_at, updated_at) VALUES
('upload_001', 'workspace_001', 'user_001', 'fb_data_20240115.csv', 'facebook_data_january_2024.csv', 2048576, 'facebook', 'completed', 100, 1500, 1500, 1485, 15, 'template_001', '2024-01-01', '2024-01-15', '2024-01-15T10:00:00Z', '2024-01-15T10:45:00Z'),
('upload_002', 'workspace_001', 'user_002', 'ga_data_20240115.csv', 'google_ads_january_2024.csv', 1536000, 'google', 'completed', 100, 800, 800, 800, 0, 'template_002', '2024-01-01', '2024-01-15', '2024-01-15T14:00:00Z', '2024-01-15T14:22:00Z'),
('upload_003', 'workspace_002', 'user_003', 'tt_data_20240116.csv', 'tiktok_campaign_data.csv', 512000, 'tiktok', 'processing', 75, 300, 400, 300, 0, 'template_003', '2024-01-10', '2024-01-16', '2024-01-16T09:00:00Z', '2024-01-16T09:00:00Z'),
('upload_004', 'workspace_003', 'user_005', 'snap_data_20240117.csv', 'snapchat_metrics.csv', 768000, 'snapchat', 'queued', 0, 0, 600, 0, 0, 'template_004', '2024-01-12', '2024-01-17', '2024-01-17T11:00:00Z', '2024-01-17T11:00:00Z');

-- Insert alert rules
INSERT INTO alert_rules (id, workspace_id, created_by, name, metric, condition, threshold, time_window, severity, is_active, created_at, updated_at) VALUES
('alert_001', 'workspace_001', 'user_001', 'High CPA Alert', 'cpa', 'greater_than', 15.00, 'daily', 'warning', TRUE, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('alert_002', 'workspace_001', 'user_001', 'Low ROAS Alert', 'roas', 'less_than', 2.0, 'daily', 'critical', TRUE, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('alert_003', 'workspace_002', 'user_003', 'Spend Spike Alert', 'spend', 'percentage_increase', NULL, 'daily', 'warning', TRUE, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('alert_004', 'workspace_003', 'user_005', 'Conversion Drop Alert', 'conversions', 'percentage_decrease', NULL, 'daily', 'critical', TRUE, '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z');

-- Insert alert triggers
INSERT INTO alert_triggers (id, alert_rule_id, workspace_id, triggered_at, metric_value, threshold_value, condition_met, affected_entity_type, affected_entity_id, affected_entity_name, platform, is_resolved, created_at) VALUES
('trigger_001', 'alert_002', 'workspace_001', '2024-01-16T08:00:00Z', 1.85, 2.0, 'roas_below_threshold', 'campaign', 'campaign_001', 'Summer Sale 2024', 'facebook', FALSE, '2024-01-16T08:00:00Z'),
('trigger_002', 'alert_001', 'workspace_001', '2024-01-17T09:00:00Z', 16.50, 15.0, 'cpa_above_threshold', 'adset', 'adset_004', 'Electronics - Exact Match', 'google', TRUE, '2024-01-17T09:00:00Z'),
('trigger_003', 'alert_003', 'workspace_002', '2024-01-17T10:00:00Z', 25.5, 20.0, 'spend_increase_27_percent', 'account', 'account_003', 'Digital Growth FB', 'facebook', FALSE, '2024-01-17T10:00:00Z');

-- Insert notifications
INSERT INTO notifications (id, user_id, workspace_id, type, title, message, alert_trigger_id, priority, is_read, created_at) VALUES
('notif_001', 'user_001', 'workspace_001', 'alert', 'Low ROAS Alert', 'Campaign "Summer Sale 2024" has ROAS of 1.85, below threshold of 2.0', 'trigger_001', 'high', FALSE, '2024-01-16T08:01:00Z'),
('notif_002', 'user_001', 'workspace_001', 'alert', 'High CPA Alert', 'Ad Set "Electronics - Exact Match" has CPA of $16.50, above threshold of $15.00', 'trigger_002', 'medium', TRUE, '2024-01-17T09:01:00Z'),
('notif_003', 'user_003', 'workspace_002', 'alert', 'Spend Spike Alert', 'Account "Digital Growth FB" spend increased by 27% compared to yesterday', 'trigger_003', 'medium', FALSE, '2024-01-17T10:01:00Z'),
('notif_004', 'user_001', 'workspace_001', 'system', 'Upload Complete', 'Your Facebook data upload has completed successfully with 1485 rows processed', NULL, 'normal', TRUE, '2024-01-15T10:45:00Z'),
('notif_005', 'user_002', 'workspace_001', 'system', 'Upload Complete', 'Your Google Ads data upload has completed successfully with 800 rows processed', NULL, 'normal', TRUE, '2024-01-15T14:22:00Z');

-- Insert user preferences
INSERT INTO user_preferences (id, user_id, email_notifications, in_app_notifications, email_frequency, theme_preference, created_at, updated_at) VALUES
('pref_001', 'user_001', TRUE, TRUE, 'immediate', 'dark', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('pref_002', 'user_002', TRUE, TRUE, 'daily', 'light', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('pref_003', 'user_003', FALSE, TRUE, 'weekly', 'dark', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('pref_004', 'user_005', TRUE, TRUE, 'immediate', 'auto', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z'),
('pref_005', 'user_006', TRUE, FALSE, 'daily', 'dark', '2024-01-03T00:00:00Z', '2024-01-03T00:00:00Z');

-- Insert shared links
INSERT INTO shared_links (id, workspace_id, created_by, link_token, link_type, access_level, password_protected, expires_at, is_active, view_count, created_at, updated_at) VALUES
('link_001', 'workspace_001', 'user_001', 'share_abc123def456', 'dashboard', 'read_only', FALSE, '2024-02-15T23:59:59Z', TRUE, 25, '2024-01-15T00:00:00Z', '2024-01-17T00:00:00Z'),
('link_002', 'workspace_002', 'user_003', 'share_xyz789ghi012', 'report', 'read_only', TRUE, '2024-01-31T23:59:59Z', TRUE, 8, '2024-01-16T00:00:00Z', '2024-01-16T00:00:00Z'),
('link_003', 'workspace_003', 'user_005', 'share_mno345pqr678', 'dashboard', 'view_only', FALSE, NULL, TRUE, 12, '2024-01-17T00:00:00Z', '2024-01-17T00:00:00Z');

-- Insert export jobs
INSERT INTO export_jobs (id, workspace_id, user_id, export_type, format, date_from, date_to, status, progress, file_size, row_count, expires_at, created_at, updated_at) VALUES
('export_001', 'workspace_001', 'user_001', 'metrics', 'csv', '2024-01-01', '2024-01-15', 'completed', 100, 1048576, 1500, '2024-01-22T23:59:59Z', '2024-01-15T16:00:00Z', '2024-01-15T16:15:00Z'),
('export_002', 'workspace_002', 'user_003', 'campaigns', 'xlsx', '2024-01-10', '2024-01-17', 'processing', 60, NULL, NULL, '2024-01-24T23:59:59Z', '2024-01-17T14:00:00Z', '2024-01-17T14:00:00Z'),
('export_003', 'workspace_001', 'user_002', 'creative_performance', 'pdf', '2024-01-01', '2024-01-16', 'queued', 0, NULL, NULL, '2024-01-23T23:59:59Z', '2024-01-17T15:00:00Z', '2024-01-17T15:00:00Z');

-- Insert anomaly detections
INSERT INTO anomaly_detections (id, workspace_id, entity_type, entity_id, metric, platform, date, current_value, expected_value, z_score, deviation_percentage, anomaly_type, severity, is_reviewed, created_at) VALUES
('anomaly_001', 'workspace_001', 'campaign', 'campaign_001', 'ctr', 'facebook', '2024-01-16', 2.8, 5.0, -2.5, -44.0, 'drop', 'high', FALSE, '2024-01-17T06:00:00Z'),
('anomaly_002', 'workspace_002', 'adset', 'adset_005', 'spend', 'facebook', '2024-01-17', 350.0, 200.0, 3.2, 75.0, 'spike', 'medium', TRUE, '2024-01-18T06:00:00Z'),
('anomaly_003', 'workspace_003', 'ad', 'ad_008', 'conversions', 'google', '2024-01-17', 5, 25, -2.8, -80.0, 'drop', 'critical', FALSE, '2024-01-18T06:00:00Z');

-- Insert creative performance
INSERT INTO creative_performance (id, workspace_id, creative_name, creative_thumb_url, creative_tags, ad_format, platforms, total_spend, total_impressions, total_clicks, total_conversions, total_revenue, avg_ctr, avg_cpm, campaign_count, first_seen_date, last_seen_date, created_at, updated_at) VALUES
('creative_001', 'workspace_001', 'Summer Collection Video', 'https://picsum.photos/500/300?random=10', 'summer,sale,video', 'SINGLE_VIDEO', '["facebook"]', 850.50, 42500, 2125, 85, 2167.50, 5.0, 20.01, 3, '2024-01-01', '2024-01-17', '2024-01-17T00:00:00Z', '2024-01-17T00:00:00Z'),
('creative_002', 'workspace_001', 'Product Carousel Creative', 'https://picsum.photos/500/300?random=11', 'summer,sale,carousel', 'CAROUSEL', '["facebook"]', 620.75, 31500, 1260, 63, 1606.50, 4.0, 19.71, 2, '2024-01-01', '2024-01-16', '2024-01-17T00:00:00Z', '2024-01-17T00:00:00Z'),
('creative_003', 'workspace_004', 'Trending Video Creative', 'https://picsum.photos/500/300?random=12', 'tiktok,viral,trending', 'VIDEO', '["tiktok"]', 425.30, 87600, 1752, 68, 1734.00, 2.0, 4.85, 1, '2024-01-01', '2024-01-17', '2024-01-17T00:00:00Z', '2024-01-17T00:00:00Z');

-- Insert workspace invitations
INSERT INTO workspace_invitations (id, workspace_id, invited_by, email, role, invitation_token, status, expires_at, created_at, updated_at) VALUES
('invite_001', 'workspace_001', 'user_001', 'newuser1@example.com', 'member', 'invite_token_abc123', 'pending', '2024-01-25T23:59:59Z', '2024-01-18T10:00:00Z', '2024-01-18T10:00:00Z'),
('invite_002', 'workspace_002', 'user_003', 'analyst@example.com', 'admin', 'invite_token_def456', 'pending', '2024-01-25T23:59:59Z', '2024-01-18T11:00:00Z', '2024-01-18T11:00:00Z'),
('invite_003', 'workspace_004', 'user_006', 'manager@example.com', 'admin', 'invite_token_ghi789', 'accepted', '2024-01-25T23:59:59Z', '2024-01-17T14:00:00Z', '2024-01-18T09:00:00Z');

-- Insert audit logs
INSERT INTO audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, ip_address, user_agent, created_at) VALUES
('audit_001', 'workspace_001', 'user_001', 'upload_data', 'upload_job', 'upload_001', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '2024-01-15T10:00:00Z'),
('audit_002', 'workspace_001', 'user_002', 'create_alert', 'alert_rule', 'alert_001', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', '2024-01-15T14:00:00Z'),
('audit_003', 'workspace_001', 'user_001', 'share_dashboard', 'shared_link', 'link_001', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '2024-01-15T16:00:00Z'),
('audit_004', 'workspace_002', 'user_003', 'invite_user', 'workspace_invitation', 'invite_002', '10.0.0.50', 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15', '2024-01-18T11:00:00Z'),
('audit_005', 'workspace_001', 'user_001', 'export_data', 'export_job', 'export_001', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '2024-01-15T16:00:00Z');

-- Insert user sessions
INSERT INTO user_sessions (id, user_id, session_token, refresh_token, ip_address, user_agent, is_active, last_activity_at, expires_at, created_at) VALUES
('session_001', 'user_001', 'sess_abc123def456ghi789', 'refresh_xyz789abc123def', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', TRUE, '2024-01-18T15:30:00Z', '2024-01-25T15:30:00Z', '2024-01-18T10:00:00Z'),
('session_002', 'user_002', 'sess_def456ghi789jkl012', 'refresh_abc123def456ghi', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', TRUE, '2024-01-18T14:45:00Z', '2024-01-25T14:45:00Z', '2024-01-18T09:15:00Z'),
('session_003', 'user_003', 'sess_ghi789jkl012mno345', 'refresh_def456ghi789jkl', '10.0.0.50', 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15', TRUE, '2024-01-18T16:00:00Z', '2024-01-25T16:00:00Z', '2024-01-18T11:30:00Z'),
('session_004', 'user_005', 'sess_jkl012mno345pqr678', 'refresh_ghi789jkl012mno', '172.16.0.25', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', FALSE, '2024-01-17T18:00:00Z', '2024-01-24T18:00:00Z', '2024-01-17T12:00:00Z');