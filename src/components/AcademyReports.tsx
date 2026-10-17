import {useMemo,useState} from 'react';
import {DEMO_COURSES} from '../lib/operations.mjs';
import {summarizeDemoAcademy,demoAggregateCsv} from '../lib/reporting.mjs';
import type {ClassRoom,Person} from './AcademyOperations';
import type {AcademicState} from './AcademyAcademics';
import type {AssessmentState} from './AcademyAssessments';

type Ledger={student:string;learnerId:string;guardian:string;guardianId:string;due:number;recorded:number;period:string};
type Change={sequence:number;previous:number;next:number;delta:number};
type Props={classes:ClassRoom[];academic:AcademicState;assessments:AssessmentState;ledger:Ledger[];teachers:Person[];financeChanges:Change[]};
type Summary={classes:number;enrollments:number;capacity:number;uniqueLearners:number;utilization:number;activeTeachers:number;activeCourses:number;plannedSessions:number};
type Attendance={opportunities:number;present:number;late:number;absent:number;excused:number;unmarked:number;markedRate:number|null};
type Grades={assigned:number;submitted:number;awaitingReview:number;graded:number;average:number|null};
type Group={id:string;course:string;teacher:string;teacherId:string;slot:string;learners:number;capacity:number;utilization:number;sessions:number;attendance:Attendance;grades:Grades};
type Staff={id:string;name:string;groups:number;enrollments:number;uniqueLearners:number;weeklySessions:number;plannedSessions:number};
type Course={id:string;name:string;groups:number;enrollments:number;capacity:number;utilization:number};
type Fees={due:number;recorded:number;outstanding:number;paid:number;partial:number;unpaid:number;rows:number;exceptions:{index:number;reason:string}[];periods:{name:string;due:number;recorded:number;outstanding:number;rows:number}[]};
type Report={summary:Summary;attendance:Attendance;grades:Grades;classRows:Group[];teacherRows:Staff[];courseRows:Course[];fees:Fees};
type Tab='Classes'|'Teachers'|'Attendance'|'Grades'|'Finance';
const price=(n:number)=>'ETB '+n.toLocaleString('en-US');
const rate=(n:number|null)=>n===null?'—':n+'%';
export default function AcademyReports({classes,academic,assessments,ledger,teachers,financeChanges}:Props){
 const [termId,setTermId]=useState('all');
 const [courseId,setCourseId]=useState('all');
 const [teacherId,setTeacherId]=useState('all');
 const [period,setPeriod]=useState('all');
 const [tab,setTab]=useState<Tab>('Classes');
 const [message,setMessage]=useState('');
 const report=useMemo(()=>summarizeDemoAcademy({classes,academic,assessments,ledger,termId,courseId,teacherId,period,teachers}),
  [classes,academic,assessments,ledger,termId,courseId,teacherId,period,teachers]) as Report;
 const periods=[...new Set(ledger.map(x=>x.period))].sort();
 function download(){
  try{
   const data=demoAggregateCsv(report);
   const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='bigchange-demo-aggregate-report.csv';
   document.body.appendChild(a);a.click();a.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);
   setMessage('Aggregate sample CSV generated. Individual students and payment rows were not exported.');
  }catch{setMessage('CSV could not be generated in this browser.');}
 }
 return <div className="reports-workspace">
  <section className="panel">
   <div className="panel-head"><div><span className="eyebrow">ACADEMY ADMINISTRATION · DEMO ONLY</span>
    <h2>Reports & oversight</h2><p>Current class capacity, teacher loads, attendance, assessment outcomes and external fee totals.</p>
   </div><button type="button" className="small-btn" onClick={download}>Export aggregate CSV ↓</button></div>
   <div className="report-filters">
    <label>Academic term<select value={termId} onChange={e=>setTermId(e.target.value)}>
     <option value="all">All sample terms</option>{academic.terms.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
    </select></label>
    <label>Course<select value={courseId} onChange={e=>setCourseId(e.target.value)}>
     <option value="all">All courses</option>{DEMO_COURSES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
    </select></label>
    <label>Instructor<select value={teacherId} onChange={e=>setTeacherId(e.target.value)}>
     <option value="all">All instructors</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
    </select></label>
    <label>Fee period<select value={period} onChange={e=>setPeriod(e.target.value)}>
     <option value="all">All fee periods</option>{periods.map(p=><option key={p} value={p}>{p}</option>)}
    </select></label>
   </div>
   <p className="quiet">Academic filters affect groups, sessions and grades. Fee-period filtering affects only the <strong>academy-wide</strong> external-payment ledger. Tuition is not attributed to individual teachers/courses.</p>
   <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>
  <div className="report-kpis">
   {[
    ['Class groups',report.summary.classes,'Current fictional groups'],
    ['Unique learners',report.summary.uniqueLearners,report.summary.enrollments+' course enrollments'],
    ['Seat utilization',report.summary.utilization+'%',report.summary.enrollments+' / '+report.summary.capacity+' total seats'],
    ['Marked attendance rate',rate(report.attendance.markedRate),report.attendance.unmarked+' unmarked opportunities']
   ].map(([title,value,note])=><div className="metric" key={String(title)}>
    <span className="metric-icon">▦</span><div className="metric-value">{value}</div><div className="metric-title">{title}</div>
    <div className="metric-subtitle">{note}</div>
   </div>)}
  </div>
  <section className="panel">
   <div className="report-tabs" aria-label="Report categories">
    {(['Classes','Teachers','Attendance','Grades','Finance'] as const).map(x=><button type="button" key={x}
     className={'report-tab '+(tab===x?'selected':'')} aria-pressed={tab===x} onClick={()=>setTab(x)}>{x}</button>)}
   </div>
   {tab==='Classes'&&<>
    <span className="eyebrow">CURRENT ENROLLMENT SNAPSHOT</span><h2>Class occupancy</h2>
    <p>Enrollment dates are not stored. These bars show current course distribution, <strong>not a historical enrollment trend</strong>.</p>
    <div className="report-bars">{report.courseRows.filter(c=>c.groups>0).map(c=><div key={c.id}>
     <div className="report-bar-label"><strong>{c.name}</strong><span>{c.enrollments} / {c.capacity} ({c.utilization}%)</span></div>
     <div className="report-bar-track" role="progressbar" aria-label={'Seat utilization for '+c.name}
      aria-valuenow={c.utilization} aria-valuemin={0} aria-valuemax={100}>
      <span style={{width:c.utilization+'%'}}/></div>
    </div>)}{report.courseRows.every(c=>!c.groups)&&<p className="quiet">No sample groups match the filters.</p>}</div>
    <h3>Individual group capacity</h3>
    <div className="table-wrap"><table><thead><tr><th>Group</th><th>Course</th><th>Teacher</th><th>Schedule</th><th>Enrolled / seats</th><th>Planned sessions</th></tr></thead><tbody>
     {report.classRows.map(c=><tr key={c.id}><td>{c.id.toUpperCase()}</td><td>{c.course}</td><td>{c.teacher}</td><td>{c.slot}</td><td>{c.learners} / {c.capacity}</td><td>{c.sessions}</td></tr>)}
    </tbody></table></div>
   </>}
   {tab==='Teachers'&&<>
    <span className="eyebrow">ILLUSTRATIVE INSTRUCTOR WORKLOAD</span><h2>Teaching allocation</h2>
    <p>Weekly sessions = 2 × assigned groups. This is a planning estimate, not verified teaching time.</p>
    <div className="table-wrap"><table><thead><tr><th>Instructor</th><th>Groups</th><th>Sessions / week</th><th>Enrollments</th><th>Unique learners</th><th>Planned sessions</th></tr></thead><tbody>
     {report.teacherRows.map(t=><tr key={t.id}><td>{t.name}</td><td>{t.groups}</td><td>{t.weeklySessions}</td><td>{t.enrollments}</td><td>{t.uniqueLearners}</td><td>{t.plannedSessions}</td></tr>)}
    </tbody></table></div>
   </>}
   {tab==='Attendance'&&<>
    <span className="eyebrow">MARKED SESSIONS ONLY FOR RATE</span><h2>Attendance summary</h2>
    <div className="report-strips">{[
     ['Opportunities',report.attendance.opportunities],['Present',report.attendance.present],
     ['Late',report.attendance.late],['Absent',report.attendance.absent],
     ['Excused',report.attendance.excused],['Unmarked',report.attendance.unmarked]
    ].map(([k,v])=><div key={String(k)}><strong>{v}</strong><small>{k}</small></div>)}</div>
    <p>Rate: <strong>{rate(report.attendance.markedRate)}</strong> = (Present + Late) / (Present + Late + Absent).
     Excused and unmarked sessions are excluded, never interpreted as absences.</p>
    <div className="table-wrap"><table><thead><tr><th>Group</th><th>Present</th><th>Late</th><th>Absent</th><th>Excused</th><th>Unmarked</th><th>Rate</th></tr></thead><tbody>
     {report.classRows.map(c=><tr key={c.id}><td>{c.course} · {c.id.toUpperCase()}</td><td>{c.attendance.present}</td><td>{c.attendance.late}</td><td>{c.attendance.absent}</td><td>{c.attendance.excused}</td><td>{c.attendance.unmarked}</td><td>{rate(c.attendance.markedRate)}</td></tr>)}
    </tbody></table></div>
   </>}
   {tab==='Grades'&&<>
    <span className="eyebrow">ASSESSED WORK · GRADED SUBMISSIONS ONLY</span><h2>Academic outcomes</h2>
    <div className="report-strips">{[
     ['Assigned seats',report.grades.assigned],['Submitted',report.grades.submitted],
     ['Awaiting review',report.grades.awaitingReview],['Graded',report.grades.graded],
     ['Graded average',rate(report.grades.average)]
    ].map(([k,v])=><div key={String(k)}><strong>{v}</strong><small>{k}</small></div>)}</div>
    <p>The average excludes unsubmitted work and tasks awaiting review. It is not a final course grade.</p>
    <div className="table-wrap"><table><thead><tr><th>Group</th><th>Assigned</th><th>Submitted</th><th>Awaiting review</th><th>Graded</th><th>Average</th></tr></thead><tbody>
     {report.classRows.map(c=><tr key={c.id}><td>{c.course} · {c.id.toUpperCase()}</td><td>{c.grades.assigned}</td><td>{c.grades.submitted}</td><td>{c.grades.awaitingReview}</td><td>{c.grades.graded}</td><td>{rate(c.grades.average)}</td></tr>)}
    </tbody></table></div>
   </>}
   {tab==='Finance'&&<>
    <span className="eyebrow">EXTERNAL PAYMENT TRACKING ONLY</span><h2>Offline fee reconciliation</h2>
    <div className="finance-strip"><div><small>Expected (valid rows)</small><strong>{price(report.fees.due)}</strong></div>
     <div><small>Recorded externally (valid rows)</small><strong>{price(report.fees.recorded)}</strong></div>
     <div><small>Outstanding (valid rows)</small><strong>{price(report.fees.outstanding)}</strong></div></div>
    <div className="report-strips">{[
     ['Paid',report.fees.paid],['Partial',report.fees.partial],['Unpaid',report.fees.unpaid],
     ['Invalid rows',report.fees.exceptions.length]
    ].map(([k,v])=><div key={String(k)}><strong>{v}</strong><small>{k}</small></div>)}</div>
    {report.fees.exceptions.length>0&&<p className="report-warning" role="alert">
     {report.fees.exceptions.length} invalid example rows were excluded from totals. Review them before relying on a report.</p>}
    <div className="table-wrap"><table><thead><tr><th>Period</th><th>Valid items</th><th>Expected</th><th>Recorded</th><th>Outstanding</th></tr></thead><tbody>
     {report.fees.periods.map(p=><tr key={p.name}><td>{p.name}</td><td>{p.rows}</td><td>{price(p.due)}</td><td>{price(p.recorded)}</td><td>{price(p.outstanding)}</td></tr>)}
    </tbody></table></div>
    <h3>Browser-only changes</h3>
    <p>These examples show Finance clicks in this tab, not verified transactions or immutable accounting records.</p>
    {financeChanges.length?<ol className="report-history">{financeChanges.slice(-8).reverse().map(h=><li key={h.sequence}>
     Recorded {price(h.delta)} in a fictional fee row: {price(h.previous)} → {price(h.next)}
    </li>)}</ol>:<p className="quiet">No fictional payment updates have been made this session.</p>}
   </>}
  </section>
  <p className="quiet">This is an aggregate-only fictional preview. The CSV contains no learner/guardian records or individual payments. Refresh resets changes.</p>
 </div>;
}
