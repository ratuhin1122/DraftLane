import assert from "node:assert/strict";
import { test } from "node:test";
import * as Y from "yjs";
import { WorkspaceSync } from "../lib/workspace-sync";
import { toBase64, fromBase64 } from "../lib/base64";

const browser = new EventTarget() as EventTarget & { location: { reload(): void } };
let reloads = 0;
browser.location = { reload: () => { reloads++; } };
Object.defineProperty(globalThis,"window",{configurable:true,value:browser});
Object.defineProperty(globalThis,"navigator",{configurable:true,value:{onLine:false}});
const originalFetch = globalThis.fetch;

test("offline changes remain queued and persist after reconnect",async()=>{
 const doc=new Y.Doc();let cached='';let writes=0;const server=new Y.Doc();
 globalThis.fetch=async(_input,init)=>{
  assert.equal(init?.method,'POST');writes++;
  const body=JSON.parse(String(init?.body));Y.applyUpdate(server,fromBase64(body.state));
  return Response.json({state:toBase64(Y.encodeStateAsUpdate(server))});
 };
 const sync=new WorkspaceSync('test','canvas',0,doc,state=>{cached=state;});
 try {
  doc.getMap('objects').set('arrow',{x:40});
  await assert.rejects(()=>sync.flush());assert.equal(writes,0);
  const recovered=new Y.Doc();Y.applyUpdate(recovered,fromBase64(cached));assert.deepEqual(recovered.getMap('objects').get('arrow'),{x:40});recovered.destroy();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
  await sync.flush();assert.equal(writes,1);assert.deepEqual(server.getMap('objects').get('arrow'),{x:40});
 } finally {sync.destroy();doc.destroy();server.destroy();globalThis.fetch=originalFetch;}
});
test("read-only viewers never post updates",async()=>{
 const doc=new Y.Doc();let writes=0;
 globalThis.fetch=async(_input,init)=>{if(init?.method==='POST')writes++;return Response.json({generation:0,doc:null,canvas:null});};
 const sync=new WorkspaceSync('viewer','canvas',0,doc,()=>{},true);
 try {doc.getMap('objects').set('unauthorized','local only');await sync.flush();assert.equal(writes,0);}
 finally {sync.destroy();doc.destroy();globalThis.fetch=originalFetch;}
});
test("stale-generation rejection reloads instead of retrying an obsolete save",async()=>{
 const doc=new Y.Doc();let writes=0;
 globalThis.fetch=async()=>{writes++;return new Response('Workspace restored',{status:409});};
 const sync=new WorkspaceSync('restored','canvas',0,doc,()=>{});
 try {await assert.rejects(()=>sync.flush());await sync.flush();assert.equal(writes,1);assert.equal(reloads,1);}
 finally {sync.destroy();doc.destroy();globalThis.fetch=originalFetch;}
});
