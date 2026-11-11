import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),meta=JSON.parse(await fs.readFile(path.join(root,'artifacts/client-build.json'),'utf8')),roots=new Set();
for(const input of Object.keys(meta.inputs)){const m=input.replaceAll('\\','/').match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);if(m)roots.add(path.resolve(root,m[1]));}
for(const folder of roots){const p=JSON.parse(await fs.readFile(path.join(folder,'package.json'),'utf8')),files=(await fs.readdir(folder)).filter(n=>/^(licen[cs]e|copying|notice|ofl)(\.|$)/i.test(n));if(!files.length)console.log(JSON.stringify({name:p.name,version:p.version,license:p.license,repository:p.repository}));}
