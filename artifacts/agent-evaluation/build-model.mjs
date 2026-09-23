import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('.',import.meta.url));
const source = (line) => [{ path: '原始运行流程.svg', line }];
const records = [
 ['user-prompt','start','用户请求','代码仓库、规格、Mermaid 或自然语言','User Prompt','Codebase, spec, Mermaid, or plain-language request',35,'input'],
 ['skill-trigger','process','触发 Skill','识别架构、拓扑与流程意图','Skill Trigger','Detect architecture, topology, flow, or blueprint intent',39,'input'],
 ['scope-decision','process','选择图的范围','总览、运行流程、记忆、部署或对比','Scope Decision','Overview, runtime, memory flow, deployment, compare',43,'input'],
 ['output-mode','process','确定输出形式','默认 HTML + SVG；Mermaid 需明确请求','Output Mode','HTML + SVG first, Mermaid only when explicitly needed',47,'input'],
 ['model-extraction','process','提取结构模型','识别节点、分组、边界和关系','Model Extraction','Identify nodes, groups, boundaries, and flows',53,'extract'],
 ['system-simplification','process','简化系统表达','将细节整理为有意义的层次','System Simplification','Collapse noisy details into meaningful layers',57,'extract'],
 ['visual-grammar','process','应用视觉语法','用样式区分语义角色','Visual Grammar','Map roles to semantic color and card styles',61,'extract'],
 ['template-composition','process','编排图面内容','组织标题、图例、节点与场景','Template Composition','Inject title, legend, cards, and diagram scene',67,'render'],
 ['svg-rendering','process','渲染 SVG','布局节点、路径、分组与标签','SVG Rendering','Place nodes, routes, groups, and labels cleanly',71,'render'],
 ['self-contained-file','process','生成自包含文件','内嵌样式与图形，支持离线阅读','Self-contained File','Inline CSS, inline SVG, no external runtime required',75,'render'],
 ['readme-docs','process','放入 README / 文档','用于仓库、RFC、内部文档与演示','README / Docs','Use in repositories, RFCs, internal docs, and demos',81,'deliver'],
 ['feedback-loop','process','收集反馈','增补组件、修订流程、调整重点','Feedback Loop','Add components, revise flow, change visual emphasis',85,'deliver'],
 ['iterated-output','process','交付迭代结果','保持视觉语言，持续完善内容','Iterated Output','Keep the same visual language while refining content',89,'deliver']
];
const nodes = records.map(([id,kind,label,summary,original,copy,line,groupId]) => ({id,kind,label,summary,details:`原图节点：${original}\n原文说明：${copy}\n依据仅证明该概念出现在原图，不证明已有运行时实现。`+(id==='scope-decision'?'\n原图未给出各范围的条件或出口，因此保留为选择步骤，不虚构条件分支。':'')+(id==='output-mode'?'\n条件已保留在可见摘要：默认采用 HTML + SVG；只有用户明确要求时使用 Mermaid。原图没有描述 Mermaid 分支的后续执行差异，因此不增加跳过渲染等路径。':'')+(id==='feedback-loop'?'\n原图只画出了到 Iterated Output 的顺序连线，没有明确反馈返回哪个步骤。额外回边使用 assumed 状态并显示“推定”。':''),groupId,evidenceStatus:'confirmed',sources:source(line)}));
const edgeLines=[94,95,96,98,99,100,102,103,104,106,107,108];
const edges=records.slice(0,-1).map((record,i)=>({id:`step-${String(i+1).padStart(2,'0')}`,source:record[0],target:records[i+1][0],kind:'control',directed:true,details:'原图存在此连接，但没有箭头。方向按四个阶段的编号与从左至右阅读顺序解释，属于重绘时的方向推定。',evidenceStatus:'assumed',sources:source(edgeLines[i])}));
edges.push({id:'revise-again',source:'iterated-output',target:'model-extraction',kind:'feedback',directed:true,label:'再次修订（推定）',details:'原图包含 Feedback Loop 和 Iterated Output 概念，但没有画出回边。本图将再次修订返回到 Model Extraction，以表达重新调整组件或流程的循环；返回位置与触发条件均为推定，尚无代码或规格依据。无需继续修改时，可在迭代结果处结束本轮。',evidenceStatus:'assumed',sources:source(85)});
const doc={schemaVersion:'2.0',id:'agent-runtime-from-request-to-diagram',title:'Agent Runtime · 从请求到系统图',description:'依据原图重建；箭头方向按阅读顺序解释，虚线反馈回边为推定。未验证代码实现。',view:{kind:'flow',direction:'DOWN',theme:'light',primaryPath:edges.slice(0,12).map(e=>e.id)},groups:[{id:'input',label:'1 · 输入与范围',details:'原图第 28 行：1. Input。此边界表示工作阶段，不代表部署隔离。'},{id:'extract',label:'2 · 提取与规范',details:'原图第 29 行：2. Extract & Normalize。'},{id:'render',label:'3 · 编排与渲染',details:'原图第 30 行：3. Compose & Render。'},{id:'deliver',label:'4 · 交付与迭代',details:'原图第 31 行：4. Deliver & Iterate。'}],nodes,edges};
fs.writeFileSync(`${root}/agent-runtime.diagram.json`,JSON.stringify(doc,null,2)+'\n','utf8');
console.log(`Created ${nodes.length} nodes, ${edges.length} edges, ${doc.groups.length} groups`);

