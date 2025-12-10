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

    // STEP 1: Navigate to DVSum landing page
    console.log('[DVSum] Step 1: Navigating to landing page...');
    await page.goto(`${DVSUM_BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: WAIT_TIMEOUT });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // STEP 2: Click the orange "Sign In" button on landing page
    console.log('[DVSum] Step 2: Looking for Sign In button on landing page...');
    
    // Find and click the Sign In button (orange button)
    const signInButtonClicked = await clickElementByText(page, 'button, a', 'Sign In') ||
                                await clickElementByText(page, 'button, a', 'Sign in') ||
                                await clickElementByText(page, '[role="button"]', 'Sign In');
    
    if (!signInButtonClicked) {
      // Try finding button by class or other attributes
      const buttons = await page.$$('button, a.btn, a[class*="button"], a[class*="btn"]');
      let clicked = false;
      for (const btn of buttons) {
        const text = await btn.evaluate((el: Element) => el.textContent?.trim().toLowerCase() || '');
        if (text.includes('sign in') || text.includes('signin') || text.includes('login')) {
          await btn.click();
          clicked = true;
          console.log('[DVSum] Clicked Sign In button');
          break;
        }
      }
      if (!clicked) {
        // Take screenshot for debugging
        await page.screenshot({ path: path.join(downloadDir, 'landing_page.png'), fullPage: true });
        throw new Error('Could not find Sign In button on landing page');
      }
    } else {
      console.log('[DVSum] Clicked Sign In button');
    }
    
    // STEP 3: Wait for redirect to Cognito (auth.dvsum.ai)
    console.log('[DVSum] Step 3: Waiting for redirect to auth page...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const authUrl = page.url();
    console.log(`[DVSum] Current URL after clicking Sign In: ${authUrl}`);
    
    if (!authUrl.includes('auth.dvsum.ai') && !authUrl.includes('cognito')) {
      // Take screenshot
      await page.screenshot({ path: path.join(downloadDir, 'after_signin_click.png'), fullPage: true });
      console.log('[DVSum] Warning: Not on auth page, trying to continue...');
    }
    
    // STEP 4: Fill in credentials on the RIGHT side form (email/password login)
    console.log('[DVSum] Step 4: Looking for email/password form...');
    
    // Wait for the form to be visible
    await page.waitForSelector('input', { timeout: WAIT_TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // The Cognito page has two forms - we need the right side with email/password
    // Look for all inputs and find the email and password fields
    const allInputs = await page.$$('input');
    console.log(`[DVSum] Found ${allInputs.length} input fields`);
    
    // Find email input (on the right side - "Sign in with your email and password")
    let emailInput = null;
    let passwordInput = null;
    
    // Try to find by name attribute first
    emailInput = await page.$('input[name="email"]') || 
                 await page.$('input[type="email"]') ||
                 await page.$('input[placeholder*="email" i]') ||
                 await page.$('input[placeholder*="name@host.com" i]');
    
    passwordInput = await page.$('input[name="password"]') ||
                    await page.$('input[type="password"]');
    
    if (!emailInput) {
      // If we can't find by attributes, look at all text inputs
      for (const input of allInputs) {
        const type = await input.evaluate((el: Element) => el.getAttribute('type'));
        const placeholder = await input.evaluate((el: Element) => el.getAttribute('placeholder') || '');
        
        if (type === 'email' || placeholder.toLowerCase().includes('email') || placeholder.includes('@')) {
          emailInput = input;
        } else if (type === 'password') {
          passwordInput = input;
        }
      }
    }
    
    if (!emailInput) {
      await page.screenshot({ path: path.join(downloadDir, 'cognito_page.png'), fullPage: true });
      throw new Error('Could not find email input on auth page');
    }
    
    if (!passwordInput) {
      await page.screenshot({ path: path.join(downloadDir, 'cognito_page.png'), fullPage: true });
      throw new Error('Could not find password input on auth page');
    }
    
    console.log('[DVSum] Found email and password inputs, entering credentials...');
    
    // Clear and type email
    await emailInput.click();
    await emailInput.evaluate((el: HTMLInputElement) => el.value = '');
    await emailInput.type(username, { delay: 30 });
    
    // Clear and type password
    await passwordInput.click();
    await passwordInput.evaluate((el: HTMLInputElement) => el.value = '');
    await passwordInput.type(password, { delay: 30 });
    
    // STEP 5: Click the blue "Sign in" submit button (on the right side)
    console.log('[DVSum] Step 5: Clicking Sign in button...');
    
    // Find the submit button near the password field (right side form)
    const submitButtons = await page.$$('button[type="submit"], button, input[type="submit"]');
    let submitClicked = false;
    
    for (const btn of submitButtons) {
      const text = await btn.evaluate((el: Element) => el.textContent?.trim().toLowerCase() || '');
      const isVisible = await btn.evaluate((el: Element) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      
      if (isVisible && (text.includes('sign in') || text.includes('signin') || text.includes('login') || text.includes('submit'))) {
        // Check if this button is on the right side (x > 400 typically)
        const btnX = await btn.evaluate((el: Element) => el.getBoundingClientRect().x);
        if (btnX > 400) { // Right side of the form
          await btn.click();
          submitClicked = true;
          console.log('[DVSum] Clicked right-side Sign in button');
          break;
        }
      }
    }
    
    if (!submitClicked) {
      // Fallback: try to click any visible Sign in button
      for (const btn of submitButtons) {
        const text = await btn.evaluate((el: Element) => el.textContent?.trim().toLowerCase() || '');
        if (text.includes('sign in') || text === 'sign in') {
          await btn.click();
          submitClicked = true;
          console.log('[DVSum] Clicked Sign in button (fallback)');
          break;
        }
      }
    }
    
    if (!submitClicked) {
      // Last resort: press Enter
      await page.keyboard.press('Enter');
      console.log('[DVSum] Pressed Enter to submit');
    }
    
    // STEP 6: Wait for login to complete
    console.log('[DVSum] Step 6: Waiting for login to complete...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    const postLoginUrl = page.url();
    console.log(`[DVSum] Post-login URL: ${postLoginUrl}`);
    
    // Check if we're still on the login/auth page
    if (postLoginUrl.includes('auth.dvsum.ai') || postLoginUrl.includes('/login')) {
      // Check for error messages
      const errorElement = await page.$('[class*="error" i], [class*="alert" i], [role="alert"]');
      if (errorElement) {
        const errorText = await errorElement.evaluate((el: Element) => el.textContent?.trim() || '');
        if (errorText) {
          throw new Error(`Login failed: ${errorText}`);
        }
      }
      
      await page.screenshot({ path: path.join(downloadDir, 'login_failed.png'), fullPage: true });
      throw new Error('Login failed: Still on auth page. Please verify your credentials.');
    }
    
    console.log('[DVSum] Login successful!');
    
    // STEP 7: Navigate to rules page
    console.log('[DVSum] Step 7: Navigating to rules page...');
    await page.goto(DVSUM_RULES_URL, { waitUntil: 'networkidle0', timeout: WAIT_TIMEOUT });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // STEP 8: Extract rule IDs
    console.log('[DVSum] Step 8: Extracting rule IDs...');
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
    
    console.log(`[DVSum] Found ${ruleIds.length} rules: ${ruleIds.slice(0, 5).join(', ')}${ruleIds.length > 5 ? '...' : ''}`);
    
    if (ruleIds.length === 0) {
      await page.screenshot({ path: path.join(downloadDir, 'rules_page.png'), fullPage: true });
      result.message = 'No rules found on the page. Please verify your access to DVSum rules.';
      return result;
    }
    
    // STEP 9: Download each rule
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
              const fullUrl = href.startsWith('http') ? href : `${DVSUM_BASE_URL}${href}`;
              await page.goto(fullUrl, { waitUntil: 'networkidle0', timeout: WAIT_TIMEOUT });
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
          console.log(`[DVSum] Clicked Data tab for ${ruleId}`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Look for Export button
        const exportClicked = await clickElementByText(page, 'button, [role="button"]', 'Export');
        if (exportClicked) {
          console.log(`[DVSum] Clicked Export button for ${ruleId}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Click CSV option
          const csvClicked = await clickElementByText(page, '*', 'CSV Export') || 
                            await clickElementByText(page, '*', 'Export to CSV') ||
                            await clickElementByText(page, '*', 'CSV') ||
                            await clickElementByText(page, 'button, a, [role="menuitem"]', 'Download');
          
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
    const files = fs.readdirSync(downloadDir).filter(f => 
      (f.endsWith('.csv') || f.endsWith('.xlsx')) && !f.includes('dvsum_reports')
    );
    
    console.log(`[DVSum] Found ${files.length} downloaded files`);
    
    if (files.length > 0) {
      const zipPath = path.join(downloadDir, 'dvsum_reports.zip');
      await createZipArchive(downloadDir, files, zipPath);
      result.zipPath = zipPath;
      result.success = true;
      result.message = `Downloaded ${files.length} reports successfully`;
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
