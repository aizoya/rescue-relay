const $=id=>document.getElementById(id);
let config, disabled=new Set(['leo']), revision=0, pending=null, lastResult=null;
const time=n=>{const hour=7+Math.floor(n/60);return `${hour}:${String(n%60).padStart(2,'0')}`;};
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
function status(text,type='neutral'){$('status').textContent=text;$('status').className=`status ${type}`;}
function buttons(busy=false){$('offline').disabled=busy;$('live').disabled=busy||!config?.live.ready;}
function clearResult(){revision++;pending?.abort();pending=null;lastResult=null;$('download').disabled=true;$('mode').textContent='NOT RUN';$('mode').className='chip';$('checks').hidden=true;$('cost').textContent='No model call for this input';$('receipt-detail').textContent='Changed inputs clear the previous result. Run a new check before reviewing this schedule.';buttons();renderBaseline();status('Input changed. Run a fresh proposal for this cancellation.');}
function renderDrivers(){
  $('drivers').replaceChildren(...config.fixture.drivers.map(d=>{
    const button=el('button',undefined,'driver');button.type='button';button.setAttribute('aria-pressed',String(disabled.has(d.id)));button.setAttribute('aria-label',`${d.name}, ${disabled.has(d.id)?'unavailable':'available'}, click to toggle`);
    button.append(el('span',d.name[0],'avatar'));
    const copy=el('span',undefined,'driver-copy');copy.append(el('strong',d.name),el('small',`${d.capacity} crate capacity`));button.append(copy,el('span',disabled.has(d.id)?'UNAVAILABLE':'AVAILABLE','availability'));
    button.onclick=()=>{disabled.has(d.id)?disabled.delete(d.id):disabled.add(d.id);clearResult();renderDrivers();};return button;
  }));
}
function metrics(covered,recovered,human){
  $('metrics').replaceChildren(...[[covered,'crates covered in plan'],[recovered,'affected crates recovered'],[human,'pickups need a human']].map(([n,label])=>{const div=el('div',undefined,'metric');div.append(el('strong',String(n)),el('span',label));return div;}));
}
function renderBoard(result){
  const checks=result?.checked;
  $('board').replaceChildren(...config.fixture.pickups.map(p=>{
    const assignment=checks?.assignments.find(a=>a.pickupId===p.id);
    const affected=disabled.has(p.originalDriver);
    const missing=checks?.unassigned.includes(p.id);
    const recovered=checks?.valid&&affected&&assignment;
    let tag='ORIGINAL', cls='';
    if(!result&&affected){tag='AT RISK';cls='unassigned';}
    if(result){tag=checks.valid?(missing?'NEEDS HUMAN':recovered?'RECOVERED':'PRESERVED'):'NOT ACCEPTED';cls=checks.valid?(missing?'unassigned':recovered?'recovered':''):'invalid';}
    const card=el('div',undefined,`pickup ${cls}`);card.append(el('span',p.id.toUpperCase(),'id'));
    const title=el('div');title.append(el('strong',p.name),el('small',`${p.crates} crates · window ${time(p.window[0])}–${time(p.window[1])}`));card.append(title);
    const schedule=el('div',undefined,'schedule');
    const driverId=result?assignment?.driverId:p.originalDriver;
    const driver=config.fixture.drivers.find(d=>d.id===driverId);
    schedule.append(el('strong',driver?.name||(missing?'Unassigned':'No assignment')),el('small',assignment?`Pickup ${time(assignment.startMinute)} PM`:(affected?'Driver unavailable':'Original assignment')));card.append(schedule,el('span',tag,'tag'));return card;
  }));
}
function renderBaseline(){if(!config)return;metrics('—','—','—');renderBoard(null);}
function renderResult(result){
  lastResult=result;$('download').disabled=false;
  const c=result.checked,r=result.receipt,live=r.mode==='live';
  $('mode').textContent=live?'LIVE EMBER':'OFFLINE · NO AI';$('mode').className=`chip ${live?'live':''}`;
  if(!c.valid)status('Proposal rejected by the checker. No plan accepted. Review the failed constraints below.','error');
  else if(c.unassigned.length)status(`Checks passed for the assigned routes. ${c.unassigned.length} pickup(s) remain uncovered and need a human. Nothing has been dispatched.`,'warning');
  else status('All five pickups covered. Capacity, travel, windows and availability checks passed. Awaiting human review; nothing dispatched.','success');
  metrics(c.valid?c.retainedCrates:0,c.valid?c.recoveredCrates:0,c.valid?c.unassigned.length:'—');renderBoard(result);
  const checkNodes=[];
  if(c.errors.length){checkNodes.push(el('strong','Rejected constraints'));const list=el('ul');c.errors.forEach(e=>list.append(el('li',e)));checkNodes.push(list);}
  else{checkNodes.push(el('strong','Checked routes'));const list=el('ul');c.routes.forEach(route=>list.append(el('li',`${route.driverId}: ${route.crates}/${route.capacity} crates · hub return ${time(route.returnMinute)} PM`)));checkNodes.push(list);if(c.warnings.length)checkNodes.push(el('p',c.warnings.join(' ')));}
  $('checks').replaceChildren(...checkNodes);$('checks').hidden=false;
  $('cost').textContent=!live?'Offline drill · no API call':r.costUsd===null?'Cost not reported':`$${r.costUsd.toFixed(6)} actual request cost`;
  const details=live?`${r.returnedModel||'Returned model not reported'} · ${r.latencyMs} ms · ${r.promptTokens??'?'} input / ${r.completionTokens??'?'} output tokens. ${r.costSource} Request: ${r.requestId||'not reported'}.`:'Deterministic fixture planner only. This is not an Ember run, not real dispatch data, and not evidence of $1 challenge completion.';
  $('receipt-detail').textContent=details;
}
async function run(mode){
  const token=++revision;pending?.abort();pending=new AbortController();lastResult=null;$('download').disabled=true;$('checks').hidden=true;renderBaseline();$('mode').textContent=mode==='live'?'CALLING EMBER…':'RUNNING DRILL…';$('mode').className='chip loading';$('cost').textContent='Waiting for this run';$('receipt-detail').textContent=mode==='live'?'One request to Muse Ember through OpenRouter. No automatic retries.':'No model or paid service is being called.';status('Preparing a proposal, then checking every assignment.');buttons(true);
  try{
    const response=await fetch('/api/replan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,disabledDrivers:[...disabled],note:$('note').value}),signal:pending.signal});
    const result=await response.json();if(token!==revision)return;if(!response.ok)throw new Error(result.error||'Request failed.');renderResult(result);
  }catch(error){if(token!==revision||error.name==='AbortError')return;status(error.message,'error');$('mode').textContent='FAILED · NO PLAN';$('mode').className='chip';$('cost').textContent='No accepted result';$('receipt-detail').textContent='No offline fallback was substituted. Check OpenRouter for any charge from the attempted live call.';}
  finally{if(token===revision){pending=null;buttons();}}
}
$('offline').onclick=()=>run('offline');$('live').onclick=()=>run('live');$('note').addEventListener('input',clearResult);
$('recoverable').onclick=()=>{disabled=new Set(['leo']);$('note').value="Leo's van broke down. Save the pickups if you can, but don't disturb Sam's route.";clearResult();renderDrivers();};
$('impossible').onclick=()=>{disabled=new Set(['leo','maya']);$('note').value='Two vans are unavailable. Keep Sam’s existing pickups. Tell us clearly what cannot be rescued.';clearResult();renderDrivers();};
$('download').onclick=()=>{if(!lastResult)return;const blob=new Blob([JSON.stringify({app:'Rescue Relay',syntheticData:true,noDispatch:true,...lastResult},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=el('a');anchor.href=url;anchor.download=`rescue-relay-${lastResult.receipt.mode}-${Date.now()}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
try{const response=await fetch('/api/config');if(!response.ok)throw new Error('Cannot load the local app.');config=await response.json();$('readiness').textContent=config.live.reason;renderDrivers();renderBaseline();buttons();}catch(error){status(error.message,'error');$('live').disabled=true;$('offline').disabled=true;}
