import { z } from 'zod';
// ================================
// USERS SCHEMAS
// ================================
export const userSchema = z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    password_hash: z.string(),
    email_verified: z.boolean(),
    email_verification_token: z.string().nullable(),
    password_reset_token: z.string().nullable(),
    password_reset_expires: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createUserInputSchema = z.object({
    email: z.string().email().min(1).max(255),
    name: z.string().min(1).max(255),
    password: z.string().min(6),
    email_verified: z.boolean().default(false),
    email_verification_token: z.string().nullable().optional(),
    password_reset_token: z.string().nullable().optional(),
    password_reset_expires: z.string().nullable().optional()
});
export const updateUserInputSchema = z.object({
    id: z.string(),
    email: z.string().email().min(1).max(255).optional(),
    name: z.string().min(1).max(255).optional(),
    password_hash: z.string().min(1).optional(),
    email_verified: z.boolean().optional(),
    email_verification_token: z.string().nullable().optional(),
    password_reset_token: z.string().nullable().optional(),
    password_reset_expires: z.string().nullable().optional()
});
export const searchUsersInputSchema = z.object({
    query: z.string().optional(),
    email: z.string().optional(),
    email_verified: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().default(10),
    offset: z.coerce.number().int().nonnegative().default(0),
    sort_by: z.enum(['email', 'name', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// WORKSPACES SCHEMAS
// ================================
export const workspaceSchema = z.object({
    id: z.string(),
    name: z.string(),
    default_currency: z.string(),
    default_revenue_per_conversion: z.number().nullable(),
    timezone: z.string(),
    data_retention_days: z.number().int(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createWorkspaceInputSchema = z.object({
    name: z.string().min(1).max(255),
    default_currency: z.string().min(1).max(10).default('USD'),
    default_revenue_per_conversion: z.number().positive().nullable().optional(),
    timezone: z.string().min(1).max(100).default('UTC'),
    data_retention_days: z.number().int().positive().default(730)
});
export const updateWorkspaceInputSchema = z.object({
    id: z.string(),
    name: z.string().min(1).max(255).optional(),
    default_currency: z.string().min(1).max(10).optional(),
    default_revenue_per_conversion: z.number().positive().nullable().optional(),
    timezone: z.string().min(1).max(100).optional(),
    data_retention_days: z.number().int().positive().optional()
});
export const searchWorkspacesInputSchema = z.object({
    query: z.string().optional(),
    currency: z.string().optional(),
    timezone: z.string().optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['name', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// MEMBERSHIPS SCHEMAS
// ================================
export const membershipSchema = z.object({
    id: z.string(),
    user_id: z.string(),
    workspace_id: z.string(),
    role: z.string(),
    status: z.string(),
    invited_by: z.string().nullable(),
    invitation_token: z.string().nullable(),
    invitation_expires: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createMembershipInputSchema = z.object({
    user_id: z.string().min(1),
    workspace_id: z.string().min(1),
    role: z.enum(['owner', 'admin', 'member']),
    status: z.enum(['active', 'inactive', 'pending']).default('active'),
    invited_by: z.string().nullable().optional(),
    invitation_token: z.string().nullable().optional(),
    invitation_expires: z.string().nullable().optional()
});
export const updateMembershipInputSchema = z.object({
    id: z.string(),
    role: z.enum(['owner', 'admin', 'member']).optional(),
    status: z.enum(['active', 'inactive', 'pending']).optional(),
    invitation_token: z.string().nullable().optional(),
    invitation_expires: z.string().nullable().optional()
});
export const searchMembershipsInputSchema = z.object({
    user_id: z.string().optional(),
    workspace_id: z.string().optional(),
    role: z.enum(['owner', 'admin', 'member']).optional(),
    status: z.enum(['active', 'inactive', 'pending']).optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['role', 'status', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// ACCOUNTS SCHEMAS
// ================================
export const accountSchema = z.object({
    id: z.string(),
    workspace_id: z.string(),
    platform: z.string(),
    account_id: z.string(),
    account_name: z.string().nullable(),
    status: z.string(),
    currency: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createAccountInputSchema = z.object({
    workspace_id: z.string().min(1),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']),
    account_id: z.string().min(1),
    account_name: z.string().min(1).max(255).nullable().optional(),
    status: z.enum(['active', 'inactive', 'paused']).default('active'),
    currency: z.string().min(1).max(10).nullable().optional()
});
export const updateAccountInputSchema = z.object({
    id: z.string(),
    account_name: z.string().min(1).max(255).nullable().optional(),
    status: z.enum(['active', 'inactive', 'paused']).optional(),
    currency: z.string().min(1).max(10).nullable().optional()
});
export const searchAccountsInputSchema = z.object({
    workspace_id: z.string().optional(),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']).optional(),
    status: z.enum(['active', 'inactive', 'paused']).optional(),
    currency: z.string().optional(),
    query: z.string().optional(),
    limit: z.coerce.number().int().positive().default(10),
    offset: z.coerce.number().int().nonnegative().default(0),
    sort_by: z.enum(['account_name', 'platform', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// CAMPAIGNS SCHEMAS
// ================================
export const campaignSchema = z.object({
    id: z.string(),
    account_id: z.string(),
    campaign_id: z.string(),
    campaign_name: z.string().nullable(),
    status: z.string(),
    objective: z.string().nullable(),
    buying_type: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createCampaignInputSchema = z.object({
    account_id: z.string().min(1),
    campaign_id: z.string().min(1),
    campaign_name: z.string().min(1).max(255).nullable().optional(),
    status: z.enum(['active', 'paused', 'archived']).default('active'),
    objective: z.string().max(100).nullable().optional(),
    buying_type: z.enum(['AUCTION', 'RESERVED']).nullable().optional()
});
export const updateCampaignInputSchema = z.object({
    id: z.string(),
    campaign_name: z.string().min(1).max(255).nullable().optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    objective: z.string().max(100).nullable().optional(),
    buying_type: z.enum(['AUCTION', 'RESERVED']).nullable().optional()
});
export const searchCampaignsInputSchema = z.object({
    account_id: z.string().optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    objective: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['campaign_name', 'status', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// AD_SETS SCHEMAS
// ================================
export const adSetSchema = z.object({
    id: z.string(),
    campaign_id: z.string(),
    adset_id: z.string(),
    adset_name: z.string().nullable(),
    status: z.string(),
    bid_strategy: z.string().nullable(),
    optimization_goal: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createAdSetInputSchema = z.object({
    campaign_id: z.string().min(1),
    adset_id: z.string().min(1),
    adset_name: z.string().min(1).max(255).nullable().optional(),
    status: z.enum(['active', 'paused', 'archived']).default('active'),
    bid_strategy: z.string().max(100).nullable().optional(),
    optimization_goal: z.string().max(100).nullable().optional()
});
export const updateAdSetInputSchema = z.object({
    id: z.string(),
    adset_name: z.string().min(1).max(255).nullable().optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    bid_strategy: z.string().max(100).nullable().optional(),
    optimization_goal: z.string().max(100).nullable().optional()
});
export const searchAdSetsInputSchema = z.object({
    campaign_id: z.string().optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    query: z.string().optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['adset_name', 'status', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// ADS SCHEMAS
// ================================
export const adSchema = z.object({
    id: z.string(),
    adset_id: z.string(),
    ad_id: z.string(),
    ad_name: z.string().nullable(),
    creative_name: z.string().nullable(),
    creative_thumb_url: z.string().nullable(),
    creative_tags: z.string().nullable(),
    status: z.string(),
    ad_format: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createAdInputSchema = z.object({
    adset_id: z.string().min(1),
    ad_id: z.string().min(1),
    ad_name: z.string().min(1).max(255).nullable().optional(),
    creative_name: z.string().min(1).max(255).nullable().optional(),
    creative_thumb_url: z.string().url().nullable().optional(),
    creative_tags: z.string().max(500).nullable().optional(),
    status: z.enum(['active', 'paused', 'archived']).default('active'),
    ad_format: z.enum(['SINGLE_IMAGE', 'SINGLE_VIDEO', 'CAROUSEL', 'COLLECTION']).nullable().optional()
});
export const updateAdInputSchema = z.object({
    id: z.string(),
    ad_name: z.string().min(1).max(255).nullable().optional(),
    creative_name: z.string().min(1).max(255).nullable().optional(),
    creative_thumb_url: z.string().url().nullable().optional(),
    creative_tags: z.string().max(500).nullable().optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    ad_format: z.enum(['SINGLE_IMAGE', 'SINGLE_VIDEO', 'CAROUSEL', 'COLLECTION']).nullable().optional()
});
export const searchAdsInputSchema = z.object({
    adset_id: z.string().optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    ad_format: z.enum(['SINGLE_IMAGE', 'SINGLE_VIDEO', 'CAROUSEL', 'COLLECTION']).optional(),
    query: z.string().optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['ad_name', 'status', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// METRICS_DAILY SCHEMAS
// ================================
export const metricsDailySchema = z.object({
    id: z.string(),
    date: z.string(),
    platform: z.string(),
    account_id: z.string(),
    campaign_id: z.string().nullable(),
    adset_id: z.string().nullable(),
    ad_id: z.string().nullable(),
    spend: z.number().nullable(),
    impressions: z.number().int().nullable(),
    clicks: z.number().int().nullable(),
    conversions: z.number().int().nullable(),
    revenue: z.number().nullable(),
    ctr: z.number().nullable(),
    cpm: z.number().nullable(),
    cpc: z.number().nullable(),
    cpa: z.number().nullable(),
    cvr: z.number().nullable(),
    roas: z.number().nullable(),
    frequency: z.number().nullable(),
    reach: z.number().int().nullable(),
    video_views: z.number().int().nullable(),
    video_view_rate: z.number().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createMetricsDailyInputSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']),
    account_id: z.string().min(1),
    campaign_id: z.string().nullable().optional(),
    adset_id: z.string().nullable().optional(),
    ad_id: z.string().nullable().optional(),
    spend: z.number().nonnegative().nullable().default(0),
    impressions: z.number().int().nonnegative().nullable().default(0),
    clicks: z.number().int().nonnegative().nullable().default(0),
    conversions: z.number().int().nonnegative().nullable().default(0),
    revenue: z.number().nonnegative().nullable().default(0),
    ctr: z.number().nonnegative().nullable().optional(),
    cpm: z.number().nonnegative().nullable().optional(),
    cpc: z.number().nonnegative().nullable().optional(),
    cpa: z.number().nonnegative().nullable().optional(),
    cvr: z.number().nonnegative().nullable().optional(),
    roas: z.number().nonnegative().nullable().optional(),
    frequency: z.number().nonnegative().nullable().optional(),
    reach: z.number().int().nonnegative().nullable().optional(),
    video_views: z.number().int().nonnegative().nullable().optional(),
    video_view_rate: z.number().nonnegative().nullable().optional()
});
export const searchMetricsDailyInputSchema = z.object({
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']).optional(),
    account_id: z.string().optional(),
    campaign_id: z.string().optional(),
    adset_id: z.string().optional(),
    ad_id: z.string().optional(),
    limit: z.coerce.number().int().positive().default(10),
    offset: z.coerce.number().int().nonnegative().default(0),
    sort_by: z.enum(['date', 'spend', 'impressions', 'clicks', 'conversions']).default('date'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// UPLOAD_JOBS SCHEMAS
// ================================
export const uploadJobSchema = z.object({
    id: z.string(),
    workspace_id: z.string(),
    user_id: z.string(),
    filename: z.string(),
    original_filename: z.string(),
    file_size: z.number().int(),
    platform: z.string(),
    status: z.string(),
    progress: z.number().int(),
    rows_processed: z.number().int(),
    rows_total: z.number().int(),
    rows_success: z.number().int(),
    rows_error: z.number().int(),
    error_text: z.string().nullable(),
    error_log_url: z.string().nullable(),
    mapping_template_id: z.string().nullable(),
    date_from: z.string().nullable(),
    date_to: z.string().nullable(),
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createUploadJobInputSchema = z.object({
    workspace_id: z.string().min(1),
    user_id: z.string().min(1),
    filename: z.string().min(1),
    original_filename: z.string().min(1),
    file_size: z.number().int().positive(),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']),
    status: z.enum(['queued', 'processing', 'completed', 'failed']).default('queued'),
    progress: z.number().int().min(0).max(100).default(0),
    mapping_template_id: z.string().nullable().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});
export const updateUploadJobInputSchema = z.object({
    id: z.string(),
    status: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    rows_processed: z.number().int().nonnegative().optional(),
    rows_total: z.number().int().nonnegative().optional(),
    rows_success: z.number().int().nonnegative().optional(),
    rows_error: z.number().int().nonnegative().optional(),
    error_text: z.string().nullable().optional(),
    error_log_url: z.string().url().nullable().optional(),
    started_at: z.string().nullable().optional(),
    completed_at: z.string().nullable().optional()
});
export const searchUploadJobsInputSchema = z.object({
    workspace_id: z.string().optional(),
    user_id: z.string().optional(),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']).optional(),
    status: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['created_at', 'status', 'progress']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// MAPPING_TEMPLATES SCHEMAS
// ================================
export const mappingTemplateSchema = z.object({
    id: z.string(),
    workspace_id: z.string(),
    name: z.string(),
    platform: z.string(),
    mapping: z.record(z.any()),
    is_default: z.boolean(),
    is_shared: z.boolean(),
    created_by: z.string(),
    usage_count: z.number().int(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createMappingTemplateInputSchema = z.object({
    workspace_id: z.string().min(1),
    name: z.string().min(1).max(255),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']),
    mapping: z.record(z.any()).refine((data) => Object.keys(data).length > 0, "Mapping cannot be empty"),
    is_default: z.boolean().default(false),
    is_shared: z.boolean().default(false),
    created_by: z.string().min(1)
});
export const updateMappingTemplateInputSchema = z.object({
    id: z.string(),
    name: z.string().min(1).max(255).optional(),
    mapping: z.record(z.any()).optional(),
    is_default: z.boolean().optional(),
    is_shared: z.boolean().optional()
});
export const searchMappingTemplatesInputSchema = z.object({
    workspace_id: z.string().optional(),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']).optional(),
    is_default: z.boolean().optional(),
    is_shared: z.boolean().optional(),
    query: z.string().optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['name', 'usage_count', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// ALERT_RULES SCHEMAS
// ================================
export const alertRuleSchema = z.object({
    id: z.string(),
    workspace_id: z.string(),
    created_by: z.string(),
    name: z.string(),
    metric: z.string(),
    condition: z.string(),
    threshold: z.number().nullable(),
    threshold_percentage: z.number().nullable(),
    time_window: z.string(),
    platform_filter: z.record(z.any()).nullable(),
    account_filter: z.record(z.any()).nullable(),
    campaign_filter: z.record(z.any()).nullable(),
    severity: z.string(),
    is_active: z.boolean(),
    notification_email: z.boolean(),
    notification_in_app: z.boolean(),
    cooldown_minutes: z.number().int(),
    last_triggered_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createAlertRuleInputSchema = z.object({
    workspace_id: z.string().min(1),
    created_by: z.string().min(1),
    name: z.string().min(1).max(255),
    metric: z.enum(['spend', 'impressions', 'clicks', 'conversions', 'revenue', 'ctr', 'cpm', 'cpc', 'cpa', 'cvr', 'roas']),
    condition: z.enum(['greater_than', 'less_than', 'percentage_increase', 'percentage_decrease']),
    threshold: z.number().positive().nullable().optional(),
    threshold_percentage: z.number().positive().max(100).nullable().optional(),
    time_window: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
    platform_filter: z.record(z.any()).nullable().optional(),
    account_filter: z.record(z.any()).nullable().optional(),
    campaign_filter: z.record(z.any()).nullable().optional(),
    severity: z.enum(['info', 'warning', 'critical']).default('warning'),
    is_active: z.boolean().default(true),
    notification_email: z.boolean().default(true),
    notification_in_app: z.boolean().default(true),
    cooldown_minutes: z.number().int().positive().default(60)
});
export const updateAlertRuleInputSchema = z.object({
    id: z.string(),
    name: z.string().min(1).max(255).optional(),
    condition: z.enum(['greater_than', 'less_than', 'percentage_increase', 'percentage_decrease']).optional(),
    threshold: z.number().positive().nullable().optional(),
    threshold_percentage: z.number().positive().max(100).nullable().optional(),
    time_window: z.enum(['hourly', 'daily', 'weekly']).optional(),
    platform_filter: z.record(z.any()).nullable().optional(),
    account_filter: z.record(z.any()).nullable().optional(),
    campaign_filter: z.record(z.any()).nullable().optional(),
    severity: z.enum(['info', 'warning', 'critical']).optional(),
    is_active: z.boolean().optional(),
    notification_email: z.boolean().optional(),
    notification_in_app: z.boolean().optional(),
    cooldown_minutes: z.number().int().positive().optional()
});
export const searchAlertRulesInputSchema = z.object({
    workspace_id: z.string().optional(),
    metric: z.enum(['spend', 'impressions', 'clicks', 'conversions', 'revenue', 'ctr', 'cpm', 'cpc', 'cpa', 'cvr', 'roas']).optional(),
    severity: z.enum(['info', 'warning', 'critical']).optional(),
    is_active: z.boolean().optional(),
    query: z.string().optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['name', 'severity', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// ALERT_TRIGGERS SCHEMAS
// ================================
export const alertTriggerSchema = z.object({
    id: z.string(),
    alert_rule_id: z.string(),
    workspace_id: z.string(),
    triggered_at: z.string(),
    metric_value: z.number(),
    threshold_value: z.number(),
    condition_met: z.string(),
    affected_entity_type: z.string(),
    affected_entity_id: z.string(),
    affected_entity_name: z.string().nullable(),
    platform: z.string(),
    details: z.record(z.any()).nullable(),
    is_resolved: z.boolean(),
    resolved_at: z.string().nullable(),
    resolved_by: z.string().nullable(),
    created_at: z.string()
});
export const createAlertTriggerInputSchema = z.object({
    alert_rule_id: z.string().min(1),
    workspace_id: z.string().min(1),
    triggered_at: z.string(),
    metric_value: z.number(),
    threshold_value: z.number(),
    condition_met: z.string().min(1),
    affected_entity_type: z.enum(['account', 'campaign', 'adset', 'ad']),
    affected_entity_id: z.string().min(1),
    affected_entity_name: z.string().max(255).nullable().optional(),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']),
    details: z.record(z.any()).nullable().optional()
});
export const updateAlertTriggerInputSchema = z.object({
    id: z.string(),
    is_resolved: z.boolean().optional(),
    resolved_at: z.string().nullable().optional(),
    resolved_by: z.string().nullable().optional()
});
export const searchAlertTriggersInputSchema = z.object({
    workspace_id: z.string().optional(),
    alert_rule_id: z.string().optional(),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']).optional(),
    is_resolved: z.boolean().optional(),
    affected_entity_type: z.enum(['account', 'campaign', 'adset', 'ad']).optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['triggered_at', 'metric_value', 'created_at']).default('triggered_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// NOTIFICATIONS SCHEMAS
// ================================
export const notificationSchema = z.object({
    id: z.string(),
    user_id: z.string(),
    workspace_id: z.string(),
    type: z.string(),
    title: z.string(),
    message: z.string(),
    alert_trigger_id: z.string().nullable(),
    related_entity_type: z.string().nullable(),
    related_entity_id: z.string().nullable(),
    is_read: z.boolean(),
    read_at: z.string().nullable(),
    priority: z.string(),
    action_url: z.string().nullable(),
    expires_at: z.string().nullable(),
    created_at: z.string()
});
export const createNotificationInputSchema = z.object({
    user_id: z.string().min(1),
    workspace_id: z.string().min(1),
    type: z.enum(['alert', 'system', 'info', 'warning']),
    title: z.string().min(1).max(255),
    message: z.string().min(1).max(1000),
    alert_trigger_id: z.string().nullable().optional(),
    related_entity_type: z.string().max(50).nullable().optional(),
    related_entity_id: z.string().nullable().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    action_url: z.string().url().nullable().optional(),
    expires_at: z.string().nullable().optional()
});
export const updateNotificationInputSchema = z.object({
    id: z.string(),
    is_read: z.boolean().optional(),
    read_at: z.string().nullable().optional()
});
export const searchNotificationsInputSchema = z.object({
    user_id: z.string().optional(),
    workspace_id: z.string().optional(),
    type: z.enum(['alert', 'system', 'info', 'warning']).optional(),
    is_read: z.boolean().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['created_at', 'priority', 'is_read']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// USER_PREFERENCES SCHEMAS
// ================================
export const userPreferencesSchema = z.object({
    id: z.string(),
    user_id: z.string(),
    email_notifications: z.boolean(),
    in_app_notifications: z.boolean(),
    email_frequency: z.string(),
    reduced_motion: z.boolean(),
    date_format: z.string(),
    number_format: z.string(),
    default_dashboard_view: z.string(),
    theme_preference: z.string(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createUserPreferencesInputSchema = z.object({
    user_id: z.string().min(1),
    email_notifications: z.boolean().default(true),
    in_app_notifications: z.boolean().default(true),
    email_frequency: z.enum(['immediate', 'daily', 'weekly']).default('immediate'),
    reduced_motion: z.boolean().default(false),
    date_format: z.enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY']).default('YYYY-MM-DD'),
    number_format: z.enum(['US', 'EU', 'UK']).default('US'),
    default_dashboard_view: z.enum(['overview', 'campaigns', 'creatives', 'analytics']).default('overview'),
    theme_preference: z.enum(['light', 'dark', 'auto']).default('dark')
});
export const updateUserPreferencesInputSchema = z.object({
    id: z.string(),
    email_notifications: z.boolean().optional(),
    in_app_notifications: z.boolean().optional(),
    email_frequency: z.enum(['immediate', 'daily', 'weekly']).optional(),
    reduced_motion: z.boolean().optional(),
    date_format: z.enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY']).optional(),
    number_format: z.enum(['US', 'EU', 'UK']).optional(),
    default_dashboard_view: z.enum(['overview', 'campaigns', 'creatives', 'analytics']).optional(),
    theme_preference: z.enum(['light', 'dark', 'auto']).optional()
});
// ================================
// SHARED_LINKS SCHEMAS
// ================================
export const sharedLinkSchema = z.object({
    id: z.string(),
    workspace_id: z.string(),
    created_by: z.string(),
    link_token: z.string(),
    link_type: z.string(),
    dashboard_config: z.record(z.any()).nullable(),
    access_level: z.string(),
    password_protected: z.boolean(),
    password_hash: z.string().nullable(),
    expires_at: z.string().nullable(),
    is_active: z.boolean(),
    view_count: z.number().int(),
    last_accessed_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createSharedLinkInputSchema = z.object({
    workspace_id: z.string().min(1),
    created_by: z.string().min(1),
    link_token: z.string().min(1),
    link_type: z.enum(['dashboard', 'report', 'chart']),
    dashboard_config: z.record(z.any()).nullable().optional(),
    access_level: z.enum(['read_only', 'view_only']).default('read_only'),
    password_protected: z.boolean().default(false),
    password_hash: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional()
});
export const updateSharedLinkInputSchema = z.object({
    id: z.string(),
    dashboard_config: z.record(z.any()).nullable().optional(),
    access_level: z.enum(['read_only', 'view_only']).optional(),
    password_protected: z.boolean().optional(),
    password_hash: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    is_active: z.boolean().optional()
});
export const searchSharedLinksInputSchema = z.object({
    workspace_id: z.string().optional(),
    created_by: z.string().optional(),
    link_type: z.enum(['dashboard', 'report', 'chart']).optional(),
    is_active: z.boolean().optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['view_count', 'created_at', 'last_accessed_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// EXPORT_JOBS SCHEMAS
// ================================
export const exportJobSchema = z.object({
    id: z.string(),
    workspace_id: z.string(),
    user_id: z.string(),
    export_type: z.string(),
    format: z.string(),
    filters: z.record(z.any()).nullable(),
    date_from: z.string().nullable(),
    date_to: z.string().nullable(),
    platforms: z.array(z.string()).nullable(),
    accounts: z.array(z.string()).nullable(),
    status: z.string(),
    progress: z.number().int(),
    file_url: z.string().nullable(),
    file_size: z.number().int().nullable(),
    row_count: z.number().int().nullable(),
    error_message: z.string().nullable(),
    expires_at: z.string().nullable(),
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createExportJobInputSchema = z.object({
    workspace_id: z.string().min(1),
    user_id: z.string().min(1),
    export_type: z.enum(['metrics', 'campaigns', 'creative_performance', 'alerts']),
    format: z.enum(['csv', 'xlsx', 'pdf']),
    filters: z.record(z.any()).nullable().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    platforms: z.array(z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter'])).nullable().optional(),
    accounts: z.array(z.string()).nullable().optional()
});
export const updateExportJobInputSchema = z.object({
    id: z.string(),
    status: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    file_url: z.string().url().nullable().optional(),
    file_size: z.number().int().positive().nullable().optional(),
    row_count: z.number().int().nonnegative().nullable().optional(),
    error_message: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    started_at: z.string().nullable().optional(),
    completed_at: z.string().nullable().optional()
});
export const searchExportJobsInputSchema = z.object({
    workspace_id: z.string().optional(),
    user_id: z.string().optional(),
    export_type: z.enum(['metrics', 'campaigns', 'creative_performance', 'alerts']).optional(),
    status: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
    format: z.enum(['csv', 'xlsx', 'pdf']).optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['created_at', 'status', 'export_type']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// ANOMALY_DETECTIONS SCHEMAS
// ================================
export const anomalyDetectionSchema = z.object({
    id: z.string(),
    workspace_id: z.string(),
    entity_type: z.string(),
    entity_id: z.string(),
    metric: z.string(),
    platform: z.string(),
    date: z.string(),
    current_value: z.number(),
    expected_value: z.number(),
    z_score: z.number(),
    deviation_percentage: z.number(),
    anomaly_type: z.string(),
    severity: z.string(),
    is_reviewed: z.boolean(),
    reviewed_by: z.string().nullable(),
    reviewed_at: z.string().nullable(),
    review_notes: z.string().nullable(),
    created_at: z.string()
});
export const createAnomalyDetectionInputSchema = z.object({
    workspace_id: z.string().min(1),
    entity_type: z.enum(['account', 'campaign', 'adset', 'ad']),
    entity_id: z.string().min(1),
    metric: z.enum(['spend', 'impressions', 'clicks', 'conversions', 'revenue', 'ctr', 'cpm', 'cpc', 'cpa', 'cvr', 'roas']),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    current_value: z.number(),
    expected_value: z.number(),
    z_score: z.number(),
    deviation_percentage: z.number(),
    anomaly_type: z.enum(['spike', 'drop', 'pattern_break']),
    severity: z.enum(['low', 'medium', 'high', 'critical'])
});
export const updateAnomalyDetectionInputSchema = z.object({
    id: z.string(),
    is_reviewed: z.boolean().optional(),
    reviewed_by: z.string().nullable().optional(),
    reviewed_at: z.string().nullable().optional(),
    review_notes: z.string().max(1000).nullable().optional()
});
export const searchAnomalyDetectionsInputSchema = z.object({
    workspace_id: z.string().optional(),
    entity_type: z.enum(['account', 'campaign', 'adset', 'ad']).optional(),
    metric: z.enum(['spend', 'impressions', 'clicks', 'conversions', 'revenue', 'ctr', 'cpm', 'cpc', 'cpa', 'cvr', 'roas']).optional(),
    platform: z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter']).optional(),
    anomaly_type: z.enum(['spike', 'drop', 'pattern_break']).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    is_reviewed: z.boolean().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['date', 'severity', 'z_score', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// CREATIVE_PERFORMANCE SCHEMAS
// ================================
export const creativePerformanceSchema = z.object({
    id: z.string(),
    workspace_id: z.string(),
    creative_name: z.string(),
    creative_thumb_url: z.string().nullable(),
    creative_tags: z.string().nullable(),
    ad_format: z.string().nullable(),
    platforms: z.array(z.string()),
    total_spend: z.number(),
    total_impressions: z.number().int(),
    total_clicks: z.number().int(),
    total_conversions: z.number().int(),
    total_revenue: z.number(),
    avg_ctr: z.number().nullable(),
    avg_cpm: z.number().nullable(),
    avg_cpc: z.number().nullable(),
    avg_cpa: z.number().nullable(),
    avg_cvr: z.number().nullable(),
    avg_roas: z.number().nullable(),
    campaign_count: z.number().int(),
    performance_rank: z.string().nullable(),
    first_seen_date: z.string(),
    last_seen_date: z.string(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createCreativePerformanceInputSchema = z.object({
    workspace_id: z.string().min(1),
    creative_name: z.string().min(1).max(255),
    creative_thumb_url: z.string().url().nullable().optional(),
    creative_tags: z.string().max(500).nullable().optional(),
    ad_format: z.enum(['SINGLE_IMAGE', 'SINGLE_VIDEO', 'CAROUSEL', 'COLLECTION']).nullable().optional(),
    platforms: z.array(z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter'])).min(1),
    total_spend: z.number().nonnegative().default(0),
    total_impressions: z.number().int().nonnegative().default(0),
    total_clicks: z.number().int().nonnegative().default(0),
    total_conversions: z.number().int().nonnegative().default(0),
    total_revenue: z.number().nonnegative().default(0),
    campaign_count: z.number().int().nonnegative().default(0),
    first_seen_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    last_seen_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
export const updateCreativePerformanceInputSchema = z.object({
    id: z.string(),
    creative_name: z.string().min(1).max(255).optional(),
    creative_thumb_url: z.string().url().nullable().optional(),
    creative_tags: z.string().max(500).nullable().optional(),
    ad_format: z.enum(['SINGLE_IMAGE', 'SINGLE_VIDEO', 'CAROUSEL', 'COLLECTION']).nullable().optional(),
    platforms: z.array(z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter'])).min(1).optional(),
    total_spend: z.number().nonnegative().optional(),
    total_impressions: z.number().int().nonnegative().optional(),
    total_clicks: z.number().int().nonnegative().optional(),
    total_conversions: z.number().int().nonnegative().optional(),
    total_revenue: z.number().nonnegative().optional(),
    performance_rank: z.string().nullable().optional(),
    last_seen_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});
export const searchCreativePerformanceInputSchema = z.object({
    workspace_id: z.string().optional(),
    platforms: z.array(z.enum(['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter'])).optional(),
    ad_format: z.enum(['SINGLE_IMAGE', 'SINGLE_VIDEO', 'CAROUSEL', 'COLLECTION']).optional(),
    performance_rank: z.string().optional(),
    query: z.string().optional(),
    min_spend: z.number().nonnegative().optional(),
    max_spend: z.number().nonnegative().optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['creative_name', 'total_spend', 'avg_roas', 'campaign_count', 'last_seen_date']).default('total_spend'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// WORKSPACE_INVITATIONS SCHEMAS
// ================================
export const workspaceInvitationSchema = z.object({
    id: z.string(),
    workspace_id: z.string(),
    invited_by: z.string(),
    email: z.string(),
    role: z.string(),
    invitation_token: z.string(),
    status: z.string(),
    expires_at: z.string(),
    accepted_at: z.string().nullable(),
    accepted_by: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export const createWorkspaceInvitationInputSchema = z.object({
    workspace_id: z.string().min(1),
    invited_by: z.string().min(1),
    email: z.string().email(),
    role: z.enum(['admin', 'member']),
    invitation_token: z.string().min(1),
    expires_at: z.string()
});
export const updateWorkspaceInvitationInputSchema = z.object({
    id: z.string(),
    status: z.enum(['pending', 'accepted', 'declined', 'expired']).optional(),
    accepted_at: z.string().nullable().optional(),
    accepted_by: z.string().nullable().optional()
});
export const searchWorkspaceInvitationsInputSchema = z.object({
    workspace_id: z.string().optional(),
    email: z.string().optional(),
    status: z.enum(['pending', 'accepted', 'declined', 'expired']).optional(),
    role: z.enum(['admin', 'member']).optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['email', 'role', 'status', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// AUDIT_LOGS SCHEMAS
// ================================
export const auditLogSchema = z.object({
    id: z.string(),
    workspace_id: z.string(),
    user_id: z.string().nullable(),
    action: z.string(),
    entity_type: z.string().nullable(),
    entity_id: z.string().nullable(),
    details: z.record(z.any()).nullable(),
    ip_address: z.string().nullable(),
    user_agent: z.string().nullable(),
    created_at: z.string()
});
export const createAuditLogInputSchema = z.object({
    workspace_id: z.string().min(1),
    user_id: z.string().nullable().optional(),
    action: z.string().min(1).max(255),
    entity_type: z.string().max(100).nullable().optional(),
    entity_id: z.string().nullable().optional(),
    details: z.record(z.any()).nullable().optional(),
    ip_address: z.string().ip().nullable().optional(),
    user_agent: z.string().max(500).nullable().optional()
});
export const searchAuditLogsInputSchema = z.object({
    workspace_id: z.string().optional(),
    user_id: z.string().optional(),
    action: z.string().optional(),
    entity_type: z.string().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['action', 'created_at']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
// ================================
// USER_SESSIONS SCHEMAS
// ================================
export const userSessionSchema = z.object({
    id: z.string(),
    user_id: z.string(),
    session_token: z.string(),
    refresh_token: z.string().nullable(),
    ip_address: z.string().nullable(),
    user_agent: z.string().nullable(),
    is_active: z.boolean(),
    last_activity_at: z.string(),
    expires_at: z.string(),
    created_at: z.string()
});
export const createUserSessionInputSchema = z.object({
    user_id: z.string().min(1),
    session_token: z.string().min(1),
    refresh_token: z.string().nullable().optional(),
    ip_address: z.string().ip().nullable().optional(),
    user_agent: z.string().max(500).nullable().optional(),
    is_active: z.boolean().default(true),
    last_activity_at: z.string(),
    expires_at: z.string()
});
export const updateUserSessionInputSchema = z.object({
    id: z.string(),
    refresh_token: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
    last_activity_at: z.string().optional(),
    expires_at: z.string().optional()
});
export const searchUserSessionsInputSchema = z.object({
    user_id: z.string().optional(),
    is_active: z.boolean().optional(),
    ip_address: z.string().optional(),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    sort_by: z.enum(['last_activity_at', 'created_at', 'expires_at']).default('last_activity_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc')
});
//# sourceMappingURL=schema.js.map