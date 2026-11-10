import { useMemo, useState, type FormEvent } from 'react';
import { visibleDemoClasses } from '../lib/operations.mjs';
import type {CourseRecord} from './AcademyCourseCatalog';
import {
  createDemoAssessment, reviseDemoAssessment, submitDemoProject, submitDemoQuiz, gradeDemoProject,
  visibleDemoTasks, demoGradeRows, demoProgress
} from '../lib/assessments.mjs';
import type { ClassRoom, Person } from './AcademyOperations';
import type { Term } from './AcademyAcademics';

export type RubricCriterion={id:string;label:string;max:number};
export type Question={prompt:string;options:string[];answer:number};
export type Assessment={id:string;classId:string;termId:string;kind:'project'|'quiz';title:string;
  instructions:string;dueDate:string;rubric:RubricCriterion[];questions:Question[]};
export type DemoSubmission={taskId:string;learnerId:string;response:string;answers:number[];
  status:'submitted'|'graded';points:number|null;maxPoints:number;rubricScores:Record<string,number>|null;feedback:string};
export type GradeChange={sequence:number;taskId:string;learnerId:string;from:number|null;to:number};
export type AssessmentState={tasks:Assessment[];submissions:DemoSubmission[];gradeHistory:GradeChange[]};
type Role='Student'|'Teacher'|'Administrator';
type GradeRow={taskId:string;classId:string;learnerId:string;title:string;kind:string;
  status:string;points:number|null;maxPoints:number};
type Props={view:'Assignments'|'Quizzes'|'Grades';role:Role;classes:ClassRoom[];courses:CourseRecord[];learners:Person[];teacherId?:string;learnerId?:string;terms:Term[];
  state:AssessmentState;onUpdate:(newState:AssessmentState)=>void};
function ProjectResponse({onSubmit}:{onSubmit:(value:string)=>void}){
  const [response,setResponse]=useState('');
  return <form className="assessment-form" onSubmit={e=>{e.preventDefault();onSubmit(response);}}>
    <label>Write a fictional response — no actual schoolwork or personal details
      <textarea rows={5} minLength={15} maxLength={800} required placeholder="For example: The CPU processes instructions…"
        value={response} onChange={e=>setResponse(e.target.value)}/></label>
    <button className="primary-btn" type="submit">Submit sample project</button>
  </form>;
}
function QuizResponse({task,onSubmit}:{task:Assessment;onSubmit:(answers:number[])=>void}){
  const [answers,setAnswers]=useState<Record<number,number>>({});
  return <form className="assessment-form" onSubmit={e=>{e.preventDefault();onSubmit(task.questions.map((_,i)=>answers[i]??-1));}}>
    {task.questions.map((q,i)=><fieldset key={i} className="quiz-question"><legend>{i+1}. {q.prompt}</legend>
      {q.options.map((option,j)=><label key={j} className="quiz-option">
        <input type="radio" name={'question-'+i} value={j} required checked={answers[i]===j}
          onChange={()=>setAnswers(current=>({...current,[i]:j}))}/>
        <span>{option}</span>
      </label>)}
    </fieldset>)}
    <button className="primary-btn" type="submit">Submit and score sample quiz</button>
  </form>;
}
function RubricEditor({task,submission,onGrade}:{task:Assessment;submission:DemoSubmission;
  onGrade:(scores:Record<string,number>,feedback:string)=>void}){
  const [scores,setScores]=useState<Record<string,number>>(()=>Object.fromEntries(
    task.rubric.map(r=>[r.id,submission.rubricScores?.[r.id]??0])));
  const [feedback,setFeedback]=useState(submission.feedback||'Good effort. Review the example and check your explanations.');
  const total=task.rubric.reduce((sum,r)=>sum+(scores[r.id]??0),0);
  return <form className="assessment-form" onSubmit={e=>{e.preventDefault();onGrade(scores,feedback);}}>
    <div className="assessment-rubric">{task.rubric.map(r=><label key={r.id}>{r.label} (0–{r.max})
      <select value={scores[r.id]} onChange={e=>setScores(current=>({...current,[r.id]:Number(e.target.value)}))}>
        {Array.from({length:r.max+1},(_,i)=><option value={i} key={i}>{i} / {r.max}</option>)}
      </select>
    </label>)}</div>
    <p>Proposed rubric score: <strong>{total} / {task.rubric.reduce((sum,r)=>sum+r.max,0)}</strong></p>
    <label>Teacher feedback<textarea rows={3} value={feedback} minLength={8} maxLength={300} required
      onChange={e=>setFeedback(e.target.value)}/></label>
    <button className="primary-btn" type="submit">{submission.status==='graded'?'Update sample grade':'Save sample grade'}</button>
  </form>;
}

function AssessmentEditor({task,term,onSave}:{task:Assessment;term:Term;
  onSave:(title:string,instructions:string,dueDate:string)=>void}){
  const [title,setTitle]=useState(task.title);
  const [instructions,setInstructions]=useState(task.instructions);
  const [dueDate,setDueDate]=useState(task.dueDate);
  return <form className="assessment-form assessment-edit" onSubmit={e=>{e.preventDefault();onSave(title,instructions,dueDate);}}>
    <label>Task title<input value={title} onChange={e=>setTitle(e.target.value)} minLength={5} maxLength={90} required/></label>
    <label>Instructions<textarea value={instructions} onChange={e=>setInstructions(e.target.value)}
      minLength={15} maxLength={500} rows={3} required/></label>
    <label>Due date<input type="date" value={dueDate} min={term.start} max={term.end}
      onChange={e=>setDueDate(e.target.value)} required/></label>
    <p className="quiet">This edits the title, instructions and deadline only. Existing rubric scores, quiz answers and submissions remain unchanged.</p>
    <button className="primary-btn" type="submit">Save task changes</button>
  </form>;
}
export default function AcademyAssessments({view,role,classes,courses,learners,terms,state,onUpdate,teacherId='teacher-a',learnerId='learner-a'}:Props){
  const courseName=(id:string)=>courses.find(x=>x.id===id)?.name??'Sample course';
  const learnerName=(id:string)=>learners.find(x=>x.id===id)?.name??'Sample learner';
  const groupList=useMemo(()=>visibleDemoClasses(classes,role,{teacherId,learnerId}),[classes,role,teacherId,learnerId]);
  const [classChoice,setClassChoice]=useState('');
  const [taskChoice,setTaskChoice]=useState('');
  const [learnerChoice,setLearnerChoice]=useState('');
  const [title,setTitle]=useState('');
  const [instructions,setInstructions]=useState('Complete this fictional classroom exercise with a clear explanation.');
  const [dueDate,setDueDate]=useState('2026-11-02');
  const [termId,setTermId]=useState('term-autumn-2026');
  const [message,setMessage]=useState('');
  const [showGradeHistory,setShowGradeHistory]=useState(false);
  const [editingTask,setEditingTask]=useState(false);
  const educator=role!=='Student';
  const selectedClass=groupList.find(c=>c.id===classChoice)??groupList[0];
  const kind=view==='Quizzes'?'quiz':'project';
  const visible: Assessment[]=visibleDemoTasks(state.tasks,classes,role,view==='Grades'?undefined:kind,{teacherId,learnerId});
  const filtered=visible.filter(t=>t.classId===selectedClass?.id);
  const selectedTask=filtered.find(t=>t.id===taskChoice)??filtered[0];
  const selectedSubmissions=state.submissions.filter(s=>s.taskId===selectedTask?.id
    &&selectedClass?.learnerIds.includes(s.learnerId));
  const submittedProjects=selectedSubmissions.filter(s=>s.status==='submitted'||s.status==='graded');
  const pickedSubmission=submittedProjects.find(s=>s.learnerId===learnerChoice)??submittedProjects[0];
  const mine=state.submissions.find(s=>s.taskId===selectedTask?.id&&s.learnerId===learnerId);
  const gradeRows: GradeRow[]=(demoGradeRows(state,classes,role,{teacherId,learnerId}) as GradeRow[]).filter(row=>row.classId===selectedClass?.id);
  const stats=demoProgress(gradeRows);
  const term=terms.find(t=>t.id===termId)??terms[0];
  const selectedTaskTerm=terms.find(t=>t.id===selectedTask?.termId);
  const scoreValue=(points:number|null,max:number)=>points===null?'Pending':points+' / '+max;
  function apply(fn:()=>AssessmentState,success:string):boolean{
    try{onUpdate(fn());setMessage(success);return true;}
    catch(e){setMessage(e instanceof Error?e.message:'Unable to update the fictional exercise');return false;}
  }
  function createTask(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!selectedClass||!term)return;
    apply(()=>createDemoAssessment(state,{classes,terms,role,classId:selectedClass.id,termId:term.id,
      kind,title,instructions,dueDate,teacherId,courses}),'Created a fictional '+kind+'. Select it to continue.');
    setTaskChoice('');
  }
  function saveTask(nextTitle:string,nextInstructions:string,nextDueDate:string){
    if(!selectedTask)return;
    const saved=apply(()=>reviseDemoAssessment(state,{classes,terms,role,taskId:selectedTask.id,
      title:nextTitle,instructions:nextInstructions,dueDate:nextDueDate,teacherId}),
      'Updated fictional task details. Existing submissions and grades were preserved.');
    if(saved)setEditingTask(false);
  }
  return <div className="assessment-workspace">
    <section className="panel">
      <span className="eyebrow">ACADEMY ASSESSMENTS · FICTIONAL DEMO</span>
      <h2>{view==='Grades'?'Gradebook and progress':view==='Quizzes'?'Practice quizzes':'Class assignments'}</h2>
      <p>Activities belong to a specific class group. Submissions and scores live only in this browser tab.</p>
      <div className="assessment-header">
        <label>Class group
          <select value={selectedClass?.id??''} onChange={e=>{setClassChoice(e.target.value);setTaskChoice('');setLearnerChoice('');setEditingTask(false);setMessage('');}}>
            {!groupList.length&&<option value="">No assigned class</option>}
            {groupList.map(c=><option value={c.id} key={c.id}>{courseName(c.courseId)} · {c.id.toUpperCase()}</option>)}
          </select>
        </label>
        {view!=='Grades'&&selectedClass&&<div className="assessment-type-summary">
          <strong>{filtered.length}</strong><small>{view==='Quizzes'?'Quizzes':'Projects'} in this group</small>
        </div>}
      </div>
      {view==='Grades'?<div className="assessment-stats">
        <div><strong>{stats.assigned}</strong><small>Assigned tasks</small></div>
        <div><strong>{stats.submitted}</strong><small>Submitted</small></div>
        <div><strong>{stats.awaitingReview}</strong><small>Awaiting review</small></div>
        <div><strong>{stats.percentage===null?'—':stats.percentage+'%'}</strong><small>Average graded score</small></div>
      </div>:<div className="assessment-task-list">
        {filtered.map(t=><button type="button" key={t.id} aria-pressed={t.id===selectedTask?.id}
          onClick={()=>{setTaskChoice(t.id);setLearnerChoice('');setEditingTask(false);setMessage('');}}
          className={'assessment-task '+(t.id===selectedTask?.id?'selected':'')}>
          <strong>{t.title}</strong>
          <small>Due {t.dueDate} · {t.kind==='quiz'?t.questions.length+' questions':t.rubric.reduce((sum,r)=>sum+r.max,0)+' rubric points'}</small>
        </button>)}
        {!filtered.length&&<p className="quiet">No fictional {kind}s have been created for this class.</p>}
      </div>}
    </section>
    {view==='Grades'&&<section className="panel">
      <span className="eyebrow">GRADEBOOK · FICTIONAL COURSE PROGRESS</span><h2>{educator?'Class grades':'My sample progress'}</h2>
      <div className="table-wrap"><table><thead><tr><th>Learner</th><th>Task</th><th>Type</th><th>Status</th><th>Grade</th></tr></thead><tbody>
        {gradeRows.map(row=><tr key={row.taskId+':'+row.learnerId}>
          <td>{learnerName(row.learnerId)}</td><td>{row.title}</td><td>{row.kind}</td><td>{row.status}</td>
          <td>{row.points===null?'—':scoreValue(row.points,row.maxPoints)}</td>
        </tr>)}
      </tbody></table></div>
      {!gradeRows.length&&<p className="quiet">No assigned learners or assessments for this sample class.</p>}
      <p className="quiet">The average includes only graded submissions, not outstanding work. No actual report cards or exports.</p>
    </section>}
    {view!=='Grades'&&selectedTask&&selectedClass&&<section className="panel">
      <span className="eyebrow">{view==='Quizzes'?'MULTIPLE-CHOICE QUIZ':'PROJECT ASSIGNMENT'} · {selectedClass.id.toUpperCase()}</span>
      <h2>{selectedTask.title}</h2><p>{selectedTask.instructions}</p>
      <p className="assessment-due">Due {selectedTask.dueDate} · {courseName(selectedClass.courseId)}</p>
      {selectedTask.kind==='project'&&<div className="assessment-criteria"><strong>Scoring rubric</strong>
        {selectedTask.rubric.map(r=><span key={r.id}>{r.label} · {r.max} points</span>)}
      </div>}
      {role==='Student'&&<>
        {mine?<div className="assessment-result"><strong>{mine.status==='graded'?'Marked sample work':'Submission recorded'}</strong>
          <p>{mine.status==='graded'?'Score: '+scoreValue(mine.points,mine.maxPoints):'Awaiting sample teacher review.'}</p>
          {mine.feedback&&<p>{mine.feedback}</p>}
          {selectedTask.kind==='quiz'&&<p>This browser demonstration reveals the quiz grade immediately. Answers are not securely stored.</p>}
        </div>:selectedTask.kind==='project'
          ?<ProjectResponse key={selectedTask.id} onSubmit={response=>apply(()=>submitDemoProject(state,{classes,role,
              taskId:selectedTask.id,learnerId,previewLearnerId:learnerId,response}),'Submitted fictional work for teacher review.')}/>
          :<QuizResponse key={selectedTask.id} task={selectedTask}
            onSubmit={answers=>apply(()=>submitDemoQuiz(state,{classes,role,taskId:selectedTask.id,
              learnerId,previewLearnerId:learnerId,answers}),'Quiz submitted and automatically scored (demo only).')}/>}
      </>}
      {educator&&<>
        <div className="assessment-edit-actions">
          <button type="button" className="small-btn" aria-expanded={editingTask}
            onClick={()=>setEditingTask(value=>!value)}>{editingTask?'Cancel task editing':'Edit task details'}</button>
        </div>
        {editingTask&&selectedTaskTerm&&<AssessmentEditor key={selectedTask.id} task={selectedTask}
          term={selectedTaskTerm} onSave={saveTask}/>}
        <h3>{selectedTask.kind==='project'?'Sample submissions and review':'Automatically marked sample quiz responses'}</h3>
        <div className="assessment-sub-list">
          {selectedSubmissions.map(s=><button type="button" key={s.learnerId}
            className={'assessment-sub '+(s.learnerId===pickedSubmission?.learnerId?'selected':'')}
            onClick={()=>{setLearnerChoice(s.learnerId);setMessage('');}}>
            <strong>{learnerName(s.learnerId)}</strong><small>{s.status==='graded'?scoreValue(s.points,s.maxPoints):'Awaiting review'}</small>
          </button>)}
          {!selectedSubmissions.length&&<p className="quiet">No fictional submissions yet. Switch to Student preview to submit sample work, then return here.</p>}
        </div>
        {pickedSubmission&&selectedTask.kind==='project'&&<>
          <div className="assessment-written"><strong>Sample response</strong><p>{pickedSubmission.response}</p></div>
          <RubricEditor key={selectedTask.id+'-'+pickedSubmission.learnerId+'-'+pickedSubmission.status}
            task={selectedTask} submission={pickedSubmission}
            onGrade={(scores,feedback)=>apply(()=>gradeDemoProject(state,{classes,role,
              taskId:selectedTask.id,learnerId:pickedSubmission.learnerId,scores,feedback,teacherId}),
              'Fictional grade recorded with a browser-only correction entry.')}/>
          <button className="text-btn" type="button" onClick={()=>setShowGradeHistory(!showGradeHistory)}
            aria-expanded={showGradeHistory}>{showGradeHistory?'Hide':'Show'} sample regrade history</button>
          {showGradeHistory&&<ol className="assessment-history">{state.gradeHistory.filter(x=>x.taskId===selectedTask.id
            &&x.learnerId===pickedSubmission.learnerId).map(x=><li key={x.sequence}>
              {x.from===null?'Unmarked':x.from} → {x.to} points
            </li>)}</ol>}
        </>}
        {pickedSubmission&&selectedTask.kind==='quiz'&&<p className="assessment-written">
          Auto-scored {scoreValue(pickedSubmission.points,pickedSubmission.maxPoints)}. Results cannot be manually changed in this preview.
        </p>}
      </>}
    </section>}
    {educator&&view!=='Grades'&&selectedClass&&<section className="panel">
      <span className="eyebrow">TEACHER TOOLS · SAMPLE CLASS ONLY</span>
      <h2>Create a fictional {kind}</h2>
      <p>{kind==='quiz'?'Quiz questions come from this course’s fixed sample question bank.':'Projects use a three-criterion, 10-point scoring rubric.'}</p>
      <form className="assessment-form assessment-create" onSubmit={createTask}>
        <label>Task title<input required minLength={5} maxLength={90} value={title} onChange={e=>setTitle(e.target.value)}
          placeholder={kind==='quiz'?'New class quiz':'New class project'}/></label>
        <label>Instructions<textarea required minLength={15} maxLength={500} rows={3}
          value={instructions} onChange={e=>setInstructions(e.target.value)}/></label>
        <div className="assessment-form-row">
          <label>Academic term<select value={term?.id??''} onChange={e=>{setTermId(e.target.value);
            const next=terms.find(t=>t.id===e.target.value);if(next)setDueDate(next.start);}}>
            {terms.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label>Due date<input type="date" required min={term?.start} max={term?.end} value={dueDate}
            onChange={e=>setDueDate(e.target.value)}/></label>
        </div>
        <button className="primary-btn" type="submit">Create fictional {kind}</button>
      </form>
    </section>}
    <p role="status" aria-live="polite" className="ops-feedback">{message}</p>
    <p className="quiet">No real student data, uploads, notifications or permanent grades. Preview role switching is not secure access control; refresh resets all submissions and scores.</p>
  </div>;
}
