import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let sequence = 0; const pending = new Map(); const errors = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result); }
  };
  return { ws, errors, send: (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 10000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); ws.send(JSON.stringify({ id, method, params }));
  }) };
}
const browser = await connect(version.webSocketDebuggerUrl);
const contexts = []; const pages = [];
async function newPage(width, height, url) {
  const { browserContextId } = await browser.send('Target.createBrowserContext'); contexts.push(browserContextId);
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const page = await connect(`ws://127.0.0.1:9222/devtools/page/${targetId}`); pages.push(page);
  page.eval = async expression => {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  page.wait = async expression => { for (let i = 0; i < 80; i++) { if (await page.eval(expression)) return; await delay(100); } throw new Error(`Timed out: ${expression}. Body: ${await page.eval('document.body.innerText')}`); };
  page.fill = (selector, value) => page.eval(`(()=>{ const el=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  page.click = text => page.eval(`(()=>{ const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}); if(!b) throw Error('Missing button'); b.click(); })()`);
  page.capture = async path => { const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); writeFileSync(path, Buffer.from(data, 'base64')); };
  await page.send('Runtime.enable'); await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
  await page.send('Page.navigate', { url });
  await page.wait('!!document.querySelector("#player-name")');
  return page;
}
try {
  const host = await newPage(1440, 1050, 'http://127.0.0.1:5173/');
  await host.capture('.browser-check/entry-desktop.png');
  await host.eval('document.querySelector(".research-optin input").click()');
  await host.fill('#player-name', 'Chaitanya'); await host.click('Create my room');
  await host.wait('!!document.querySelector("#competition-guess")');
  const code = await host.eval('JSON.parse(localStorage.getItem("hunch_session_v1")).code');
  const guest = await newPage(390, 844, `http://127.0.0.1:5173/?room=${code}`);
  await guest.fill('#player-name', 'Aisha'); await guest.click('Join the game');
  await guest.wait('!!document.querySelector("#competition-guess")');
  await host.wait('document.querySelector(".room-strip").innerText.includes("2 players")');
  await host.fill('#competition-guess', '450'); await host.fill('#maximum-pay', '400'); await host.click('Lock in guess');
  await host.wait('!!document.querySelector(".guess-locked")');
  await guest.fill('#competition-guess', '500'); await guest.click('Lock in guess');
  await guest.wait('!!document.querySelector(".guess-locked")');
  await host.wait('document.querySelector(".submission-status").innerText.includes("2 / 2")');
  await delay(1000);
  await host.capture('.browser-check/game-desktop.png');
  assert.equal(await host.eval('document.querySelector(".round-reveal") === null'), true);
  await host.click('Copy invite link');
  await host.wait('!!document.querySelector("#invite-url")');
  assert.ok(!(await host.eval('document.querySelector("#invite-url").value')).includes('127.0.0.1'));
  for (let i = 0; i < 4; i++) {
    const response = await fetch(`http://127.0.0.1:5173/api/rooms/${code}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Research player ${i}`, researchConsent: true }) });
    const { session } = await response.json();
    const guess = await fetch(`http://127.0.0.1:5173/api/rooms/${code}/guess`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ roundIndex: 0, guess: 600 + i * 10, maximumPay: 400 }) });
    assert.equal(guess.status, 200);
  }
  await host.wait('document.querySelector(".submission-status").innerText.includes("6 / 6")');
  await host.click('Reveal the price');
  await host.wait('!!document.querySelector(".round-reveal")');
  await guest.wait('!!document.querySelector(".round-reveal")');
  assert.ok((await guest.eval('document.querySelector(".winner-announcement").innerText')).includes('Aisha'));
  assert.ok((await guest.eval('document.querySelector(".round-reveal").innerText')).includes('499.00'));
  await guest.capture('.browser-check/game-mobile.png');
  assert.equal(await guest.eval('document.documentElement.scrollWidth <= innerWidth'), true, 'Mobile must not overflow');
  assert.equal(await host.eval('document.documentElement.scrollWidth <= innerWidth'), true, 'Desktop must not overflow');
  await host.click('Next item');
  await guest.wait('!!document.querySelector("#competition-guess")');
  assert.equal(await guest.eval('document.querySelector("#competition-guess").value'), '');
  assert.ok((await guest.eval('document.querySelector(".round-display").innerText')).includes('02'));
  await guest.send('Page.reload');
  await guest.wait('!!document.querySelector("#competition-guess")');
  assert.ok((await guest.eval('document.querySelector(".room-strip").innerText')).includes('6 players'));
  await guest.eval('document.querySelectorAll(".bottom-nav-item")[1].click()');
  await guest.wait('!!document.querySelector("#round-select")');
  await guest.eval('const s=document.querySelector("#round-select"); s.value="0"; s.dispatchEvent(new Event("change",{bubbles:true}));');
  await guest.wait('document.querySelectorAll(".ranking-table tbody tr").length===6');
  await guest.eval('document.querySelectorAll(".bottom-nav-item")[2].click()');
  await guest.wait('document.querySelector(".competition-view h1")?.innerText.includes("Aisha")');
  assert.equal(await guest.eval('document.documentElement.scrollWidth <= innerWidth'), true, 'Profile must fit mobile');
  await host.click('Insights');
  await host.wait('document.querySelectorAll(".insight-product").length===1');
  assert.ok((await host.eval('document.querySelector(".insight-product").innerText')).includes('5 RESPONSES'));
  assert.ok((await host.eval('document.querySelector(".insight-product").innerText')).includes('610.00'));
  assert.ok((await host.eval('document.querySelector(".insight-product").innerText')).includes('400.00'));
  await host.capture('.browser-check/insights-desktop.png');
  await host.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await host.eval('document.documentElement.scrollWidth <= innerWidth'), true, 'Insights must fit mobile');
  await host.capture('.browser-check/insights-mobile.png');
  const another = await (await fetch('http://127.0.0.1:5173/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Other game' }) })).json();
  await guest.send('Page.navigate', { url: `http://127.0.0.1:5173/?room=${another.session.code}` });
  await guest.wait('!!document.querySelector("#room-code")');
  assert.equal(await guest.eval('document.querySelector("#room-code").value'), another.session.code);
  await guest.send('Page.navigate', { url: `http://127.0.0.1:5173/?room=${code}` });
  await guest.wait('!!document.querySelector("#competition-guess")');
  assert.ok((await guest.eval('document.querySelector(".playing-as").innerText')).includes('Aisha'));
  assert.deepEqual(host.errors, []); assert.deepEqual(guest.errors, []);
  console.log('Browser checks passed: create/join, two private guesses, invite URL, host reveal, nearest winner, shared next round, session reload, leaderboard history, profile, and desktop/mobile overflow.');
  console.log('Screenshots: .browser-check/entry-desktop.png, game-desktop.png, game-mobile.png');
} finally {
  for (const page of pages) page.ws.close();
  for (const id of contexts) { try { await browser.send('Target.disposeBrowserContext', { browserContextId: id }); } catch { /* Browser may have already disposed its context. */ } }
  browser.ws.close();
}
