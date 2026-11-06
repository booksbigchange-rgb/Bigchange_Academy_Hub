/**
 * Quarterly course-fee planning. School policy (from the owner): parents pay every 3 months per course.
 * A family with exactly one course in total pays 150; a family with two or more courses pays 100 per course.
 * "Family" = the paying guardian, counted across all of that guardian's children. Payments happen outside the app.
 */
export const FEE_RATES = Object.freeze({ single: 150, multi: 100 });

/** First month of the quarter containing `date`, as 'YYYY-MM' (Jan/Apr/Jul/Oct). */
export function quarterStart(date = new Date()) {
  const m = Math.floor(date.getMonth() / 3) * 3 + 1;
  return date.getFullYear() + '-' + String(m).padStart(2, '0');
}
/** '2026-10' -> '2026 Q4'. */
export function quarterLabel(period) {
  if (!/^\d{4}-(01|04|07|10)$/.test(period)) throw Error('Invalid quarter');
  return period.slice(0, 4) + ' Q' + ((Number(period.slice(5)) - 1) / 3 + 1);
}
/** Quarters from last year to next year, newest first, for a picker. */
export function quarterOptions(date = new Date()) {
  const out = [];
  for (let y = date.getFullYear() + 1; y >= date.getFullYear() - 1; y--)
    for (const m of [10, 7, 4, 1]) out.push(y + '-' + String(m).padStart(2, '0'));
  return out;
}

/**
 * Work out which fee rows to create for a quarter.
 * @param {{period:string, learners:Array<{id:string,active:boolean}>, links:Array<{learner_id:string,guardian_id:string,verified:boolean}>,
 *   enrollments:Array<{class_id:string,learner_id:string}>, classes:Array<{id:string,course_id:string}>,
 *   existing:Array<{learner_id:string,course_id:string|null,period:string|null}>}} input
 */
export function planQuarterFees({ period, learners, links, enrollments, classes, existing }) {
  const label = quarterLabel(period);
  const courseOfClass = new Map(classes.map(c => [c.id, c.course_id]));
  const active = new Set(learners.filter(l => l.active).map(l => l.id));
  const payer = new Map(); // learner -> lowest-id verified guardian
  for (const l of links) if (l.verified && (!payer.has(l.learner_id) || l.guardian_id < payer.get(l.learner_id))) payer.set(l.learner_id, l.guardian_id);
  const pairs = new Map(); // "learner|course" -> pair
  for (const e of enrollments) {
    const course = courseOfClass.get(e.class_id);
    if (course && active.has(e.learner_id)) pairs.set(e.learner_id + '|' + course, { learner_id: e.learner_id, course_id: course });
  }
  const skippedNoGuardian = new Set();
  const perFamily = new Map();
  for (const p of pairs.values()) {
    const g = payer.get(p.learner_id);
    if (!g) { skippedNoGuardian.add(p.learner_id); continue; }
    p.guardian_id = g;
    perFamily.set(g, (perFamily.get(g) ?? 0) + 1);
  }
  const have = new Set(existing.filter(x => x.period === period).map(x => x.learner_id + '|' + x.course_id));
  const toCreate = [], alreadyExist = [];
  for (const p of pairs.values()) {
    if (!p.guardian_id) continue;
    if (have.has(p.learner_id + '|' + p.course_id)) { alreadyExist.push(p); continue; }
    toCreate.push({ learner_id: p.learner_id, course_id: p.course_id, guardian_id: p.guardian_id, period, term: label,
      amount_due: perFamily.get(p.guardian_id) === 1 ? FEE_RATES.single : FEE_RATES.multi });
  }
  return { toCreate, alreadyExist, skippedNoGuardian: [...skippedNoGuardian], total: toCreate.reduce((s, r) => s + r.amount_due, 0) };
}
