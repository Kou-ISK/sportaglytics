import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { getTimelineWindow } from './e2e-angle-sync-workspace.mjs';

const out = path.resolve('visual-results');
await fs.mkdir(out);
const root = await fs.mkdtemp(path.join(process.env.RUNNER_TEMP,'visual-'));
process.env.E2E_APP_PATH = path.join(process.env.RUNNER_TEMP,'signed/SporTagLytics.app/Contents/MacOS/SporTagLytics');
execFileSync('unzip',['-q','samples/synthetic-first-run.stpkg.zip','-d',root]);
const single = path.join(root,'Synthetic-first-run.stpkg');
const pair = path.join(root,'Pair.stpkg');
await fs.cp(single,pair,{recursive:true});
const config = path.join(pair,'.metadata/config.json');
const data = JSON.parse(await fs.readFile(config));
const first = data.angles[0];
const second = structuredClone(first);
second.id = 'angle-2'; second.name = 'Offset view';
second.relativePath = 'videos/offset.mp4';
second.clips[0] = {...second.clips[0],id:'offset-clip',relativePath:second.relativePath};
await fs.copyFile(path.join(pair,first.relativePath),path.join(pair,second.relativePath));
Object.assign(data,{angles:[first,second],secondaryAngleId:second.id,tightViewPath:first.relativePath,wideViewPath:second.relativePath,syncData:{isAnalyzed:true,syncOffset:.4,angleOffsets:[0,.4]}});
await fs.writeFile(config,JSON.stringify(data));
const playlist = path.join(root,'Review.stpl');
await fs.mkdir(playlist);
await fs.writeFile(path.join(playlist,'playlist.json'), JSON.stringify({id:'visual',name:'Synthetic review',type:'reference',createdAt:1,updatedAt:2,items:[{id:'marker',timelineItemId:'marker',actionName:'Marker',startTime:2,endTime:17,addedAt:1,videoSource:path.join(pair,first.relativePath)}]}));

async function sample(app, page, count) {
  const boxes = await page.evaluate(() => [...document.querySelectorAll('video')].filter(v=>v.videoWidth>0 && v.clientWidth>0 && getComputedStyle(v).visibility!=='hidden').map(v=>{
    const rect=v.getBoundingClientRect();
    const scale=Math.min(rect.width/v.videoWidth,rect.height/v.videoHeight);
    const width=Math.round(v.videoWidth*scale),height=Math.round(v.videoHeight*scale);
    return {rect:{x:Math.round(rect.x+(rect.width-width)/2),y:Math.round(rect.y+(rect.height-height)/2),width,height},time:v.currentTime,paused:v.paused,src:v.currentSrc.split('/').pop()};
  }));
  assert.equal(boxes.length,count,JSON.stringify(boxes));
  const win=await app.browserWindow(page);
  try {
    for(const b of boxes) {
      const m=await win.evaluate(async(w,rect)=>{
        const img=await w.webContents.capturePage(rect);
        const bitmap=img.resize({width:640,height:360}).toBitmap();
        // The MIT sample has one moving white square, 16x16, and a narrow midfield line.
        const points=[];
        for(let y=80;y<265;y++){
          let start=-1;
          for(let x=5;x<635;x++){
            const i=4*(y*640+x);
            if(Math.min(bitmap[i],bitmap[i+1],bitmap[i+2])>=220){if(start<0)start=x;}
            else if(start>=0){if(x-start>=9 && x-start<=22)points.push([(start+x-1)/2,y]);start=-1;}
          }
        }
        return points.length<6?null:{x:points.reduce((s,p)=>s+p[0],0)/points.length,y:points.reduce((s,p)=>s+p[1],0)/points.length};
      },b.rect);
      b.marker=m;
    }
  } finally {await win.dispose();}
  return boxes;
}

const records=[];
async function exercise(mode) {
  const profile=path.join(root,'profile-'+mode);
  const app=await electron.launch(getElectronLaunchOptions(profile,[mode==='single'?single:pair]));
  let media, control;
  try {
    const identity=await app.evaluate(({app})=>[app.getVersion(),app.isPackaged,app.getPath('exe'),app.getPath('userData')]);
    assert.deepEqual(identity,['0.17.34',true,process.env.E2E_APP_PATH,profile]);
    const main=await app.firstWindow();
    await main.locator('#video_0 video').waitFor({timeout:30000});
    await main.evaluate(()=>localStorage.setItem('sportaglytics-onboarding-completed','true'));
    let bar,slider;
    if(mode==='playlist'){
      const [review]=await Promise.all([app.waitForEvent('window'),main.evaluate(p=>window.electronAPI.playlist.loadPlaylistFile(p),playlist)]);
      media=control=review;
      await review.getByTestId('organizer-clip-marker').dblclick();
      const input=review.getByRole('slider',{name:'映像の再生位置'});
      slider=input;
      bar=input.locator('xpath=ancestor::*[contains(@class,"MuiSlider-root")][1]');
    } else {
      media=main;
      await main.evaluate(()=>window.electronAPI.timelineWindow.openWindow());
      control=await getTimelineWindow(app);
      bar=control.getByTestId('timeline-time-origin');
      slider=control.getByRole('slider',{name:'タイムラインの再生位置'});
    }
    const count=mode==='pair'?2:1;
    await media.waitForFunction(n=>[...document.querySelectorAll('video')].filter(v=>v.videoWidth>0 && v.clientWidth>0).length===n,count);
    const b=await bar.boundingBox();assert.ok(b);
    const lo=Number(await slider.getAttribute(mode==='playlist'?'min':'aria-valuemin'));
    const hi=Number(await slider.getAttribute(mode==='playlist'?'max':'aria-valuemax'));
    assert.ok(hi>10,JSON.stringify({b,lo,hi}));
    const x=t=>Math.round(b.x+b.width*(t-lo)/(hi-lo));
    const y=Math.round(b.y+(mode==='playlist'?b.height/2:8));
    const actual=t=>lo+(x(t)-b.x)*(hi-lo)/b.width;
    const offsets=mode==='pair'?[0,.4]:[0];
    const states=()=>media.evaluate(()=>[...document.querySelectorAll('video')].filter(v=>v.videoWidth && v.clientWidth).map(v=>({time:v.currentTime,paused:v.paused})));
    async function playing(want) {
      if ((await states()).every(v=>v.paused!==want))return;
      if(mode==='playlist')await media.keyboard.press('Space');
      else await media.getByRole('button',{name:want?'再生':'一時停止',exact:true}).click({force:true});
      await media.waitForFunction(w=>[...document.querySelectorAll('video')].filter(v=>v.videoWidth && v.clientWidth).every(v=>v.paused!==w),want,{timeout:5000});
    }
    async function match(t) {
      let seen;
      for(let i=0;i<20;i++){
        seen=await sample(app,media,count);
        if(seen.every((v,j)=>v.marker && Math.abs(v.marker.x-(27+28*(t+offsets[j])))<7 && Math.abs(v.marker.y-(179+80*Math.sin(t+offsets[j])))<12)) return seen;
        await sleep(65);
      }
      throw Error('Pixels disagree with source marker at '+t+' '+JSON.stringify(seen));
    }
    await playing(false);
    await control.mouse.move(x(4),y);await control.mouse.down();
    for(const t of [4,9,6]){
      await control.mouse.move(x(t),y);
      const seen=await match(actual(t));
      records.push({mode,stage:'held',target:actual(t),seen});
      await media.screenshot({path:path.join(out,mode+'-held-'+t+'.png')});
    }
    await control.mouse.up();
    await match(actual(6));
    const landed=await states();
    assert.ok(landed.every((s,j)=>s.paused && Math.abs(s.time-actual(6)-offsets[j])<1/24+.012),JSON.stringify({landed,target:actual(6)}));
    records.push({mode,stage:'released-paused',target:actual(6),landed});
    await playing(true);
    await control.mouse.move(x(5),y);await control.mouse.down();
    await control.mouse.move(x(8),y);
    await match(actual(8));
    await control.mouse.up();
    await media.waitForFunction(()=>[...document.querySelectorAll('video')].filter(v=>v.videoWidth && v.clientWidth).every(v=>!v.paused),undefined,{timeout:4000});
    const one=await sample(app,media,count);await sleep(380);const two=await sample(app,media,count);
    assert.ok(one.every((v,j)=>Math.abs(v.time-actual(8)-offsets[j])<.5 && two[j].time>v.time+.15 && two[j].marker && v.marker && Math.abs(two[j].marker.x-v.marker.x)>3),JSON.stringify({one,two,target:actual(8)}));
    records.push({mode,stage:'released-playing',target:actual(8),one,two});
    console.log(mode,'held image, release and resumed image verified');
  } catch(err) {
    if(media){await media.screenshot({path:path.join(out,mode+'-failure.png')}).catch(()=>{});}
    throw err;
  } finally {await fs.writeFile(path.join(out,'observations.json'),JSON.stringify(records,null,2));await app.close();}
}
let failed=false;
for (const mode of ['single','pair','playlist']){
  try{await exercise(mode);}catch(e){failed=true;console.error(mode,e.message);}
}
if(failed)process.exitCode=1;
