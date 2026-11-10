/** Fictional guardian enrollment simulator. NOT custody verification or account creation. */
import {DEMO_GUARDIANS} from './family.mjs';
export const initialDemoGuardians=()=>DEMO_GUARDIANS.map(g=>({...g,learnerIds:[...g.learnerIds]}));
const owned=id=>typeof id==='string'&&/^guardian-demo-\d+$/.test(id);
export function addDemoGuardian(guardians,name){
  if(typeof name!=='string')throw Error('Enter a fictional guardian name');
  const clean=name.trim().replace(/\s+/g,' ');
  if(clean.length<12||clean.length>60||!/^Sample Guardian [a-z0-9 -]+$/i.test(clean))
    throw Error('Use a fictional name beginning with Sample Guardian');
  if(guardians.some(g=>g.name.toLowerCase()===clean.toLowerCase()))throw Error('Sample guardian name already exists');
  if(guardians.length>=3000)throw Error('Sample guardian directory limit');
  const used=new Set(guardians.map(g=>g.id));let n=1;
  while(used.has('guardian-demo-'+n))n++;
  return [...guardians,{id:'guardian-demo-'+n,name:clean,learnerIds:[],active:true}];
}
export function linkDemoChild(guardians,guardianId,learnerId,learners){
  const guardian=guardians.find(g=>g.id===guardianId);
  if(!guardian||!owned(guardianId)||guardian.active===false)
    throw Error('Choose an active, newly created fictional guardian');
  if(!learners.some(l=>l.id===learnerId&&l.active!==false))throw Error('Choose an active fictional learner');
  if(guardian.learnerIds.includes(learnerId))throw Error('Fictional child already linked');
  if(guardian.learnerIds.length>=20)throw Error('Sample guardian child link limit');
  return guardians.map(g=>g.id===guardianId?{...g,learnerIds:[...g.learnerIds,learnerId]}:g);
}
export function unlinkDemoChild(guardians,guardianId,learnerId){
  const guardian=guardians.find(g=>g.id===guardianId);
  if(!guardian||!owned(guardianId))throw Error('Only newly added fictional guardian links may be changed');
  if(!guardian.learnerIds.includes(learnerId))throw Error('Child link not found');
  return guardians.map(g=>g.id===guardianId?{...g,learnerIds:g.learnerIds.filter(id=>id!==learnerId)}:g);
}
export function setDemoGuardianActive(guardians,guardianId,active){
  if(typeof active!=='boolean')throw Error('Invalid status');
  const guardian=guardians.find(g=>g.id===guardianId);
  if(!guardian||!owned(guardianId))throw Error('Only newly added fictional guardians can change status');
  if(!active&&guardian.learnerIds.length)throw Error('Unlink fictional children before deactivating guardian');
  return guardians.map(g=>g.id===guardianId?{...g,active}:g);
}
