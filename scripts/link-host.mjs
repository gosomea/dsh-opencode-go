/** Development-only links to one built Harness checkout; not shipped as an installer. */
import { readdir, readFile, mkdir, symlink, lstat, unlink, realpath } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { createRequire } from 'node:module'
const host=resolve(process.argv[2] ?? '')
if (!process.argv[2]) throw new Error('Usage: node scripts/link-host.mjs /absolute/built/harness')
const manifest=JSON.parse(await readFile('package.json','utf8'))
const packages=new Map()
for(const root of ['vendor','packages']) for(const group of await readdir(join(host,root),{withFileTypes:true})) {
 if(!group.isDirectory())continue
 const paths=root==='vendor'?[join(host,root,group.name)]: (await readdir(join(host,root,group.name),{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>join(host,root,group.name,x.name))
 for(const path of paths) {try { const m=JSON.parse(await readFile(join(path,'package.json'),'utf8'));packages.set(m.name,path) } catch(e) {if(e.code!=='ENOENT')throw e} }
}
const rootReq=createRequire(join(host,'package.json'))
const piReq=createRequire(join(host,'packages/llm/llm-pi-ai/package.json'))
const reactReq=createRequire(join(host,'packages/client/ui-settings-models/package.json'))
async function link(name,target){const dest=resolve('node_modules',name);await mkdir(dirname(dest),{recursive:true});try {const s=await lstat(dest);if(!s.isSymbolicLink())throw new Error('Refusing to replace '+dest);await unlink(dest)}catch(e){if(e.code!=='ENOENT')throw e}await symlink(target,dest)}
for(const name of Object.keys({...manifest.peerDependencies,...manifest.dependencies,...manifest.devDependencies})) {
 let target=packages.get(name)
 if(!target) for(const req of [rootReq,piReq,reactReq]) {try {target=dirname(req.resolve(name+'/package.json'));break}catch {}}
 if(!target) for(const base of [host,join(host,'packages/llm/llm-pi-ai'),join(host,'packages/client/ui-settings-models')]) { try {target=await realpath(join(base,'node_modules',name));break}catch {}}
 if(!target)throw new Error('Host dependency not found: '+name)
 await link(name,await realpath(target))
}
await link('.bin',join(host,'node_modules/.bin'))
console.log('Linked development dependencies to '+host)
