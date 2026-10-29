// Run with Playwright installed: node tests/draw.spec.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

(async () => {
    const root = path.resolve(__dirname, '..');
    const server = http.createServer((req, res) => {
        const name = req.url === '/' ? 'index.html' : req.url.slice(1);
        if (!['index.html', 'app.js', 'upgrade.css'].includes(name)) { res.writeHead(404).end(); return; }
        res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
        res.end(fs.readFileSync(path.join(root, name)));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({headless: true, channel: 'chrome'});
        const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', d => d.accept());
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        assert.equal(await page.locator('.draw-column').count(), 3);
        assert.equal(await page.locator('#drawBtn').isDisabled(), true);
        await page.click('[data-panel="groups"]');
        for (const name of ['技术组', '市场组', '嘉宾组']) {
            await page.fill('#newGroupName', name);
            await page.getByRole('button', {name: '创建分组', exact: true}).click();
        }
        await page.click('[data-panel="students"]');
        for (let i = 0; i < 3; i++) {
            await page.selectOption('#addGroup', String(i));
            await page.fill('#studentInput', [`候选${i}-甲`, `候选${i}-乙`, `候选${i}-丙`].join('\n'));
            await page.getByRole('button', {name: '添加', exact: true}).click();
        }
        assert.equal(await page.locator('.student-card').count(), 9);
        await page.click('[data-panel="draw"]');
        for (let i = 0; i < 3; i++) await page.selectOption(`#pool-${i}`, String(i));
        await page.evaluate(() => { settings.spinDuration = 1; soundEnabled = false; });
        await page.click('#drawBtn');
        assert.equal(await page.locator('#addColumn').isDisabled(), true);
        await page.waitForFunction(() => !isSpinning);
        const first = await page.evaluate(() => history.map(h => ({...h})));
        assert.equal(first.length, 3);
        assert.deepEqual(first.map(h => h.groupName), ['技术组', '市场组', '嘉宾组']);
        assert.equal(new Set(first.map(h => h.name)).size, 3);
        assert.equal(await page.locator('#studentCount').textContent(), '6');
        await page.evaluate(() => { markAnswer(true, 0); markAnswer(true, 0); });
        assert.equal(await page.evaluate(() => stats.totalCorrect), 1);
        assert.equal(await page.evaluate(() => history.length), 3);
        await page.reload();
        assert.equal(await page.evaluate(() => availableStudents().length), 6);
        assert.deepEqual(await page.evaluate(() => columns), ['0', '1', '2']);
        await page.click('#drawBtn');
        await page.waitForFunction(() => !isSpinning);
        assert.equal(await page.evaluate(() => new Set(history.map(h => h.name)).size), 6);
        await page.click('#drawBtn');
        await page.waitForFunction(() => !isSpinning);
        assert.equal(await page.evaluate(() => history.length), 9);
        assert.equal(await page.locator('#drawBtn').isDisabled(), true);

        // An unrestricted pool must leave the only member of a specific pool available.
        const fixture = {students: [{name:'A',group:0}, {name:'B',group:1}, {name:'C',group:1}], groups:[{name:'唯一组'}, {name:'两人组'}], columns:['all','0','1'], settings:{spinDuration:1}, soundEnabled:false};
        await page.evaluate(data => { applyData(data); renderAll(); }, fixture);
        await page.click('#drawBtn');
        await page.waitForFunction(() => !isSpinning);
        assert.equal(await page.evaluate(() => history.find(h => h.column === 2).name), 'A');
        assert.equal(await page.evaluate(() => new Set(history.map(h => h.name)).size), 3);

        // Same-pool shortage blocks the entire draw; no partial records.
        await page.evaluate(data => { applyData({...data, columns:['0','0','1']}); renderAll(); }, fixture);
        assert.equal(await page.locator('#drawBtn').isDisabled(), true);
        await page.evaluate(() => startDraw());
        assert.equal(await page.evaluate(() => history.length), 0);
        await page.selectOption('#pool-0', '1');
        await page.selectOption('#pool-1', '1');
        await page.selectOption('#pool-2', '0');
        await page.click('#drawBtn');
        await page.waitForFunction(() => !isSpinning);
        assert.equal(await page.evaluate(() => new Set(history.map(h => h.name)).size), 3);

        // Old records exclude already-drawn names; clearing candidates cannot revive them.
        await page.evaluate(() => {
            applyData({students:[{name:'旧用户',group:0},{name:'新用户',group:0}], groups:[{name:'旧组',members:['旧用户','新用户']}], history:[{name:'旧用户',correct:true,score:10,time:'12:00:00'}]});
            renderAll();
            clearStudents();
            addNames('旧用户\n新用户', 0);
        });
        assert.deepEqual(await page.evaluate(() => availableStudents().map(s => s.name)), ['新用户']);
        assert.equal(await page.evaluate(() => history.length), 1);
        // Import validation is atomic; export round trips keep draw state.
        assert.equal(await page.evaluate(() => {
            const before = JSON.stringify(dataSnapshot());
            try { applyData({students:[{name:'测试'}],groups:[],questions:[{}]}); } catch (_) {}
            return before === JSON.stringify(dataSnapshot());
        }), true);
        assert.equal(await page.evaluate(() => {
            const before = JSON.stringify(dataSnapshot());
            applyData(JSON.parse(before));
            return before === JSON.stringify(dataSnapshot());
        }), true);
        const backup = await page.evaluate(() => dataSnapshot());
        await page.setInputFiles('#importInput', {name:'backup.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(backup))});
        await page.waitForFunction(() => document.getElementById('toast').textContent === '数据已导入');
        assert.deepEqual(await page.evaluate(() => dataSnapshot()), backup);
        const downloadPromise = page.waitForEvent('download');
        await page.evaluate(() => exportData());
        const download = await downloadPromise;
        const stream = await download.createReadStream();
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), backup);
        // Rename, move, delete, and HTML-like names remain safe and consistent.
        await page.evaluate(() => { renameGroup(0, '<测试组>'); moveStudent(1, 'ungrouped'); renderAll(); });
        assert.equal(await page.locator('#pool-0 option[value="0"]').textContent(), '<测试组>');
        await page.evaluate(() => { columns = ['0','all','all']; deleteGroup(0); });
        assert.deepEqual(await page.evaluate(() => columns), ['ungrouped','all','all']);
        await page.evaluate(() => { for (let i=0;i<10;i++) changeColumns(1); });
        assert.equal(await page.locator('.draw-column').count(), 6);
        await page.evaluate(() => { for (let i=0;i<10;i++) changeColumns(-1); });
        assert.equal(await page.locator('.draw-column').count(), 1);
        await page.evaluate(data => { applyData(data); renderAll(); }, fixture);
        await page.setViewportSize({width: 390, height: 844});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.evaluate(() => { document.getElementById('toast').classList.remove('show'); document.getElementById('confettiContainer').innerHTML = ''; });
        if (process.env.SCREENSHOT_PATH) await page.screenshot({path: process.env.SCREENSHOT_PATH, fullPage: true});
        await page.setViewportSize({width: 1440, height: 1000});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (process.env.SCREENSHOT_PATH) await page.screenshot({path: process.env.SCREENSHOT_PATH.replace('.png', '-desktop.png'), fullPage: true});
        assert.deepEqual(errors, []);
        console.log('PASS: groups, three-column draws, overlap, same-pool uniqueness, shortage, scoring, reload, legacy migration, import validation, round-trip, column bounds, responsive layout.');
    } finally {
        if (browser) await browser.close();
        server.close();
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
