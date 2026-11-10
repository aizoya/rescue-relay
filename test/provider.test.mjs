import test from 'node:test';
import assert from 'node:assert/strict';
import { emberProposal, liveReadiness, MODEL } from '../src/provider.mjs';
import { offlineProposal } from '../src/engine.mjs';
const env={LIVE_CALLS_APPROVED:'true',OPENROUTER_API_KEY:'TEST_ONLY_NOT_A_REAL_KEY'};
const input={disabledDrivers:['leo'],note:'test fixture note',mode:'live'};
const raw = (usage={}) => ({ id:'mock-request',model:MODEL,choices:[{message:{content:JSON.stringify(offlineProposal(['leo']))}}],usage });
const response = data => async () => ({ok:true,json:async()=>data});

test('live calls require explicit private approval, key, and required model',async()=>{
  for(const deniedEnv of [{},{OPENROUTER_API_KEY:'test'},{LIVE_CALLS_APPROVED:'true'},{...env,LIVE_CALLS_APPROVED:'TRUE'},{...env,OPENROUTER_MODEL:'other/model'}]){
    assert.equal(liveReadiness(deniedEnv).ready,false);
    await assert.rejects(emberProposal(input,{env:deniedEnv,fetchImpl:()=>assert.fail('must not fetch')}),{status:409});
  }
  assert.equal(liveReadiness(env).ready,true);
});

test('mock request pins model and schema and reports only provider-supplied usage',async()=>{
  let count=0;
  const result=await emberProposal(input,{env,fetchImpl:async(url,options)=>{
    count++;assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,`Bearer ${env.OPENROUTER_API_KEY}`);
    const body=JSON.parse(options.body);assert.equal(body.model,MODEL);assert.equal(body.response_format.json_schema.strict,true);
    assert.deepEqual(JSON.parse(body.messages[1].content).unavailableDrivers,['leo']);
    assert.ok(options.signal instanceof AbortSignal);
    return {ok:true,json:async()=>raw({prompt_tokens:120,completion_tokens:40,cost:0.00123})};
  }});
  assert.equal(count,1);assert.equal(result.receipt.costUsd,0.00123);assert.equal(result.receipt.costSource,'OpenRouter response usage.cost');
  assert.equal(result.receipt.promptTokens,120);assert.equal(result.receipt.completionTokens,40);
  assert.equal(result.receipt.requestId,'mock-request');assert.equal(result.receipt.returnedModel,MODEL);
  assert.ok(result.receipt.latencyMs>=0);assert.ok(Number.isFinite(Date.parse(result.receipt.recordedAt)));
});

test('missing, malformed, negative, and non-finite costs are never estimated or treated as zero',async()=>{
  for(const cost of [undefined,null,'0.01',-1,NaN,Infinity]){
    const {receipt}=await emberProposal(input,{env,fetchImpl:response(raw({cost,prompt_tokens:'12',completion_tokens:-2}))});
    assert.equal(receipt.costUsd,null);assert.match(receipt.costSource,/Not reported/);
    assert.equal(receipt.promptTokens,null);assert.equal(receipt.completionTokens,null);
  }
  const {receipt}=await emberProposal(input,{env,fetchImpl:response(raw({cost:0}))});
  assert.equal(receipt.costUsd,0);assert.equal(receipt.costSource,'OpenRouter response usage.cost');
});

test('provider HTTP errors are surfaced without credential leakage or hidden fallback',async()=>{
  for(const [status,pattern] of [[401,/rejected the key/],[402,/insufficient credits/],[429,/rate limit/],[500,/HTTP 500/]]){
    await assert.rejects(emberProposal(input,{env,fetchImpl:async()=>({ok:false,status,json:()=>assert.fail('do not inspect unsafe error body')})}),error=>error.status===502&&pattern.test(error.message)&&!error.message.includes(env.OPENROUTER_API_KEY));
  }
});

test('network failures and timeouts fail closed',async()=>{
  for(const name of ['Error','TimeoutError','AbortError']){
    await assert.rejects(emberProposal(input,{env,fetchImpl:async()=>{throw Object.assign(new Error('secret details'),{name});}}),error=>error.status===502&&/No plan was accepted/.test(error.message)&&!error.message.includes('secret details'));
  }
});

test('unreadable response JSON fails closed',async()=>{
  for(const data of [{},{choices:[]},{choices:[{message:{content:'not JSON'}}]}]){
    await assert.rejects(emberProposal(input,{env,fetchImpl:response(data)}),{status:502,message:'Ember returned unreadable JSON. No plan was accepted.'});
  }
  await assert.rejects(emberProposal(input,{env,fetchImpl:async()=>({ok:true,json:async()=>{throw new Error('malformed transport');}})}),{status:502});
});
