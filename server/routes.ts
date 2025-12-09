import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { z } from "zod";
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
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
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

  app.patch("/api/users/:id/password", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
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
      const databaseName = 'dvsum-s3-glue-prod';

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
      const tablesResult = await executeSchemaQuery(`SHOW TABLES IN "${databaseName}"`);
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
      const databaseName = 'dvsum-s3-glue-prod';

      const startCommand = new StartQueryExecutionCommand({
        QueryString: `SHOW COLUMNS IN "${databaseName}"."${tableName}"`,
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

      // Poll for query completion (max 5 minutes)
      let queryStatus = 'RUNNING';
      const getExecutionCommand = new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId });
      const maxPollTime = 5 * 60 * 1000; // 5 minutes
      const pollStartTime = Date.now();

      while (queryStatus === 'RUNNING' || queryStatus === 'QUEUED') {
        // Check if we've exceeded max polling time
        if (Date.now() - pollStartTime > maxPollTime) {
          throw new Error('Query execution timeout - query is still running in Athena but took longer than 5 minutes. Please try a simpler query or contact admin.');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        const executionResponse = await athenaClient.send(getExecutionCommand);
        queryStatus = executionResponse.QueryExecution?.Status?.State || 'FAILED';
      }

      if (queryStatus !== 'SUCCEEDED') {
        throw new Error(`Query failed with status: ${queryStatus}`);
      }

      // Get query results (AWS Athena has a max limit of 1000 per request)
      const getResultsCommand = new GetQueryResultsCommand({
        QueryExecutionId: queryExecutionId,
        MaxResults: Math.min(rowLimit, 1000),
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

      // Define all queries using sanitized MSISDN
      const queries = [
        {
          name: 'SF',
          query: `select * from "dvsum-s3-glue-prod".vw_sf_all_segment_hierarchy where msisdn = '${sanitizedMsisdn}'`,
        },
        {
          name: 'Aria',
          query: `select * from "dvsum-s3-glue-prod".vw_aria_hierarchy_all_status_reverse where msisdn = '${sanitizedMsisdn}'`,
        },
        {
          name: 'Matrix',
          query: `select * from "dvsum-s3-glue-prod".vw_matrixx_plan where msisdn = '${sanitizedMsisdn}'`,
        },
        {
          name: 'Trufinder',
          query: `select * from "dvsum-s3-glue-prod".vw_true_finder_raw where msisdn = '${sanitizedMsisdn}'`,
        },
        {
          name: 'Nokia',
          query: `select * from "dvsum-s3-glue-prod".vw_nokia_raw where msisdn = '${sanitizedMsisdn}'`,
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
          const getResultsCommand = new GetQueryResultsCommand({
            QueryExecutionId: queryExecutionId,
            MaxResults: Math.min(rowLimit, 1000),
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

  // SFTP Configuration Routes (Admin only)
  app.get("/api/sftp/configs", requireAdmin, async (req, res) => {
    try {
      const configs = await storage.getAllSftpConfigs();
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sftp/configs", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSftpConfigSchema.parse(req.body);
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
      const validatedData = insertSftpConfigSchema.parse(req.body);
      
      // Get existing config to preserve credentials if not provided
      const existingConfig = await storage.getSftpConfigById(id);
      if (!existingConfig) {
        return res.status(404).json({ message: "SFTP configuration not found" });
      }
      
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
      const configs = await storage.getActiveSftpConfigs();
      
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

  const httpServer = createServer(app);
  return httpServer;
}
