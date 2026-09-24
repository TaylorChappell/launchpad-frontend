import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Dialog } from "./StudioControls";
import type { StudioSurveyData, StudioSurveyAnswer } from "../studio-api";
import "./studio-survey.css";

export function StudioSurvey({survey,onComplete,onSkip,onClose}:{survey:StudioSurveyData;onComplete:(answers:StudioSurveyAnswer[])=>void;onSkip:()=>void;onClose:()=>void}) {
  const [step,setStep]=useState(0);
  const [choices,setChoices]=useState<Record<string,string>>({});
  const [custom,setCustom]=useState<Record<string,string>>({});
  const heading=useRef<HTMLHeadingElement>(null),submitted=useRef(false);
  const question=survey.questions[step],selected=choices[question.id];
  const ready=selected!==undefined&&(selected!=="custom"||Boolean(custom[question.id]?.trim()));
  useLayoutEffect(()=>{heading.current?.focus();},[step]);
  function finish(skip=false){
    if(submitted.current)return;
    const answers=survey.questions.map(question=>{
      const choice=choices[question.id],option=question.options[Number(choice)];
      return {...(question.topic?{topic:question.topic}:{}),question:question.question,answer:choice==="custom"?custom[question.id]?.trim()??"":option?option.label+(option.description?": "+option.description:""):""};
    });
    if(!skip&&answers.some(answer=>!answer.answer))return;
    submitted.current=true;
    if(skip)onSkip();else onComplete(answers);
  }
  return <Dialog title="A few creative choices" className="at-survey-dialog" onClose={onClose}>
    <p className="at-survey-title">{survey.title}</p>
    <div className="at-survey-progress" aria-label={`Question ${step+1} of ${survey.questions.length}`}>
      <div aria-hidden="true">{survey.questions.map((q,index)=><i key={q.id} className={index<=step?"is-filled":""}/>)}</div>
      <span>{step+1} of {survey.questions.length}</span>
    </div>
    <form onSubmit={event=>{event.preventDefault();if(!ready)return;if(step<survey.questions.length-1)setStep(step+1);else finish();}}>
      <h3 ref={heading} tabIndex={-1} id="at-survey-question">{question.question}</h3>
      <div className="at-survey-options" role="radiogroup" aria-labelledby="at-survey-question">
        {question.options.map((option,index)=><label key={question.id+index} className={`at-survey-choice ${selected===String(index)?"is-selected":""}`}>
          <input type="radio" name={question.id} value={index} checked={selected===String(index)} onChange={()=>setChoices(old=>({...old,[question.id]:String(index)}))}/>
          <span className="at-survey-radio" aria-hidden="true">{selected===String(index)&&<Check size={12}/>}</span>
          <span><strong>{option.label}</strong>{option.description&&<small>{option.description}</small>}</span>
        </label>)}
        <label className={`at-survey-choice at-survey-custom ${selected==="custom"?"is-selected":""}`}>
          <input type="radio" name={question.id} value="custom" checked={selected==="custom"} onChange={()=>setChoices(old=>({...old,[question.id]:"custom"}))}/>
          <span className="at-survey-radio" aria-hidden="true">{selected==="custom"&&<Check size={12}/>}</span>
          <span><strong>My own answer</strong><small>Describe what you have in mind.</small></span>
        </label>
      </div>
      {selected==="custom"&&<textarea key={question.id} className="at-survey-custom-input" autoFocus aria-label="Your custom answer" placeholder="Tell Atlantis your idea…" value={custom[question.id]??""} maxLength={1000} rows={3} onChange={event=>setCustom(old=>({...old,[question.id]:event.target.value}))}/>}
      <footer className="at-survey-actions">
        <button type="button" className="at-survey-skip" onClick={()=>finish(true)}>Skip this survey</button>
        <div>{step>0&&<button type="button" className="at-survey-back" aria-label="Previous question" onClick={()=>setStep(step-1)}><ArrowLeft size={16}/></button>}
          <button type="submit" className="at-primary" disabled={!ready}>{step===survey.questions.length-1?"Start creating":"Next"}<ArrowRight size={16}/></button>
        </div>
      </footer>
    </form>
  </Dialog>;
}
