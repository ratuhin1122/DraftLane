import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Y from 'yjs';
import { prisma } from '../lib/prisma';
import { persistCanvas, persistDoc, ensureCanvasState, ensureDocState, STALE_WORKSPACE } from '../lib/workspace-persistence';
import { updateCanvasCrdt } from '../lib/canvas-crdt';
import { writeSnapshot, restoreSnapshot } from '../lib/workspace-history';

test('database: merged docs and canvas survive saves, snapshots restore tasks, and stale clients cannot overwrite restore', { skip: !process.env.TEST_DATABASE_URL }, async()=>{
 if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error('Use the isolated TEST_DATABASE_URL as DATABASE_URL for integration tests.');
 const user=await prisma.user.create({data:{clerkId:'integration-'+crypto.randomUUID(),email:crypto.randomUUID()+'@draftlane.test',name:'Integration test'}});
 try {
  const workspace=await prisma.workspace.create({data:{name:'Isolated integration fixture',creatorId:user.id,doc:{create:{}},canvas:{create:{}}}});
  await ensureCanvasState(workspace.id);
  await Promise.all([ensureDocState(workspace.id), ensureDocState(workspace.id)]);
  assert.ok((await prisma.doc.findUniqueOrThrow({where:{workspaceId:workspace.id}})).yjsState);
  const doc=new Y.Doc();
  const seeded=await prisma.doc.findUniqueOrThrow({where:{workspaceId:workspace.id}});
  Y.applyUpdate(doc,seeded.yjsState!);
  const group=doc.getXmlFragment('document-store').get(0) as Y.XmlElement;
  const container=group.get(0) as Y.XmlElement;
  const paragraph=container.get(0) as Y.XmlElement;
  paragraph.insert(0,[new Y.XmlText('Original plan')]);
  await persistDoc(workspace.id,Y.encodeStateAsUpdate(doc),0);
  const first=await prisma.doc.findUniqueOrThrow({where:{workspaceId:workspace.id}});assert.ok(JSON.stringify(first.content).includes('Original plan'));
  const canvas=new Y.Doc();updateCanvasCrdt(canvas,{document:{schema:{version:1},store:{'shape:a':{id:'shape:a',x:0}}}});
  await persistCanvas(workspace.id,Y.encodeStateAsUpdate(canvas),0);
  await prisma.workspaceComment.create({data:{workspaceId:workspace.id,authorId:user.clerkId,authorName:'Integration',body:'Keep this discussion',surface:'CANVAS',anchorId:'shape:a'}});
  await prisma.workspaceTask.create({data:{workspaceId:workspace.id,title:'Build original task',status:'DONE'}});
  const snapshot=await prisma.$transaction(tx=>writeSnapshot(tx,workspace.id,'Version one','Integration'));
  canvas.getMap<string>('records').set('shape:a','{"id":"shape:a","x":900}');await persistCanvas(workspace.id,Y.encodeStateAsUpdate(canvas),0);
  await prisma.workspaceTask.updateMany({where:{workspaceId:workspace.id},data:{status:'TODO'}});
  await prisma.$transaction(tx=>restoreSnapshot(tx,workspace.id,snapshot.id,'Integration'));
  const restored=await prisma.workspace.findUniqueOrThrow({where:{id:workspace.id},include:{canvas:true,tasks:true,snapshots:true}});
  assert.equal(await prisma.workspaceComment.count({where:{workspaceId:workspace.id}}),1);
  assert.equal(restored.generation,1);assert.ok(JSON.stringify(restored.canvas?.content).includes('"x":0'));assert.equal(restored.tasks[0].status,'DONE');assert.ok(restored.snapshots.some(s=>s.label==='Before restoring a version'));
  await assert.rejects(()=>persistCanvas(workspace.id,Y.encodeStateAsUpdate(canvas),0),new RegExp(STALE_WORKSPACE));
  await assert.rejects(()=>persistDoc(workspace.id,Y.encodeStateAsUpdate(doc),0),new RegExp(STALE_WORKSPACE));
  doc.destroy();canvas.destroy();
 } finally {await prisma.user.delete({where:{id:user.id}});await prisma.$disconnect();}
});
