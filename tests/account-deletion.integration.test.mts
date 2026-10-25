import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile, access, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { startAccountDeletion, finishAccountDeletion } from '../lib/account-deletion';

test('account deletion is scoped, retryable, removes uploads and account data, and does not delete other users', {skip:!process.env.TEST_DATABASE_URL}, async()=>{
 if(process.env.DATABASE_URL!==process.env.TEST_DATABASE_URL)throw new Error('Use only an isolated test database');
 const id=crypto.randomUUID();
 const owner=await prisma.user.create({data:{clerkId:'delete-test-'+id,email:id+'@delete.test',name:'Delete test '+id}});
 const other=await prisma.user.create({data:{clerkId:'keep-test-'+id,email:id+'@keep.test',name:'Keep test '+id}});
 const file=crypto.randomUUID()+'.png';const blocked=crypto.randomUUID()+'.png';
 const uploadRoot=path.join(process.cwd(),'public','uploads');const filePath=path.join(uploadRoot,file);const blockedPath=path.join(uploadRoot,blocked);
 let receipt:Awaited<ReturnType<typeof startAccountDeletion>>|undefined;
 try {
  await mkdir(uploadRoot,{recursive:true});await writeFile(filePath,'test fixture');await mkdir(blockedPath);
  await prisma.uploadedAsset.createMany({data:[{filename:file,ownerClerkId:owner.clerkId},{filename:blocked,ownerClerkId:owner.clerkId}]});
  const owned=await prisma.workspace.create({data:{name:'Owned deletion fixture',creatorId:owner.id,doc:{create:{content:[{url:'/uploads/'+file}]}},canvas:{create:{}},tasks:{create:{title:'Delete this task'}},snapshots:{create:{label:'Owned version',authorName:owner.name!,authorId:owner.clerkId,generation:0}}}});
  const shared=await prisma.workspace.create({data:{name:'Other person workspace',creatorId:other.id,doc:{create:{}},canvas:{create:{}},members:{create:{userId:owner.id,role:'EDITOR'}},comments:{create:{body:'Remove authored comment',authorId:owner.clerkId,authorName:owner.name!}},snapshots:{create:{label:'Shared version',authorName:owner.name!,authorId:owner.clerkId,generation:0}}}});
  await prisma.agentPrompt.create({data:{ownerId:owner.clerkId,userId:owner.id,workspaceId:owned.id}});
  receipt=await startAccountDeletion(owner.clerkId);
  let identityCalls=0;
  await assert.rejects(()=>finishAccountDeletion(receipt!.jobId,'wrong',async()=>{identityCalls++;}),/Invalid deletion receipt/);assert.equal(identityCalls,0);
  await assert.rejects(()=>finishAccountDeletion(receipt!.jobId,receipt!.token,async()=>{identityCalls++;throw new Error('Provider unavailable');}),/Provider unavailable/);
  assert.ok(await prisma.user.findUnique({where:{id:owner.id}}));assert.ok(await prisma.workspace.findUnique({where:{id:owned.id}}));
  await assert.rejects(()=>finishAccountDeletion(receipt!.jobId,receipt!.token,async()=>{identityCalls++;}));
  assert.equal((await prisma.accountDeletion.findUniqueOrThrow({where:{id:receipt.jobId}})).providerDeleted,true);
  assert.ok(await prisma.user.findUnique({where:{id:owner.id}}));
  await rmdir(blockedPath);
  await finishAccountDeletion(receipt.jobId,receipt.token,async()=>{identityCalls++;});
  assert.equal(identityCalls,2,'identity deletion is not repeated after local cleanup fails');
  assert.equal(await prisma.user.findUnique({where:{id:owner.id}}),null);
  assert.equal(await prisma.workspace.findUnique({where:{id:owned.id}}),null);
  assert.equal(await prisma.workspaceComment.count({where:{authorId:owner.clerkId}}),0);
  assert.equal(await prisma.workspaceMember.count({where:{userId:owner.id}}),0);
  assert.equal(await prisma.agentPrompt.count({where:{userId:owner.id}}),0);
  assert.equal(await prisma.uploadedAsset.count({where:{ownerClerkId:owner.clerkId}}),0);
  assert.equal(await prisma.accountDeletion.findUnique({where:{id:receipt.jobId}}),null);
  assert.ok(await prisma.user.findUnique({where:{id:other.id}}));assert.ok(await prisma.workspace.findUnique({where:{id:shared.id}}));
  const snapshot=await prisma.workspaceSnapshot.findFirstOrThrow({where:{workspaceId:shared.id}});assert.equal(snapshot.authorName,'Deleted account');assert.equal(snapshot.authorId,null);
  await assert.rejects(()=>access(filePath));
  assert.deepEqual(await finishAccountDeletion(receipt.jobId,receipt.token,async()=>{throw new Error('Must not call provider twice');}),{done:true});
 } finally {
  await prisma.accountDeletion.deleteMany({where:{clerkId:owner.clerkId}});
  await prisma.user.deleteMany({where:{id:{in:[owner.id,other.id]}}});
  await prisma.uploadedAsset.deleteMany({where:{ownerClerkId:owner.clerkId}});
  await unlink(filePath).catch(()=>{});await rmdir(blockedPath).catch(()=>{});await prisma.$disconnect();
 }
});
