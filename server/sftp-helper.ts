import SftpClient from 'ssh2-sftp-client';
import type { SftpConfig } from '@shared/schema';

interface SftpFileInfo {
  name: string;
  size: number;
  modifyTime: number;
  hasCurrentDate: boolean;
}

interface SftpMonitorResult {
  configId: string;
  configName: string;
  files: SftpFileInfo[];
  allFilesHaveCurrentDate: boolean;
  totalFiles: number;
  filesWithCurrentDate: number;
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
 * Connect to SFTP server and list files in the specified path
 */
export async function checkSftpFiles(config: SftpConfig): Promise<SftpMonitorResult> {
  const sftp = new SftpClient();
  
  try {
    // Connect to SFTP server
    await sftp.connect(buildConnectionOptions(config));
    
    // List files in the remote path
    const fileList = await sftp.list(config.remotePath);
    
    // Process files (exclude directories)
    const files: SftpFileInfo[] = fileList
      .filter(item => item.type === '-') // Only files, not directories
      .map(item => ({
        name: item.name,
        size: item.size,
        modifyTime: item.modifyTime,
        hasCurrentDate: hasCurrentDateInFilename(item.name),
      }));
    
    // Disconnect
    await sftp.end();
    
    // Calculate statistics
    const filesWithCurrentDate = files.filter(f => f.hasCurrentDate).length;
    const allFilesHaveCurrentDate = files.length > 0 && filesWithCurrentDate === files.length;
    
    return {
      configId: config.id,
      configName: config.name,
      files,
      allFilesHaveCurrentDate,
      totalFiles: files.length,
      filesWithCurrentDate,
    };
  } catch (error: any) {
    // Ensure disconnection even on error
    try {
      await sftp.end();
    } catch {}
    
    return {
      configId: config.id,
      configName: config.name,
      files: [],
      allFilesHaveCurrentDate: false,
      totalFiles: 0,
      filesWithCurrentDate: 0,
      error: error.message || 'Failed to connect to SFTP server',
    };
  }
}

/**
 * Test SFTP connection without listing files
 */
export async function testSftpConnection(config: Partial<SftpConfig>): Promise<{ success: boolean; error?: string }> {
  const sftp = new SftpClient();
  
  try {
    await sftp.connect(buildConnectionOptions(config));
    
    // Try to access the remote path
    if (config.remotePath) {
      await sftp.list(config.remotePath);
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
