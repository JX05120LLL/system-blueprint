import {chromium} from './evaluation-env.mjs';
import fs from 'node:fs';import{fileURLToPath}from'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const report=JSON.parse(fs.readFileSync(dir+'verification-second.json','utf8'));
report.harnessNotes=['首次验证错误地要求无 JS 摘要含数字 13；实际摘要逐项列出了全部节点，已改为逐节点核对。','第二次直接打开 SVG 并确认 13 节点/13 箭头后，fullPage 截图超时；改为覆盖整个 SVG 的固定视口截图。'];
delete report.failure;
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:800,height:2800},offline:true});const page=await context.newPage();await page.goto(new URL('./agent-runtime.svg',import.meta.url).href);
 await page.screenshot({path:dir+'svg-independent-open.png',timeout:10000});report.screenshots.push('svg-independent-open.png');
 const png=fs.readFileSync(dir+'agent-runtime.png');const pngOk=png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&png.readUInt32BE(16)===988&&png.readUInt32BE(20)===5286;
 report.checks.push({name:'PNG signature and dimensions',passed:pngOk,width:png.readUInt32BE(16),height:png.readUInt32BE(20),bytes:png.length});if(!pngOk)throw Error('PNG invalid');
 await page.setViewportSize({width:1600,height:980});await page.goto(new URL('./原始运行流程.svg',import.meta.url).href);await page.screenshot({path:dir+'original-open.png',timeout:10000});report.screenshots.push('original-open.png');
}catch(e){report.failure=String(e);throw e;}finally{fs.writeFileSync(dir+'verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.checks.filter(c=>c.passed).length,failed:report.checks.filter(c=>!c.passed),failure:report.failure,screenshots:report.screenshots},null,2));await browser.close();}

