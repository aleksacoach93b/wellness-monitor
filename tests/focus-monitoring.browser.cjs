const fs = require("fs"),
  assert = require("assert/strict");
const { chromium, webkit } = require(
  process.env.RHR_PLAYWRIGHT_MODULE || "playwright",
);
const base = process.env.PVT_TEST_BASE_URL;
if (!base || new URL(base).hostname !== "127.0.0.1")
  throw Error("Explicit loopback fixture required");
const cookie = fs
  .readFileSync("/tmp/pvt-test-admin-cookie", "utf8")
  .replace(/^wm_admin_session=/, "")
  .trim();
async function run(engine, duration) {
  const browser = await (engine === "chromium" ? chromium : webkit).launch({
    headless: true,
    ...(engine === "chromium"
      ? { executablePath: process.env.RHR_BROWSER }
      : {}),
  });
  let checks = 0;
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
      timezoneId: "Europe/Belgrade",
    });
    await ctx.addCookies([
      { name: "wm_admin_session", value: cookie, url: base },
    ]);
    const page = await ctx.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/surveys/update-recurring", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"updates":[]}',
      }),
    );
    const list = await ctx.request
        .get(base + "/api/pvt/admin")
        .then((r) => r.json()),
      session = list.sessions.find(
        (s) => s.status === "COMPLETED" && s.summary?.quality === "OK",
      );
    assert.ok(session);
    checks++;
    await page.goto(base + "/admin/pvt/session/" + session.id);
    await page
      .getByRole("heading", { name: "Every reaction", exact: true })
      .waitFor();
    assert.equal(await page.locator(".fm-chart").count(), 2);
    assert.ok(
      (await page.locator(".fm-kpis").innerText())
        .toLowerCase()
        .includes("mean rt"),
    );
    checks++;
    await page.screenshot({
      path: "/tmp/focus-" + engine + "-desktop.png",
      fullPage: true,
    });
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: "Trial CSV", exact: true }).click();
    const d = await dl;
    assert.ok(d.suggestedFilename().startsWith("Focus trials - "));
    await d.saveAs("/tmp/focus-" + engine + "-trials.csv");
    checks++;
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      assert.ok(await page.locator(".fm-kpis").isVisible());
      checks++;
    }
    await page.screenshot({
      path: "/tmp/focus-" + engine + "-mobile.png",
      fullPage: true,
    });
    await page.goto(base + "/admin/pvt/session/nonexistent-focus-session");
    await page.getByRole("heading", { name: "Session unavailable" }).waitFor();
    assert.ok(
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .isVisible(),
    );
    checks++;
    await page.goto(base + "/pvt/demo");
    await page
      .getByRole("button", { name: "Start Focus test", exact: true })
      .click();
    await page.getByRole("button", { name: "Begin test", exact: true }).click();
    await page.locator("[data-testid=pvt-response]").waitFor();
    for (let i = 0; i < 3; i++)
      await page
        .locator("[data-testid=pvt-response]")
        .dispatchEvent("pointerdown", {
          isPrimary: true,
          button: 0,
          bubbles: true,
        });
    await page.locator("[data-testid=pvt-repeat]").waitFor();
    assert.ok(
      (await page.getByRole("dialog").innerText()).includes("Three early taps"),
    );
    checks++;
    await page.goto(base + "/pvt/demo");
    await page
      .getByRole("combobox", { name: /^Protocol/ })
      .selectOption(String(duration));
    await page
      .getByRole("button", { name: "Start Focus test", exact: true })
      .click();
    assert.ok(
      (await page.getByRole("dialog").innerText()).includes(
        "all " + duration + " seconds",
      ),
    );
    await page.getByRole("button", { name: "Begin test", exact: true }).click();
    const before = Date.now();
    await page.evaluate(() => {
      let sent = false;
      window.__focusTap = setInterval(() => {
        const signal = document.querySelector("[data-testid=pvt-signal]"),
          counter = document.querySelector("[data-testid=pvt-counter]"),
          button = document.querySelector("[data-testid=pvt-response]");
        if (!signal || !button) return;
        if (signal.dataset.active !== "true") {
          sent = false;
          return;
        }
        if (!sent && Number(counter.textContent) >= 240) {
          sent = true;
          button.dispatchEvent(
            new PointerEvent("pointerdown", {
              isPrimary: true,
              button: 0,
              bubbles: true,
              cancelable: true,
            }),
          );
        }
      }, 8);
    });
    await page
      .locator("[data-testid=pvt-done]")
      .waitFor({ timeout: (duration + 10) * 1000 });
    assert.ok(Date.now() - before >= duration * 1000 - 1000);
    assert.ok(
      await page
        .locator("[data-testid=pvt-completion-median-value]")
        .isVisible(),
    );
    checks++;
    await page.evaluate(() => clearInterval(window.__focusTap));
    await page.locator("[data-testid=pvt-done]").click();
    assert.equal(await page.getByRole("dialog").count(), 0);
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      "PASS " +
        engine +
        ": " +
        checks +
        " browser checks including real " +
        duration +
        "s Focus completion",
    );
  } finally {
    await browser.close();
  }
}
Promise.all([run("chromium", 30), run("webkit", 60)]).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
