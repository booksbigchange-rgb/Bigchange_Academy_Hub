import {useState} from 'react';
import { DEMO_COURSES } from '../lib/operations.mjs';
import { demoGuardianProfile, demoFamilyReport } from '../lib/family.mjs';
import type { ClassRoom, Person } from './AcademyOperations';
import type { AcademicState } from './AcademyAcademics';
import type { AssessmentState } from './AcademyAssessments';

type LedgerRow={student:string;learnerId:string;guardian:string;guardianId:string;
  due:number;recorded:number;period:string};
type Props={view:'overview'|'family';classes:ClassRoom[];learners:Person[];academic:AcademicState;
  assessments:AssessmentState;ledger:LedgerRow[];onOpenFamily:()=>void};

const courseOf=(id:string)=>DEMO_COURSES.find(x=>x.id===id)?.name??'Course';
const money=(amount:number)=>'ETB '+amount.toLocaleString('en-US');
function statusTag(status:string){
  if(status==='graded'||status==='Present'||status==='Paid')return 'green';
  if(status==='Absent'||status==='Unpaid'||status==='not submitted')return 'amber';
  return '';
}
export default function AcademyFamily({view,classes,learners,academic,assessments,ledger,onOpenFamily}:Props){
  const nameOf=(id:string)=>learners.find(x=>x.id===id)?.name??'Fictional learner';
  // Exactly one synthetic family is displayed. This is not a logged-in guardian identity.
  const guardian=demoGuardianProfile('guardian-a');
  const [childId,setChildId]=useState('learner-a');
  const [channels,setChannels]=useState({email:false,whatsapp:false});
  if(!guardian)return <section className="panel"><h2>Sample family unavailable</h2></section>;
  const selected=guardian.learnerIds.includes(childId)?childId:guardian.learnerIds[0];
  const report=demoFamilyReport({guardianId:guardian.id,learnerId:selected,
    classes,academic,assessment:assessments,ledger});
  const linkedClasses=classes.filter(c=>report.classIds.includes(c.id));
  return <div className="family-dashboard">
    <section className="panel family-welcome">
      <span className="eyebrow">FAMILY PREVIEW · FICTIONAL GUARDIAN A</span>
      <h2>{view==='overview'?'Welcome to the family learning space':'My children’s learning overview'}</h2>
      <p>View synthetic classroom progress, lesson attendance and externally recorded fee examples for linked fictional learners only.</p>
      <div className="family-child-picker" role="group" aria-label="Select fictional child">
        {guardian.learnerIds.map(id=><button type="button" key={id}
          aria-pressed={selected===id} className={'family-child '+(selected===id?'selected':'')}
          onClick={()=>setChildId(id)}>
          <span className="student-token" aria-hidden="true">{id.slice(-1).toUpperCase()}</span>
          <span>{nameOf(id)}</span>
        </button>)}
      </div>
      <p className="quiet">Linked family members are example fixtures. Actual family relationships must be verified in a secure backend before use.</p>
    </section>
    <div className="family-metrics">
      <div className="metric"><span className="metric-icon">▣</span><div className="metric-value">{report.classCount}</div><div className="metric-title">Enrolled class groups</div><div className="metric-subtitle">Sample courses</div></div>
      <div className="metric"><span className="metric-icon">◷</span><div className="metric-value">{report.attendance.attended} / {report.attendance.marked}</div><div className="metric-title">Attended marked sessions</div><div className="metric-subtitle">{report.attendance.unmarked} unmarked, {report.attendance.excused} excused</div></div>
      <div className="metric"><span className="metric-icon">✎</span><div className="metric-value">{report.progress.submitted} / {report.progress.assigned}</div><div className="metric-title">Assignments submitted</div><div className="metric-subtitle">{report.progress.awaitingReview} awaiting review</div></div>
      <div className="metric"><span className="metric-icon">◈</span><div className="metric-value">{report.progress.average===null?'—':report.progress.average+'%'}</div><div className="metric-title">Average graded work</div><div className="metric-subtitle">{report.progress.graded} graded attempts</div></div>
    </div>
    {view==='overview'?<section className="panel calm">
      <span className="eyebrow">EXPLORE THE FAMILY PORTAL</span><h2>{nameOf(selected)} at a glance</h2>
      <p>There are {report.assigned.filter(t=>t.status==='not submitted').length} sample assignments not submitted.
        The example ledger has {money(report.fees.outstanding)} remaining on external fee obligations.</p>
      <button className="primary-btn" type="button" onClick={onOpenFamily}>View detailed family report →</button>
    </section>:<>
      <div className="two-col">
        <section className="panel">
          <span className="eyebrow">ENROLLMENTS & STUDY</span><h2>My child’s classes</h2>
          {linkedClasses.map(c=><div className="family-course" key={c.id}>
            <strong>{courseOf(c.courseId)}</strong><small>{c.id.toUpperCase()} · {c.slot}</small>
          </div>)}
          {!linkedClasses.length&&<p className="quiet">No fictional courses enrolled.</p>}
        </section>
        <section className="panel">
          <span className="eyebrow">PROGRESS · GRADED TASKS ONLY</span><h2>Learning progress</h2>
          <p>{report.progress.graded} graded, {report.progress.awaitingReview} awaiting teacher review,
            and {report.assigned.filter(t=>t.status==='not submitted').length} not submitted.</p>
          {report.progress.average===null?<p className="quiet">No marked results available yet.</p>:
            <div className="family-progress">
              <strong>{report.progress.average}%</strong>
              <div className="progress"><span style={{width:report.progress.average+'%'}} /></div>
              <small>Average of reviewed and auto-scored tasks; not a final grade.</small>
            </div>}
        </section>
      </div>
      <section className="panel">
        <span className="eyebrow">FAMILY VISIBILITY · ASSIGNMENTS AND GRADES</span><h2>Homework and assessment results</h2>
        <div className="table-wrap"><table><thead><tr><th>Class</th><th>Assessment</th><th>Due</th><th>Status</th><th>Score</th></tr></thead><tbody>
          {report.assigned.map(t=><tr key={t.id}>
            <td>{courseOf(classes.find(c=>c.id===t.classId)?.courseId??'')}</td>
            <td>{t.title}</td><td>{t.dueDate}</td>
            <td><span className={'tag '+statusTag(t.status)}>{t.status}</span></td>
            <td>{t.points===null?'—':t.points+' / '+t.maxPoints}</td>
          </tr>)}
        </tbody></table></div>
        {!report.assigned.length&&<p className="quiet">No sample assignments yet.</p>}
        {report.assigned.filter(t=>t.feedback).map(t=><div className="family-feedback" key={t.id}>
          <strong>{t.title} — fictional teacher feedback</strong><p>{t.feedback}</p>
        </div>)}
      </section>
      <section className="panel">
        <span className="eyebrow">LESSON BY LESSON · FICTIONAL REGISTER</span><h2>Attendance record</h2>
        <p>Attendance is displayed by individual lesson. Unmarked sessions are not counted as absences.</p>
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Course</th><th>Lesson</th><th>Attendance</th></tr></thead><tbody>
          {report.lessons.map(l=><tr key={l.id}>
            <td>{l.date}</td><td>{courseOf(classes.find(c=>c.id===l.classId)?.courseId??'')}</td>
            <td>{l.topic}</td><td><span className={'tag '+statusTag(l.status)}>{l.status}</span></td>
          </tr>)}
        </tbody></table></div>
        {!report.lessons.length&&<p className="quiet">No scheduled example lessons in this learner’s classes.</p>}
      </section>
      <section className="panel">
        <span className="eyebrow">EXTERNAL PAYMENT TRACKING · FICTIONAL ETB</span><h2>Fee obligations overview</h2>
        <div className="finance-strip">
          <div><small>Expected</small><strong>{money(report.fees.due)}</strong></div>
          <div><small>Recorded elsewhere</small><strong>{money(report.fees.recorded)}</strong></div>
          <div><small>Outstanding</small><strong>{money(report.fees.outstanding)}</strong></div>
        </div>
        <div className="table-wrap"><table><thead><tr><th>Period</th><th>Due</th><th>Recorded</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>
          {report.ledgerRows.map((row,i)=><tr key={row.period+'-'+i}>
            <td>{row.period}</td><td>{money(row.due)}</td><td>{money(row.recorded)}</td>
            <td>{money(row.outstanding)}</td><td><span className={'tag '+statusTag(row.status)}>{row.status}</span></td>
          </tr>)}
        </tbody></table></div>
        <p className="quiet">The app cannot accept payments. These figures are fictional and are not invoices or payment receipts.</p>
      </section>
      <section className="panel">
        <span className="eyebrow">COMMUNICATION PREFERENCES · LOCAL UI ONLY</span><h2>Future notification preferences</h2>
        <p>This demonstration lets you express channel preferences locally. It does not verify contact details, give legal consent, send messages, or subscribe anyone to a service.</p>
        <div className="family-channel-choices">
          <label><input type="checkbox" checked={channels.email} onChange={e=>setChannels(s=>({...s,email:e.target.checked}))}/>
            Email summaries (example preference)</label>
          <label><input type="checkbox" checked={channels.whatsapp} onChange={e=>setChannels(s=>({...s,whatsapp:e.target.checked}))}/>
            WhatsApp updates (example preference)</label>
        </div>
        <p className="quiet" role="status" aria-live="polite">
          {channels.email||channels.whatsapp?'Demo preference selected in this browser tab; no message will be sent.':'No demo notification channels selected.'}
        </p>
      </section>
    </>}
    <p className="quiet">BigChange Academy · Prototype, fictional families only · No guardian login, notifications, live financial records or personal data.</p>
  </div>;
}
