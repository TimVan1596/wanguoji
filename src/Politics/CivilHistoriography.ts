import type {CivilGovernorTerm} from './CivilAdministrationSchema';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import {CIVIL_OFFICE_NAMES,civilOfficeLevel} from './CivilOffice';
import {formatWorldDate,formatWorldDuration} from '../Simulation/WorldTime';
/** An account of recorded service, not character judgement from ability scores. */
export function civilCareerReading(terms:readonly CivilGovernorTerm[],person:MilitaryPerson|undefined,month:number){
 const rows=terms.filter(t=>t.startMonth<=month),offices=[...new Set(rows.map(t=>CIVIL_OFFICE_NAMES[t.office??'JUNSHOU']))],cities=[...new Set(rows.flatMap(t=>t.cityName?[t.cityName]:[]))],service=rows.reduce((n,t)=>n+Math.max(0,Math.min(t.endMonth??month,month)-t.startMonth),0),recovery=rows.flatMap(t=>t.receipts??[]).filter(r=>r.month<=month),assessments=rows.flatMap(t=>t.stewardshipAssessments??[]).filter(a=>a.month<=month),promotions=rows.filter(t=>t.promotion),retired=rows.filter(t=>t.endReason==='RETIREMENT'&&t.endMonth!<=month).at(-1),lost=rows.filter(t=>t.endReason==='CITY_LOST'&&t.endMonth!<=month),central=rows.some(t=>civilOfficeLevel(t.office)>=2),dual=!!person?.appointments.some(a=>a.startMonth<=month);
 if(!rows.length)return {life:[],assessment:[]};
 const life=[`历任${offices.join('、')}${cities.length?`，先后任事于${cities.join('、')}`:''}，累计实任${formatWorldDuration(service)}。`];
 if(dual)life.push('另有正式军旅任职记录，文武生涯沿用同一人物身份。');
 if(assessments.length)life.push(`任内有${assessments.length}次守成考课称职。`);
 if(retired)life.push(`${formatWorldDate(retired.endMonth!)}致仕。`);
 const assessment:string[]=[];
 if(recovery.length)assessment.push(recovery.length>1?'任内多次办理城邑恢复事务，有实绩可考。':'任内曾办理城邑恢复事务。');
 if(promotions.length||retired)assessment.push(`${central?'经升迁入任中央文职':promotions.length?'曾获正式升迁':'久任地方'}${retired?'，曾经致仕':''}。`);
 if(!assessment.length)assessment.push(assessments.length?'其任可考者，以稳定城邑的守成考课为主。':'履历所载以任官记事为主。');
 if(lost.length)assessment.push(`有${lost.length}次失城离任记录；失守本身不等于政治获罪。`);
 else if(person?.politicalHistory?.some(a=>a.month<=month))assessment.push('另有正式政治处分或赦免史事，评价须与当时法律状态分读。');
 else if(person?.nobilityHistory?.some(g=>g.month<=month))assessment.push('曾有正式授爵记录，爵位权源与治理记录分别保留。');
 return {life,assessment:assessment.slice(0,3)};
}
