import assert from "node:assert/strict";
import { test } from "node:test";
import * as Y from "yjs";
import { canvasFromCrdt, updateCanvasCrdt, mergeCanvasStates, type CanvasSnapshot } from "../lib/canvas-crdt";
import { permits } from "../lib/workspace-permissions";

function seed() {
 const doc = new Y.Doc();
 updateCanvasCrdt(doc,{document:{schema:{version:1},store:{shared:{id:"shared",x:0},remove:{id:"remove",x:0}}}});
 return doc;
}
test("three offline clients converge on conflicting moves, deletions and separate additions regardless of reconnect order",()=>{
 const base=seed(); const state=Y.encodeStateAsUpdate(base);
 const clients=[0,1,2].map(i=>{const doc=new Y.Doc();Y.applyUpdate(doc,state);doc.getMap<string>('records').set('shared',JSON.stringify({id:'shared',x:(i+1)*100}));doc.getMap<string>('records').set('new-'+i,JSON.stringify({id:'new-'+i,x:i}));return doc;});
 clients[1].getMap('records').delete('remove');
 const updates=clients.map(doc=>Y.encodeStateAsUpdate(doc));
 const orders=[[0,1,2],[2,1,0],[1,0,2],[1,2,0],[0,2,1],[2,0,1]];
 let expected: unknown;
 for(const order of orders){const server=new Y.Doc();Y.applyUpdate(server,state);for(const i of order)Y.applyUpdate(server,updates[i]);const snapshot=canvasFromCrdt(server)!;const stable=Object.entries(snapshot.document.store).sort(([a],[b])=>a.localeCompare(b));if(!expected)expected=stable;else assert.deepEqual(stable,expected);assert.equal('remove' in snapshot.document.store,false);for(let i=0;i<3;i++)assert.ok('new-'+i in snapshot.document.store);for(const client of clients){Y.applyUpdate(client,Y.encodeStateAsUpdate(server));assert.deepEqual(Object.entries(canvasFromCrdt(client)!.document.store).sort(([a],[b])=>a.localeCompare(b)),stable);}server.destroy();}
 clients.forEach(doc=>doc.destroy());base.destroy();
});
test("canvas merge preserves independent records instead of replacing an entire snapshot",()=>{
 const base=seed();const a=new Y.Doc();const b=new Y.Doc();Y.applyUpdate(a,Y.encodeStateAsUpdate(base));Y.applyUpdate(b,Y.encodeStateAsUpdate(base));
 a.getMap<string>('records').set('one','{"x":1}');b.getMap<string>('records').set('two','{"x":2}');const merged=mergeCanvasStates(Y.encodeStateAsUpdate(a),Y.encodeStateAsUpdate(b));assert.ok(merged.snapshot?.document.store.one);assert.ok(merged.snapshot?.document.store.two);[base,a,b].forEach(doc=>doc.destroy());
});
test("role matrix denies unauthorized writes and access management",()=>{
 assert.equal(permits(null,'view'),false);assert.equal(permits('VIEWER','view'),true);assert.equal(permits('VIEWER','comment'),false);assert.equal(permits('COMMENTER','comment'),true);assert.equal(permits('COMMENTER','edit'),false);assert.equal(permits('EDITOR','edit'),true);assert.equal(permits('EDITOR','manage'),false);assert.equal(permits('MANAGER','manage'),true);
});
test("a 1000-object canvas round trips through CRDT state",()=>{
 const snapshot:CanvasSnapshot={document:{schema:{version:1},store:Object.fromEntries(Array.from({length:1000},(_,i)=>['shape:'+i,{id:'shape:'+i,x:i*10,y:i}]))}};
 const doc=new Y.Doc();const start=performance.now();updateCanvasCrdt(doc,snapshot);const reopened=new Y.Doc();Y.applyUpdate(reopened,Y.encodeStateAsUpdate(doc));assert.deepEqual(canvasFromCrdt(reopened),snapshot);console.log(`1000-object CRDT encode/merge/decode: ${Math.round(performance.now()-start)} ms`);doc.destroy();reopened.destroy();
});
