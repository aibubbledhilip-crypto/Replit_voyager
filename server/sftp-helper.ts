import SftpClient from 'ssh2-sftp-client';
import type { SftpConfig } from '@shared/schema';

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
  matchedPattern?: string;
}

interface PatternResult {
  pattern: string;
  latestFile: SftpFileInfo | null;
  hasCurrentDate: boolean;
  matchingFiles: number;
}

interface PathResult {
  path: string;
  files: SftpFileInfo[];
  allFilesHaveCurrentDate: boolean;
  totalFiles: number;
  filesWithCurrentDate: number;
  patterns?: PatternResult[];
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

function hasCurrentDateInFilename(filename: string): boolean {
  const { year, month, day } = getCentralTimeDate();
  
  const formats = [
    `${year}${month}${day}`,
    `${year}-${month}-${day}`,
    `${year}_${month}_${day}`,
  ];
  
  const filenameLower = filename.toLowerCase();
  
  return formats.some(format => filenameLower.includes(format));
}

function extractDateFromFilename(filename: string): Date | null {
  const patterns = [
    /(\d{4})(\d{2})(\d{2})/,
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{4})_(\d{2})_(\d{2})/,
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Date(year, month - 1, day);
      }
    }
  }
  return null;
}

function globToRegex(pattern: string): RegExp {
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`, 'i');
}

function matchesPattern(filename: string, pattern: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(filename);
}

function buildConnectionOptions(config: Partial<SftpConfig>) {
  const options: any = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    readyTimeout: 10000,
  };
  
  if (config.authType === 'key' && config.privateKey) {
    options.privateKey = config.privateKey;
    if (config.passphrase) {
      options.passphrase = config.passphrase;
    }
  } else if (config.password) {
    options.password = config.password;
  }
  
  return options;
}

async function checkPath(sftp: SftpClient, remotePath: string, pathPatterns?: string[]): Promise<PathResult> {
  try {
    const fileList = await sftp.list(remotePath);
    
    const allFiles: SftpFileInfo[] = fileList
      .filter(item => item.type === '-')
      .map(item => {
        const filenameCheck = hasCurrentDateInFilename(item.name);
        return {
          name: item.name,
          size: item.size,
          modifyTime: item.modifyTime,
          hasCurrentDateInFilename: filenameCheck,
          hasCurrentDate: filenameCheck,
        };
      });

    if (pathPatterns && pathPatterns.length > 0) {
      const patternResults: PatternResult[] = pathPatterns.map(pattern => {
        const matching = allFiles.filter(f => matchesPattern(f.name, pattern));
        
        let latestFile: SftpFileInfo | null = null;
        if (matching.length > 0) {
          latestFile = matching.reduce((latest, file) => {
            const latestDate = extractDateFromFilename(latest.name);
            const fileDate = extractDateFromFilename(file.name);
            if (fileDate && latestDate && fileDate > latestDate) return file;
            if (fileDate && !latestDate) return file;
            return latest;
          });
          latestFile = { ...latestFile, matchedPattern: pattern };
        }
        
        return {
          pattern,
          latestFile,
          hasCurrentDate: latestFile ? latestFile.hasCurrentDate : false,
          matchingFiles: matching.length,
        };
      });

      const trackedFiles = patternResults
        .filter(pr => pr.latestFile)
        .map(pr => pr.latestFile!);
      const filesWithCurrentDate = trackedFiles.filter(f => f.hasCurrentDate).length;
      const allHealthy = patternResults.length > 0 && 
        patternResults.every(pr => pr.hasCurrentDate);

      return {
        path: remotePath,
        files: trackedFiles,
        patterns: patternResults,
        allFilesHaveCurrentDate: allHealthy,
        totalFiles: trackedFiles.length,
        filesWithCurrentDate,
      };
    }

    if (allFiles.length > 0) {
      const latestFile = allFiles.reduce((latest, file) => {
        const latestDate = extractDateFromFilename(latest.name);
        const fileDate = extractDateFromFilename(file.name);
        if (fileDate && latestDate && fileDate > latestDate) return file;
        if (fileDate && !latestDate) return file;
        if (!fileDate && !latestDate && file.modifyTime > latest.modifyTime) return file;
        return latest;
      });

      return {
        path: remotePath,
        files: [latestFile],
        allFilesHaveCurrentDate: latestFile.hasCurrentDate,
        totalFiles: 1,
        filesWithCurrentDate: latestFile.hasCurrentDate ? 1 : 0,
      };
    }

    return {
      path: remotePath,
      files: [],
      allFilesHaveCurrentDate: false,
      totalFiles: 0,
      filesWithCurrentDate: 0,
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

export async function checkSftpFiles(config: SftpConfig): Promise<SftpMonitorResult> {
  const sftp = new SftpClient();
  
  try {
    await sftp.connect(buildConnectionOptions(config));
    
    const paths = config.remotePaths || ['/'];
    const filePatterns = (config.filePatterns as Record<string, string[]>) || {};
    
    const pathResults: PathResult[] = [];
    for (let i = 0; i < paths.length; i++) {
      const remotePath = paths[i];
      const patterns = filePatterns[remotePath] || filePatterns[String(i)] || undefined;
      const result = await checkPath(sftp, remotePath, patterns);
      pathResults.push(result);
    }
    
    await sftp.end();
    
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

export async function testSftpConnection(config: Partial<SftpConfig> & { remotePaths?: string[] }): Promise<{ success: boolean; error?: string }> {
  const sftp = new SftpClient();
  
  try {
    await sftp.connect(buildConnectionOptions(config));
    
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
