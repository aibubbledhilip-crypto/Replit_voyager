import type { OrganizationDatabaseConnection, DatabaseType } from "@shared/schema";

export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  executionTimeMs: number;
}

export interface DatabaseDriver {
  testConnection(connection: OrganizationDatabaseConnection): Promise<{ success: boolean; message: string }>;
  executeQuery(connection: OrganizationDatabaseConnection, query: string, rowLimit: number): Promise<QueryResult>;
  disconnect?(): Promise<void>;
}

function getDefaultPort(type: DatabaseType): number {
  switch (type) {
    case 'postgresql': return 5432;
    case 'mysql': return 3306;
    case 'mssql': return 1433;
    case 'clickhouse': return 8123;
    case 'snowflake': return 443;
    default: return 0;
  }
}

const postgresDriver: DatabaseDriver = {
  async testConnection(conn) {
    const { default: pg } = await import('pg');
    const client = new pg.Client({
      host: conn.host || 'localhost',
      port: conn.port || 5432,
      database: conn.database || 'postgres',
      user: conn.username || 'postgres',
      password: conn.password || '',
      ssl: conn.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return { success: true, message: 'Successfully connected to PostgreSQL database.' };
    } catch (error: any) {
      try { await client.end(); } catch {}
      return { success: false, message: error.message || 'Failed to connect to PostgreSQL.' };
    }
  },
  async executeQuery(conn, query, rowLimit) {
    const { default: pg } = await import('pg');
    const client = new pg.Client({
      host: conn.host || 'localhost',
      port: conn.port || 5432,
      database: conn.database || 'postgres',
      user: conn.username || 'postgres',
      password: conn.password || '',
      ssl: conn.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });
    const startTime = Date.now();
    try {
      await client.connect();
      const result = await client.query(query);
      const executionTimeMs = Date.now() - startTime;
      const columns = result.fields?.map(f => f.name) || [];
      const rows = (result.rows || []).slice(0, rowLimit);
      await client.end();
      return { columns, rows, rowCount: result.rowCount || rows.length, executionTimeMs };
    } catch (error: any) {
      try { await client.end(); } catch {}
      throw error;
    }
  }
};

const mysqlDriver: DatabaseDriver = {
  async testConnection(conn) {
    const mysql = await import('mysql2/promise');
    let connection;
    try {
      connection = await mysql.createConnection({
        host: conn.host || 'localhost',
        port: conn.port || 3306,
        database: conn.database || '',
        user: conn.username || 'root',
        password: conn.password || '',
        ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 10000,
      });
      await connection.query('SELECT 1');
      await connection.end();
      return { success: true, message: 'Successfully connected to MySQL database.' };
    } catch (error: any) {
      try { if (connection) await connection.end(); } catch {}
      return { success: false, message: error.message || 'Failed to connect to MySQL.' };
    }
  },
  async executeQuery(conn, query, rowLimit) {
    const mysql = await import('mysql2/promise');
    const startTime = Date.now();
    const connection = await mysql.createConnection({
      host: conn.host || 'localhost',
      port: conn.port || 3306,
      database: conn.database || '',
      user: conn.username || 'root',
      password: conn.password || '',
      ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 10000,
    });
    try {
      const [rows, fields] = await connection.query(query);
      const executionTimeMs = Date.now() - startTime;
      const resultRows = Array.isArray(rows) ? rows.slice(0, rowLimit) : [];
      const columns = Array.isArray(fields) ? fields.map((f: any) => f.name) : [];
      await connection.end();
      return { columns, rows: resultRows as Record<string, any>[], rowCount: resultRows.length, executionTimeMs };
    } catch (error: any) {
      try { await connection.end(); } catch {}
      throw error;
    }
  }
};

const mssqlDriver: DatabaseDriver = {
  async testConnection(conn) {
    const sql = await import('mssql');
    try {
      const pool = await sql.default.connect({
        server: conn.host || 'localhost',
        port: conn.port || 1433,
        database: conn.database || 'master',
        user: conn.username || '',
        password: conn.password || '',
        options: {
          encrypt: conn.ssl,
          trustServerCertificate: true,
        },
        connectionTimeout: 10000,
      });
      await pool.request().query('SELECT 1');
      await pool.close();
      return { success: true, message: 'Successfully connected to SQL Server.' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to connect to SQL Server.' };
    }
  },
  async executeQuery(conn, query, rowLimit) {
    const sql = await import('mssql');
    const startTime = Date.now();
    const pool = await sql.default.connect({
      server: conn.host || 'localhost',
      port: conn.port || 1433,
      database: conn.database || 'master',
      user: conn.username || '',
      password: conn.password || '',
      options: {
        encrypt: conn.ssl,
        trustServerCertificate: true,
      },
      connectionTimeout: 10000,
    });
    try {
      const result = await pool.request().query(query);
      const executionTimeMs = Date.now() - startTime;
      const rows = (result.recordset || []).slice(0, rowLimit);
      const columns = result.recordset?.columns ? Object.keys(result.recordset.columns) : (rows.length > 0 ? Object.keys(rows[0]) : []);
      await pool.close();
      return { columns, rows, rowCount: result.rowsAffected?.[0] || rows.length, executionTimeMs };
    } catch (error: any) {
      try { await pool.close(); } catch {}
      throw error;
    }
  }
};

const athenaDriver: DatabaseDriver = {
  async testConnection(conn) {
    const { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand } = await import('@aws-sdk/client-athena');
    try {
      if (!conn.awsAccessKeyId || !conn.awsSecretAccessKey) {
        return { success: false, message: 'AWS Access Key ID and Secret Access Key are required.' };
      }
      if (!conn.s3OutputLocation) {
        return { success: false, message: 'S3 Output Location is required.' };
      }
      const client = new AthenaClient({
        region: conn.awsRegion || 'us-east-1',
        credentials: {
          accessKeyId: conn.awsAccessKeyId,
          secretAccessKey: conn.awsSecretAccessKey,
        },
      });
      const startCmd = new StartQueryExecutionCommand({
        QueryString: 'SELECT 1',
        ResultConfiguration: { OutputLocation: conn.s3OutputLocation },
      });
      const startRes = await client.send(startCmd);
      const qid = startRes.QueryExecutionId;
      if (!qid) return { success: false, message: 'Failed to start test query.' };

      let status = 'RUNNING';
      const timeout = Date.now() + 30000;
      while (status === 'RUNNING' || status === 'QUEUED') {
        if (Date.now() > timeout) return { success: false, message: 'Test query timed out.' };
        await new Promise(r => setTimeout(r, 1000));
        const getCmd = new GetQueryExecutionCommand({ QueryExecutionId: qid });
        const getRes = await client.send(getCmd);
        status = getRes.QueryExecution?.Status?.State || 'FAILED';
      }
      if (status === 'SUCCEEDED') {
        return { success: true, message: 'Successfully connected to AWS Athena.' };
      }
      return { success: false, message: `Athena query failed with status: ${status}` };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to connect to AWS Athena.' };
    }
  },
  async executeQuery(conn, query, rowLimit) {
    const { executeAthenaQueryWithPagination } = await import('./athena-helper');
    const { AthenaClient } = await import('@aws-sdk/client-athena');

    if (!conn.awsAccessKeyId || !conn.awsSecretAccessKey || !conn.s3OutputLocation) {
      throw new Error('AWS credentials and S3 output location are required.');
    }

    const client = new AthenaClient({
      region: conn.awsRegion || 'us-east-1',
      credentials: {
        accessKeyId: conn.awsAccessKeyId,
        secretAccessKey: conn.awsSecretAccessKey,
      },
    });

    const startTime = Date.now();
    const result = await executeAthenaQueryWithPagination(
      client, query, conn.s3OutputLocation, rowLimit
    );
    const executionTimeMs = Date.now() - startTime;

    return {
      columns: result.columns,
      rows: result.data,
      rowCount: result.totalRows,
      executionTimeMs,
    };
  }
};

const clickhouseDriver: DatabaseDriver = {
  async testConnection(conn) {
    const { createClient } = await import('@clickhouse/client');
    const client = createClient({
      url: `${conn.ssl ? 'https' : 'http'}://${conn.host || 'localhost'}:${conn.port || 8123}`,
      username: conn.username || 'default',
      password: conn.password || '',
      database: conn.database || 'default',
      request_timeout: 10000,
    });
    try {
      await client.query({ query: 'SELECT 1' });
      await client.close();
      return { success: true, message: 'Successfully connected to ClickHouse.' };
    } catch (error: any) {
      try { await client.close(); } catch {}
      return { success: false, message: error.message || 'Failed to connect to ClickHouse.' };
    }
  },
  async executeQuery(conn, query, rowLimit) {
    const { createClient } = await import('@clickhouse/client');
    const startTime = Date.now();
    const client = createClient({
      url: `${conn.ssl ? 'https' : 'http'}://${conn.host || 'localhost'}:${conn.port || 8123}`,
      username: conn.username || 'default',
      password: conn.password || '',
      database: conn.database || 'default',
      request_timeout: 60000,
    });
    try {
      const result = await client.query({ query, format: 'JSONEachRow' });
      const rows = await result.json() as Record<string, any>[];
      const executionTimeMs = Date.now() - startTime;
      const limitedRows = rows.slice(0, rowLimit);
      const columns = limitedRows.length > 0 ? Object.keys(limitedRows[0]) : [];
      await client.close();
      return { columns, rows: limitedRows, rowCount: rows.length, executionTimeMs };
    } catch (error: any) {
      try { await client.close(); } catch {}
      throw error;
    }
  }
};

const snowflakeDriver: DatabaseDriver = {
  async testConnection(conn) {
    try {
      const snowflake = await import('snowflake-sdk');
      return new Promise((resolve) => {
        const connection = snowflake.createConnection({
          account: conn.account || '',
          username: conn.username || '',
          password: conn.password || '',
          database: conn.database || '',
          warehouse: conn.warehouse || '',
          schema: conn.schema || 'PUBLIC',
          role: conn.role || '',
        });
        connection.connect((err) => {
          if (err) {
            resolve({ success: false, message: err.message || 'Failed to connect to Snowflake.' });
          } else {
            connection.destroy((destroyErr) => {
              resolve({ success: true, message: 'Successfully connected to Snowflake.' });
            });
          }
        });
        setTimeout(() => {
          resolve({ success: false, message: 'Connection timed out.' });
        }, 15000);
      });
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to connect to Snowflake.' };
    }
  },
  async executeQuery(conn, query, rowLimit) {
    const snowflake = await import('snowflake-sdk');
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const connection = snowflake.createConnection({
        account: conn.account || '',
        username: conn.username || '',
        password: conn.password || '',
        database: conn.database || '',
        warehouse: conn.warehouse || '',
        schema: conn.schema || 'PUBLIC',
        role: conn.role || '',
      });
      connection.connect((err) => {
        if (err) return reject(err);
        connection.execute({
          sqlText: query,
          complete: (execErr, stmt, rows) => {
            const executionTimeMs = Date.now() - startTime;
            if (execErr) {
              connection.destroy(() => {});
              return reject(execErr);
            }
            const resultRows = (rows || []).slice(0, rowLimit) as Record<string, any>[];
            const columns = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];
            connection.destroy(() => {});
            resolve({ columns, rows: resultRows, rowCount: (rows || []).length, executionTimeMs });
          },
        });
      });
    });
  }
};

const bigqueryDriver: DatabaseDriver = {
  async testConnection(conn) {
    try {
      const { BigQuery } = await import('@google-cloud/bigquery');
      if (!conn.credentialsJson) {
        return { success: false, message: 'Service account credentials JSON is required for BigQuery.' };
      }
      let credentials;
      try {
        credentials = JSON.parse(conn.credentialsJson);
      } catch {
        return { success: false, message: 'Invalid credentials JSON format.' };
      }
      const bigquery = new BigQuery({
        projectId: conn.projectId || credentials.project_id,
        credentials,
      });
      const [rows] = await bigquery.query({ query: 'SELECT 1', location: conn.awsRegion || 'US' });
      return { success: true, message: 'Successfully connected to Google BigQuery.' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to connect to BigQuery.' };
    }
  },
  async executeQuery(conn, query, rowLimit) {
    const { BigQuery } = await import('@google-cloud/bigquery');
    if (!conn.credentialsJson) {
      throw new Error('Service account credentials JSON is required.');
    }
    const credentials = JSON.parse(conn.credentialsJson);
    const bigquery = new BigQuery({
      projectId: conn.projectId || credentials.project_id,
      credentials,
    });
    const startTime = Date.now();
    const [rows] = await bigquery.query({
      query,
      location: conn.awsRegion || 'US',
      maxResults: rowLimit,
    });
    const executionTimeMs = Date.now() - startTime;
    const resultRows = (rows || []).slice(0, rowLimit);
    const columns = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];
    return { columns, rows: resultRows, rowCount: resultRows.length, executionTimeMs };
  }
};

const driverRegistry: Record<string, DatabaseDriver> = {
  postgresql: postgresDriver,
  mysql: mysqlDriver,
  mssql: mssqlDriver,
  athena: athenaDriver,
  clickhouse: clickhouseDriver,
  snowflake: snowflakeDriver,
  bigquery: bigqueryDriver,
};

export function getDriver(type: string): DatabaseDriver {
  const driver = driverRegistry[type];
  if (!driver) {
    throw new Error(`Unsupported database type: ${type}`);
  }
  return driver;
}

export function maskConnectionCredentials(conn: OrganizationDatabaseConnection): OrganizationDatabaseConnection {
  const masked = { ...conn };
  if (masked.password) {
    masked.password = '********';
  }
  if (masked.awsSecretAccessKey) {
    masked.awsSecretAccessKey = '********';
  }
  if (masked.awsAccessKeyId && masked.awsAccessKeyId.length > 8) {
    masked.awsAccessKeyId = masked.awsAccessKeyId.substring(0, 4) + '****' + masked.awsAccessKeyId.substring(masked.awsAccessKeyId.length - 4);
  }
  if (masked.credentialsJson) {
    masked.credentialsJson = '********';
  }
  return masked;
}

export function hasCredentials(conn: OrganizationDatabaseConnection): boolean {
  switch (conn.type) {
    case 'athena':
      return !!(conn.awsAccessKeyId && conn.awsSecretAccessKey && conn.s3OutputLocation);
    case 'bigquery':
      return !!conn.credentialsJson;
    case 'snowflake':
      return !!(conn.account && conn.username && conn.password);
    default:
      return !!(conn.host && conn.username);
  }
}

export const DATABASE_TYPE_LABELS: Record<string, { label: string; icon: string; defaultPort: number | null }> = {
  postgresql: { label: 'PostgreSQL', icon: 'database', defaultPort: 5432 },
  mysql: { label: 'MySQL', icon: 'database', defaultPort: 3306 },
  mssql: { label: 'SQL Server', icon: 'database', defaultPort: 1433 },
  athena: { label: 'AWS Athena', icon: 'cloud', defaultPort: null },
  bigquery: { label: 'Google BigQuery', icon: 'cloud', defaultPort: null },
  snowflake: { label: 'Snowflake', icon: 'snowflake', defaultPort: null },
  clickhouse: { label: 'ClickHouse', icon: 'database', defaultPort: 8123 },
};
