import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root=process.cwd();
async function files(dir){const rows=await readdir(dir,{withFileTypes:true});return(await Promise.all(rows.map(async row=>row.isDirectory()?files(join(dir,row.name)):[join(dir,row.name)]))).flat();}
const appFiles=await files(join(root,'app'));
const sourceFiles=[...appFiles,...await files(join(root,'components'))].filter(file=>/\.(tsx|ts)$/.test(file));
const routes=appFiles.filter(file=>/(page|route)\.tsx?$/.test(file)).map(file=>{
  const relativeRoute=relative(join(root,'app'),file).replace(/(^|\/)(page|route)\.tsx?$/,'').replace(/\/\([^/]+\)/g,'');
  const route='/'+relativeRoute.replace(/\[\.\.\.[^\]]+\]/g,'.+').replace(/\[[^\]]+\]/g,'[^/]+');
  return new RegExp(`^${route==='/'?'/':route}/?$`);
});
const found=new Map();
for(const file of sourceFiles){
  if(file.includes('/app/admin/')||file.includes('/components/admin-'))continue;
  const source=await readFile(file,'utf8');
  for(const match of source.matchAll(/["'`]\/(?!\/)[A-Za-z0-9_?=&#%./+-]*/g)){
    const raw=match[0].slice(1),path=raw.split(/[?#]/)[0];
    if(!path||path.startsWith('/admin')||path.startsWith('/_next')||/\.[a-z0-9]{2,5}$/i.test(path))continue;
    const locations=found.get(path)??[];locations.push(relative(root,file));found.set(path,locations);
  }
}
const missing=[...found].filter(([path])=>!routes.some(route=>route.test(path)||(path.endsWith('/')&&route.test(`${path}linked-value`))));
if(missing.length){console.error('Broken customer routes found:');for(const[path,locations]of missing)console.error(`- ${path} (${[...new Set(locations)].join(', ')})`);process.exit(1);}
console.log(`Customer route audit passed: ${found.size} linked paths resolve to application routes.`);
