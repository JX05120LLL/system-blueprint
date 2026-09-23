import { chromium } from './evaluation-env.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const report={checks:[],errors:[],network:[],screenshots:[],limitations:['此图只有单层分组；两层嵌套折叠不适用。','未提供代码或运行日志，未验证任何 Agent Runtime 真实实现。']};
const check=(name,ok,detail={})=>{report.checks.push({name,passed:!!ok,...detail});if(!ok)throw Error(name+' failed');};
const browser=await chromium.launch({headless:true});
try{
const context=await browser.newContext({viewport:{width:1366,height:768},offline:true});
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});
const idle=()=>page.evaluate(()=>window.blueprint.whenIdle());
await page.goto(new URL('./agent-runtime.html',import.meta.url).href);await page.evaluate(()=>window.blueprint.ready);await idle();
const brief=()=>page.evaluate(()=>{const s=window.blueprint.getState();return {theme:s.theme,transform:s.transform,collapsedGroups:s.collapsedGroups,revision:s.revision,committedRevision:s.committedRevision,nodeCount:s.graph.nodes.length,edgeCount:s.graph.edges.length,diagnostics:s.diagnostics};});
check('offline file load',true,await brief());
const geometry=await page.evaluate(()=>{
 const graph=window.blueprint.getState().graph;
 const issues=[];const overlap=(a,b)=>a.x<b.x+b.width-0.5&&a.x+a.width>b.x+0.5&&a.y<b.y+b.height-0.5&&a.y+a.height>b.y+0.5;
 for(let i=0;i<graph.nodes.length;i++)for(let j=i+1;j<graph.nodes.length;j++)if(overlap(graph.nodes[i],graph.nodes[j]))issues.push(`nodes ${graph.nodes[i].id}/${graph.nodes[j].id}`);
 for(const n of graph.nodes){const g=graph.groups.find(g=>g.id===n.groupId);if(g&&(n.x<g.x||n.y<g.y||n.x+n.width>g.x+g.width||n.y+n.height>g.y+g.height))issues.push(`group bounds ${n.id}`);}
 for(const node of document.querySelectorAll('[data-node-id]')){const shape=node.querySelector('.bp-shape');for(const text of node.querySelectorAll('text')){const b=text.getBBox();for(const [x,y]of [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]])if(!shape.isPointInFill(new DOMPoint(x,y)))issues.push(`text outside ${node.dataset.nodeId}`);}}
 const boundary=(p,n)=>((Math.abs(p.x-n.x)<1||Math.abs(p.x-n.x-n.width)<1)&&p.y>=n.y-1&&p.y<=n.y+n.height+1)||((Math.abs(p.y-n.y)<1||Math.abs(p.y-n.y-n.height)<1)&&p.x>=n.x-1&&p.x<=n.x+n.width+1);
 for(const e of graph.edges){for(const section of e.sections){for(let i=1;i<section.length;i++){const a=section[i-1],b=section[i];for(const n of graph.nodes.filter(n=>n.id!==e.source&&n.id!==e.target)){if(Math.abs(a.x-b.x)<0.5&&a.x>n.x+0.5&&a.x<n.x+n.width-0.5&&Math.max(a.y,b.y)>n.y+0.5&&Math.min(a.y,b.y)<n.y+n.height-0.5)issues.push(`edge crosses ${e.id}/${n.id}`);if(Math.abs(a.y-b.y)<0.5&&a.y>n.y+0.5&&a.y<n.y+n.height-0.5&&Math.max(a.x,b.x)>n.x+0.5&&Math.min(a.x,b.x)<n.x+n.width-0.5)issues.push(`edge crosses ${e.id}/${n.id}`);}}}
 const end=e.sections.at(-1).at(-1),target=graph.nodes.find(n=>n.id===e.target);if(!boundary(end,target))issues.push(`arrow endpoint ${e.id}`);if(e.labelBox)for(const n of graph.nodes)if(overlap(e.labelBox,n))issues.push(`label overlap ${e.id}/${n.id}`);
 }
 return {issues,nodeCount:graph.nodes.length,edgeCount:graph.edges.length,groups:graph.groups.length,width:graph.width,height:graph.height};
});check('geometry and actual SVG text bounds',geometry.issues.length===0,geometry);
await page.locator('[data-node-id="output-mode"]').click();await idle();
check('node detail and source',await page.locator('#details').innerText().then(t=>t.includes('原始运行流程.svg:47')&&t.includes('Mermaid 需明确请求')));
await page.screenshot({path:dir+'1366-node-detail.png'});report.screenshots.push('1366-node-detail.png');
await page.getByRole('button',{name:'上游',exact:true}).click();await idle();
check('upstream highlighting',await page.locator('[data-node-id].bp-related').count()>=3);
await page.getByRole('button',{name:'下游',exact:true}).click();await idle();
check('downstream handles loop without duplicates',await page.locator('[data-node-id].bp-related').count()>=9,{count:await page.locator('[data-node-id].bp-related').count()});
await page.keyboard.press('Escape');check('Escape closes detail and restores node focus',await page.evaluate(()=>document.querySelector('#details').hidden&&document.activeElement.dataset.nodeId==='output-mode'));
const z0=(await brief()).transform.k;await page.locator('#zoom-in').click();await idle();const z1=(await brief()).transform.k;check('zoom button',z1>z0);
await page.locator('#fit').click();await idle();const fit=await brief();check('fit supports long diagram below 25 percent',fit.transform.k<0.25,{scale:fit.transform.k});
await page.locator('#zoom-in').click();await idle();check('continuous zoom from fit',(await brief()).transform.k>fit.transform.k);
const beforeDrag=(await brief()).transform;await page.mouse.move(100,260);await page.mouse.down();await page.mouse.move(220,330,{steps:5});await page.mouse.up();await idle();const afterDrag=(await brief()).transform;check('pan gesture changes view',afterDrag.x!==beforeDrag.x||afterDrag.y!==beforeDrag.y);check('drag does not select a node',await page.locator('#details').evaluate(e=>e.hidden));
await page.mouse.move(400,300);const beforeWheel=(await brief()).transform.k;await page.mouse.wheel(0,-120);await idle();check('wheel zoom',(await brief()).transform.k>beforeWheel);
await page.locator('#reset').click();await idle();
await page.locator('[data-group-toggle="input"]').focus();await page.keyboard.press('Enter');await idle();check('keyboard group collapse',(await brief()).collapsedGroups.includes('input'));
await page.locator('[data-group-toggle="input"]').focus();await page.keyboard.press('Space');await idle();check('keyboard group expand',!(await brief()).collapsedGroups.includes('input'));
await page.evaluate(async()=>{const p=[];for(let i=0;i<10;i++)p.push(window.blueprint.toggleGroup('extract'));await Promise.all(p);await window.blueprint.whenIdle();});const race=await brief();check('rapid group toggles settle consistently',race.revision===race.committedRevision&&!race.collapsedGroups.includes('extract'),{revision:race.revision,committedRevision:race.committedRevision});
await page.evaluate(()=>window.blueprint.toggleGroup('render'));await idle();check('group collapse reduces visible nodes',(await brief()).nodeCount<13);
await page.screenshot({path:dir+'1366-collapsed.png'});report.screenshots.push('1366-collapsed.png');
const beforeExport=await brief();const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadPromise;await download.saveAs(dir+'export-while-collapsed.svg');await idle();const afterExport=await brief();check('export leaves reading state unchanged',JSON.stringify(beforeExport)===JSON.stringify(afterExport));
const downloaded=fs.readFileSync(dir+'export-while-collapsed.svg','utf8');check('collapsed-view export contains all original nodes', (downloaded.match(/data-node-id=/g)||[]).length===13,{nodeCount:(downloaded.match(/data-node-id=/g)||[]).length});
await page.locator('#theme').click();await idle();await page.locator('#reset').click();await idle();check('reset restores groups and preserves theme',(await brief()).collapsedGroups.length===0&&(await brief()).theme==='dark'&&await page.locator('#details').evaluate(e=>e.hidden));
await page.locator('#theme').click();await idle();
await page.locator('[data-edge-id="revise-again"]').focus();await page.keyboard.press('Enter');await idle();check('feedback edge detail preserves assumption and source',await page.locator('#details').innerText().then(t=>t.includes('推定')&&t.includes('原始运行流程.svg:85')));await page.screenshot({path:dir+'1366-feedback-detail.png'});report.screenshots.push('1366-feedback-detail.png');await page.keyboard.press('Escape');
for(const [width,height] of [[1920,1080],[375,812]]){await page.setViewportSize({width,height});await page.reload();await page.evaluate(()=>window.blueprint.ready);await idle();const layout=await page.evaluate(()=>({viewport:window.innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,buttons:[...document.querySelectorAll('button')].filter(e=>e.offsetParent!==null).map(e=>({id:e.id,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}));check(`viewport ${width} no horizontal overflow`,layout.document<=width&&layout.body<=width&&layout.buttons.every(b=>b.left>=0&&b.right<=width+0.5),layout);await page.screenshot({path:dir+`${width}-initial.png`});report.screenshots.push(`${width}-initial.png`);if(width===375){await page.locator('[data-node-id="user-prompt"]').focus();await page.keyboard.press('Enter');await idle();check('mobile detail opens',!(await page.locator('#details').evaluate(e=>e.hidden)));await page.screenshot({path:dir+'375-detail.png'});report.screenshots.push('375-detail.png');await page.getByRole('button',{name:'关闭详情',exact:true}).click();check('mobile detail closes',await page.locator('#details').evaluate(e=>e.hidden));}}
check('offline no external requests',report.network.length===0,{externalRequests:report.network});check('no browser runtime errors',report.errors.length===0,{pageErrors:report.errors});
const nojs=await browser.newContext({javaScriptEnabled:false,offline:true,viewport:{width:1366,height:768}});const nojsPage=await nojs.newPage();await nojsPage.goto(new URL('./agent-runtime.html',import.meta.url).href);const noscriptText=await nojsPage.locator('body').innerText();check('no-JS model summary fallback',JSON.parse(fs.readFileSync(dir+'agent-runtime.diagram.json','utf8')).nodes.every(n=>noscriptText.includes(n.label))&&noscriptText.includes('JavaScript'),{text:noscriptText.slice(-700)});
await nojsPage.screenshot({path:dir+'1366-no-js.png'});report.screenshots.push('1366-no-js.png');
await page.setViewportSize({width:800,height:2800});await page.goto(new URL('./agent-runtime.svg',import.meta.url).href);const staticInfo=await page.evaluate(()=>({title:document.querySelector('svg').getAttribute('width'),width:document.documentElement.getAttribute('width'),height:document.documentElement.getAttribute('height'),nodes:document.querySelectorAll('[data-node-id]').length,text:document.documentElement.textContent,markerCount:document.querySelectorAll('[marker-end]').length}));check('standalone SVG title condition feedback and full graph',staticInfo.nodes===13&&staticInfo.markerCount===13&&staticInfo.text.includes('Agent Runtime')&&staticInfo.text.includes('Mermaid')&&staticInfo.text.includes('再次修订（推定）'),{width:staticInfo.width,height:staticInfo.height,nodeCount:staticInfo.nodes,arrows:staticInfo.markerCount});
await page.screenshot({path:dir+'svg-independent-open.png'});report.screenshots.push('svg-independent-open.png');
const png=fs.readFileSync(dir+'agent-runtime.png');check('PNG signature and dimensions',png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&png.readUInt32BE(16)===988&&png.readUInt32BE(20)===5286,{width:png.readUInt32BE(16),height:png.readUInt32BE(20),bytes:png.length});
}catch(e){report.failure=String(e);throw e;}finally{fs.writeFileSync(dir+'verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.checks.filter(c=>c.passed).length,failed:report.checks.filter(c=>!c.passed),failure:report.failure,screenshots:report.screenshots,errors:report.errors,network:report.network},null,2));await browser.close();}


