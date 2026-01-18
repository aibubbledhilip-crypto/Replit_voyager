import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { z } from "zod";
import crypto from "crypto";
import { insertUserSchema, insertQueryLogSchema } from "@shared/schema";
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";
import { ensureCsrfToken, verifyCsrfToken, getCsrfToken } from "./csrf";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
import { parseFile, compareDatasets, cleanupOldFiles } from "./file-comparison-helper";
import { checkSftpFiles, testSftpConnection } from "./sftp-helper";
import { insertSftpConfigSchema } from "@shared/schema";
import { executeAthenaQueryWithPagination } from "./athena-helper";
import { analyzeData, getValidatedModel, type AIProvider } from "./ai-service";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
      cb(null, `${name}_${timestamp}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and XLSX files are allowed'));
    }
  },
});

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
  // Ensure CSRF token exists in session
  app.use(ensureCsrfToken);
  
  // CSRF token endpoint (must be before CSRF verification)
  app.get("/api/csrf-token", getCsrfToken);
  
  // CSRF verification temporarily disabled for debugging cookie issues
  // app.use('/api', verifyCsrfToken);

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

      // Regenerate session to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to create session" });
        }

        // Set session data
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        
        // Generate new CSRF token for the new session
        req.session.csrfToken = undefined;

        req.session.save((err) => {
          if (err) {
            return res.status(500).json({ message: "Failed to save session" });
          }

          res.json({
            id: user.id,
            username: user.username,
            role: user.role,
          });
        });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const sessionId = req.session.id;
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      
      // Clear the session cookie
      res.clearCookie('connect.sid');
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
      const organizationId = req.session.organizationId;
      let users;
      if (organizationId) {
        // Get users that belong to this organization
        users = await storage.getUsersByOrganization(organizationId);
      } else {
        // Fallback for legacy users without organization
        users = await storage.getAllUsers();
      }
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const organizationId = req.session.organizationId;
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser(userData);
      
      // Add user to the admin's organization if they have one
      if (organizationId) {
        await storage.addOrganizationMember({
          organizationId,
          userId: user.id,
          role: 'member',
        });
      }
      
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
      const organizationId = req.session.organizationId;

      if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Verify user belongs to admin's organization
      if (organizationId) {
        const member = await storage.getOrganizationMember(organizationId, id);
        if (!member) {
          return res.status(403).json({ message: "User not in your organization" });
        }
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
      const organizationId = req.session.organizationId;

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Verify user belongs to admin's organization
      if (organizationId) {
        const member = await storage.getOrganizationMember(organizationId, id);
        if (!member) {
          return res.status(403).json({ message: "User not in your organization" });
        }
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

  app.patch("/api/users/:id/password", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      const organizationId = req.session.organizationId;

      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Verify user belongs to admin's organization
      if (organizationId) {
        const member = await storage.getOrganizationMember(organizationId, id);
        if (!member) {
          return res.status(403).json({ message: "User not in your organization" });
        }
      }

      const user = await storage.updateUserPassword(id, password);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Settings routes
  // Default settings values for when settings don't exist
  const defaultSettings: Record<string, string> = {
    row_limit: '1000',
    display_limit: '10000',
    athena_database: 'dvsum-s3-glue-prod',
    explorer_table_sf: 'vw_sf_all_segment_hierarchy',
    explorer_column_sf: 'msisdn',
    explorer_table_aria: 'vw_aria_hierarchy_all_status_reverse',
    explorer_column_aria: 'msisdn',
    explorer_table_matrix: 'vw_matrixx_plan',
    explorer_column_matrix: 'msisdn',
    explorer_table_trufinder: 'vw_true_finder_raw',
    explorer_column_trufinder: 'msisdn',
    explorer_table_nokia: 'vw_nokia_raw',
    explorer_column_nokia: 'msisdn',
  };

  // Sensitive settings that require admin access
  const sensitiveSettings = ['openai_api_key', 'anthropic_api_key', 'gemini_api_key'];

  app.get("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const { key } = req.params;
      const organizationId = req.session.organizationId;
      
      // Check if this is a sensitive setting
      if (sensitiveSettings.includes(key)) {
        // Only admins can access sensitive settings
        const user = await storage.getUser(req.session.userId!);
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ message: "Admin access required" });
        }
        
        const setting = await storage.getSetting(key, organizationId);
        if (!setting) {
          return res.json({ key, value: '', configured: false });
        }
        // Return masked value for API keys
        const maskedValue = setting.value ? `${setting.value.slice(0, 7)}...${setting.value.slice(-4)}` : '';
        return res.json({ key, value: maskedValue, configured: !!setting.value });
      }
      
      const setting = await storage.getSetting(key, organizationId);
      if (!setting) {
        // Return default value if setting doesn't exist
        if (defaultSettings[key]) {
          return res.json({ key, value: defaultSettings[key] });
        }
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
      const organizationId = req.session.organizationId;
      
      if (!key || value === undefined) {
        return res.status(400).json({ message: "Key and value are required" });
      }

      const setting = await storage.upsertSetting({ key, value, organizationId });
      res.json(setting);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Saved Queries routes
  app.get("/api/saved-queries", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const queries = await storage.getSavedQueriesByUser(userId);
      res.json(queries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/saved-queries", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { name, query } = req.body;
      
      if (!name || !query) {
        return res.status(400).json({ message: "Name and query are required" });
      }
      
      const savedQuery = await storage.createSavedQuery({ userId, name, query });
      res.json(savedQuery);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/saved-queries/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { id } = req.params;
      
      const deleted = await storage.deleteSavedQuery(id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Saved query not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Schema cache to avoid hammering Athena
  let schemaCache: { 
    data: any; 
    timestamp: number;
  } | null = null;
  const SCHEMA_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Database schema endpoint - get tables only (columns fetched on demand)
  app.get("/api/query/schema", requireAuth, async (req, res) => {
    try {
      // Return cached data if valid
      if (schemaCache && (Date.now() - schemaCache.timestamp) < SCHEMA_CACHE_TTL) {
        return res.json(schemaCache.data);
      }

      const athenaClient = new AthenaClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

      const s3OutputLocation = process.env.AWS_S3_OUTPUT_LOCATION || 's3://dvsum-staging-prod';
      
      // Get Athena database name from settings
      const athenaDbSetting = await storage.getSetting('athena_database');
      const databaseName = athenaDbSetting?.value || 'dvsum-s3-glue-prod';

      // Helper function to execute a query and get results
      const executeSchemaQuery = async (query: string): Promise<string[][]> => {
        const startCommand = new StartQueryExecutionCommand({
          QueryString: query,
          ResultConfiguration: { OutputLocation: s3OutputLocation },
        });

        const startResponse = await athenaClient.send(startCommand);
        const queryExecutionId = startResponse.QueryExecutionId;

        if (!queryExecutionId) throw new Error('Failed to start query');

        let queryStatus = 'RUNNING';
        const maxPollTime = 30000;
        const pollStartTime = Date.now();

        while (queryStatus === 'RUNNING' || queryStatus === 'QUEUED') {
          if (Date.now() - pollStartTime > maxPollTime) {
            throw new Error('Schema query timeout');
          }
          await new Promise(resolve => setTimeout(resolve, 500));
          const execResponse = await athenaClient.send(
            new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId })
          );
          queryStatus = execResponse.QueryExecution?.Status?.State || 'FAILED';
        }

        if (queryStatus !== 'SUCCEEDED') {
          throw new Error(`Query failed: ${queryStatus}`);
        }

        const resultsResponse = await athenaClient.send(
          new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId, MaxResults: 1000 })
        );

        const rows = resultsResponse.ResultSet?.Rows || [];
        return rows.map(row => row.Data?.map(cell => cell.VarCharValue || '') || []);
      };

      // Get list of tables/views only (no column fetching to reduce queries)
      const tablesResult = await executeSchemaQuery(`SHOW TABLES IN \`${databaseName}\``);
      const tableNames = tablesResult.slice(1).map(row => row[0]).filter(Boolean);

      const schema = tableNames.map(name => ({ name, columns: [] }));

      const responseData = {
        database: databaseName,
        tables: schema,
        totalTables: tableNames.length,
        fetchedTables: tableNames.length,
      };

      // Cache the result
      schemaCache = { data: responseData, timestamp: Date.now() };

      res.json(responseData);
    } catch (error: any) {
      console.error('Schema fetch error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get columns for a specific table (on demand)
  app.get("/api/query/schema/:tableName/columns", requireAuth, async (req, res) => {
    try {
      const { tableName } = req.params;
      
      if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
        return res.status(400).json({ message: "Invalid table name" });
      }

      const athenaClient = new AthenaClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

      const s3OutputLocation = process.env.AWS_S3_OUTPUT_LOCATION || 's3://dvsum-staging-prod';
      
      // Get Athena database name from settings
      const athenaDbSetting = await storage.getSetting('athena_database');
      const databaseName = athenaDbSetting?.value || 'dvsum-s3-glue-prod';

      const startCommand = new StartQueryExecutionCommand({
        QueryString: `SHOW COLUMNS IN \`${databaseName}\`.\`${tableName}\``,
        ResultConfiguration: { OutputLocation: s3OutputLocation },
      });

      const startResponse = await athenaClient.send(startCommand);
      const queryExecutionId = startResponse.QueryExecutionId;

      if (!queryExecutionId) throw new Error('Failed to start query');

      let queryStatus = 'RUNNING';
      const maxPollTime = 30000;
      const pollStartTime = Date.now();

      while (queryStatus === 'RUNNING' || queryStatus === 'QUEUED') {
        if (Date.now() - pollStartTime > maxPollTime) {
          throw new Error('Column query timeout');
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        const execResponse = await athenaClient.send(
          new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId })
        );
        queryStatus = execResponse.QueryExecution?.Status?.State || 'FAILED';
      }

      if (queryStatus !== 'SUCCEEDED') {
        throw new Error(`Query failed: ${queryStatus}`);
      }

      const resultsResponse = await athenaClient.send(
        new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId, MaxResults: 500 })
      );

      const rows = resultsResponse.ResultSet?.Rows || [];
      const columns = rows.slice(1).map(row => ({
        name: row.Data?.[0]?.VarCharValue || '',
        type: row.Data?.[1]?.VarCharValue || 'string',
      }));

      res.json({ tableName, columns });
    } catch (error: any) {
      console.error('Column fetch error:', error);
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

      // Get row limit setting (used for export restriction, not display)
      const exportLimitSetting = await storage.getSetting('row_limit');
      const rowLimit = exportLimitSetting ? parseInt(exportLimitSetting.value) : 1000;
      
      // Get display limit setting (for results shown in UI)
      const displayLimitSetting = await storage.getSetting('display_limit');
      const displayLimit = displayLimitSetting ? parseInt(displayLimitSetting.value) : 10000;

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

      // Execute query with pagination support for large result sets
      // Use displayLimit for fetching all results; rowLimit is only for export restriction
      const result = await executeAthenaQueryWithPagination(
        athenaClient,
        query,
        s3OutputLocation,
        displayLimit
      );

      const columns = result.columns;
      const data = result.data;
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

  // MSISDN Lookup route - executes multiple queries in parallel
  app.post("/api/query/msisdn-lookup", requireAuth, async (req, res) => {
    try {
      const { msisdn } = req.body;
      if (!msisdn) {
        return res.status(400).json({ message: "MSISDN is required" });
      }

      // Trim whitespace and validate MSISDN to prevent SQL injection - must be digits only
      const trimmedMsisdn = typeof msisdn === 'string' ? msisdn.trim() : '';
      
      if (!trimmedMsisdn) {
        return res.status(400).json({ message: "MSISDN is required" });
      }
      
      const msisdnSchema = z.string().regex(/^\d+$/, "MSISDN must contain only digits");
      const validationResult = msisdnSchema.safeParse(trimmedMsisdn);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid MSISDN format. MSISDN must contain only digits.",
          errors: validationResult.error.errors 
        });
      }
      
      const sanitizedMsisdn = validationResult.data;

      // Get row limit setting (used for export restriction)
      const exportLimitSetting = await storage.getSetting('row_limit');
      const rowLimit = exportLimitSetting ? parseInt(exportLimitSetting.value) : 1000;
      
      // Get display limit setting (for results shown in UI)
      const displayLimitSetting = await storage.getSetting('display_limit');
      const displayLimit = displayLimitSetting ? parseInt(displayLimitSetting.value) : 10000;

      // Get Explorer configurations from settings (table and column for each data source)
      const sfTableSetting = await storage.getSetting('explorer_table_sf');
      const sfColumnSetting = await storage.getSetting('explorer_column_sf');
      const ariaTableSetting = await storage.getSetting('explorer_table_aria');
      const ariaColumnSetting = await storage.getSetting('explorer_column_aria');
      const matrixTableSetting = await storage.getSetting('explorer_table_matrix');
      const matrixColumnSetting = await storage.getSetting('explorer_column_matrix');
      const trufinderTableSetting = await storage.getSetting('explorer_table_trufinder');
      const trufinderColumnSetting = await storage.getSetting('explorer_column_trufinder');
      const nokiaTableSetting = await storage.getSetting('explorer_table_nokia');
      const nokiaColumnSetting = await storage.getSetting('explorer_column_nokia');

      const sfTable = sfTableSetting?.value || 'vw_sf_all_segment_hierarchy';
      const sfColumn = sfColumnSetting?.value || 'msisdn';
      const ariaTable = ariaTableSetting?.value || 'vw_aria_hierarchy_all_status_reverse';
      const ariaColumn = ariaColumnSetting?.value || 'msisdn';
      const matrixTable = matrixTableSetting?.value || 'vw_matrixx_plan';
      const matrixColumn = matrixColumnSetting?.value || 'msisdn';
      const trufinderTable = trufinderTableSetting?.value || 'vw_true_finder_raw';
      const trufinderColumn = trufinderColumnSetting?.value || 'msisdn';
      const nokiaTable = nokiaTableSetting?.value || 'vw_nokia_raw';
      const nokiaColumn = nokiaColumnSetting?.value || 'msisdn';

      // Get Athena database name from settings
      const athenaDbSetting = await storage.getSetting('athena_database');
      const databaseName = athenaDbSetting?.value || 'dvsum-s3-glue-prod';

      // Initialize Athena client
      const athenaClient = new AthenaClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

      const s3OutputLocation = process.env.AWS_S3_OUTPUT_LOCATION || 's3://dvsum-staging-prod';

      // Define all queries using sanitized search value and configured table/column names
      const queries = [
        {
          name: 'SF',
          query: `select * from "${databaseName}".${sfTable} where ${sfColumn} = '${sanitizedMsisdn}'`,
        },
        {
          name: 'Aria',
          query: `select * from "${databaseName}".${ariaTable} where ${ariaColumn} = '${sanitizedMsisdn}'`,
        },
        {
          name: 'Matrix',
          query: `select * from "${databaseName}".${matrixTable} where ${matrixColumn} = '${sanitizedMsisdn}'`,
        },
        {
          name: 'Trufinder',
          query: `select * from "${databaseName}".${trufinderTable} where ${trufinderColumn} = '${sanitizedMsisdn}'`,
        },
        {
          name: 'Nokia',
          query: `select * from "${databaseName}".${nokiaTable} where ${nokiaColumn} = '${sanitizedMsisdn}'`,
        },
      ];

      const startTime = Date.now();

      // Execute all queries in parallel
      const executeQuery = async (queryConfig: { name: string; query: string }) => {
        try {
          // Start query execution
          const startCommand = new StartQueryExecutionCommand({
            QueryString: queryConfig.query,
            ResultConfiguration: {
              OutputLocation: s3OutputLocation,
            },
          });

          const startResponse = await athenaClient.send(startCommand);
          const queryExecutionId = startResponse.QueryExecutionId;

          if (!queryExecutionId) {
            throw new Error(`Failed to start query execution for ${queryConfig.name}`);
          }

          // Poll for query completion
          let queryStatus = 'RUNNING';
          const getExecutionCommand = new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId });

          while (queryStatus === 'RUNNING' || queryStatus === 'QUEUED') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const executionResponse = await athenaClient.send(getExecutionCommand);
            queryStatus = executionResponse.QueryExecution?.Status?.State || 'FAILED';
          }

          if (queryStatus !== 'SUCCEEDED') {
            throw new Error(`Query failed with status: ${queryStatus}`);
          }

          // Get query results (AWS Athena has a max limit of 1000 per request)
          // Use displayLimit for fetching results shown in UI
          const getResultsCommand = new GetQueryResultsCommand({
            QueryExecutionId: queryExecutionId,
            MaxResults: Math.min(displayLimit, 1000),
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

          return {
            name: queryConfig.name,
            columns,
            data,
            rowsReturned: data.length,
            status: 'success',
            error: null,
          };
        } catch (error: any) {
          return {
            name: queryConfig.name,
            columns: [],
            data: [],
            rowsReturned: 0,
            status: 'error',
            error: error.message,
          };
        }
      };

      // Execute all queries in parallel
      const results = await Promise.all(queries.map(executeQuery));
      const executionTime = Date.now() - startTime;

      // Log the MSISDN lookup
      const totalRows = results.reduce((sum, r) => sum + r.rowsReturned, 0);
      const hasErrors = results.some(r => r.status === 'error');
      
      await storage.createQueryLog({
        userId: req.session.userId!,
        username: req.session.username!,
        query: `MSISDN Lookup: ${sanitizedMsisdn}`,
        rowsReturned: totalRows,
        executionTime,
        status: hasErrors ? 'error' : 'success',
      });

      res.json({
        msisdn: sanitizedMsisdn,
        results,
        totalRowsReturned: totalRows,
        executionTime,
        rowLimit,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Query logs routes
  app.get("/api/logs", requireAuth, async (req, res) => {
    try {
      let logs;
      const organizationId = req.session.organizationId;
      
      if (organizationId && req.session.role === 'admin') {
        // Admin sees all logs for their organization
        logs = await storage.getQueryLogsByOrganization(organizationId);
      } else if (organizationId) {
        // Regular users see their own logs within the organization
        logs = await storage.getQueryLogsByUser(req.session.userId!);
      } else {
        // Fallback for legacy users without organization
        logs = await storage.getQueryLogsByUser(req.session.userId!);
      }
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // File Comparison routes
  app.post("/api/compare/execute", requireAuth, upload.fields([
    { name: 'file1', maxCount: 1 },
    { name: 'file2', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (!files || !files.file1 || !files.file2) {
        return res.status(400).json({ message: "Both files are required" });
      }
      
      const file1 = files.file1[0];
      const file2 = files.file2[0];
      
      // Get column mappings from request
      const { columnMappings } = req.body;
      
      if (!columnMappings) {
        // Clean up uploaded files
        fs.unlinkSync(file1.path);
        fs.unlinkSync(file2.path);
        return res.status(400).json({ message: "Column mappings are required for comparison" });
      }
      
      // Parse column mappings
      let parsedMappings: Array<{file1Column: string, file2Column: string}>;
      try {
        parsedMappings = typeof columnMappings === 'string' ? JSON.parse(columnMappings) : columnMappings;
        if (!Array.isArray(parsedMappings) || parsedMappings.length === 0) {
          throw new Error('Column mappings must be a non-empty array');
        }
        
        // Validate each mapping has required fields
        for (const mapping of parsedMappings) {
          if (!mapping.file1Column || !mapping.file2Column) {
            throw new Error('Each mapping must have file1Column and file2Column');
          }
        }
      } catch (error: any) {
        fs.unlinkSync(file1.path);
        fs.unlinkSync(file2.path);
        return res.status(400).json({ message: `Invalid column mappings format: ${error.message}` });
      }
      
      try {
        // Parse both files
        const parsed1 = parseFile(file1.path);
        const parsed2 = parseFile(file2.path);
        
        // Perform comparison
        const comparisonResult = compareDatasets(
          parsed1,
          parsed2,
          parsedMappings,
          file1.originalname,
          file2.originalname
        );
        
        // Generate single XLSX file with all results on separate sheets
        const { generateComparisonXLSX } = await import('./file-comparison-helper.js');
        const xlsxFileName = generateComparisonXLSX(comparisonResult);
        
        // Clean up uploaded files
        fs.unlinkSync(file1.path);
        fs.unlinkSync(file2.path);
        
        // Log the comparison
        const mappingDesc = parsedMappings.map(m => `${m.file1Column}→${m.file2Column}`).join(', ');
        await storage.createQueryLog({
          userId: req.session.userId!,
          username: req.session.username!,
          query: `File Comparison: ${file1.originalname} vs ${file2.originalname} (Mappings: ${mappingDesc})`,
          rowsReturned: comparisonResult.uniqueToFile1.length + comparisonResult.uniqueToFile2.length + comparisonResult.matchingKeys.length,
          executionTime: 0,
          status: 'success',
        });
        
        res.json({
          summary: comparisonResult.summary,
          uniqueToFile1Count: comparisonResult.uniqueToFile1.length,
          uniqueToFile2Count: comparisonResult.uniqueToFile2.length,
          matchingKeysCount: comparisonResult.matchingKeys.length,
          downloadFile: xlsxFileName,
          message: 'Comparison completed successfully',
        });
        
        // Clean up old comparison files (older than 24 hours)
        cleanupOldFiles(path.join(__dirname, '..', 'comparison_results'));
      } catch (error: any) {
        // Clean up uploaded files on error
        if (fs.existsSync(file1.path)) fs.unlinkSync(file1.path);
        if (fs.existsSync(file2.path)) fs.unlinkSync(file2.path);
        throw error;
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/compare/download/:filename", requireAuth, async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Validate filename to prevent path traversal
      const safeName = path.basename(filename);
      const filePath = path.join(__dirname, '..', 'comparison_results', safeName);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Send file
      res.download(filePath, safeName, (err) => {
        if (err) {
          console.error('Error downloading file:', err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Error downloading file" });
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // SFTP Configuration Routes (Admin only, organization-scoped)
  app.get("/api/sftp/configs", requireAdmin, async (req, res) => {
    try {
      const organizationId = req.session.organizationId;
      let configs;
      if (organizationId) {
        configs = await storage.getSftpConfigsByOrganization(organizationId);
      } else {
        // Fallback for legacy users without organization
        configs = await storage.getAllSftpConfigs();
      }
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sftp/configs", requireAdmin, async (req, res) => {
    try {
      const organizationId = req.session.organizationId;
      const validatedData = insertSftpConfigSchema.parse({
        ...req.body,
        organizationId: organizationId || req.body.organizationId
      });
      const newConfig = await storage.createSftpConfig(validatedData);
      res.status(201).json(newConfig);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/sftp/configs/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const organizationId = req.session.organizationId;
      const validatedData = insertSftpConfigSchema.parse(req.body);
      
      // Get existing config to preserve credentials if not provided
      const existingConfig = await storage.getSftpConfigById(id);
      if (!existingConfig) {
        return res.status(404).json({ message: "SFTP configuration not found" });
      }
      
      // Verify organization ownership
      if (organizationId && existingConfig.organizationId !== organizationId) {
        return res.status(403).json({ message: "Not authorized to modify this configuration" });
      }
      
      // Prevent organizationId tampering - always use existing organizationId
      validatedData.organizationId = existingConfig.organizationId;
      
      // Preserve existing password if not provided (empty string means keep existing)
      if (!validatedData.password && existingConfig.password) {
        validatedData.password = existingConfig.password;
      }
      
      // Preserve existing private key if not provided
      if (!validatedData.privateKey && existingConfig.privateKey) {
        validatedData.privateKey = existingConfig.privateKey;
      }
      
      // Preserve existing passphrase if not provided
      if (!validatedData.passphrase && existingConfig.passphrase) {
        validatedData.passphrase = existingConfig.passphrase;
      }
      
      const updated = await storage.updateSftpConfig(id, validatedData);
      
      if (!updated) {
        return res.status(404).json({ message: "SFTP configuration not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/sftp/configs/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const organizationId = req.session.organizationId;
      
      // Verify organization ownership before deleting
      const existingConfig = await storage.getSftpConfigById(id);
      if (!existingConfig) {
        return res.status(404).json({ message: "SFTP configuration not found" });
      }
      
      if (organizationId && existingConfig.organizationId !== organizationId) {
        return res.status(403).json({ message: "Not authorized to delete this configuration" });
      }
      
      const deleted = await storage.deleteSftpConfig(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "SFTP configuration not found" });
      }
      
      res.json({ message: "SFTP configuration deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sftp/test", requireAdmin, async (req, res) => {
    try {
      const result = await testSftpConnection(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sftp/monitor", requireAuth, async (req, res) => {
    try {
      const organizationId = req.session.organizationId;
      let configs;
      if (organizationId) {
        configs = await storage.getSftpConfigsByOrganization(organizationId);
        configs = configs.filter(c => c.status === 'active');
      } else {
        configs = await storage.getActiveSftpConfigs();
      }
      
      // Check all SFTP servers in parallel
      const results = await Promise.all(
        configs.map(config => checkSftpFiles(config))
      );
      
      // Include server time for debugging timezone differences
      const serverTime = new Date().toISOString();
      const serverDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
      
      res.json({ 
        results, 
        serverTime,
        serverDate,
        serverTimestamp: Date.now()
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sftp/monitor/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const config = await storage.getSftpConfigById(id);
      
      if (!config) {
        return res.status(404).json({ message: "SFTP configuration not found" });
      }
      
      const result = await checkSftpFiles(config);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // AI Analysis endpoint
  app.post("/api/ai/analyze", requireAuth, async (req, res) => {
    try {
      const { data, sourceName } = req.body;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ message: "Data is required for analysis" });
      }

      // Get AI settings
      const providerSetting = await storage.getSetting('ai_provider');
      const modelSetting = await storage.getSetting('ai_model');
      const promptSetting = await storage.getSetting('ai_analysis_prompt');
      const ollamaUrlSetting = await storage.getSetting('ollama_url');

      const provider = (providerSetting?.value || 'openai') as AIProvider;
      const model = getValidatedModel(provider, modelSetting?.value);
      
      // Get API key for the selected provider
      let apiKey: string | undefined;
      if (provider === 'openai') {
        const keySetting = await storage.getSetting('openai_api_key');
        apiKey = keySetting?.value;
      } else if (provider === 'anthropic') {
        const keySetting = await storage.getSetting('anthropic_api_key');
        apiKey = keySetting?.value;
      } else if (provider === 'gemini') {
        const keySetting = await storage.getSetting('gemini_api_key');
        apiKey = keySetting?.value;
      }

      // Validate API key (not required for Ollama)
      if (provider !== 'ollama' && !apiKey) {
        const providerNames: Record<string, string> = {
          openai: 'OpenAI',
          anthropic: 'Anthropic',
          gemini: 'Google Gemini',
        };
        return res.status(400).json({ 
          message: `${providerNames[provider] || provider} API key not configured. Please configure it in Administration > AI Configuration.` 
        });
      }

      const defaultPrompt = `You are a data analyst assistant. Analyze the following data and provide insights in plain, human-readable text format.

IMPORTANT: Do NOT output JSON or any structured data format. Write your analysis as clear, readable paragraphs and bullet points.

Please provide:
1. A brief summary of the key findings
2. Any patterns, anomalies, or discrepancies found across the data sources
3. Actionable recommendations based on the data
4. Any data quality issues or missing values that need attention

Be concise and focus on the most important insights. Use clear headings and bullet points for readability.`;

      // If custom prompt exists but doesn't specify format, append format instructions
      let systemPrompt = promptSetting?.value || defaultPrompt;
      if (promptSetting?.value && !promptSetting.value.toLowerCase().includes('json')) {
        systemPrompt = promptSetting.value + '\n\nIMPORTANT: Provide your response in plain text format with clear headings and bullet points. Do NOT use JSON format.';
      }

      const analysis = await analyzeData({
        data,
        sourceName,
        systemPrompt,
        config: {
          provider,
          apiKey,
          model,
          ollamaUrl: ollamaUrlSetting?.value || 'http://localhost:11434',
        },
      });

      // Calculate total rows (handle multi-source format)
      const isMultiSource = Array.isArray(data) && data.length > 0 && 
        data[0]?.source !== undefined && Array.isArray(data[0]?.data);
      
      let totalRows = 0;
      if (isMultiSource) {
        for (const sourceData of data) {
          totalRows += sourceData.data?.length || 0;
        }
      } else {
        totalRows = data.length;
      }

      res.json({
        analysis,
        provider,
        model,
        sourceName,
        rowsAnalyzed: totalRows,
        totalRows: totalRows,
        sourcesAnalyzed: isMultiSource ? data.length : 1,
      });
    } catch (error: any) {
      console.error("AI analysis error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to analyze data",
      });
    }
  });

  // ============================================================
  // SAAS ROUTES - Registration, Organizations, Billing
  // ============================================================

  // Registration schema
  const registerSchema = z.object({
    email: z.string().email("Invalid email address"),
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
  });

  // Self-service registration
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(data.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Create organization slug
      const slug = data.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + crypto.randomBytes(4).toString('hex');

      // Check if organization slug exists
      const existingOrg = await storage.getOrganizationBySlug(slug);
      if (existingOrg) {
        return res.status(400).json({ message: "Organization name already taken" });
      }

      // Create organization
      const organization = await storage.createOrganization({
        name: data.organizationName,
        slug,
        status: 'active',
      });

      // Hash password before storing
      const hashedPassword = await bcrypt.hash(data.password, 10);
      
      // Create user
      const user = await storage.createUser({
        email: data.email,
        username: data.username,
        password: hashedPassword,
        role: 'admin',
      });

      // Add user as organization admin
      await storage.addOrganizationMember({
        organizationId: organization.id,
        userId: user.id,
        role: 'admin',
      });

      // Get free plan and create subscription
      const freePlan = await storage.getSubscriptionPlanBySlug('free');
      if (freePlan) {
        await storage.createOrganizationSubscription({
          organizationId: organization.id,
          planId: freePlan.id,
          status: 'active',
          billingCycle: 'monthly',
        });
      }

      // Create audit log
      await storage.createAuditLog({
        organizationId: organization.id,
        userId: user.id,
        action: 'organization_created',
        resourceType: 'organization',
        resourceId: organization.id,
        details: JSON.stringify({ name: data.organizationName }),
        ipAddress: req.ip,
      });

      // Auto-login after registration
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ message: "Registration successful but login failed" });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.organizationId = organization.id;

        req.session.save((err) => {
          if (err) {
            return res.status(500).json({ message: "Failed to save session" });
          }

          res.json({
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
            },
            organization: {
              id: organization.id,
              name: organization.name,
              slug: organization.slug,
            },
          });
        });
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  // Get current user's organizations with membership role
  app.get("/api/organizations", requireAuth, async (req, res) => {
    try {
      const organizations = await storage.getUserOrganizations(req.session.userId!);
      
      // Include member role for each organization
      const orgsWithRole = await Promise.all(
        organizations.map(async (org) => {
          const member = await storage.getOrganizationMember(org.id, req.session.userId!);
          return {
            ...org,
            memberRole: member?.role || 'member'
          };
        })
      );
      
      res.json(orgsWithRole);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get organization details
  app.get("/api/organizations/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check membership
      const member = await storage.getOrganizationMember(id, req.session.userId!);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this organization" });
      }

      const organization = await storage.getOrganization(id);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }

      const subscription = await storage.getOrganizationSubscription(id);
      let plan = null;
      if (subscription) {
        plan = await storage.getSubscriptionPlan(subscription.planId);
      }

      res.json({
        ...organization,
        subscription,
        plan,
        memberRole: member.role,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get organization members
  app.get("/api/organizations/:id/members", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const member = await storage.getOrganizationMember(id, req.session.userId!);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this organization" });
      }

      const members = await storage.getOrganizationMembers(id);
      const users = await storage.getUsersByOrganization(id);
      
      const membersWithUsers = members.map(m => {
        const user = users.find(u => u.id === m.userId);
        return {
          ...m,
          user: user ? {
            id: user.id,
            username: user.username,
            email: user.email,
            status: user.status,
          } : null,
        };
      });

      res.json(membersWithUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Invite user to organization
  app.post("/api/organizations/:id/invitations", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { email, role } = req.body;
      
      const member = await storage.getOrganizationMember(id, req.session.userId!);
      if (!member || member.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Generate invitation token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      const invitation = await storage.createOrganizationInvitation({
        organizationId: id,
        email,
        role: role || 'member',
        token,
        invitedBy: req.session.userId!,
        expiresAt,
      });

      res.json({
        invitation,
        inviteLink: `${req.protocol}://${req.get('host')}/invite/${token}`,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Accept invitation
  app.post("/api/invitations/:token/accept", async (req, res) => {
    try {
      const { token } = req.params;
      
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.acceptedAt) {
        return res.status(400).json({ message: "Invitation already accepted" });
      }

      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ message: "Invitation expired" });
      }

      // Check if user exists or needs to register
      const existingUser = await storage.getUserByEmail(invitation.email);
      
      if (existingUser) {
        // Add to organization
        await storage.addOrganizationMember({
          organizationId: invitation.organizationId,
          userId: existingUser.id,
          role: invitation.role,
        });
        
        await storage.acceptInvitation(token);

        res.json({ 
          message: "Invitation accepted", 
          requiresRegistration: false,
          organizationId: invitation.organizationId,
        });
      } else {
        res.json({ 
          message: "Please complete registration",
          requiresRegistration: true,
          email: invitation.email,
          organizationId: invitation.organizationId,
          token,
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get subscription plans
  app.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await storage.getActiveSubscriptionPlans();
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Stripe publishable key
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      res.status(500).json({ message: "Stripe not configured" });
    }
  });

  // Create checkout session
  app.post("/api/stripe/checkout", requireAuth, async (req, res) => {
    try {
      const { priceId, organizationId } = req.body;
      
      const member = await storage.getOrganizationMember(organizationId, req.session.userId!);
      if (!member || member.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const organization = await storage.getOrganization(organizationId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get or create Stripe customer
      let customerId = organization.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          user.email,
          organization.id,
          organization.name
        );
        customerId = customer.id;
        await storage.updateOrganization(organization.id, { stripeCustomerId: customerId });
      }

      // Create checkout session
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${req.protocol}://${req.get('host')}/billing?success=true`,
        `${req.protocol}://${req.get('host')}/billing?canceled=true`,
        organizationId
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  // Create customer portal session
  app.post("/api/stripe/portal", requireAuth, async (req, res) => {
    try {
      const { organizationId } = req.body;
      
      const member = await storage.getOrganizationMember(organizationId, req.session.userId!);
      if (!member || member.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const organization = await storage.getOrganization(organizationId);
      if (!organization?.stripeCustomerId) {
        return res.status(400).json({ message: "No billing information found" });
      }

      const session = await stripeService.createCustomerPortalSession(
        organization.stripeCustomerId,
        `${req.protocol}://${req.get('host')}/billing`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Portal error:", error);
      res.status(500).json({ message: error.message || "Failed to create portal session" });
    }
  });

  // Get organization subscription
  app.get("/api/organizations/:id/subscription", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const member = await storage.getOrganizationMember(id, req.session.userId!);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this organization" });
      }

      const subscription = await storage.getOrganizationSubscription(id);
      if (!subscription) {
        return res.json({ subscription: null, plan: null });
      }

      const plan = await storage.getSubscriptionPlan(subscription.planId);
      res.json({ subscription, plan });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update user's current organization in session
  app.post("/api/auth/switch-organization", requireAuth, async (req, res) => {
    try {
      const { organizationId } = req.body;
      
      const member = await storage.getOrganizationMember(organizationId, req.session.userId!);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this organization" });
      }

      req.session.organizationId = organizationId;
      
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to switch organization" });
        }
        res.json({ message: "Organization switched", organizationId });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get audit logs for organization (admin only)
  app.get("/api/organizations/:id/audit-logs", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const member = await storage.getOrganizationMember(id, req.session.userId!);
      if (!member || member.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const logs = await storage.getAuditLogsByOrganization(id);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
