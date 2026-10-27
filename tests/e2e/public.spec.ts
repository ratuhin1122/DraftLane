import { test, expect } from '@playwright/test';

for(const viewport of [{width:375,height:812},{width:768,height:1024},{width:1024,height:768}]){
  test(`landing page and auth fit ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('link',{name:'DraftLane home'})).toBeVisible();
    await expect(page.locator('#product')).toBeAttached();
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.getByRole('link',{name:'DraftLane home'}).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/sign-in');
    await expect(page.getByText('Sign in to DraftLane',{exact:false})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('anonymous callers cannot read or mutate private workspace APIs',async({request})=>{
  const id='nonexistent-security-fixture';
  expect((await request.get(`/api/workspaces/${id}/sync`)).status()).toBe(404);
  expect((await request.post(`/api/workspaces/${id}/sync`,{data:{surface:'canvas',generation:0,state:'AAA='}})).status()).toBe(403);
  expect((await request.post('/api/uploads',{multipart:{workspaceId:id,file:{name:'fake.png',mimeType:'image/png',buffer:Buffer.from('not an image')}}})).status()).toBe(401);
  expect((await request.post('/api/agent',{data:{workspaceId:id,messages:[]}})).status()).toBe(401);
  expect((await request.post('/api/account/delete',{data:{confirmation:'DELETE',accountId:'someone-else'}})).status()).toBe(401);
});

test('invalid deletion receipts and unsigned webhooks are rejected',async({request})=>{
  for(const data of [{},{jobId:'x',token:'wrong'},{jobId:'x',token:'a'.repeat(65)}]){
    expect((await request.post('/api/account/delete/finish',{data})).status()).toBe(400);
  }
  const malformed=await request.post('/api/account/delete/finish',{data:'{',headers:{'Content-Type':'application/json'}});
  expect(malformed.status()).toBe(400);
  const webhook=await request.post('/api/webhooks/clerk',{data:{type:'user.deleted',data:{id:'someone-else'}}});
  expect(webhook.status()).toBe(400);
});

test('private pages redirect anonymous visitors to sign in',async({page})=>{
  for(const route of ['/dashboard','/workspaces','/workspace/nonexistent-security-fixture']){
    await page.goto(route);
    await expect(page).toHaveURL(/sign-in/);
  }
});
