import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

const DVSUM_BASE_URL = 'https://www.app.dvsum.ai';
const DVSUM_RULES_URL = `${DVSUM_BASE_URL}/rules?selected-filter=all&node-id=45397986&selected-asset-type=RLS`;
const WAIT_TIMEOUT = 30000;

interface DownloadResult {
  success: boolean;
  downloaded: number;
  failed: number;
  failedRules: string[];
  zipPath?: string;
  message?: string;
}

export async function downloadDvsumReports(
  username: string,
  password: string,
  downloadDir: string
): Promise<DownloadResult> {
  let browser: Browser | null = null;
  const result: DownloadResult = {
    success: false,
    downloaded: 0,
    failed: 0,
    failedRules: [],
  };

  try {
    console.log('[DVSum] Starting browser...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    });

    console.log('[DVSum] Navigating to login page...');
    await page.goto(`${DVSUM_BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
    
    await page.waitForSelector('input[type="email"], input[name="email"], input[type="text"]', { timeout: WAIT_TIMEOUT });
    
    console.log('[DVSum] Entering credentials...');
    const emailInput = await page.$('input[type="email"]') || await page.$('input[name="email"]') || await page.$('input[type="text"]');
    if (emailInput) {
      await emailInput.type(username, { delay: 50 });
    }
    
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.type(password, { delay: 50 });
    }
    
    const loginButton = await page.$('button[type="submit"]') || await page.$('button:has-text("Login")') || await page.$('button:has-text("Sign in")');
    if (loginButton) {
      await loginButton.click();
    }
    
    console.log('[DVSum] Waiting for login to complete...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT }).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      const errorElement = await page.$('.error, .alert-error, [class*="error"]');
      if (errorElement) {
        const errorText = await errorElement.evaluate(el => el.textContent);
        throw new Error(`Login failed: ${errorText?.trim() || 'Invalid credentials'}`);
      }
      throw new Error('Login failed: Please check your credentials');
    }
    
    console.log('[DVSum] Login successful, navigating to rules page...');
    await page.goto(DVSUM_RULES_URL, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('[DVSum] Extracting rule IDs...');
    const ruleIds = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/rules/"]');
      const ids: string[] = [];
      const seen = new Set<string>();
      
      links.forEach(link => {
        const text = link.textContent?.trim();
        if (text && text.startsWith('DQ-') && !seen.has(text)) {
          ids.push(text);
          seen.add(text);
        }
      });
      
      return ids;
    });
    
    console.log(`[DVSum] Found ${ruleIds.length} rules: ${ruleIds.slice(0, 5).join(', ')}...`);
    
    if (ruleIds.length === 0) {
      result.message = 'No rules found on the page';
      return result;
    }
    
    for (let i = 0; i < ruleIds.length; i++) {
      const ruleId = ruleIds[i];
      console.log(`[DVSum] Processing ${i + 1}/${ruleIds.length}: ${ruleId}`);
      
      try {
        const ruleLink = await page.$(`a[href*="/rules/"]:has-text("${ruleId}")`);
        if (!ruleLink) {
          const allLinks = await page.$$('a[href*="/rules/"]');
          for (const link of allLinks) {
            const text = await link.evaluate(el => el.textContent?.trim());
            if (text === ruleId) {
              const href = await link.evaluate(el => el.getAttribute('href'));
              if (href) {
                await page.goto(`${DVSUM_BASE_URL}${href}`, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
                break;
              }
            }
          }
        } else {
          await ruleLink.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT }).catch(() => {});
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const dataTab = await page.$('button:has-text("Data"), a:has-text("Data"), [role="tab"]:has-text("Data")');
        if (dataTab) {
          await dataTab.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const exportButton = await page.$('button:has-text("Export")');
        if (exportButton) {
          await exportButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const csvOption = await page.$('*:has-text("CSV Export"), *:has-text("Export to CSV"), *:has-text("CSV")');
          if (csvOption) {
            await csvOption.click();
            await new Promise(resolve => setTimeout(resolve, 3000));
            result.downloaded++;
            console.log(`[DVSum] Downloaded ${ruleId}`);
          } else {
            throw new Error('CSV export option not found');
          }
        } else {
          throw new Error('Export button not found');
        }
        
        await page.goto(DVSUM_RULES_URL, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error: any) {
        console.error(`[DVSum] Failed to download ${ruleId}: ${error.message}`);
        result.failed++;
        result.failedRules.push(ruleId);
        
        await page.goto(DVSUM_RULES_URL, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const files = fs.readdirSync(downloadDir).filter(f => f.endsWith('.csv') || f.endsWith('.xlsx'));
    
    if (files.length > 0) {
      const zipPath = path.join(downloadDir, 'dvsum_reports.zip');
      await createZipArchive(downloadDir, files, zipPath);
      result.zipPath = zipPath;
    }
    
    result.success = true;
    result.message = `Downloaded ${result.downloaded} reports, ${result.failed} failed`;
    
    return result;
  } catch (error: any) {
    console.error('[DVSum] Error:', error.message);
    result.message = error.message;
    return result;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function createZipArchive(dir: string, files: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));
    
    archive.pipe(output);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      archive.file(filePath, { name: file });
    }
    
    archive.finalize();
  });
}
