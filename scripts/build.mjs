import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import ts from 'typescript';
import { WorkspaceAnalyzer, FaceModelEmitter, writePackageArtifacts } from '@deepseek-ai/dsh-typert-generator';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
await fs.mkdir(path.join(root,'dist'),{recursive:true});
const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
// The official generator currently discovers projects beneath packages/. Keep
// its build-only workspace inside this package; no parent/sibling workspace.
const stage = path.join(root, '.build/typert');
if (path.dirname(stage) !== path.join(root, '.build')) throw new Error('Unsafe build stage');
await fs.rm(stage,{recursive:true,force:true});
const pkg = path.join(stage, 'packages/media-review');
await fs.mkdir(pkg, { recursive: true });
await fs.cp(path.join(root, 'src'), path.join(pkg, 'src'), { recursive: true });
await fs.writeFile(path.join(pkg, 'package.json'), JSON.stringify(manifest));
const config = JSON.parse(await fs.readFile(path.join(root, 'tsconfig.json'), 'utf8'));
// Register the exact official protocol declaration package in the compiler's
// inventory. The published analyzer identifies decorators via that inventory;
// an unregistered npm declaration alone is silently ignored by 0.2.2-rc.1.
const protocol = path.join(stage, 'packages/protocol');
await fs.mkdir(protocol, {recursive:true});
const protocolTypes=path.join(root,'node_modules/@deepseek-ai/dsh-typert-protocol/lib/types');
await fs.mkdir(path.join(protocol,'src'),{recursive:true});
for(const name of await fs.readdir(protocolTypes)) if(name.endsWith('.d.ts')) await fs.copyFile(path.join(protocolTypes,name),path.join(protocol,'src',name.replace('.d.ts','.ts')));
const protocolManifest=JSON.parse(await fs.readFile(path.join(root,'node_modules/@deepseek-ai/dsh-typert-protocol/package.json'),'utf8'));
protocolManifest.exports={'.':'./src/index.ts','./types':'./src/types.ts','./remote-info':'./src/remote-info.ts'};
await fs.writeFile(path.join(protocol,'package.json'),JSON.stringify(protocolManifest));
await fs.writeFile(path.join(protocol,'tsconfig.json'),JSON.stringify({compilerOptions:config.compilerOptions,include:['src/**/*.ts']}));
config.compilerOptions.paths={'@deepseek-ai/dsh-typert-protocol':['../protocol/src/index.ts']};
await fs.writeFile(path.join(pkg, 'tsconfig.json'), JSON.stringify(config));
await fs.writeFile(path.join(stage, 'tsconfig.host.json'), JSON.stringify({files:[],compilerOptions:{...config.compilerOptions,paths:{'@deepseek-ai/dsh-typert-protocol':['./packages/protocol/src/index.ts']}},references:[{path:'./packages/media-review'},{path:'./packages/protocol'}]}));
const model=new WorkspaceAnalyzer({root:stage,packages:[manifest.name],faces:['host']}).analyze();
const artifacts=model.faces.flatMap(face=>face.packages.filter(p=>p.name===manifest.name).map(p=>({...new FaceModelEmitter(face).emit(p.name),packageRoot:p.root})));
if (!artifacts.length) throw new Error('Official generator produced no Host artifacts');
writePackageArtifacts(root, artifacts);
const declarations=ts.createProgram([path.join(root,'src/types.ts')],{declaration:true,emitDeclarationOnly:true,outDir:path.join(root,'lib/types'),target:ts.ScriptTarget.ES2024,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,skipLibCheck:true});
const declarationResult=declarations.emit();
const declarationErrors=ts.getPreEmitDiagnostics(declarations).concat(declarationResult.diagnostics).filter(d=>d.category===ts.DiagnosticCategory.Error);
if(declarationErrors.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(declarationErrors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
await build({entryPoints:[path.join(root,'src/types.ts')],outfile:path.join(root,'lib/types.js'),format:'esm',platform:'neutral'});
await fs.mkdir(path.join(root,'lib/assets'),{recursive:true});
await fs.copyFile(path.join(root,'src/assets/setup-speech.wav'),path.join(root,'lib/assets/setup-speech.wav'));
let fontCss='';
for(const family of ['noto-sans-sc','jetbrains-mono']) {
  const directory=path.join(root,'node_modules/@fontsource-variable',family);
  const css=await fs.readFile(path.join(directory,'index.css'),'utf8');
  fontCss+=css.replaceAll(/url\(\.\/files\/([^)]*)\)/g,(_,name)=>`url("/api/eh3-media-review/asset?file=${name}")`);
  for(const match of css.matchAll(/url\(\.\/files\/([^)]*)\)/g))await fs.copyFile(path.join(directory,'files',match[1]),path.join(root,'lib/assets',match[1]));
}
await fs.writeFile(path.join(root,'src/fonts.generated.css'),fontCss);
await build({entryPoints:[path.join(root,'src/index.ts')],outfile:path.join(root,'lib/index.js'),bundle:true,platform:'node',format:'esm',target:'node24',packages:'external',sourcemap:false});
const client=await build({entryPoints:[path.join(root,'src/client.jsx')],bundle:true,platform:'browser',format:'cjs',target:'chrome120',external:['react','react/jsx-runtime','react-dom','react-dom/client','@deepseek-ai/cordis'],loader:{'.css':'text'},define:{'process.env.NODE_ENV':'"production"','__MR_PREVIEW__':process.env.MR_PREVIEW==='1'?'true':'false'},minify:true,metafile:true,write:false});
await fs.writeFile(path.join(root,'artifacts/client-build.json'),JSON.stringify(client.metafile));
await fs.writeFile(path.join(root,'lib/client.js'),`window.__ModuleLoader__.load({id:${JSON.stringify(manifest.name)},factory(require){const module={exports:{}};const exports=module.exports;\n${client.outputFiles[0].text}\nreturn module.exports;}});\n`);
console.log('Built Host and official generated Remote artifacts:', artifacts.map(a=>a.package));
