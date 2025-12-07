import SftpClient from 'ssh2-sftp-client';
import type { SftpConfig } from '@shared/schema';

/**
 * Get current date components in Central Time (America/Chicago)
 * This handles both CST (UTC-6) and CDT (UTC-5) automatically
 */
function getCentralTimeDate(): { year: number; month: string; day: string; dateObj: Date } {
  const now = new Date();
  const centralTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  
  return {
    year: centralTime.getFullYear(),
    month: String(centralTime.getMonth() + 1).padStart(2, '0'),
    day: String(centralTime.getDate()).padStart(2, '0'),
    dateObj: centralTime,
  };
}

interface SftpFileInfo {
  name: string;
  size: number;
  modifyTime: number;
  hasCurrentDate: boolean;
  hasCurrentDateInFilename: boolean;
  hasCurrentDateInModified: boolean;
}

interface PathResult {
  path: string;
  files: SftpFileInfo[];
  allFilesHaveCurrentDate: boolean;
  totalFiles: number;
  filesWithCurrentDate: number;
  error?: string;
}

interface SftpMonitorResult {
  configId: string;
  configName: string;
  paths: PathResult[];
  allPathsHealthy: boolean;
  totalPaths: number;
  healthyPaths: number;
  error?: string;
}

/**
 * Check if a filename contains today's date (in Central Time) in common formats:
 * - YYYYMMDD
 * - YYYY-MM-DD
 * - YYYY_MM_DD
 * - YYYYMMDD_HHMMSS
 */
function hasCurrentDateInFilename(filename: string): boolean {
  const { year, month, day } = getCentralTimeDate();
  
  // Common date formats in filenames
  const formats = [
    `${year}${month}${day}`,           // YYYYMMDD
    `${year}-${month}-${day}`,         // YYYY-MM-DD
    `${year}_${month}_${day}`,         // YYYY_MM_DD
  ];
  
  const filenameLower = filename.toLowerCase();
  
  return formats.some(format => filenameLower.includes(format));
}

/**
 * Check if a file's modification timestamp is from today (in Central Time)
 */
function hasCurrentDateInModified(modifyTime: number): boolean {
  const { year, month, day } = getCentralTimeDate();
  
  // Convert modify time to Central Time for comparison
  const modifyDate = new Date(modifyTime);
  const modifyCentral = new Date(modifyDate.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  
  const modifyYear = modifyCentral.getFullYear();
  const modifyMonth = String(modifyCentral.getMonth() + 1).padStart(2, '0');
  const modifyDay = String(modifyCentral.getDate()).padStart(2, '0');
  
  return year === modifyYear && month === modifyMonth && day === modifyDay;
}

/**
 * Build connection options based on auth type
 */
function buildConnectionOptions(config: Partial<SftpConfig>) {
  const options: any = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    readyTimeout: 10000, // 10 seconds
  };
  
  if (config.authType === 'key' && config.privateKey) {
    // Use private key content directly
    options.privateKey = config.privateKey;
    if (config.passphrase) {
      options.passphrase = config.passphrase;
    }
  } else if (config.password) {
    options.password = config.password;
  }
  
  return options;
}

/**
 * Check files in a single path
 */
async function checkPath(sftp: SftpClient, remotePath: string): Promise<PathResult> {
  try {
    const fileList = await sftp.list(remotePath);
    
    // Process files (exclude directories)
    const files: SftpFileInfo[] = fileList
      .filter(item => item.type === '-') // Only files, not directories
      .map(item => {
        const filenameCheck = hasCurrentDateInFilename(item.name);
        const modifiedCheck = hasCurrentDateInModified(item.modifyTime);
        return {
          name: item.name,
          size: item.size,
          modifyTime: item.modifyTime,
          hasCurrentDateInFilename: filenameCheck,
          hasCurrentDateInModified: modifiedCheck,
          hasCurrentDate: filenameCheck || modifiedCheck, // Green if either condition is true
        };
      });
    
    // Calculate statistics
    const filesWithCurrentDate = files.filter(f => f.hasCurrentDate).length;
    const allFilesHaveCurrentDate = files.length > 0 && filesWithCurrentDate === files.length;
    
    return {
      path: remotePath,
      files,
      allFilesHaveCurrentDate,
      totalFiles: files.length,
      filesWithCurrentDate,
    };
  } catch (error: any) {
    return {
      path: remotePath,
      files: [],
      allFilesHaveCurrentDate: false,
      totalFiles: 0,
      filesWithCurrentDate: 0,
      error: error.message || `Failed to access path: ${remotePath}`,
    };
  }
}

/**
 * Connect to SFTP server and check all configured paths
 */
export async function checkSftpFiles(config: SftpConfig): Promise<SftpMonitorResult> {
  const sftp = new SftpClient();
  
  try {
    // Connect to SFTP server
    await sftp.connect(buildConnectionOptions(config));
    
    // Get paths to check (use remotePaths array)
    const paths = config.remotePaths || ['/'];
    
    // Check all paths
    const pathResults: PathResult[] = [];
    for (const remotePath of paths) {
      const result = await checkPath(sftp, remotePath);
      pathResults.push(result);
    }
    
    // Disconnect
    await sftp.end();
    
    // Calculate overall health
    const healthyPaths = pathResults.filter(p => !p.error && p.allFilesHaveCurrentDate).length;
    const allPathsHealthy = pathResults.length > 0 && healthyPaths === pathResults.length;
    
    return {
      configId: config.id,
      configName: config.name,
      paths: pathResults,
      allPathsHealthy,
      totalPaths: pathResults.length,
      healthyPaths,
    };
  } catch (error: any) {
    // Ensure disconnection even on error
    try {
      await sftp.end();
    } catch {}
    
    return {
      configId: config.id,
      configName: config.name,
      paths: [],
      allPathsHealthy: false,
      totalPaths: 0,
      healthyPaths: 0,
      error: error.message || 'Failed to connect to SFTP server',
    };
  }
}

/**
 * Test SFTP connection and verify access to all paths
 */
export async function testSftpConnection(config: Partial<SftpConfig> & { remotePaths?: string[] }): Promise<{ success: boolean; error?: string }> {
  const sftp = new SftpClient();
  
  try {
    await sftp.connect(buildConnectionOptions(config));
    
    // Try to access all remote paths
    const paths = config.remotePaths || ['/'];
    for (const remotePath of paths) {
      await sftp.list(remotePath);
    }
    
    await sftp.end();
    
    return { success: true };
  } catch (error: any) {
    try {
      await sftp.end();
    } catch {}
    
    return {
      success: false,
      error: error.message || 'Connection failed',
    };
  }
}
