const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { chromium, webkit } = require(
  process.env.RHR_PLAYWRIGHT_MODULE || "playwright",
);
const fixture = JSON.parse(
  fs.readFileSync("/tmp/ops-sharing-test-context.json", "utf8"),
);
const base = process.env.PVT_TEST_BASE_URL;
if (!base || new URL(base).hostname !== "127.0.0.1" || base !== fixture.base)
  throw Error("Explicit loopback fixture required");
const errors = [],
  { link, password, adminToken } = fixture;
let checks = 0;
const check = (x, name) => {
  assert.ok(x, name);
  checks++;
};
async function run(engine) {
  const browser = await (engine === "chromium" ? chromium : webkit).launch({
    headless: true,
    ...(engine === "chromium"
      ? { executablePath: process.env.RHR_BROWSER }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Europe/Belgrade",
    extraHTTPHeaders: {
      "x-forwarded-for":
        engine === "chromium" ? "203.0.113.120" : "203.0.113.121",
    },
  });
  const page = await context.newPage(),
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/"))
      requests.push({ path: new URL(r.url()).pathname, method: r.method() });
  });
  const url = `${base}/staff/live-ops/${link.token}?surveyId=individual-fixture-survey`;
  try {
    const response = await page.goto(url);
    await page
      .getByRole("heading", { name: "Staff access", exact: true })
      .waitFor();
    check(
      response.headers()["referrer-policy"] === "no-referrer",
      "no referrer on staff document",
    );
    check(response.headers()["x-frame-options"] === "DENY", "framing denied");
    check(!requests.length, "no data loaded before password entry");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page
      .getByRole("button", { name: "Open Live Ops", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    check(
      await page
        .getByRole("heading", { name: "Staff access", exact: true })
        .isVisible(),
      "bad password keeps gate",
    );
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Open Live Ops", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Live Ops", exact: true })
      .waitFor();
    await page.locator("table.ops-classic tbody tr").first().waitFor();
    await page.getByLabel("Monitoring date").fill("2026-10-18");
    await page
      .getByRole("cell", { name: "Đorđe Čović" })
      .waitFor()
      .catch(() =>
        page.locator(".ops-cell-name").filter({ hasText: "Čović" }).waitFor(),
      );
    check(
      await page.locator("table.ops-classic").isVisible(),
      "daily table loaded",
    );
    check(
      (await page.locator("table.ops-classic").innerText()).includes("bpm"),
      "HR displayed",
    );
    check(
      (await page.locator('a[href^="/admin"]').count()) === 0,
      "staff has no admin links",
    );
    check(
      (await page
        .getByRole("button", { name: /export|print|csv|customize columns/i })
        .count()) === 0,
      "staff export tools absent",
    );
    check(
      (await page
        .getByRole("button", { name: "Rules & metrics", exact: true })
        .count()) === 0,
      "no settings mutation tab",
    );
    check(
      await page.locator(".share-watermark").isVisible(),
      "session watermark visible",
    );
    await page.screenshot({
      path: `/tmp/share-${engine}-desktop.png`,
      fullPage: true,
    });
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "no page overflow " + width,
      );
    }
    await page.screenshot({
      path: `/tmp/share-${engine}-mobile.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: "Measurements", exact: true })
      .click();
    await page.getByRole("heading", { name: "Measurement board" }).waitFor();
    check(
      await page
        .locator(".opsm-panel")
        .innerText()
        .then((t) => t.includes("bpm")),
      "measurement values present",
    );
    await page
      .getByRole("button", { name: "Weekly report", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Weekly monitoring report" })
      .waitFor();
    check(
      (await page
        .getByRole("button", { name: /Print \/ save PDF/ })
        .count()) === 0,
      "weekly print hidden",
    );
    await page
      .getByRole("button", { name: "Reliability", exact: true })
      .click();
    check(
      (await page.locator(".opsm-hub").innerText()).includes("Reliability"),
      "reliability visible",
    );
    await page
      .getByRole("button", { name: "Individual player", exact: true })
      .click();
    await page
      .getByLabel("Individual player", {exact:true})
      .selectOption("individual-fixture-player");
    await page.locator(".ip-kpis").waitFor();
    check(
      (await page
        .getByRole("button", { name: "Export PDF", exact: true })
        .count()) === 0,
      "individual PDF hidden",
    );
    check(
      (await page.locator('a[href^="/admin"]').count()) === 0,
      "individual links cannot bypass sharing",
    );
    await page.screenshot({
      path: `/tmp/share-${engine}-individual.png`,
      fullPage: true,
    });
    // Reload must require a password even with a valid cookie.
    await page.reload();
    await page
      .getByRole("heading", { name: "Staff access", exact: true })
      .waitFor();
    check(
      (await page.locator("table.ops-classic").count()) === 0,
      "reload clears previously viewed player data",
    );
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Open Live Ops", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Live Ops", exact: true })
      .waitFor();
    // A real administrator revokes all sessions while this staff page is open.
    const r = await context.request.post(base + "/api/ops/sharing", {
      headers: { Cookie: "wm_admin_session=" + adminToken, Origin: base },
      data: { action: "disconnect-all" },
    });
    check(r.status() === 200, "admin disconnect accepted");
    await page
      .getByRole("heading", { name: "Staff access", exact: true })
      .waitFor({ timeout: 28000 });
    check(
      (await page.locator("table.ops-classic").count()) === 0,
      "revocation removes table without reload",
    );
    check(
      requests.filter(
        (r) => r.method !== "GET" && !/\/(login|logout)$/.test(r.path),
      ).length === 0,
      "staff page never sends admin/measurement mutations",
    );
  } finally {
    await browser.close();
  }
}
(async () => {
  await run("chromium");
  await run("webkit");
  const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.RHR_BROWSER,
    }),
    ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([
    { name: "wm_admin_session", value: adminToken, url: base },
  ]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/admin/ops/sharing");
  await page
    .getByRole("heading", { name: "Staff links", exact: true })
    .waitFor();
  check(
    await page
      .getByRole("heading", { name: "Access journal", exact: true })
      .isVisible(),
    "admin journal visible",
  );
  check(
    (await page.getByLabel("Staff password", { exact: true }).inputValue()) ===
      "",
    "stored password never prefilled",
  );
  await page.screenshot({
    path: "/tmp/share-admin-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "admin settings responsive",
  );
  await page.screenshot({
    path: "/tmp/share-admin-mobile.png",
    fullPage: true,
  });
  check(!errors.length, "no browser runtime errors: " + errors.join("; "));
  await browser.close();
  console.log(
    JSON.stringify({
      passed: true,
      checks,
      engines: ["Chrome", "WebKit"],
      fixtureOnly: true,
    }),
  );
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
