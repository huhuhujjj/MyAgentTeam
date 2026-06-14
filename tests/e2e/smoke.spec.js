const { test, expect } = require('@playwright/test');

test.describe('Smoke 测试 · 首屏 + 关键 UI 元素', () => {
  test('页面加载 / 标题正确', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/MyAgentTeam/);
  });

  test('首次访问 → 介绍页自动弹出', async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    const intro = page.locator('#intro');
    await expect(intro).toBeVisible();
    // 8 项数据统计（含 NEW: 记忆源 + 自动化测试）
    const stats = page.locator('.intro-stat-n');
    await expect(stats).toHaveCount(8);
  });

  test('介绍页含 5 路长程记忆章节', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await expect(page.locator('.intro-memory-flow')).toBeVisible();
    await expect(page.locator('.intro-memory-node')).toHaveCount(5);
    // 工程基建 4 项数据
    await expect(page.locator('.intro-eng-stat')).toHaveCount(4);
    // 6 张安全卡片
    await expect(page.locator('.intro-security-card')).toHaveCount(6);
  });

  test('点"立即开始"切到欢迎页', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.click('#introStartBtn');
    await expect(page.locator('#welcome')).toBeVisible();
    await expect(page.locator('#intro')).toBeHidden();
  });

  test('7 个场景 chip 全部渲染', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('myAgentTeam.introSeen', '1'));
    await page.goto('/');
    await expect(page.locator('.scene-chip')).toHaveCount(7);
  });

  test('设置按钮打开 drawer', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('myAgentTeam.introSeen', '1'));
    await page.goto('/');
    await page.click('#settingsBtn');
    await expect(page.locator('#drawer')).toBeVisible();
    // 6 厂商 Key 输入框
    await expect(page.locator('#openaiKey')).toBeVisible();
    await expect(page.locator('#anthropicKey')).toBeVisible();
    await expect(page.locator('#qwenKey')).toBeVisible();
    await expect(page.locator('#deepseekKey')).toBeVisible();
    await expect(page.locator('#doubaoKey')).toBeVisible();
    await expect(page.locator('#geminiKey')).toBeVisible();
    // 项目上下文 textarea
    await expect(page.locator('#projectContextInput')).toBeVisible();
  });

  test('输入文字 → 自动路由 chip 高亮', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('myAgentTeam.introSeen', '1'));
    await page.goto('/');
    await page.fill('#userInput', '帮我写一份技术周报');
    await expect(page.locator('.scene-chip[data-scene="writing"].selected-hint')).toBeVisible({ timeout: 2000 });
  });

  test('历史按钮打开历史 modal', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('myAgentTeam.introSeen', '1'));
    await page.goto('/');
    await page.click('#historyBtn');
    await expect(page.locator('#modal')).toBeVisible();
  });
});

test.describe('记忆系统 UI', () => {
  test('项目上下文输入 → 字符计数同步', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('myAgentTeam.introSeen', '1'));
    await page.goto('/');
    await page.click('#settingsBtn');
    await page.fill('#projectContextInput', '我是 SaaS 创业者');
    await expect(page.locator('#projectContextCounter')).toContainText('/ 500');
  });

  test('保存项目上下文 → 重载后保留', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('myAgentTeam.introSeen', '1'));
    await page.goto('/');
    await page.click('#settingsBtn');
    await page.fill('#projectContextInput', '测试项目上下文');
    await page.click('#saveConfigBtn');
    await page.reload();
    await page.click('#settingsBtn');
    await expect(page.locator('#projectContextInput')).toHaveValue('测试项目上下文');
  });
});
