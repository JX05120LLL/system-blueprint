import { chromium } from './evaluation-env.mjs';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1366,height:768}});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto(new URL('./agent-runtime.html',import.meta.url).href);
await page.evaluate(async()=>{await window.blueprint.ready;await window.blueprint.whenIdle();});
console.log(JSON.stringify(await page.evaluate(()=>({title:document.title,api:Object.keys(window.blueprint),buttons:Array.from(document.querySelectorAll('button')).map(x=>({text:x.textContent,label:x.getAttribute('aria-label'),id:x.id})),svg:document.querySelector('svg')?.outerHTML.slice(0,3500),body:document.body.innerText.slice(0,2500)})),null,2));
await page.screenshot({path:new URL('./1366-initial.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
console.log(JSON.stringify({errors}));
await browser.close();

