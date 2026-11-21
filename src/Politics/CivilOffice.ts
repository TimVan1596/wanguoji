/** Local posts own a city duty; central posts never pretend to own a city. */
export const CIVIL_OFFICES=['XIANLING','JUNSHOU','YUSHI_DAFU','CHENGXIANG'] as const;
export type CivilOffice=typeof CIVIL_OFFICES[number];
export const CIVIL_OFFICE_NAMES:Record<CivilOffice,string>={XIANLING:'县令',JUNSHOU:'郡守',YUSHI_DAFU:'御史大夫',CHENGXIANG:'丞相'};
export const civilOfficeLevel=(office?:CivilOffice)=>CIVIL_OFFICES.indexOf(office??'JUNSHOU');
export const isLocalCivilOffice=(office?:CivilOffice)=>civilOfficeLevel(office)<2;
export function civilOfficeTitle(t:{office?:CivilOffice;cityName?:string}){return `${isLocalCivilOffice(t.office)?t.cityName??'': ''}${CIVIL_OFFICE_NAMES[t.office??'JUNSHOU']}`;}
export const civilOfficeDuties:Record<CivilOffice,string>={XIANLING:'负责本城基层治理，恢复忠诚及战乱创伤。',JUNSHOU:'负责本城地方治理，凭真实治绩参与升迁。',YUSHI_DAFU:'中央督察地方恢复；按真实治理事项形成监督政绩，不拥有地方城池。',CHENGXIANG:'统筹国家现有城市恢复事务；不具有军事编组指挥权。'};
export function civilOfficeCap(cities:number){return Math.min(3,Math.max(1,Math.ceil(cities/4)));}
export function centralCivilOfficeAvailable(office:CivilOffice,cities:number,terms:readonly {office?:CivilOffice;endMonth?:number;factionId:string}[],factionId:string){return isLocalCivilOffice(office)||civilOfficeCap(cities)>=(office==='CHENGXIANG'?3:2)&&!terms.some(t=>t.factionId===factionId&&t.endMonth===undefined&&t.office===office);}
