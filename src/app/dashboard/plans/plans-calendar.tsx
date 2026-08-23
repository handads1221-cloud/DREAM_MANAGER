'use client';

import { useMemo, useState } from 'react';
import { createPlan, deletePlan, updatePlan } from './actions';

export type Plan = { id:string; schedule_date:string; schedule_time:string|null; title:string; details:string; created_at:string; updated_at:string; creator_name:string };
const weekdays = ['일','월','화','수','목','금','토'];
const iso = (year:number,month:number,day:number) => `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
const timeText = (value:string|null) => value ? value.slice(0,5) : '시간 미정';

function PlanForm({ plan, defaultDate, onCancel }: { plan?:Plan; defaultDate:string; onCancel:()=>void }) {
  return <form action={plan ? updatePlan : createPlan} className="plan-form">{plan && <input type="hidden" name="id" value={plan.id}/>}<label><span>날짜</span><input type="date" name="schedule_date" defaultValue={plan?.schedule_date ?? defaultDate} required/></label><label><span>시간</span><input type="time" name="schedule_time" defaultValue={plan?.schedule_time?.slice(0,5) ?? ''}/></label><label className="wide"><span>제목</span><input name="title" maxLength={120} defaultValue={plan?.title ?? ''} placeholder="예: 수련회 뒷풀이 고기파티" required/></label><label className="wide"><span>상세내용</span><textarea name="details" maxLength={5000} defaultValue={plan?.details ?? ''} rows={5} placeholder="준비물, 장소, 담당자 등 공유할 내용을 입력하세요."/></label><div className="plan-form-actions"><button type="button" className="secondary" onClick={onCancel}>취소</button><button type="submit">{plan ? '수정 저장' : '일정 등록'}</button></div></form>;
}

export function PlansCalendar({ plans, today }: { plans:Plan[]; today:string }) {
  const initial = today.split('-').map(Number); const [cursor,setCursor] = useState(new Date(initial[0],initial[1]-1,1)); const [selected,setSelected] = useState<Plan|null>(null); const [form,setForm] = useState<'new'|'edit'|null>(null); const [selectedDate,setSelectedDate] = useState(today);
  const year=cursor.getFullYear(), month=cursor.getMonth(), firstDay=new Date(year,month,1).getDay(), days=new Date(year,month+1,0).getDate();
  const byDate = useMemo(() => plans.reduce<Record<string,Plan[]>>((all,plan) => { (all[plan.schedule_date] ??= []).push(plan); return all; },{}),[plans]);
  const cells = [...Array(firstDay).fill(null),...Array.from({length:days},(_,index)=>index+1)];
  const move = (amount:number) => { setCursor(new Date(year,month+amount,1)); setSelected(null); setForm(null); };
  return <div className="plans-workspace"><div className="plans-toolbar"><div><button type="button" onClick={()=>move(-1)} aria-label="이전 달">‹</button><h2>{year}년 {month+1}월</h2><button type="button" onClick={()=>move(1)} aria-label="다음 달">›</button></div><button type="button" className="plan-add-button" onClick={()=>{setSelectedDate(today);setSelected(null);setForm('new');}}>＋ 일정등록</button></div>
    {form === 'new' && <section className="plan-editor"><h3>새로운 일정</h3><PlanForm defaultDate={selectedDate} onCancel={()=>setForm(null)}/></section>}
    <section className="plans-calendar"><div className="plans-weekdays">{weekdays.map((day,index)=><b key={day} className={index===0?'sunday':index===6?'saturday':''}>{day}</b>)}</div><div className="plans-days">{cells.map((day,index)=>day===null?<div className="plan-day blank" key={`blank-${index}`}/>:<div key={day} className={`plan-day ${iso(year,month,day)===today?'today':''}`}><button type="button" className="plan-day-number" onClick={()=>{setSelectedDate(iso(year,month,day));setSelected(null);setForm('new');}}>{day}</button><div>{(byDate[iso(year,month,day)]??[]).slice(0,3).map(plan=><button key={plan.id} type="button" className="plan-chip" onClick={()=>{setSelected(plan);setForm(null);}}><small>{plan.schedule_time?.slice(0,5)}</small>{plan.title}</button>)}{(byDate[iso(year,month,day)]??[]).length>3&&<span className="plan-more">+{byDate[iso(year,month,day)].length-3}개</span>}</div></div>)}</div></section>
    {selected && <section className="plan-detail"><div className="plan-detail-heading"><div><p>{Number(selected.schedule_date.slice(5,7))}월 {Number(selected.schedule_date.slice(8,10))}일 · {timeText(selected.schedule_time)}</p><h2>{selected.title}</h2></div><span>{selected.creator_name} 등록</span></div><p className="plan-detail-body">{selected.details || '등록된 상세내용이 없습니다.'}</p>{form==='edit'?<PlanForm plan={selected} defaultDate={selected.schedule_date} onCancel={()=>setForm(null)}/>:<div className="plan-detail-actions"><button type="button" onClick={()=>setForm('edit')}>일정 수정</button><form action={deletePlan} onSubmit={(event)=>{if(!confirm('이 일정을 삭제하시겠습니까?')) event.preventDefault();}}><input type="hidden" name="id" value={selected.id}/><button type="submit" className="danger">일정 삭제</button></form></div>}</section>}
  </div>;
}
