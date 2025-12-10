import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

const DVSUM_BASE_URL = 'https://www.app.dvsum.ai';
const DVSUM_RULES_URL = `${DVSUM_BASE_URL}/rules?selected-filter=all&node-id=45397986&selected-asset-type=RLS`;
const WAIT_TIMEOUT = 60000;

interface DownloadResult {
  success: boolean;
  downloaded: number;
  failed: number;
  failedRules: string[];
  zipPath?: string;
  message?: string;
}

async function findElementByText(page: Page, selector: string, text: string): Promise<any> {
  const elements = await page.$$(selector);
  for (const el of elements) {
    const elText = await el.evaluate((node: Element) => node.textContent?.trim());
    if (elText && elText.includes(text)) {
      return el;
    }
  }
  return null;
}

async function clickElementByText(page: Page, selector: string, text: string): Promise<boolean> {
  const element = await findElementByText(page, selector, text);
  if (element) {
    await element.click();
    return true;
  }
  return false;
}

async function waitForAnySelector(page: Page, selectors: string[], timeout: number): Promise<string | null> {
  const promises = selectors.map(selector => 
    page.waitForSelector(selector, { timeout, visible: true })
      .then(() => selector)
      .catch(() => null)
  );
  
  const results = await Promise.race([
    Promise.all(promises),
    new Promise<string[]>(resolve => setTimeout(() => resolve([]), timeout))
  ]);
  
  if (Array.isArray(results)) {
    return results.find(r => r !== null) || null;
  }
  return null;
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
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    });

    console.log('[DVSum] Navigating to login page...');
    await page.goto(`${DVSUM_BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: WAIT_TIMEOUT });
    
    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Log the current URL and page content for debugging
    const currentUrl = page.url();
    console.log(`[DVSum] Current URL: ${currentUrl}`);
    
    // Try to find any input field - DVSum might use custom components
    const inputSelectors = [
      'input[type="email"]',
      'input[type="text"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="user" i]',
      'input[id*="email" i]',
      'input[id*="user" i]',
      'input:not([type="hidden"]):not([type="password"])',
    ];
    
    let emailInput = null;
    for (const selector of inputSelectors) {
      emailInput = await page.$(selector);
      if (emailInput) {
        console.log(`[DVSum] Found email input with selector: ${selector}`);
        break;
      }
    }
    
    if (!emailInput) {
      // Take a screenshot for debugging
      const screenshotPath = path.join(downloadDir, 'login_page.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[DVSum] Screenshot saved to ${screenshotPath}`);
      
      // Get page content for debugging
      const pageContent = await page.content();
      const contentPath = path.join(downloadDir, 'login_page.html');
      fs.writeFileSync(contentPath, pageContent);
      console.log(`[DVSum] Page HTML saved to ${contentPath}`);
      
      // Check if we're on a different page (SSO redirect, etc)
      if (currentUrl.includes('auth0') || currentUrl.includes('okta') || currentUrl.includes('login.microsoft')) {
        throw new Error('DVSum uses SSO authentication. Please log in manually through your browser first.');
      }
      
      throw new Error('Could not find login form. The DVSum page structure may have changed.');
    }
    
    console.log('[DVSum] Entering credentials...');
    await emailInput.click();
    await emailInput.type(username, { delay: 30 });
    
    // Find password field
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.click();
      await passwordInput.type(password, { delay: 30 });
    } else {
      throw new Error('Could not find password field');
    }
    
    // Find and click login button
    const buttonSelectors = [
      'button[type="submit"]',
      'button:not([type])',
      'input[type="submit"]',
      '[role="button"]',
    ];
    
    let loginButton = null;
    for (const selector of buttonSelectors) {
      const buttons = await page.$$(selector);
      for (const btn of buttons) {
        const text = await btn.evaluate((el: Element) => el.textContent?.toLowerCase() || '');
        if (text.includes('login') || text.includes('sign in') || text.includes('submit') || text.includes('continue')) {
          loginButton = btn;
          break;
        }
      }
      if (loginButton) break;
    }
    
    if (!loginButton) {
      // Try to find any button
      loginButton = await page.$('button[type="submit"]') || await page.$('button');
    }
    
    if (loginButton) {
      console.log('[DVSum] Clicking login button...');
      await loginButton.click();
    } else {
      // Try pressing Enter
      await page.keyboard.press('Enter');
    }
    
    console.log('[DVSum] Waiting for login to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if login was successful
    const postLoginUrl = page.url();
    console.log(`[DVSum] Post-login URL: ${postLoginUrl}`);
    
    if (postLoginUrl.includes('/login') || postLoginUrl.includes('error')) {
      const errorElement = await page.$('.error, .alert-error, [class*="error"], [class*="Error"]');
      if (errorElement) {
        const errorText = await errorElement.evaluate((el: Element) => el.textContent);
        throw new Error(`Login failed: ${errorText?.trim() || 'Invalid credentials'}`);
      }
      throw new Error('Login failed: Please check your credentials');
    }
    
    console.log('[DVSum] Login successful, navigating to rules page...');
    await page.goto(DVSUM_RULES_URL, { waitUntil: 'networkidle0', timeout: WAIT_TIMEOUT });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
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
      // Save screenshot for debugging
      const screenshotPath = path.join(downloadDir, 'rules_page.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      result.message = 'No rules found on the page. Please verify your access to DVSum rules.';
      return result;
    }
    
    for (let i = 0; i < ruleIds.length; i++) {
      const ruleId = ruleIds[i];
      console.log(`[DVSum] Processing ${i + 1}/${ruleIds.length}: ${ruleId}`);
      
      try {
        // Find and click the rule link
        const ruleLinks = await page.$$('a[href*="/rules/"]');
        let found = false;
        
        for (const link of ruleLinks) {
          const text = await link.evaluate((el: Element) => el.textContent?.trim());
          if (text === ruleId) {
            const href = await link.evaluate((el: Element) => el.getAttribute('href'));
            if (href) {
              await page.goto(`${DVSUM_BASE_URL}${href}`, { waitUntil: 'networkidle0', timeout: WAIT_TIMEOUT });
              found = true;
              break;
            }
          }
        }
        
        if (!found) {
          throw new Error(`Rule link not found: ${ruleId}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Look for Data tab
        const dataTabClicked = await clickElementByText(page, 'button, a, [role="tab"], div[role="tab"]', 'Data');
        if (dataTabClicked) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Look for Export button
        const exportClicked = await clickElementByText(page, 'button, [role="button"]', 'Export');
        if (exportClicked) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Click CSV option
          const csvClicked = await clickElementByText(page, '*', 'CSV Export') || 
                            await clickElementByText(page, '*', 'Export to CSV') ||
                            await clickElementByText(page, '*', 'CSV') ||
                            await clickElementByText(page, '*', 'Download');
          
          if (csvClicked) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            result.downloaded++;
            console.log(`[DVSum] Downloaded ${ruleId}`);
          } else {
            throw new Error('CSV export option not found');
          }
        } else {
          throw new Error('Export button not found');
        }
        
        // Navigate back to rules list
        await page.goto(DVSUM_RULES_URL, { waitUntil: 'networkidle0', timeout: WAIT_TIMEOUT });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error: any) {
        console.error(`[DVSum] Failed to download ${ruleId}: ${error.message}`);
        result.failed++;
        result.failedRules.push(ruleId);
        
        // Try to navigate back to rules list
        await page.goto(DVSUM_RULES_URL, { waitUntil: 'networkidle0', timeout: WAIT_TIMEOUT }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Wait for downloads to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check for downloaded files
    const files = fs.readdirSync(downloadDir).filter(f => f.endsWith('.csv') || f.endsWith('.xlsx'));
    
    if (files.length > 0) {
      const zipPath = path.join(downloadDir, 'dvsum_reports.zip');
      await createZipArchive(downloadDir, files, zipPath);
      result.zipPath = zipPath;
      result.success = true;
      result.message = `Downloaded ${result.downloaded} reports, ${result.failed} failed`;
    } else if (result.downloaded > 0) {
      result.success = true;
      result.message = `Processed ${result.downloaded} reports but files may still be downloading`;
    } else {
      result.message = `No reports were downloaded. ${result.failed} failed.`;
    }
    
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
