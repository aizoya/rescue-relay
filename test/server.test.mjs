import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createServer } from '../server.mjs';
import { offlineProposal } from '../src/engine.mjs';

async function serve(t, options={}) {
  const server=createServer(options);server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return async (path='/api/replan', {method='POST',headers={},body={disabledDrivers:['leo'],note:'synthetic local test',mode:'offline'}}={}) => {
    const port=server.address().port;
    return new Promise((resolve,reject)=>{
      const req=http.request({host:'127.0.0.1',port,path,method,headers:{'Content-Type':'application/json',...headers}},res=>{
        let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text,data:res.headers['content-type']?.includes('json')?JSON.parse(text):null}));
      });req.on('error',reject);req.end(body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body));
    });
  };
}

test('offline HTTP result is explicitly synthetic, non-dispatched, and not a model cost receipt',async t=>{
  const request=await serve(t,{provider:()=>assert.fail('offline must never call provider')});
  const result=await request();assert.equal(result.status,200);assert.equal(result.data.checked.valid,true);
  assert.equal(result.data.dispatched,false);assert.equal(result.data.receipt.mode,'offline');assert.equal(result.data.receipt.costUsd,null);
  assert.equal(result.data.receipt.requestId,null);assert.match(result.data.receipt.costSource,/No API call. Not a model result/);
  assert.equal(result.headers['cache-control'],'no-store');assert.match(result.headers['content-security-policy'],/connect-src 'self'/);
});

test('server rejects live use by default without calling external services',async t=>{
  const request=await serve(t,{env:{}});
  const result=await request('/api/replan',{body:{disabledDrivers:['leo'],mode:'live'}});
  assert.equal(result.status,409);assert.match(result.data.error,/Live calls are disabled/);
  const config=await request('/api/config',{method:'GET'});assert.equal(config.data.live.ready,false);
});

test('server independently rejects an invalid mock model proposal',async t=>{
  const request=await serve(t,{provider:async()=>({proposal:{assignments:[],unassigned:[]},receipt:{mode:'live',costUsd:null}})});
  const result=await request('/api/replan',{body:{disabledDrivers:['leo'],mode:'live'}});
  assert.equal(result.status,200);assert.equal(result.data.checked.valid,false);
  assert.equal(result.data.checked.retainedCrates,0);assert.equal(result.data.dispatched,false);assert.match(result.data.checked.errors.join(' '),/missing/);
});

test('server enforces local Host, same Origin, JSON input, and size limits',async t=>{
  const request=await serve(t);
  assert.equal((await request('/api/config',{method:'GET',headers:{Host:'attacker.example'}})).status,403);
  assert.equal((await request('/api/replan',{headers:{Origin:'https://attacker.example'}})).status,403);
  assert.equal((await request('/api/replan',{headers:{'Content-Type':'text/plain'}})).status,415);
  assert.equal((await request('/api/replan',{body:'{bad json'})).status,400);
  assert.equal((await request('/api/replan',{body:'x'.repeat(8001)})).status,413);
  assert.equal((await request('/unknown',{method:'GET'})).status,404);
});

test('one mocked live request at a time; busy state clears after failure',async t=>{
  let release,started;const entered=new Promise(resolve=>started=resolve);
  let calls=0;
  const request=await serve(t,{provider:async()=>{
    calls++;if(calls===1){started();await new Promise(resolve=>release=resolve);throw Object.assign(new Error('Mock provider failed'),{status:502});}
    return {proposal:offlineProposal(['leo']),receipt:{mode:'live',costUsd:null}};
  }});
  const first=request('/api/replan',{body:{disabledDrivers:['leo'],mode:'live'}});await entered;
  const second=await request('/api/replan',{body:{disabledDrivers:['leo'],mode:'live'}});
  assert.equal(second.status,409);assert.equal(calls,1);release();assert.equal((await first).status,502);
  const third=await request('/api/replan',{body:{disabledDrivers:['leo'],mode:'live'}});
  assert.equal(third.status,200);assert.equal(calls,2);
});
