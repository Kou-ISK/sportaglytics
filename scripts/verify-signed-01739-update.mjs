import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { expect } from 'playwright/test';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';

import { getTimelineWindow } from './e2e-angle-sync-workspace.mjs';

async function savedTag(app, main, create) {
  await main.evaluate(()=>window.electronAPI.timelineWindow.openWindow());
  const timeline = await getTimelineWindow(app);
  await timeline.getByTestId('timeline-ruler').waitFor();
  return timeline.evaluate(create => new Promise((resolve,reject) => {
    const bridge = window.electronAPI.timelineWindow;
    const off = bridge.onSync(snapshot => {
      const item = snapshot.timeline.find(i=>i.actionName==='Synthetic upgrade marker');
      if (!item) return;
      clearTimeout(timer);
      off();
      resolve([item.actionName,item.startTime,item.endTime]);
    });
    const timer = setTimeout(()=>{off();reject(Error('Timeline marker not observed'));},15000);
    bridge.sendCommand(create ? {type:'create-item', actionName:'Synthetic upgrade marker', startTime:2,endTime:6,color:'#336699'} : {type:'request-sync'});
  }),create);
}
const temp = process.env.RUNNER_TEMP;
const root = await fs.mkdtemp(path.join(temp, 'document-update-'));
const installed = path.join(temp, 'test-Applications/SporTagLytics.app');
const binary = 'Contents/MacOS/SporTagLytics';
const profile = path.join(root, 'profile');
const folder = path.join(root, 'Upgrade Review.stpkg');
const playlist = path.join(root, 'Clips.stpl');
const slides = path.join(root, 'Meeting.stpl');
const json = p => fs.readFile(p, 'utf8').then(JSON.parse);
const hash = async p => createHash('sha256').update(await fs.readFile(p)).digest('hex');
const observations = {};
async function launch(bundle, version, userData, args = []) {
  process.env.E2E_APP_PATH = path.join(bundle, binary);
  const app = await electron.launch(getElectronLaunchOptions(userData, args));
  app.context().setDefaultTimeout(25000);
  const identity = await app.evaluate(({ app }) => [app.getVersion(), app.isPackaged, app.getPath('exe'), app.getPath('userData')]);
  assert.deepEqual(identity, [version, true, process.env.E2E_APP_PATH, userData]);
  return app;
}
async function mainPage(app) {
  await expect.poll(() => app.windows().some(p => p.url().startsWith('file:') && !new URL(p.url()).hash)).toBe(true);
  return app.windows().find(p => p.url().startsWith('file:') && !new URL(p.url()).hash);
}
async function newWindow(app, action) {
  const [page] = await Promise.all([app.waitForEvent('window'), action()]);
  return page;
}
async function readyVideo(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('video')].some(v => v.videoWidth > 0 && v.readyState >= 2), undefined, {timeout:30000});
}
async function fingerprint() {
  const configPath = path.join(folder, '.metadata/config.json');
  const config = await json(configPath);
  const marker = config.angles[0].clips[0].relativePath;
  assert.ok(marker && !path.isAbsolute(marker));
  return { config:await hash(configPath), timeline:await hash(path.join(folder,'timeline.json')),
    media:await hash(path.join(folder,marker)), playlist:await hash(path.join(playlist,'playlist.json')) };
}
async function persist() {
  await fs.mkdir('update-results', {recursive:true});
  await fs.writeFile('update-results/document-check.json', JSON.stringify(observations, null, 2));
}

let app;
function stage(name) {
  observations.stage = name;
  console.log('Update check:',name);
}
try {
  execFileSync('unzip', ['-q', 'samples/synthetic-first-run.stpkg.zip', '-d', root]);
  const sample = path.join(root, 'Synthetic-first-run.stpkg');
  const fixture = await json(path.join(sample, '.metadata/config.json'));
  const source = path.join(sample, fixture.angles[0].clips[0].relativePath);
  await fs.access(source);
  app = await launch(installed, '0.17.36', profile);
  let main = await mainPage(app);
  await main.evaluate(() => localStorage.setItem('sportaglytics-onboarding-completed','true'));
  await main.reload();
  await app.evaluate(({dialog}, {source,root,playlist}) => {
    dialog.showOpenDialog = async (...args) => ({canceled:false, filePaths:[args.at(-1).properties?.includes('openDirectory') ? root : source]});
    dialog.showSaveDialog = async () => ({canceled:false, filePath:playlist});
    const original = dialog.showMessageBox.bind(dialog);
    dialog.showMessageBox = async (...args) => {
      const opts = args.at(-1);
      if (opts.title === '保存完了' && opts.type === 'info' && opts.message === 'プレイリストを保存しました') {
        globalThis.__oldSaveConfirmed = true;
        return {response:0,checkboxChecked:false};
      }
      return original(...args);
    };
  }, {source,root,playlist});
  await main.getByText('新しいパッケージを作成', {exact:true}).click();
  await main.getByRole('textbox',{name:'パッケージ',exact:true}).fill('Upgrade Review');
  await main.getByLabel('Team 1').fill('Red');
  await main.getByLabel('Team 2').fill('Blue');
  await main.getByRole('button',{name:'次へ'}).click();
  await main.getByRole('button',{name:'このアングルに映像を追加'}).click();
  await main.getByRole('menuitem',{name:/ローカル映像/}).click();
  await main.getByText(path.basename(source),{exact:true}).first().waitFor();
  await main.getByRole('button',{name:'パッケージを作成…'}).click();
  await main.locator('#video_0 video').waitFor();
  await readyVideo(main);
  stage('old wizard saved the package; recording timeline tag');
  const marker = await savedTag(app,main,true);
  assert.deepEqual(marker,['Synthetic upgrade marker',2,6]);
  const created = await json(path.join(folder,'.metadata/config.json'));
  const media = path.join(folder,created.angles[0].clips[0].relativePath);
  assert.equal(await hash(media),await hash(source));
  const item = {id:'marker', timelineItemId:null, actionName:'Marker', startTime:2, endTime:6, addedAt:1, videoSource:media, note:'Saved by 0.17.36'};
  stage('old playlist window; add and save a new clip');
  let page = await newWindow(app, () => main.evaluate(() => window.electronAPI.playlist.openWindow()));
  await page.getByRole('button',{name:'Organizer',exact:true}).click();
  await main.evaluate(item => window.electronAPI.playlist.addItemToAllWindows(item),item);
  await page.getByTestId('organizer-clip-marker').click();
  stage('old clip visible; open the Save dialog');
  await page.keyboard.press('Meta+s');
  const save = page.getByRole('dialog',{name:'プレイリストを保存'});
  await save.getByLabel('プレイリスト名').fill('Clips');
  await save.getByRole('button',{name:/元データにリンク/}).click();
  stage('old reference format selected; execute the real Save As');
  await save.getByRole('button',{name:'保存',exact:true}).click();
  await expect.poll(async () => (await json(path.join(playlist,'playlist.json')).catch(()=>null))?.items?.[0]?.note,{timeout:15000}).toBe(item.note);
  await expect.poll(()=>app.evaluate(()=>Boolean(globalThis.__oldSaveConfirmed)),{timeout:12000}).toBe(true);
  stage('old Save As confirmed and bytes observed; exit old app');
  await app.close(); app = undefined;
  stage('read old documents after normal exit');
  const before = await fingerprint();
  const storedTimeline = await json(path.join(folder,'timeline.json'));
  assert.ok(storedTimeline.instances.length > 0 && JSON.stringify(storedTimeline).includes('Synthetic upgrade marker'));
  observations.oldVersion = '0.17.36';
  observations.saved = before;
  await persist();
  console.log('Published .36 created the synthetic package in its wizard and saved a new clip-only playlist.');

  await fs.rename(installed,path.join(temp,'preserved-old.app'));
  execFileSync('ditto',[path.join(temp,'signed/SporTagLytics.app'),installed]);
  execFileSync('codesign',['--verify','--deep','--strict',installed]);
  stage('reopen old package and saved tag in updated app');
  app = await launch(installed,'0.17.39',profile,[folder]);
  main = await mainPage(app);
  await main.locator('#video_0 video').waitFor();
  await readyVideo(main);
  assert.equal(await main.evaluate(()=>localStorage.getItem('sportaglytics-onboarding-completed')),'true');
  assert.deepEqual(await savedTag(app,main,false),marker);
  const loaded = await main.evaluate(()=>document.querySelector('#video_0 video').currentSrc);
  assert.ok(decodeURIComponent(loaded).includes(path.basename(media)),loaded);
  const open = p => newWindow(app, () => main.evaluate(file=>window.electronAPI.playlist.loadPlaylistFile(file),p));
  stage('open and play the old clip in the signed candidate');
  page = await open(playlist);
  await page.getByTestId('organizer-clip-marker').dblclick();
  await readyVideo(page);
  await page.waitForFunction(() => [...document.querySelectorAll('video')].some(v => !v.paused && v.currentTime>=2 && v.currentTime<6));
  const disk = await json(path.join(playlist,'playlist.json'));
  assert.deepEqual([disk.items[0].actionName,disk.items[0].note,disk.items[0].startTime,disk.items[0].endTime],['Marker',item.note,2,6]);
  assert.deepEqual(await fingerprint(),before);
  observations.updated = {version:'0.17.39', sameInstallPath:true, sameProfile:true, packageVideoDecoded:true, clipPlayed:true, originalBytesPreserved:true};
  await persist();
  console.log('Signed .39 reopened both documents on the same installation path and profile; media decoded and clip played.');

  await app.close(); app = undefined;
  observations.complete = true;
  await persist();
} catch (error) {
  observations.failure = error.message;
  if (app) {
    for (const page of app.windows()) {
      try {
        console.log('Synthetic window:',new URL(page.url()).hash,
          (await page.locator('body').innerText({timeout:1000})).slice(-1600));
      } catch { /* A closing window has no DOM. */ }
    }
  }
  console.error('Failed stage:',observations.stage,error);
  await persist();
  process.exitCode=1;
  // The CI worker owns the disposable apps. Let it clean up any failed modal session.
  if (app) process.exit(1);
  throw error;
} finally {
  await persist();
  await app?.close();
}
