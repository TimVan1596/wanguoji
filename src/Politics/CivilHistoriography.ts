import type {CivilGovernorTerm} from './CivilAdministrationSchema';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import {CIVIL_OFFICE_NAMES,civilOfficeLevel} from './CivilOffice';
import {formatWorldDuration} from '../Simulation/WorldTime';
/** An account of recorded service, not character judgement from ability scores. */
export function civilCareerReading(terms:readonly CivilGovernorTerm[],person:MilitaryPerson|undefined,month:number){
 const rows=terms.filter(t=>t.startMonth<=month),offices=[...new Set(rows.map(t=>CIVIL_OFFICE_NAMES[t.office??'JUNSHOU']))],cities=[...new Set(rows.flatMap(t=>t.cityName?[t.cityName]:[]))],service=rows.reduce((n,t)=>n+Math.max(0,Math.min(t.endMonth??month,month)-t.startMonth),0),recovery=rows.reduce((n,t)=>n+t.loyaltyRecovered+t.devastationRecovered,0),assessments=rows.flatMap(t=>t.stewardshipAssessments??[]).filter(a=>a.month<=month),promotions=rows.filter(t=>t.promotion),retired=rows.some(t=>t.endReason==='RETIREMENT'&&t.endMonth!<=month),lost=rows.filter(t=>t.endReason==='CITY_LOST'&&t.endMonth!<=month),central=rows.some(t=>civilOfficeLevel(t.office)>=2),dual=!!person?.appointments.some(a=>a.startMonth<=month);
 if(!rows.length)return {life:[],assessment:[]};
 const life=[`历任${offices.join('、')}${cities.length?`，先后任事于${cities.join('、')}`:''}，累计实任${formatWorldDuration(service)}。`];
 if(dual)life.push('另有正式军旅任职记录，文武生涯沿用同一人物身份。');
 const assessment=[recovery?`任内记录有恢复型治理贡献${recovery}点${assessments.length?`，另有${assessments.length}次守成考课`:''}；两者分别记载。`:assessments.length?`存有${assessments.length}次连续稳定观察所据的守成考课；不据此推称战乱恢复之功。`:'现存履历未见恢复型治绩或守成考课记录，不据能力数值推定功绩。',central?`经正式升迁进入中央文职${retired?'，其后有致仕记录':''}。`:promotions.length?`有${promotions.length}次正式升迁记录${retired?'，其后致仕':''}。`:retired?'未见正式升迁，后依法致仕。':'现存履历未见正式升迁记录。'];
 if(lost.length)assessment.push(`有${lost.length}次失城离任记录；失守本身不等于政治获罪。`);
 else if(person?.politicalHistory?.some(a=>a.month<=month))assessment.push('另有正式政治处分或赦免史事，评价须与当时法律状态分读。');
 else if(person?.nobilityHistory?.some(g=>g.month<=month))assessment.push('曾有正式授爵记录，爵位权源与治理记录分别保留。');
 return {life,assessment:assessment.slice(0,3)};
}
