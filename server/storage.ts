import { db } from "./db";
import { users, queryLogs, settings, type User, type InsertUser, type QueryLog, type InsertQueryLog, type Setting, type InsertSetting } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  updateUserStatus(userId: string, status: string): Promise<User | undefined>;
  updateUserLastActive(userId: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  createQueryLog(log: InsertQueryLog): Promise<QueryLog>;
  getAllQueryLogs(): Promise<QueryLog[]>;
  getQueryLogsByUser(userId: string): Promise<QueryLog[]>;
  
  getSetting(key: string): Promise<Setting | undefined>;
  upsertSetting(setting: InsertSetting): Promise<Setting>;
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
}

export const storage = new DbStorage();
