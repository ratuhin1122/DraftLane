import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client';
import { prisma } from '../lib/prisma';

const run=promisify(execFile);
test('a PostgreSQL dump and companion upload can actually be restored into a separate database', {skip:!process.env.TEST_DATABASE_URL,timeout:120000},async()=>{
  const url=new URL(process.env.TEST_DATABASE_URL!);
  assert.equal(process.env.DATABASE_URL,url.toString().replace(/\/$/,''));
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
  assert.equal(url.port,'55433');assert.equal(url.pathname,'/draftlane_test');
  const suffix=crypto.randomUUID().replaceAll('-','');
  const name='restore_test_'+suffix;
  const root=path.resolve('.local','backup-test-'+suffix);
  const restoredUrl=new URL(url);restoredUrl.pathname='/'+name;
  const restored=new PrismaClient({adapter:new PrismaPg({connectionString:restoredUrl.toString()})});
  const bin=process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
  const user=await prisma.user.create({data:{clerkId:'backup-'+suffix,email:suffix+'@backup.test'}});
  let created=false;
  try {
    const workspace=await prisma.workspace.create({data:{name:'Restore verification',creatorId:user.id,doc:{create:{content:[{text:'Recovery proof'}]}},canvas:{create:{content:{proof:'diagram preserved'}}},members:{create:{userId:user.id,role:'VIEWER'}},tasks:{create:{title:'Recovered task'}}}});
    await mkdir(root,{recursive:true});
    await writeFile(path.join(root,'upload-original.png'),'fixture image bytes');
    await copyFile(path.join(root,'upload-original.png'),path.join(root,'upload-backup.png'));
    await run(path.join(bin,'pg_dump.exe'),['--dbname',url.toString(),'--format=custom','--file',path.join(root,'database.dump')]);
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${name}"`);created=true;
    await run(path.join(bin,'pg_restore.exe'),['--dbname',restoredUrl.toString(),'--exit-on-error','--no-owner',path.join(root,'database.dump')]);
    const result=await restored.workspace.findUniqueOrThrow({where:{id:workspace.id},include:{doc:true,canvas:true,members:true,tasks:true}});
    assert.equal(result.creatorId,user.id);assert.deepEqual(result.doc?.content,[{text:'Recovery proof'}]);
    assert.deepEqual(result.canvas?.content,{proof:'diagram preserved'});assert.equal(result.members[0].role,'VIEWER');assert.equal(result.tasks[0].title,'Recovered task');
    await copyFile(path.join(root,'upload-backup.png'),path.join(root,'upload-restored.png'));
    assert.deepEqual(await readFile(path.join(root,'upload-restored.png')),await readFile(path.join(root,'upload-original.png')));
  } finally {
    await restored.$disconnect();
    if(created) await prisma.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
    await prisma.user.delete({where:{id:user.id}});await prisma.$disconnect();
    // Only this UUID-scoped test artifact directory is removed.
    assert.equal(path.dirname(root),path.resolve('.local'));
    await rm(root,{recursive:true,force:true});
  }
});
