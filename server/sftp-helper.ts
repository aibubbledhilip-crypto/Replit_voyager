import SftpClient from 'ssh2-sftp-client';
import type { SftpConfig } from '@shared/schema';

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
 * Check if a filename contains today's date in common formats:
 * - YYYYMMDD
 * - YYYY-MM-DD
 * - YYYY_MM_DD
 * - YYYYMMDD_HHMMSS
 */
function hasCurrentDateInFilename(filename: string): boolean {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
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
 * Check if a file's modification timestamp is from today
 */
function hasCurrentDateInModified(modifyTime: number): boolean {
  const today = new Date();
  const modifyDate = new Date(modifyTime);
  
  return (
    modifyDate.getFullYear() === today.getFullYear() &&
    modifyDate.getMonth() === today.getMonth() &&
    modifyDate.getDate() === today.getDate()
  );
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
