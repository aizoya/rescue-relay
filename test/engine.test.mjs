import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE, validateInput, validatePlan, offlineProposal } from '../src/engine.mjs';
const clone = x => structuredClone(x);
const base = () => offlineProposal([]);
function rejected(plan, pattern, disabled = [], fixture = FIXTURE) {
  const result = validatePlan(plan, disabled, fixture);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), pattern);
  assert.equal(result.retainedCrates, 0, 'invalid plans never claim retained crates');
  assert.equal(result.recoveredCrates, 0, 'invalid plans never claim recovery');
  return result;
}

test('input requires known unique driver IDs, bounded note, and explicit mode', () => {
  const good = { disabledDrivers: ['leo'], note: 'driver unavailable', mode: 'offline' };
  assert.deepEqual(validateInput(good), good);
  assert.notEqual(validateInput(good).disabledDrivers, good.disabledDrivers);
  for (const input of [null, [], {}, {...good, disabledDrivers:['ghost']}, {...good, disabledDrivers:['leo','leo']}, {...good, disabledDrivers:['maya','leo','sam','maya']}, {...good,note:9}, {...good,note:'x'.repeat(1601)}, {...good,mode:'fallback'}]) {
    assert.throws(() => validateInput(input));
  }
  assert.equal(validateInput({...good,note:'x'.repeat(1600)}).note.length,1600);
});

test('all eight disabled-driver combinations produce valid, completely accounted synthetic drills', () => {
  const expectedRetained = [16,12,16,6,16,6,11,0];
  for (let mask=0; mask<8; mask++) {
    const disabled = FIXTURE.drivers.filter((_,i)=>mask&(1<<i)).map(d=>d.id);
    const proposal = offlineProposal(disabled), checked = validatePlan(proposal,disabled);
    assert.equal(checked.valid,true,JSON.stringify({disabled,errors:checked.errors}));
    assert.equal(checked.retainedCrates,expectedRetained[mask]);
    assert.match(proposal.summary,/offline drill.*No model was called/);
    assert.deepEqual([...proposal.assignments.map(a=>a.pickupId),...proposal.unassigned].sort(),['a','b','c','d','e']);
    for(const pickup of FIXTURE.pickups.filter(p=>!disabled.includes(p.originalDriver))) {
      assert.equal(proposal.assignments.find(a=>a.pickupId===pickup.id)?.driverId,pickup.originalDriver);
    }
    assert.ok(proposal.assignments.every(a=>!disabled.includes(a.driverId)));
    const affected = FIXTURE.pickups.filter(p=>disabled.includes(p.originalDriver)).reduce((n,p)=>n+p.crates,0);
    assert.equal(checked.affectedCrates,affected);
    assert.equal(checked.recoveredCrates,checked.retainedCrates-(16-affected));
    assert.equal(checked.warnings.length,proposal.unassigned.length ? 1 : 0);
  }
});

test('rejects malformed proposals and malformed assignment values without throwing', () => {
  for(const proposal of [null,[],{},'text',{assignments:[],unassigned:null},{assignments:Array(51).fill({}),unassigned:[]}]) rejected(proposal,/schema/);
  for(const entry of [null,[],{}, {pickupId:'a',driverId:'ghost',startMinute:10},{pickupId:'ghost',driverId:'maya',startMinute:10}, ...[-1,1441,1.5,NaN,Infinity,'10',null].map(startMinute=>({pickupId:'a',driverId:'maya',startMinute}))]) {
    const p=base();p.assignments[0]=entry;rejected(p,/unknown IDs or an invalid time/);
  }
});

test('rejects duplicate, missing, unknown, and assigned-plus-unassigned pickup IDs', () => {
  let p=base();p.assignments.push(clone(p.assignments[0]));rejected(p,/Duplicate pickup/);
  p=base();p.assignments.shift();rejected(p,/missing/);
  p=base();p.unassigned=['a'];rejected(p,/duplicated or both assigned/);
  p=base();p.unassigned=['ghost'];rejected(p,/unknown pickup/);
  p=offlineProposal(['maya']);p.unassigned.push('a');rejected(p,/duplicated/,['maya']);
  p=base();p.unassigned=[null];rejected(p,/unknown pickup/);
});

test('preserves unaffected assignments, prevents dropped pickups and unavailable drivers', () => {
  let p=base();p.assignments[0].driverId='leo';rejected(p,/unaffected assignment/);
  p=base();p.assignments.shift();p.unassigned=['a'];rejected(p,/unaffected pickup was dropped/);
  rejected(base(),/leo is unavailable/,['leo']);
});

test('counts full onboard crate load against capacity; exact capacity is permitted', () => {
  const fixture=clone(FIXTURE);fixture.drivers[1].capacity=6;
  assert.equal(validatePlan(base(),[],fixture).valid,true);
  fixture.drivers[1].capacity=5;rejected(base(),/6 crates exceeds capacity 5/,[],fixture);
});

test('requires full service inside pickup window, including exact end boundary', () => {
  const fixture=clone(FIXTURE);fixture.pickups[0].window=[10,15];
  assert.equal(validatePlan(base(),[],fixture).valid,true);
  fixture.pickups[0].window=[10,14];rejected(base(),/service does not fit/,[],fixture);
  fixture.pickups[0].window=[11,30];rejected(base(),/service does not fit/,[],fixture);
});

test('checks travel from depot and between stops, and driver start availability', () => {
  let fixture=clone(FIXTURE);fixture.travel.hub.market=11;rejected(base(),/cannot reach a/,[],fixture);
  fixture=clone(FIXTURE);fixture.travel.bakery.kitchen=9;rejected(base(),/cannot reach c/,[],fixture);
  fixture=clone(FIXTURE);fixture.drivers[0].available[0]=1;rejected(base(),/cannot reach a/,[],fixture);
  fixture=clone(FIXTURE);delete fixture.travel.hub.market;rejected(base(),/cannot reach a/,[],fixture);
});

test('requires final hub return within availability; exact boundary allowed', () => {
  let fixture=clone(FIXTURE);fixture.drivers[0].available[1]=25;
  assert.equal(validatePlan(base(),[],fixture).valid,true);
  fixture.drivers[0].available[1]=24;rejected(base(),/return to hub exceeds availability/,[],fixture);
  fixture=clone(FIXTURE);delete fixture.travel.market.hub;rejected(base(),/return to hub exceeds availability/,[],fixture);
});
