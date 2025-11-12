import { db } from "./db";
import { users, queryLogs, settings, exportJobs, sftpConfigs, type User, type InsertUser, type QueryLog, type InsertQueryLog, type Setting, type InsertSetting, type ExportJob, type InsertExportJob, type SftpConfig, type InsertSftpConfig } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  updateUserStatus(userId: string, status: string): Promise<User | undefined>;
  updateUserPassword(userId: string, newPassword: string): Promise<User | undefined>;
  updateUserLastActive(userId: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  createQueryLog(log: InsertQueryLog): Promise<QueryLog>;
  getAllQueryLogs(): Promise<QueryLog[]>;
  getQueryLogsByUser(userId: string): Promise<QueryLog[]>;
  
  getSetting(key: string): Promise<Setting | undefined>;
  upsertSetting(setting: InsertSetting): Promise<Setting>;
  
  createExportJob(job: InsertExportJob): Promise<ExportJob>;
  getExportJob(id: string): Promise<ExportJob | undefined>;
  updateExportJobProgress(id: string, progress: number, totalRows?: number): Promise<void>;
  updateExportJobStatus(id: string, status: string, filePath?: string, errorMessage?: string): Promise<void>;
  getExportJobsByUser(userId: string): Promise<ExportJob[]>;
  getAllExportJobs(): Promise<ExportJob[]>;
  
  getAllSftpConfigs(): Promise<SftpConfig[]>;
  getActiveSftpConfigs(): Promise<SftpConfig[]>;
  getSftpConfigById(id: string): Promise<SftpConfig | undefined>;
  createSftpConfig(config: InsertSftpConfig): Promise<SftpConfig>;
  updateSftpConfig(id: string, config: InsertSftpConfig): Promise<SftpConfig | undefined>;
  deleteSftpConfig(id: string): Promise<boolean>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, SALT_ROUNDS);
    const result = await db.insert(users).values({
      username: insertUser.username,
      password: hashedPassword,
      role: insertUser.role || 'user',
    }).returning();
    return result[0];
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createQueryLog(log: InsertQueryLog): Promise<QueryLog> {
    const result = await db.insert(queryLogs).values(log).returning();
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

  async getSetting(key: string): Promise<Setting | undefined> {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return result[0];
  }

  async upsertSetting(setting: InsertSetting): Promise<Setting> {
    const existing = await this.getSetting(setting.key);
    if (existing) {
      const result = await db.update(settings)
        .set({ value: setting.value, updatedAt: new Date() })
        .where(eq(settings.key, setting.key))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(settings).values(setting).returning();
      return result[0];
    }
  }

  async createExportJob(job: InsertExportJob): Promise<ExportJob> {
    const result = await db.insert(exportJobs).values(job).returning();
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

  async getAllSftpConfigs(): Promise<SftpConfig[]> {
    return await db.select().from(sftpConfigs).orderBy(desc(sftpConfigs.createdAt));
  }

  async getActiveSftpConfigs(): Promise<SftpConfig[]> {
    return await db.select().from(sftpConfigs)
      .where(eq(sftpConfigs.status, 'active'))
      .orderBy(desc(sftpConfigs.createdAt));
  }

  async getSftpConfigById(id: string): Promise<SftpConfig | undefined> {
    const result = await db.select().from(sftpConfigs).where(eq(sftpConfigs.id, id)).limit(1);
    return result[0];
  }

  async createSftpConfig(config: InsertSftpConfig): Promise<SftpConfig> {
    const result = await db.insert(sftpConfigs).values(config).returning();
    return result[0];
  }

  async updateSftpConfig(id: string, config: InsertSftpConfig): Promise<SftpConfig | undefined> {
    const result = await db.update(sftpConfigs)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(sftpConfigs.id, id))
      .returning();
    return result[0];
  }

  async deleteSftpConfig(id: string): Promise<boolean> {
    const result = await db.delete(sftpConfigs)
      .where(eq(sftpConfigs.id, id))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DbStorage();
