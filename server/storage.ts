import { db } from "./db";
import { 
  users, queryLogs, settings, exportJobs, sftpConfigs, savedQueries,
  organizations, subscriptionPlans, organizationSubscriptions, 
  organizationMembers, organizationInvitations, organizationAwsConfigs,
  organizationAiConfigs, organizationDatabaseConnections, auditLogs,
  dashboardCharts,
  type User, type InsertUser, type QueryLog, type InsertQueryLog, 
  type Setting, type InsertSetting, type ExportJob, type InsertExportJob, 
  type SftpConfig, type InsertSftpConfig, type SavedQuery, type InsertSavedQuery,
  type Organization, type InsertOrganization, type SubscriptionPlan, type InsertSubscriptionPlan,
  type OrganizationSubscription, type InsertOrganizationSubscription,
  type OrganizationMember, type InsertOrganizationMember,
  type OrganizationInvitation, type InsertOrganizationInvitation,
  type OrganizationAwsConfig, type InsertOrganizationAwsConfig,
  type OrganizationAiConfig, type InsertOrganizationAiConfig,
  type OrganizationDatabaseConnection, type InsertOrganizationDatabaseConnection,
  type AuditLog, type InsertAuditLog,
  type DashboardChart, type InsertDashboardChart,
} from "@shared/schema";
import { eq, desc, and, or, isNull } from "drizzle-orm";
import bcrypt from "bcrypt";
import { encrypt, decrypt } from "./encryption";

// ---- Credential helpers ------------------------------------------------

function encryptConnectionFields(c: Partial<InsertOrganizationDatabaseConnection>): Partial<InsertOrganizationDatabaseConnection> {
  return {
    ...c,
    password: c.password ? encrypt(c.password) as string : c.password,
    awsSecretAccessKey: c.awsSecretAccessKey ? encrypt(c.awsSecretAccessKey) as string : c.awsSecretAccessKey,
    credentialsJson: c.credentialsJson ? encrypt(c.credentialsJson) as string : c.credentialsJson,
  };
}

function decryptConnectionFields(c: OrganizationDatabaseConnection): OrganizationDatabaseConnection {
  return {
    ...c,
    password: c.password ? decrypt(c.password) as string : c.password,
    awsSecretAccessKey: c.awsSecretAccessKey ? decrypt(c.awsSecretAccessKey) as string : c.awsSecretAccessKey,
    credentialsJson: c.credentialsJson ? decrypt(c.credentialsJson) as string : c.credentialsJson,
  };
}

function encryptAwsConfigFields(c: InsertOrganizationAwsConfig): InsertOrganizationAwsConfig {
  return { ...c, awsSecretAccessKey: c.awsSecretAccessKey ? encrypt(c.awsSecretAccessKey) as string : c.awsSecretAccessKey };
}

function decryptAwsConfigFields(c: OrganizationAwsConfig): OrganizationAwsConfig {
  return { ...c, awsSecretAccessKey: c.awsSecretAccessKey ? decrypt(c.awsSecretAccessKey) as string : c.awsSecretAccessKey };
}

function encryptSftpFields(c: InsertSftpConfig): InsertSftpConfig {
  return {
    ...c,
    password: c.password ? encrypt(c.password) as string : c.password,
    privateKey: c.privateKey ? encrypt(c.privateKey) as string : c.privateKey,
    passphrase: c.passphrase ? encrypt(c.passphrase) as string : c.passphrase,
  };
}

function decryptSftpFields(c: SftpConfig): SftpConfig {
  return {
    ...c,
    password: c.password ? decrypt(c.password) as string : c.password,
    privateKey: c.privateKey ? decrypt(c.privateKey) as string : c.privateKey,
    passphrase: c.passphrase ? decrypt(c.passphrase) as string : c.passphrase,
  };
}

function encryptAiConfigFields(c: InsertOrganizationAiConfig): InsertOrganizationAiConfig {
  return {
    ...c,
    openaiApiKey: c.openaiApiKey ? encrypt(c.openaiApiKey) as string : c.openaiApiKey,
    anthropicApiKey: c.anthropicApiKey ? encrypt(c.anthropicApiKey) as string : c.anthropicApiKey,
    geminiApiKey: c.geminiApiKey ? encrypt(c.geminiApiKey) as string : c.geminiApiKey,
  };
}

function decryptAiConfigFields(c: OrganizationAiConfig): OrganizationAiConfig {
  return {
    ...c,
    openaiApiKey: c.openaiApiKey ? decrypt(c.openaiApiKey) as string : c.openaiApiKey,
    anthropicApiKey: c.anthropicApiKey ? decrypt(c.anthropicApiKey) as string : c.anthropicApiKey,
    geminiApiKey: c.geminiApiKey ? decrypt(c.geminiApiKey) as string : c.geminiApiKey,
  };
}

const SALT_ROUNDS = 10;
const DEFAULT_ORG_ID = 'default-org';

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(userId: string): Promise<boolean>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  updateUserStatus(userId: string, status: string): Promise<User | undefined>;
  updateUserPassword(userId: string, newPassword: string): Promise<User | undefined>;
  updateUserLastActive(userId: string): Promise<void>;
  updateUserSuperAdmin(userId: string, isSuperAdmin: boolean): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersByOrganization(organizationId: string): Promise<User[]>;
  setEmailVerificationToken(userId: string, token: string, expires: Date): Promise<void>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  markEmailVerified(userId: string): Promise<void>;
  
  createQueryLog(log: InsertQueryLog): Promise<QueryLog>;
  getAllQueryLogs(): Promise<QueryLog[]>;
  getQueryLogsByUser(userId: string): Promise<QueryLog[]>;
  getQueryLogsByOrganization(organizationId: string): Promise<QueryLog[]>;
  
  getSetting(key: string, organizationId?: string): Promise<Setting | undefined>;
  upsertSetting(setting: InsertSetting): Promise<Setting>;
  deleteSetting(key: string, organizationId: string): Promise<void>;
  getSettingsByOrganization(organizationId: string): Promise<Setting[]>;
  
  createExportJob(job: InsertExportJob): Promise<ExportJob>;
  getExportJob(id: string): Promise<ExportJob | undefined>;
  updateExportJobProgress(id: string, progress: number, totalRows?: number): Promise<void>;
  updateExportJobStatus(id: string, status: string, filePath?: string, errorMessage?: string): Promise<void>;
  getExportJobsByUser(userId: string): Promise<ExportJob[]>;
  getAllExportJobs(): Promise<ExportJob[]>;
  getExportJobsByOrganization(organizationId: string): Promise<ExportJob[]>;
  
  getAllSftpConfigs(): Promise<SftpConfig[]>;
  getActiveSftpConfigs(): Promise<SftpConfig[]>;
  getSftpConfigById(id: string): Promise<SftpConfig | undefined>;
  createSftpConfig(config: InsertSftpConfig): Promise<SftpConfig>;
  updateSftpConfig(id: string, config: InsertSftpConfig): Promise<SftpConfig | undefined>;
  deleteSftpConfig(id: string): Promise<boolean>;
  getSftpConfigsByOrganization(organizationId: string): Promise<SftpConfig[]>;
  
  getSavedQueriesByUser(userId: string): Promise<SavedQuery[]>;
  createSavedQuery(query: InsertSavedQuery): Promise<SavedQuery>;
  deleteSavedQuery(id: string, userId: string): Promise<boolean>;
  getSavedQueriesByOrganization(organizationId: string): Promise<SavedQuery[]>;
  
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: string): Promise<boolean>;
  getAllOrganizations(): Promise<Organization[]>;
  
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlanBySlug(slug: string): Promise<SubscriptionPlan | undefined>;
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  
  getOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | undefined>;
  createOrganizationSubscription(sub: InsertOrganizationSubscription): Promise<OrganizationSubscription>;
  updateOrganizationSubscription(id: string, sub: Partial<InsertOrganizationSubscription>): Promise<OrganizationSubscription | undefined>;
  
  getOrganizationMember(organizationId: string, userId: string): Promise<OrganizationMember | undefined>;
  getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]>;
  getUserOrganizations(userId: string): Promise<Organization[]>;
  addOrganizationMember(member: InsertOrganizationMember): Promise<OrganizationMember>;
  updateMemberRole(organizationId: string, userId: string, role: string): Promise<OrganizationMember | undefined>;
  removeOrganizationMember(organizationId: string, userId: string): Promise<boolean>;
  
  createOrganizationInvitation(invitation: InsertOrganizationInvitation): Promise<OrganizationInvitation>;
  getInvitationByToken(token: string): Promise<OrganizationInvitation | undefined>;
  getOrganizationInvitations(organizationId: string): Promise<OrganizationInvitation[]>;
  acceptInvitation(token: string): Promise<OrganizationInvitation | undefined>;
  
  getOrganizationAwsConfig(organizationId: string): Promise<OrganizationAwsConfig | undefined>;
  upsertOrganizationAwsConfig(config: InsertOrganizationAwsConfig): Promise<OrganizationAwsConfig>;
  
  getOrganizationAiConfig(organizationId: string): Promise<OrganizationAiConfig | undefined>;
  upsertOrganizationAiConfig(config: InsertOrganizationAiConfig): Promise<OrganizationAiConfig>;
  
  getDatabaseConnectionsByOrganization(organizationId: string): Promise<OrganizationDatabaseConnection[]>;
  getDatabaseConnectionById(id: string): Promise<OrganizationDatabaseConnection | undefined>;
  getDefaultDatabaseConnection(organizationId: string): Promise<OrganizationDatabaseConnection | undefined>;
  createDatabaseConnection(connection: InsertOrganizationDatabaseConnection): Promise<OrganizationDatabaseConnection>;
  updateDatabaseConnection(id: string, connection: Partial<InsertOrganizationDatabaseConnection>): Promise<OrganizationDatabaseConnection | undefined>;
  deleteDatabaseConnection(id: string): Promise<boolean>;
  setDefaultDatabaseConnection(id: string, organizationId: string): Promise<void>;
  
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByOrganization(organizationId: string): Promise<AuditLog[]>;

  getDashboardCharts(organizationId: string): Promise<DashboardChart[]>;
  getDashboardChart(id: string): Promise<DashboardChart | undefined>;
  createDashboardChart(chart: InsertDashboardChart): Promise<DashboardChart>;
  updateDashboardChart(id: string, chart: Partial<InsertDashboardChart>): Promise<DashboardChart | undefined>;
  deleteDashboardChart(id: string): Promise<void>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt))).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(and(eq(users.username, username), isNull(users.deletedAt))).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(and(eq(users.email, email), isNull(users.deletedAt))).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, SALT_ROUNDS);
    const result = await db.insert(users).values({
      email: insertUser.email,
      username: insertUser.username,
      password: hashedPassword,
      role: insertUser.role || 'user',
    }).returning();
    return result[0];
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await db.update(users)
      .set({ deletedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning();
    return result.length > 0;
  }

  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserStatus(userId: string, status: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ status })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<User | undefined> {
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const result = await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserLastActive(userId: string): Promise<void> {
    await db.update(users)
      .set({ lastActive: new Date() })
      .where(eq(users.id, userId));
  }

  async updateUserSuperAdmin(userId: string, isSuperAdmin: boolean): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ isSuperAdmin })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).where(isNull(users.deletedAt));
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    // Single JOIN query — no N+1
    return await db
      .select({
        id: users.id, email: users.email, username: users.username, password: users.password,
        role: users.role, status: users.status, emailVerified: users.emailVerified,
        isSuperAdmin: users.isSuperAdmin, createdAt: users.createdAt, lastActive: users.lastActive,
        deletedAt: users.deletedAt, emailVerificationToken: users.emailVerificationToken,
        emailVerificationExpires: users.emailVerificationExpires,
      })
      .from(users)
      .innerJoin(organizationMembers, eq(users.id, organizationMembers.userId))
      .where(and(eq(organizationMembers.organizationId, organizationId), isNull(users.deletedAt))) as User[];
  }

  async setEmailVerificationToken(userId: string, token: string, expires: Date): Promise<void> {
    await db.update(users)
      .set({ emailVerificationToken: token, emailVerificationExpires: expires })
      .where(eq(users.id, userId));
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const result = await db.select().from(users)
      .where(and(eq(users.emailVerificationToken, token), isNull(users.deletedAt)))
      .limit(1);
    return result[0];
  }

  async markEmailVerified(userId: string): Promise<void> {
    await db.update(users)
      .set({ emailVerified: true, emailVerificationToken: null, emailVerificationExpires: null })
      .where(eq(users.id, userId));
  }

  async createQueryLog(log: InsertQueryLog): Promise<QueryLog> {
    const result = await db.insert(queryLogs).values({
      ...log,
      organizationId: log.organizationId || DEFAULT_ORG_ID,
    }).returning();
    return result[0];
  }

  async getAllQueryLogs(): Promise<QueryLog[]> {
    return await db.select().from(queryLogs).orderBy(desc(queryLogs.createdAt));
  }

  async getQueryLogsByUser(userId: string): Promise<QueryLog[]> {
    return await db.select().from(queryLogs)
      .where(eq(queryLogs.userId, userId))
      .orderBy(desc(queryLogs.createdAt));
  }

  async getQueryLogsByOrganization(organizationId: string): Promise<QueryLog[]> {
    return await db.select().from(queryLogs)
      .where(eq(queryLogs.organizationId, organizationId))
      .orderBy(desc(queryLogs.createdAt));
  }

  async getSetting(key: string, organizationId?: string): Promise<Setting | undefined> {
    // Strict org scoping - require organizationId for proper tenant isolation
    if (!organizationId) {
      console.warn(`getSetting called without organizationId for key: ${key}`);
      return undefined;
    }
    const result = await db.select().from(settings)
      .where(and(eq(settings.key, key), eq(settings.organizationId, organizationId)))
      .limit(1);
    return result[0];
  }

  async upsertSetting(setting: InsertSetting): Promise<Setting> {
    // Require organizationId for proper tenant isolation
    const orgId = setting.organizationId;
    if (!orgId) {
      throw new Error("Organization ID is required for settings");
    }
    
    const existing = await db.select().from(settings)
      .where(and(eq(settings.key, setting.key), eq(settings.organizationId, orgId)))
      .limit(1);
    if (existing[0]) {
      const result = await db.update(settings)
        .set({ value: setting.value, updatedAt: new Date() })
        .where(eq(settings.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(settings).values({
        ...setting,
        organizationId: orgId,
      }).returning();
      return result[0];
    }
  }

  async deleteSetting(key: string, organizationId: string): Promise<void> {
    await db.delete(settings)
      .where(and(eq(settings.key, key), eq(settings.organizationId, organizationId)));
  }

  async getSettingsByOrganization(organizationId: string): Promise<Setting[]> {
    return await db.select().from(settings)
      .where(eq(settings.organizationId, organizationId));
  }

  async createExportJob(job: InsertExportJob): Promise<ExportJob> {
    const result = await db.insert(exportJobs).values({
      ...job,
      organizationId: job.organizationId || DEFAULT_ORG_ID,
    }).returning();
    return result[0];
  }

  async getExportJob(id: string): Promise<ExportJob | undefined> {
    const result = await db.select().from(exportJobs).where(eq(exportJobs.id, id)).limit(1);
    return result[0];
  }

  async updateExportJobProgress(id: string, progress: number, totalRows?: number): Promise<void> {
    const updateData: any = { progress };
    if (totalRows !== undefined) {
      updateData.totalRows = totalRows;
    }
    await db.update(exportJobs)
      .set(updateData)
      .where(eq(exportJobs.id, id));
  }

  async updateExportJobStatus(id: string, status: string, filePath?: string, errorMessage?: string): Promise<void> {
    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    if (filePath) {
      updateData.filePath = filePath;
    }
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }
    await db.update(exportJobs)
      .set(updateData)
      .where(eq(exportJobs.id, id));
  }

  async getExportJobsByUser(userId: string): Promise<ExportJob[]> {
    return await db.select().from(exportJobs)
      .where(eq(exportJobs.userId, userId))
      .orderBy(desc(exportJobs.createdAt));
  }

  async getAllExportJobs(): Promise<ExportJob[]> {
    return await db.select().from(exportJobs).orderBy(desc(exportJobs.createdAt));
  }

  async getExportJobsByOrganization(organizationId: string): Promise<ExportJob[]> {
    return await db.select().from(exportJobs)
      .where(eq(exportJobs.organizationId, organizationId))
      .orderBy(desc(exportJobs.createdAt));
  }

  async getAllSftpConfigs(): Promise<SftpConfig[]> {
    const rows = await db.select().from(sftpConfigs).orderBy(desc(sftpConfigs.createdAt));
    return rows.map(decryptSftpFields);
  }

  async getActiveSftpConfigs(): Promise<SftpConfig[]> {
    const rows = await db.select().from(sftpConfigs)
      .where(eq(sftpConfigs.status, 'active'))
      .orderBy(desc(sftpConfigs.createdAt));
    return rows.map(decryptSftpFields);
  }

  async getSftpConfigById(id: string): Promise<SftpConfig | undefined> {
    const result = await db.select().from(sftpConfigs).where(eq(sftpConfigs.id, id)).limit(1);
    return result[0] ? decryptSftpFields(result[0]) : undefined;
  }

  async createSftpConfig(config: InsertSftpConfig): Promise<SftpConfig> {
    const result = await db.insert(sftpConfigs).values({
      ...encryptSftpFields(config),
      organizationId: config.organizationId || DEFAULT_ORG_ID,
    }).returning();
    return decryptSftpFields(result[0]);
  }

  async updateSftpConfig(id: string, config: InsertSftpConfig): Promise<SftpConfig | undefined> {
    const result = await db.update(sftpConfigs)
      .set({ ...encryptSftpFields(config), updatedAt: new Date() })
      .where(eq(sftpConfigs.id, id))
      .returning();
    return result[0] ? decryptSftpFields(result[0]) : undefined;
  }

  async deleteSftpConfig(id: string): Promise<boolean> {
    const result = await db.delete(sftpConfigs)
      .where(eq(sftpConfigs.id, id))
      .returning();
    return result.length > 0;
  }

  async getSftpConfigsByOrganization(organizationId: string): Promise<SftpConfig[]> {
    const rows = await db.select().from(sftpConfigs)
      .where(eq(sftpConfigs.organizationId, organizationId))
      .orderBy(desc(sftpConfigs.createdAt));
    return rows.map(decryptSftpFields);
  }

  async getSavedQueriesByUser(userId: string): Promise<SavedQuery[]> {
    return await db.select().from(savedQueries)
      .where(eq(savedQueries.userId, userId))
      .orderBy(desc(savedQueries.createdAt));
  }

  async createSavedQuery(query: InsertSavedQuery): Promise<SavedQuery> {
    const result = await db.insert(savedQueries).values({
      ...query,
      organizationId: query.organizationId || DEFAULT_ORG_ID,
    }).returning();
    return result[0];
  }

  async deleteSavedQuery(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(savedQueries)
      .where(and(eq(savedQueries.id, id), eq(savedQueries.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getSavedQueriesByOrganization(organizationId: string): Promise<SavedQuery[]> {
    return await db.select().from(savedQueries)
      .where(eq(savedQueries.organizationId, organizationId))
      .orderBy(desc(savedQueries.createdAt));
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const result = await db.select().from(organizations).where(and(eq(organizations.id, id), isNull(organizations.deletedAt))).limit(1);
    return result[0];
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const result = await db.select().from(organizations).where(and(eq(organizations.slug, slug), isNull(organizations.deletedAt))).limit(1);
    return result[0];
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const result = await db.insert(organizations).values(org).returning();
    return result[0];
  }

  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const result = await db.update(organizations)
      .set({ ...org, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return result[0];
  }

  async deleteOrganization(id: string): Promise<boolean> {
    const result = await db.update(organizations)
      .set({ deletedAt: new Date() })
      .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
      .returning();
    return result.length > 0;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations).where(isNull(organizations.deletedAt)).orderBy(desc(organizations.createdAt));
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
    return result[0];
  }

  async getSubscriptionPlanBySlug(slug: string): Promise<SubscriptionPlan | undefined> {
    const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.slug, slug)).limit(1);
    return result[0];
  }

  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
  }

  async getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);
  }

  async getOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | undefined> {
    const result = await db.select().from(organizationSubscriptions)
      .where(eq(organizationSubscriptions.organizationId, organizationId))
      .limit(1);
    return result[0];
  }

  async createOrganizationSubscription(sub: InsertOrganizationSubscription): Promise<OrganizationSubscription> {
    const result = await db.insert(organizationSubscriptions).values(sub).returning();
    return result[0];
  }

  async updateOrganizationSubscription(id: string, sub: Partial<InsertOrganizationSubscription>): Promise<OrganizationSubscription | undefined> {
    const result = await db.update(organizationSubscriptions)
      .set({ ...sub, updatedAt: new Date() })
      .where(eq(organizationSubscriptions.id, id))
      .returning();
    return result[0];
  }

  async getOrganizationMember(organizationId: string, userId: string): Promise<OrganizationMember | undefined> {
    const result = await db.select().from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      ))
      .limit(1);
    return result[0];
  }

  async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    return await db.select().from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    // Single JOIN query — no N+1; ordered by membership creation (oldest first)
    return await db
      .select({
        id: organizations.id, name: organizations.name, slug: organizations.slug,
        status: organizations.status, stripeCustomerId: organizations.stripeCustomerId,
        stripeSubscriptionId: organizations.stripeSubscriptionId,
        createdAt: organizations.createdAt, updatedAt: organizations.updatedAt,
        deletedAt: organizations.deletedAt,
      })
      .from(organizations)
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(and(eq(organizationMembers.userId, userId), isNull(organizations.deletedAt)))
      .orderBy(organizationMembers.createdAt) as Organization[];
  }

  async addOrganizationMember(member: InsertOrganizationMember): Promise<OrganizationMember> {
    const result = await db.insert(organizationMembers).values(member).returning();
    return result[0];
  }

  async updateMemberRole(organizationId: string, userId: string, role: string): Promise<OrganizationMember | undefined> {
    const result = await db.update(organizationMembers)
      .set({ role })
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      ))
      .returning();
    return result[0];
  }

  async removeOrganizationMember(organizationId: string, userId: string): Promise<boolean> {
    const result = await db.delete(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      ))
      .returning();
    return result.length > 0;
  }

  async createOrganizationInvitation(invitation: InsertOrganizationInvitation): Promise<OrganizationInvitation> {
    const result = await db.insert(organizationInvitations).values(invitation).returning();
    return result[0];
  }

  async getInvitationByToken(token: string): Promise<OrganizationInvitation | undefined> {
    const result = await db.select().from(organizationInvitations)
      .where(eq(organizationInvitations.token, token))
      .limit(1);
    return result[0];
  }

  async getOrganizationInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
    return await db.select().from(organizationInvitations)
      .where(eq(organizationInvitations.organizationId, organizationId))
      .orderBy(desc(organizationInvitations.createdAt));
  }

  async acceptInvitation(token: string): Promise<OrganizationInvitation | undefined> {
    const result = await db.update(organizationInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(organizationInvitations.token, token))
      .returning();
    return result[0];
  }

  async getOrganizationAwsConfig(organizationId: string): Promise<OrganizationAwsConfig | undefined> {
    const result = await db.select().from(organizationAwsConfigs)
      .where(eq(organizationAwsConfigs.organizationId, organizationId))
      .limit(1);
    return result[0] ? decryptAwsConfigFields(result[0]) : undefined;
  }

  async upsertOrganizationAwsConfig(config: InsertOrganizationAwsConfig): Promise<OrganizationAwsConfig> {
    const encrypted = encryptAwsConfigFields(config);
    const existing = await db.select().from(organizationAwsConfigs)
      .where(eq(organizationAwsConfigs.organizationId, config.organizationId)).limit(1);
    if (existing[0]) {
      const result = await db.update(organizationAwsConfigs)
        .set({ ...encrypted, updatedAt: new Date() })
        .where(eq(organizationAwsConfigs.organizationId, config.organizationId))
        .returning();
      return decryptAwsConfigFields(result[0]);
    } else {
      const result = await db.insert(organizationAwsConfigs).values(encrypted).returning();
      return decryptAwsConfigFields(result[0]);
    }
  }

  async getOrganizationAiConfig(organizationId: string): Promise<OrganizationAiConfig | undefined> {
    const result = await db.select().from(organizationAiConfigs)
      .where(eq(organizationAiConfigs.organizationId, organizationId))
      .limit(1);
    return result[0] ? decryptAiConfigFields(result[0]) : undefined;
  }

  async upsertOrganizationAiConfig(config: InsertOrganizationAiConfig): Promise<OrganizationAiConfig> {
    const encrypted = encryptAiConfigFields(config);
    const existing = await db.select().from(organizationAiConfigs)
      .where(eq(organizationAiConfigs.organizationId, config.organizationId)).limit(1);
    if (existing[0]) {
      const result = await db.update(organizationAiConfigs)
        .set({ ...encrypted, updatedAt: new Date() })
        .where(eq(organizationAiConfigs.organizationId, config.organizationId))
        .returning();
      return decryptAiConfigFields(result[0]);
    } else {
      const result = await db.insert(organizationAiConfigs).values(encrypted).returning();
      return decryptAiConfigFields(result[0]);
    }
  }

  async getDatabaseConnectionsByOrganization(organizationId: string): Promise<OrganizationDatabaseConnection[]> {
    const rows = await db.select().from(organizationDatabaseConnections)
      .where(eq(organizationDatabaseConnections.organizationId, organizationId))
      .orderBy(desc(organizationDatabaseConnections.createdAt));
    return rows.map(decryptConnectionFields);
  }

  async getDatabaseConnectionById(id: string): Promise<OrganizationDatabaseConnection | undefined> {
    const result = await db.select().from(organizationDatabaseConnections)
      .where(eq(organizationDatabaseConnections.id, id))
      .limit(1);
    return result[0] ? decryptConnectionFields(result[0]) : undefined;
  }

  async getDefaultDatabaseConnection(organizationId: string): Promise<OrganizationDatabaseConnection | undefined> {
    const result = await db.select().from(organizationDatabaseConnections)
      .where(and(
        eq(organizationDatabaseConnections.organizationId, organizationId),
        eq(organizationDatabaseConnections.isDefault, true)
      ))
      .limit(1);
    return result[0] ? decryptConnectionFields(result[0]) : undefined;
  }

  async createDatabaseConnection(connection: InsertOrganizationDatabaseConnection): Promise<OrganizationDatabaseConnection> {
    if (connection.isDefault) {
      await db.update(organizationDatabaseConnections)
        .set({ isDefault: false })
        .where(eq(organizationDatabaseConnections.organizationId, connection.organizationId));
    }
    const result = await db.insert(organizationDatabaseConnections)
      .values(encryptConnectionFields(connection) as InsertOrganizationDatabaseConnection)
      .returning();
    return decryptConnectionFields(result[0]);
  }

  async updateDatabaseConnection(id: string, connection: Partial<InsertOrganizationDatabaseConnection>): Promise<OrganizationDatabaseConnection | undefined> {
    if (connection.isDefault) {
      const existing = await this.getDatabaseConnectionById(id);
      if (existing) {
        await db.update(organizationDatabaseConnections)
          .set({ isDefault: false })
          .where(eq(organizationDatabaseConnections.organizationId, existing.organizationId));
      }
    }
    const result = await db.update(organizationDatabaseConnections)
      .set({ ...encryptConnectionFields(connection), updatedAt: new Date() })
      .where(eq(organizationDatabaseConnections.id, id))
      .returning();
    return result[0] ? decryptConnectionFields(result[0]) : undefined;
  }

  async deleteDatabaseConnection(id: string): Promise<boolean> {
    const result = await db.delete(organizationDatabaseConnections)
      .where(eq(organizationDatabaseConnections.id, id))
      .returning();
    return result.length > 0;
  }

  async setDefaultDatabaseConnection(id: string, organizationId: string): Promise<void> {
    await db.update(organizationDatabaseConnections)
      .set({ isDefault: false })
      .where(eq(organizationDatabaseConnections.organizationId, organizationId));
    await db.update(organizationDatabaseConnections)
      .set({ isDefault: true })
      .where(eq(organizationDatabaseConnections.id, id));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  async getAuditLogsByOrganization(organizationId: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.organizationId, organizationId))
      .orderBy(desc(auditLogs.createdAt));
  }

  async getDashboardCharts(organizationId: string): Promise<DashboardChart[]> {
    return await db.select().from(dashboardCharts)
      .where(eq(dashboardCharts.organizationId, organizationId))
      .orderBy(desc(dashboardCharts.createdAt));
  }

  async getDashboardChart(id: string): Promise<DashboardChart | undefined> {
    const result = await db.select().from(dashboardCharts).where(eq(dashboardCharts.id, id));
    return result[0];
  }

  async createDashboardChart(chart: InsertDashboardChart): Promise<DashboardChart> {
    const result = await db.insert(dashboardCharts).values(chart).returning();
    return result[0];
  }

  async updateDashboardChart(id: string, chart: Partial<InsertDashboardChart>): Promise<DashboardChart | undefined> {
    const result = await db.update(dashboardCharts)
      .set({ ...chart, updatedAt: new Date() })
      .where(eq(dashboardCharts.id, id))
      .returning();
    return result[0];
  }

  async deleteDashboardChart(id: string): Promise<void> {
    await db.delete(dashboardCharts).where(eq(dashboardCharts.id, id));
  }
}

export const storage = new DbStorage();
