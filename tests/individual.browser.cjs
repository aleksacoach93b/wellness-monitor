const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium, webkit } = require(
    process.env.RHR_PLAYWRIGHT_MODULE || "playwright",
  ),
  base = process.env.PVT_TEST_BASE_URL;
if (!base || new URL(base).hostname !== "127.0.0.1")
  throw Error("Loopback fixture required");
const f = JSON.parse(fs.readFileSync("/tmp/individual-test-context.json")),
  engine = process.env.INDIVIDUAL_ENGINE || "chromium";
(async () => {
  const browser = await (engine === "webkit" ? webkit : chromium).launch({
    headless: true,
    ...(engine === "chromium"
      ? { executablePath: process.env.RHR_BROWSER }
      : {}),
  });
  let checks = 0;
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1600, height: 1100 },
      timezoneId: "Europe/Belgrade",
      acceptDownloads: true,
    });
    await ctx.addCookies([
      { name: "wm_admin_session", value: f.admin, url: base },
    ]);
    const page = await ctx.newPage(),
      errors = [],
      writes = [];
    // Existing app-wide recurring-survey updater is unrelated to this read-only feature.
    await page.route("**/api/surveys/update-recurring", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ updates: [] }),
      }),
    );
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (
        r.url().includes("/api/") &&
        r.method() !== "GET" &&
        !r.url().includes("/api/surveys/update-recurring")
      )
        writes.push(r.method() + " " + new URL(r.url()).pathname);
    });
    await page.goto(base + `/admin/ops?surveyId=${f.surveyId}&date=${f.to}`);
    await page
      .getByRole("button", { name: "Individual player", exact: true })
      .click();
    const root = page.locator(".ip-root");
    await page
      .getByRole("combobox", { name: "Individual player", exact: true })
      .selectOption(f.playerId);
    await page
      .getByRole("heading", { name: "Đorđe Čović", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Standardized profile", exact: true })
      .waitFor();
    checks++;
    assert.equal(await root.locator(".ip-kpis>article").count(), 4);
    assert.ok((await root.innerText()).includes("STEN"));
    assert.equal(await root.locator(".ip-line").count(), 8);
    checks++;
    await root.screenshot({ path: `/tmp/individual-${engine}-overview.png` });
    assert.ok((await root.innerText()).includes("complete days"));
    if (engine === "chromium") {
      await page
        .locator('[aria-label="Individual from date"]')
        .fill("2026-06-21");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      await root.locator(".ip-model-stats").first().waitFor();
      assert.equal(await root.locator(".ip-model-stats").count(), 2);
      await root
        .locator(".ip-model")
        .first()
        .screenshot({ path: "/tmp/individual-model.png" });
      checks++;
      await page.getByRole("button", { name: "28 days", exact: true }).click();
      await page.waitForFunction(() =>
        document
          .querySelector(".ip-context")
          ?.textContent?.includes("21.09.2026"),
      );
      await page
        .getByRole("heading", { name: "Standardized profile", exact: true })
        .waitFor();
    }
    await page
      .getByRole("button", { name: "Correlations", exact: true })
      .click();
    await page.getByRole("heading", { name: "Correlation matrix" }).waitFor();
    assert.ok((await root.locator(".ip-scatter circle").count()) > 0);
    assert.ok(
      (await root.locator(".ip-corr-list").innerText()).includes("paired days"),
    );
    checks++;
    await page
      .getByRole("combobox", { name: "Correlation lag" })
      .selectOption("1");
    await page
      .getByRole("combobox", { name: "Correlation values" })
      .selectOption("changes");
    await page
      .getByRole("combobox", { name: "Correlation method" })
      .selectOption("pearson");
    checks++;
    await root.screenshot({
      path: `/tmp/individual-${engine}-correlations.png`,
    });
    await page
      .getByRole("button", { name: "Daily history", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Open responses 2026-10-18", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "18.10.2026",
      exact: true,
    });
    await dialog.waitFor();
    assert.ok((await dialog.innerText()).includes("Earlier submission"));
    assert.ok(
      (await dialog.innerText()).includes("Slept well. Ready for training."),
    );
    assert.ok((await dialog.innerText()).includes("Comments"));
    checks++;
    await dialog.screenshot({ path: `/tmp/individual-${engine}-day.png` });
    await page.getByRole("button", { name: "Close daily responses" }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Open responses 2026-10-18", exact: true })
        .evaluate((el) => document.activeElement === el),
      true,
    );
    checks++;
    await page
      .getByRole("button", { name: "Open responses 2026-09-28", exact: true })
      .click();
    assert.ok(
      (await page.getByRole("dialog").innerText()).includes("No questionnaire"),
    );
    await page.keyboard.press("Escape");
    checks++;
    if (engine === "chromium") {
      await page
        .getByRole("button", { name: "Full screen", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Individual player", exact: true })
          .inputValue(),
        f.playerId,
      );
      await page
        .getByRole("heading", { name: "Daily record", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Open responses 2026-10-18", exact: true })
        .click();
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".ops-fullscreen").count(), 1);
      await page
        .getByRole("button", { name: "Exit full screen", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Individual player", exact: true })
          .inputValue(),
        f.playerId,
      );
      await page
        .getByRole("heading", { name: "Daily record", exact: true })
        .waitFor();
      checks++;
    }
    await page.getByRole("button", { name: "7 days", exact: true }).click();
    await page
      .getByRole("heading", { name: "Daily record", exact: true })
      .waitFor();
    await page.waitForFunction(
      () => document.querySelectorAll(".ip-day-grid button").length === 7,
    );
    checks++;
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page
      .getByRole("heading", { name: "Standardized profile", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Z", exact: true }).click();
    assert.ok(
      await page
        .getByRole("heading", { name: "Personal Z-score history" })
        .isVisible(),
    );
    checks++;
    if (engine === "chromium") {
      const download = page.waitForEvent("download", { timeout: 180000 });
      await page
        .getByRole("button", { name: "Export PDF", exact: true })
        .click();
      const d = await download;
      assert.ok(
        d
          .suggestedFilename()
          .startsWith("Individual Wellness Report - Đorđe Čović - "),
      );
      await d.saveAs("/tmp/individual-light.pdf");
      assert.ok(fs.statSync("/tmp/individual-light.pdf").size > 20000);
      checks++;
      await page
        .getByRole("combobox", { name: "Individual PDF appearance" })
        .selectOption("dark");
      const down = page.waitForEvent("download", { timeout: 180000 });
      await page
        .getByRole("button", { name: "Export PDF", exact: true })
        .click();
      await (await down).saveAs("/tmp/individual-dark.pdf");
      checks++;
      await page
        .getByRole("combobox", { name: "Individual PDF content" })
        .selectOption("full");
      const full = page.waitForEvent("download", { timeout: 180000 });
      await page
        .getByRole("button", { name: "Export PDF", exact: true })
        .click();
      await (await full).saveAs("/tmp/individual-full.pdf");
      checks++;
    }
    await page
      .getByRole("textbox", { name: "Individual from date" })
      .count()
      .catch(() => {});
    await page
      .locator('[aria-label="Individual from date"]')
      .fill("2026-10-20");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    assert.ok((await root.innerText()).includes("Choose a valid range"));
    checks++;
    await page
      .getByRole("combobox", { name: "Individual player", exact: true })
      .selectOption("individual-fixture-empty");
    await page
      .getByRole("heading", { name: "Empty History", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Standardized profile", exact: true })
      .waitFor();
    assert.ok((await root.innerText()).includes("No comparable value"));
    checks++;
    if (engine === "chromium") {
      let failOnce = true;
      await page.route("**/api/ops/individual?**", (route) => {
        const query = new URL(route.request().url()).searchParams;
        if (query.get("playerId") === f.playerId && failOnce) {
          failOnce = false;
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Synthetic individual outage" }),
          });
        }
        return route.continue();
      });
      await page
        .getByRole("combobox", { name: "Individual player", exact: true })
        .selectOption(f.playerId);
      await page
        .getByText("Synthetic individual outage", { exact: false })
        .waitFor();
      await page
        .getByRole("button", { name: "Retry individual report", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Standardized profile", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Individual player", exact: true })
          .inputValue(),
        f.playerId,
      );
      await page.unroute("**/api/ops/individual?**");
      checks++;
    }
    await page
      .getByRole("combobox", { name: "Individual player", exact: true })
      .selectOption(f.playerId);
    await page
      .getByRole("heading", { name: "Standardized profile", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "7 days", exact: true }).click();
    await page
      .getByRole("heading", { name: "Standardized profile", exact: true })
      .waitFor();
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 950 });
      for (const tab of ["Overview", "Correlations", "Daily history"]) {
        await page.getByRole("button", { name: tab, exact: true }).click();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `page fits ${width} ${tab}`,
        );
        checks++;
      }
      if (width === 390)
        await root.screenshot({ path: `/tmp/individual-${engine}-mobile.png` });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    console.log(
      JSON.stringify({ passed: true, engine, checks, noWrites: true, errors }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
