const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  console.log('Navigating to localhost:5174...');
  await page.goto('http://localhost:5174/shop', { waitUntil: 'networkidle' });
  
  // Wait a bit to catch async errors
  await page.waitForTimeout(3000);
  
  console.log('Done.');
  await browser.close();
})();
