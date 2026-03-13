import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================
// ORGANIZATIONS (Multi-tenant SaaS)
// ============================================================

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default('active'),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// ============================================================
// SUBSCRIPTION PLANS
// ============================================================

export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  priceMonthly: integer("price_monthly").notNull(),
  priceYearly: integer("price_yearly"),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  maxUsers: integer("max_users").notNull().default(5),
  maxQueriesPerMonth: integer("max_queries_per_month").notNull().default(1000),
  maxRowsDisplay: integer("max_rows_display").notNull().default(1000),
  maxRowsExport: integer("max_rows_export").notNull().default(10000),
  features: text("features").array().notNull().default(sql`ARRAY['query', 'explorer', 'export']::text[]`),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
});

export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// ============================================================
// ORGANIZATION SUBSCRIPTIONS
// ============================================================

export const organizationSubscriptions = pgTable("organization_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id),
  status: text("status").notNull().default('active'),
  billingCycle: text("billing_cycle").notNull().default('monthly'),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganizationSubscriptionSchema = createInsertSchema(organizationSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrganizationSubscription = z.infer<typeof insertOrganizationSubscriptionSchema>;
export type OrganizationSubscription = typeof organizationSubscriptions.$inferSelect;

// ============================================================
// USERS (Updated for multi-tenancy)
// ============================================================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default('user'),
  status: text("status").notNull().default('active'),
  emailVerified: boolean("email_verified").notNull().default(false),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActive: timestamp("last_active"),
  deletedAt: timestamp("deleted_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  username: true,
  password: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================================
// ORGANIZATION MEMBERS (Links users to organizations with roles)
// ============================================================

export const organizationMembers = pgTable("organization_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text("role").notNull().default('member'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueMember: uniqueIndex("unique_org_member").on(table.organizationId, table.userId),
}));

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
export type OrganizationMember = typeof organizationMembers.$inferSelect;

// ============================================================
// ORGANIZATION INVITATIONS
// ============================================================

export const organizationInvitations = pgTable("organization_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
  role: text("role").notNull().default('member'),
  token: text("token").notNull().unique(),
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrganizationInvitationSchema = createInsertSchema(organizationInvitations).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganizationInvitation = z.infer<typeof insertOrganizationInvitationSchema>;
export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;

// ============================================================
// ORGANIZATION AWS CONFIGURATIONS (Legacy - kept for backward compat)
// ============================================================

export const organizationAwsConfigs = pgTable("organization_aws_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }).unique(),
  awsAccessKeyId: text("aws_access_key_id"),
  awsSecretAccessKey: text("aws_secret_access_key"),
  awsRegion: text("aws_region").notNull().default('us-east-1'),
  s3OutputLocation: text("s3_output_location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganizationAwsConfigSchema = createInsertSchema(organizationAwsConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrganizationAwsConfig = z.infer<typeof insertOrganizationAwsConfigSchema>;
export type OrganizationAwsConfig = typeof organizationAwsConfigs.$inferSelect;

// ============================================================
// ORGANIZATION DATABASE CONNECTIONS (Multi-database support)
// ============================================================

export const DATABASE_TYPES = [
  'postgresql', 'mysql', 'mssql', 'athena', 'bigquery', 'snowflake', 'clickhouse'
] as const;

export type DatabaseType = typeof DATABASE_TYPES[number];

export const organizationDatabaseConnections = pgTable("organization_database_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  host: text("host"),
  port: integer("port"),
  database: text("database"),
  username: text("username"),
  password: text("password"),
  ssl: boolean("ssl").notNull().default(false),
  awsAccessKeyId: text("aws_access_key_id"),
  awsSecretAccessKey: text("aws_secret_access_key"),
  awsRegion: text("aws_region"),
  s3OutputLocation: text("s3_output_location"),
  projectId: text("project_id"),
  credentialsJson: text("credentials_json"),
  dataset: text("dataset"),
  account: text("account"),
  warehouse: text("warehouse"),
  schema: text("schema"),
  role: text("role"),
  isDefault: boolean("is_default").notNull().default(false),
  status: text("status").notNull().default('active'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganizationDatabaseConnectionSchema = createInsertSchema(organizationDatabaseConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrganizationDatabaseConnection = z.infer<typeof insertOrganizationDatabaseConnectionSchema>;
export type OrganizationDatabaseConnection = typeof organizationDatabaseConnections.$inferSelect;

// ============================================================
// ORGANIZATION AI CONFIGURATIONS
// ============================================================

export const organizationAiConfigs = pgTable("organization_ai_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }).unique(),
  aiProvider: text("ai_provider").notNull().default('openai'),
  aiModel: text("ai_model").notNull().default('gpt-4o'),
  openaiApiKey: text("openai_api_key"),
  anthropicApiKey: text("anthropic_api_key"),
  geminiApiKey: text("gemini_api_key"),
  ollamaEndpoint: text("ollama_endpoint"),
  customPrompt: text("custom_prompt"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganizationAiConfigSchema = createInsertSchema(organizationAiConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrganizationAiConfig = z.infer<typeof insertOrganizationAiConfigSchema>;
export type OrganizationAiConfig = typeof organizationAiConfigs.$inferSelect;

// ============================================================
// QUERY LOGS (Updated with organization scope)
// ============================================================

export const queryLogs = pgTable("query_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  username: text("username").notNull(),
  query: text("query").notNull(),
  rowsReturned: integer("rows_returned").notNull(),
  executionTime: integer("execution_time").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQueryLogSchema = createInsertSchema(queryLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertQueryLog = z.infer<typeof insertQueryLogSchema>;
export type QueryLog = typeof queryLogs.$inferSelect;

// ============================================================
// SETTINGS (Updated with organization scope - global settings have null orgId)
// ============================================================

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// ============================================================
// EXPORT JOBS (Updated with organization scope)
// ============================================================

export const exportJobs = pgTable("export_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  username: text("username").notNull(),
  queryType: text("query_type").notNull(),
  query: text("query").notNull(),
  status: text("status").notNull().default('pending'),
  progress: integer("progress").notNull().default(0),
  totalRows: integer("total_rows"),
  rowLimit: integer("row_limit").notNull(),
  filePath: text("file_path"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertExportJobSchema = createInsertSchema(exportJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertExportJob = z.infer<typeof insertExportJobSchema>;
export type ExportJob = typeof exportJobs.$inferSelect;

// ============================================================
// SFTP CONFIGS (Updated with organization scope)
// ============================================================

export const sftpConfigs = pgTable("sftp_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(22),
  username: text("username").notNull(),
  password: text("password"),
  privateKey: text("private_key"),
  passphrase: text("passphrase"),
  authType: text("auth_type").notNull().default('password'),
  remotePaths: text("remote_paths").array().notNull().default(sql`ARRAY['/']::text[]`),
  filePatterns: jsonb("file_patterns").default(sql`'{}'::jsonb`),
  status: text("status").notNull().default('active'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSftpConfigSchema = createInsertSchema(sftpConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSftpConfig = z.infer<typeof insertSftpConfigSchema>;
export type SftpConfig = typeof sftpConfigs.$inferSelect;

// ============================================================
// SAVED QUERIES (Updated with organization scope)
// ============================================================

export const savedQueries = pgTable("saved_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  query: text("query").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSavedQuerySchema = createInsertSchema(savedQueries).omit({
  id: true,
  createdAt: true,
});

export type InsertSavedQuery = z.infer<typeof insertSavedQuerySchema>;
export type SavedQuery = typeof savedQueries.$inferSelect;

// ============================================================
// DASHBOARD CHARTS
// ============================================================

export const dashboardCharts = pgTable("dashboard_charts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  sqlQuery: text("sql_query").notNull(),
  chartType: text("chart_type").notNull().default('bar'),
  xAxisColumn: text("x_axis_column").notNull(),
  yAxisColumns: text("y_axis_columns").array().notNull().default(sql`ARRAY[]::text[]`),
  connectionId: varchar("connection_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDashboardChartSchema = createInsertSchema(dashboardCharts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDashboardChart = z.infer<typeof insertDashboardChartSchema>;
export type DashboardChart = typeof dashboardCharts.$inferSelect;

// ============================================================
// AUDIT LOGS (New for SaaS compliance)
// ============================================================

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
