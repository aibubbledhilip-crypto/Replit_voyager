import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { z } from "zod";
import { insertUserSchema, insertQueryLogSchema } from "@shared/schema";
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";

// Middleware to check if user is authenticated
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// Middleware to check if user is admin
function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ message: "Account is inactive" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Update last active
      await storage.updateUserLastActive(user.id);

      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User management routes (admin only)
  app.get("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await storage.updateUserRole(id, role);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id/status", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const user = await storage.updateUserStatus(id, status);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Settings routes
  app.get("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getSetting(key);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ message: "Key and value are required" });
      }

      const setting = await storage.upsertSetting({ key, value });
      res.json(setting);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Query execution route
  app.post("/api/query/execute", requireAuth, async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      // Get row limit setting
      const limitSetting = await storage.getSetting('row_limit');
      const rowLimit = limitSetting ? parseInt(limitSetting.value) : 1000;

      // Initialize Athena client
      const athenaClient = new AthenaClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

      const s3OutputLocation = process.env.AWS_S3_OUTPUT_LOCATION || 's3://dvsum-staging-prod';

      const startTime = Date.now();

      // Start query execution
      const startCommand = new StartQueryExecutionCommand({
        QueryString: query,
        ResultConfiguration: {
          OutputLocation: s3OutputLocation,
        },
      });

      const startResponse = await athenaClient.send(startCommand);
      const queryExecutionId = startResponse.QueryExecutionId;

      if (!queryExecutionId) {
        throw new Error('Failed to start query execution');
      }

      // Poll for query completion
      let queryStatus = 'RUNNING';
      const getExecutionCommand = new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId });

      while (queryStatus === 'RUNNING' || queryStatus === 'QUEUED') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        const executionResponse = await athenaClient.send(getExecutionCommand);
        queryStatus = executionResponse.QueryExecution?.Status?.State || 'FAILED';
      }

      if (queryStatus !== 'SUCCEEDED') {
        throw new Error(`Query failed with status: ${queryStatus}`);
      }

      // Get query results
      const getResultsCommand = new GetQueryResultsCommand({
        QueryExecutionId: queryExecutionId,
        MaxResults: rowLimit,
      });

      const resultsResponse = await athenaClient.send(getResultsCommand);
      const rows = resultsResponse.ResultSet?.Rows || [];

      // Parse results
      const columns = rows[0]?.Data?.map(col => col.VarCharValue || '') || [];
      const data = rows.slice(1).map(row => {
        const rowData: Record<string, any> = {};
        row.Data?.forEach((cell, idx) => {
          rowData[columns[idx]] = cell.VarCharValue;
        });
        return rowData;
      });

      const executionTime = Date.now() - startTime;

      // Log the query execution
      await storage.createQueryLog({
        userId: req.session.userId!,
        username: req.session.username!,
        query,
        rowsReturned: data.length,
        executionTime,
        status: 'success',
      });

      res.json({
        columns,
        data,
        rowsReturned: data.length,
        executionTime,
        rowLimit,
      });
    } catch (error: any) {
      // Log failed query
      try {
        await storage.createQueryLog({
          userId: req.session.userId!,
          username: req.session.username!,
          query: req.body.query || '',
          rowsReturned: 0,
          executionTime: 0,
          status: 'error',
        });
      } catch (logError) {
        console.error('Failed to log error query:', logError);
      }

      res.status(500).json({ message: error.message });
    }
  });

  // Query logs routes
  app.get("/api/logs", requireAuth, async (req, res) => {
    try {
      let logs;
      if (req.session.role === 'admin') {
        logs = await storage.getAllQueryLogs();
      } else {
        logs = await storage.getQueryLogsByUser(req.session.userId!);
      }
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
