export const FIXTURE = {
  id: 'rescue-fixture-v1',
  label: 'Synthetic dispatch drill. Fictional people, places, routes, capacity and timing. No food dispatched.',
  timeOrigin: '7:00 PM', serviceMinutes: 5, depot: 'hub',
  drivers: [
    { id: 'maya', name: 'Maya', capacity: 12, available: [0, 75] },
    { id: 'leo', name: 'Leo', capacity: 8, available: [0, 65] },
    { id: 'sam', name: 'Sam', capacity: 7, available: [0, 70] }
  ],
  pickups: [
    { id: 'a', name: 'Market surplus', location: 'market', crates: 4, window: [10, 30], originalDriver: 'maya' },
    { id: 'b', name: 'Bakery closeout', location: 'bakery', crates: 3, window: [20, 40], originalDriver: 'leo' },
    { id: 'c', name: 'Community kitchen', location: 'kitchen', crates: 3, window: [30, 50], originalDriver: 'leo' },
    { id: 'd', name: 'Café surplus', location: 'cafe', crates: 4, window: [15, 35], originalDriver: 'sam' },
    { id: 'e', name: 'Corner grocer', location: 'grocer', crates: 2, window: [30, 50], originalDriver: 'sam' }
  ],
  travel: {
    hub: { hub: 0, market: 10, bakery: 8, kitchen: 12, cafe: 9, grocer: 13 },
    market: { hub: 10, market: 0, bakery: 7, kitchen: 10, cafe: 12, grocer: 15 },
    bakery: { hub: 8, market: 7, bakery: 0, kitchen: 8, cafe: 8, grocer: 10 },
    kitchen: { hub: 12, market: 10, bakery: 8, kitchen: 0, cafe: 9, grocer: 8 },
    cafe: { hub: 9, market: 12, bakery: 8, kitchen: 9, cafe: 0, grocer: 10 },
    grocer: { hub: 13, market: 15, bakery: 10, kitchen: 8, cafe: 10, grocer: 0 }
  }
};

export function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected a JSON object.');
  if (!Array.isArray(input.disabledDrivers) || input.disabledDrivers.length > 3) throw new Error('Choose unavailable drivers.');
  const known = new Set(FIXTURE.drivers.map(d => d.id));
  if (input.disabledDrivers.some(id => !known.has(id)) || new Set(input.disabledDrivers).size !== input.disabledDrivers.length) throw new Error('Unknown or duplicate driver.');
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 1600)) throw new Error('Dispatcher note must be at most 1600 characters.');
  if (!['offline', 'live'].includes(input.mode)) throw new Error('Choose offline or live mode.');
  return { disabledDrivers: [...input.disabledDrivers], note: input.note || '', mode: input.mode };
}

export function validatePlan(plan, disabledDrivers, fixture = FIXTURE) {
  const errors = [], warnings = [], disabled = new Set(disabledDrivers);
  const routes = [], assignments = [], seen = new Set();
  const drivers = new Map(fixture.drivers.map(d => [d.id, d]));
  const pickups = new Map(fixture.pickups.map(p => [p.id, p]));
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.assignments) || plan.assignments.length > 50 || !Array.isArray(plan.unassigned)) {
    return { valid: false, errors: ['Proposal schema is invalid. Expected assignments and unassigned arrays.'], warnings, routes, assignments, unassigned: fixture.pickups.map(p => p.id), retainedCrates: 0, recoveredCrates: 0, affectedCrates: fixture.pickups.filter(p => disabled.has(p.originalDriver)).reduce((n,p)=>n+p.crates,0) };
  }
  for (const item of plan.assignments) {
    if (!item || typeof item !== 'object' || !pickups.has(item.pickupId) || !drivers.has(item.driverId) || !Number.isInteger(item.startMinute) || item.startMinute < 0 || item.startMinute > 1440) {
      errors.push('An assignment contains unknown IDs or an invalid time.'); continue;
    }
    const pickup = pickups.get(item.pickupId);
    if (seen.has(item.pickupId)) errors.push(`Duplicate pickup: ${item.pickupId}.`);
    seen.add(item.pickupId);
    if (disabled.has(item.driverId)) errors.push(`${item.driverId} is unavailable.`);
    if (!disabled.has(pickup.originalDriver) && item.driverId !== pickup.originalDriver) errors.push(`${item.pickupId}: unaffected assignment must remain with ${pickup.originalDriver}.`);
    if (item.startMinute < pickup.window[0] || item.startMinute + fixture.serviceMinutes > pickup.window[1]) errors.push(`${item.pickupId}: pickup service does not fit its window.`);
    assignments.push({ pickupId: item.pickupId, driverId: item.driverId, startMinute: item.startMinute });
  }
  const unassigned = [];
  for (const id of plan.unassigned) {
    if (typeof id !== 'string' || !pickups.has(id)) { errors.push('Unassigned list contains an unknown pickup.'); continue; }
    if (seen.has(id)) errors.push(`Pickup ${id} is duplicated or both assigned and unassigned.`);
    seen.add(id); unassigned.push(id);
    if (!disabled.has(pickups.get(id).originalDriver)) errors.push(`${id}: an unaffected pickup was dropped.`);
  }
  for (const pickup of fixture.pickups) if (!seen.has(pickup.id)) errors.push(`Pickup ${pickup.id} is missing from the proposal.`);
  for (const driver of fixture.drivers) {
    const stops = assignments.filter(a => a.driverId === driver.id).sort((a,b)=>a.startMinute-b.startMinute);
    if (!stops.length) continue;
    let previousLocation = fixture.depot, earliest = driver.available[0], crates = 0;
    for (const stop of stops) {
      const pickup = pickups.get(stop.pickupId), travel = fixture.travel[previousLocation]?.[pickup.location];
      if (!Number.isFinite(travel) || stop.startMinute < earliest + travel) errors.push(`${driver.id}: cannot reach ${pickup.id} in time.`);
      earliest = stop.startMinute + fixture.serviceMinutes;
      previousLocation = pickup.location;
      crates += pickup.crates;
    }
    const returnMinute = earliest + fixture.travel[previousLocation]?.[fixture.depot];
    if (!Number.isFinite(returnMinute) || returnMinute > driver.available[1]) errors.push(`${driver.id}: return to hub exceeds availability.`);
    if (crates > driver.capacity) errors.push(`${driver.id}: ${crates} crates exceeds capacity ${driver.capacity}.`);
    routes.push({ driverId: driver.id, crates, capacity: driver.capacity, returnMinute, stops });
  }
  if (unassigned.length) warnings.push(`${unassigned.length} pickup(s) need a human. Do not dispatch an incomplete plan without review.`);
  const valid = errors.length === 0;
  const affectedCrates = fixture.pickups.filter(p => disabled.has(p.originalDriver)).reduce((n,p)=>n+p.crates,0);
  const retainedCrates = valid ? assignments.reduce((n,a)=>n+pickups.get(a.pickupId).crates,0) : 0;
  const recoveredCrates = valid ? assignments.filter(a=>disabled.has(pickups.get(a.pickupId).originalDriver)).reduce((n,a)=>n+pickups.get(a.pickupId).crates,0) : 0;
  return { valid, errors: [...new Set(errors)], warnings, routes, assignments, unassigned, retainedCrates, recoveredCrates, affectedCrates };
}

// This bounded deterministic planner exists only for offline drills, never as a disguised model fallback.
export function offlineProposal(disabledDrivers) {
  const disabled = new Set(disabledDrivers), active = FIXTURE.drivers.filter(d=>!disabled.has(d.id));
  let best = { score: -1, proposal: null };
  const allocations = [];
  function assign(index, selected) {
    if (index === FIXTURE.pickups.length) { allocations.push(selected); return; }
    const p = FIXTURE.pickups[index];
    const options = disabled.has(p.originalDriver) ? [...active.map(d=>d.id), null] : [p.originalDriver];
    for (const id of options) assign(index+1, [...selected, id]);
  }
  assign(0, []);
  for (const allocation of allocations) {
    const proposal = { assignments: [], unassigned: [], summary: 'Deterministic offline drill. No model was called.' };
    for (const d of active) {
      const pickups = FIXTURE.pickups.filter((p,i)=>allocation[i]===d.id).sort((a,b)=>a.window[1]-b.window[1]);
      let minute = d.available[0], location = FIXTURE.depot;
      for (const p of pickups) {
        minute = Math.max(p.window[0], minute+FIXTURE.travel[location][p.location]);
        proposal.assignments.push({ pickupId:p.id, driverId:d.id, startMinute:minute });
        minute += FIXTURE.serviceMinutes; location=p.location;
      }
    }
    FIXTURE.pickups.forEach((p,i)=>{ if (allocation[i]===null) proposal.unassigned.push(p.id); });
    const checked = validatePlan(proposal, disabledDrivers);
    if (checked.valid && checked.retainedCrates > best.score) best = { score: checked.retainedCrates, proposal };
  }
  return best.proposal || { assignments:[], unassigned:FIXTURE.pickups.map(p=>p.id) };
}
