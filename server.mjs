import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { FIXTURE, validateInput, validatePlan, offlineProposal } from './src/engine.mjs';
import { emberProposal, liveReadiness, MODEL } from './src/provider.mjs';

const PUBLIC=fileURLToPath(new URL('./public/',import.meta.url));
const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
export function createServer({env=process.env, provider=emberProposal}={}) {
  let liveBusy=false;
  return http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||'')) return json(403,{error:'Local access only.'});
    if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) return json(403,{error:'Cross-origin requests are not allowed.'});
    const path=new URL(req.url,'http://localhost').pathname;
    if(req.method==='GET'&&path==='/api/config') return json(200,{fixture:FIXTURE,live:liveReadiness(env),model:MODEL});
    if(req.method==='POST'&&path==='/api/replan') {
      if(!req.headers['content-type']?.startsWith('application/json')) return json(415,{error:'Send application/json.'});
      let body='';
      try {
        for await(const chunk of req) {body+=chunk;if(Buffer.byteLength(body)>8000) return json(413,{error:'Input is too large.'});}
        let input;
        try {input=validateInput(JSON.parse(body));}catch(error){return json(400,{error:error instanceof SyntaxError?'Invalid JSON.':error.message});}
        let result;
        if(input.mode==='live') {
          if(liveBusy) return json(409,{error:'A live request is already running. Wait for its result.'});
          liveBusy=true;
          try {result=await provider(input,{env});}finally{liveBusy=false;}
        } else {
          const start=performance.now();
          result={proposal:offlineProposal(input.disabledDrivers),receipt:{mode:'offline',requestedModel:null,returnedModel:null,requestId:null,latencyMs:Math.round(performance.now()-start),promptTokens:null,completionTokens:null,costUsd:null,costSource:'No API call. Not a model result.',recordedAt:new Date().toISOString()}};
        }
        const checked=validatePlan(result.proposal,input.disabledDrivers);
        return json(200,{...result,checked,input:{disabledDrivers:input.disabledDrivers,note:input.note},fixtureId:FIXTURE.id,dispatched:false});
      }catch(error){return json(error.status||500,{error:error.status?error.message:'The request failed. No plan was accepted.'});}
    }
    if(req.method==='GET'&&files[path]) {
      const [name,type]=files[path];
      try{const body=await readFile(resolve(PUBLIC,name));res.writeHead(200,{'Content-Type':type});res.end(body);}catch{json(500,{error:'App file unavailable.'});}
      return;
    }
    json(404,{error:'Not found.'});
  });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||4173);
  createServer().listen(port,'127.0.0.1',()=>console.log(`Rescue Relay local prototype: http://127.0.0.1:${port}\nLive calls: ${liveReadiness().ready?'enabled by owner configuration':'disabled'}`));
}
