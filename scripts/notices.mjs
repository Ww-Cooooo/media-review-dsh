import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),meta=JSON.parse(await fs.readFile(path.join(root,'artifacts/client-build.json'),'utf8'));
const roots=new Set();
for(const input of Object.keys(meta.inputs)){const normalized=input.replaceAll('\\','/'),match=normalized.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);if(match)roots.add(path.resolve(root,match[1]));}
for(const font of ['noto-sans-sc','jetbrains-mono'])roots.add(path.join(root,'node_modules/@fontsource-variable',font));
const destination=path.join(root,'THIRD_PARTY_LICENSES');await fs.mkdir(destination,{recursive:true});
const rows=[];
for(const folder of [...roots].sort()){
  const pkg=JSON.parse(await fs.readFile(path.join(folder,'package.json'),'utf8'));
  let names=(await fs.readdir(folder)).filter(n=>/^(licen[cs]e|copying|notice|ofl)(\.|$)/i.test(n));
  const prefix=pkg.name.replaceAll('/','__').replace('@','');
  if(!names.length){
    // Preserve the actual distributed declarations rather than invent authors or dates.
    await fs.copyFile(path.join(folder,'package.json'),path.join(destination,prefix+'-package.json'));
    if(pkg.name==='@ant-design/icons-svg')await fs.copyFile(path.join(root,'node_modules/@ant-design/icons/LICENSE'),path.join(destination,prefix+'-LICENSE'));
    else if(pkg.name==='is-mobile'){const readme=await fs.readFile(path.join(folder,'README.md'),'utf8');await fs.writeFile(path.join(destination,prefix+'-LICENSE'),readme.slice(readme.indexOf('## License')));}
    else if(['gsap','@gsap/react'].includes(pkg.name)){const source=await fs.readFile(path.join(folder,pkg.name==='gsap'?'dist/gsap.js':'dist/index.js'),'utf8');await fs.writeFile(path.join(destination,prefix+'-NOTICE.txt'),source.match(/\/\*![\s\S]*?\*\//)?.[0]||'See https://gsap.com/standard-license/');}
    else if(['@antv/g-lite','@antv/event-emitter'].includes(pkg.name))await fs.writeFile(path.join(destination,prefix+'-NOTICE.txt'),`${pkg.name} ${pkg.version}\nUpstream package declares MIT. The distributed package and its source repository contain no separate license file. Original declaration is preserved in the adjacent package.json. Existing source notices are retained in the bundle. The MIT permission text is included in MIT-permission.txt.\n`);
    else throw new Error(`Missing bundled license: ${pkg.name}`);
  }
  for(const name of names)await fs.copyFile(path.join(folder,name),path.join(destination,prefix+'-'+name));
  rows.push(`| ${pkg.name} | ${pkg.version} | ${pkg.license||'See included license'} |`);
}
await fs.copyFile(path.join(root,'src/vendor/LICENSE'),path.join(destination,'media-review-LICENSE'));
const mit=await fs.readFile(path.join(root,'node_modules/@antv/g-canvas/LICENSE'),'utf8');await fs.writeFile(path.join(destination,'MIT-permission.txt'),mit.slice(mit.indexOf('Permission is hereby granted')));
const notices=`# Third-party notices\n\nThis package is a community DeepSeek Harness plugin. The application source is MIT; bundled dependencies retain their own licenses. Available license/notice files and declarations are in THIRD_PARTY_LICENSES/. React and official Harness services are provided by the installed host and are not bundled.\n\n## Reused Media Review modules\n\nSource: https://github.com/Ww-Cooooo/media-review, commit 5572013d5a7aa9a2d299a97c989be114a573a0e9, MIT. Reused runtime.mjs, review-record.mjs, review-workflow.mjs, review-tasks.mjs, review-progress.mjs and review-reference.mjs. Adaptations: frozen-revision/round-scoped progress, idempotent event receipts, human review history, and the separate eh3-media-review/annotations-v1 format with reference-frame provenance. The original source repository was not modified.\n\n## GSAP\n\nGSAP 3.15.1 and @gsap/react 2.1.2 both declare the Standard No Charge license, not MIT. Official terms: https://gsap.com/standard-license/ . Their distributed copyright/license headers are preserved. No reference-demo code or assets were copied.\n\n## Bundled UI packages and fonts\n\n| Package | Version | License declaration |\n| --- | --- | --- |\n${rows.join('\n')}\n\nNoto Sans SC Variable and JetBrains Mono Variable are served locally with their original SIL Open Font License texts; font files have not been modified. @antv/g-lite and @antv/event-emitter declare MIT but omit standalone license files in their distributions and repositories; original metadata and the MIT permission text are retained explicitly. The icons-svg notice is the matching Ant Design Icons repository license.\n`;
await fs.writeFile(path.join(root,'THIRD_PARTY_NOTICES.md'),notices+"\n## Local setup speech and optional tools\n\n`lib/assets/setup-speech.wav` is project-generated Chinese synthetic speech: “这是字幕测试。今天我们一起检查声音和画面。” It contains no user recording. It was generated with Windows SAPI / Microsoft Huihui Desktop; no Microsoft speech engine is redistributed.\n\nOptional runtime tools are downloaded separately, only on the user's preparation action. Their release licenses remain with the downloaded files. Fixed download specifications are in `src/tool-pins.json`: [FFmpeg 9.0.2 Gyan build](https://github.com/GyanD/codexffmpeg/releases/tag/9.0.2), [whisper.cpp 1.7.6](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.7.6), and [multilingual Whisper small model](https://huggingface.co/ggerganov/whisper.cpp/tree/5359861c739e955e79d9a303bcbc70fb988958b1). These executables and model weights are not bundled in this tgz.\n");console.log(JSON.stringify({bundledPackages:rows.length,licenseFiles:(await fs.readdir(destination)).length}));
