/** Versioned opportunity policies. Only experiments select LOW/HIGH; production uses MEDIUM. */
export type PoliticalCalibration='BASELINE'|'LOW'|'MEDIUM'|'HIGH';
export const DEFAULT_POLITICAL_CALIBRATION:PoliticalCalibration='MEDIUM';
export const POLITICAL_CALIBRATIONS={
 BASELINE:{evidenceMonths:36,emptyDrawCooldown:true,vulnerableStability:40,vulnerableCities:2,majorShockStability:0,depositionBase:.005,depositionStep:.005,depositionCap:.015,militaryCap:.03,shockScore:2,shockBase:.02,shockCap:.06,familyChild:1.10,familyGrandchild:1.05},
 LOW:{evidenceMonths:48,emptyDrawCooldown:false,vulnerableStability:45,vulnerableCities:2,majorShockStability:55,depositionBase:.008,depositionStep:.006,depositionCap:.025,militaryCap:.035,shockScore:1,shockBase:.03,shockCap:.07,familyChild:1.25,familyGrandchild:1.12},
 MEDIUM:{evidenceMonths:60,emptyDrawCooldown:false,vulnerableStability:45,vulnerableCities:3,majorShockStability:65,depositionBase:.012,depositionStep:.008,depositionCap:.04,militaryCap:.05,shockScore:1,shockBase:.05,shockCap:.10,familyChild:1.50,familyGrandchild:1.25},
 HIGH:{evidenceMonths:72,emptyDrawCooldown:false,vulnerableStability:50,vulnerableCities:4,majorShockStability:75,depositionBase:.02,depositionStep:.01,depositionCap:.06,militaryCap:.075,shockScore:0,shockBase:.08,shockCap:.14,familyChild:2,familyGrandchild:1.50},
} as const;
export function isPoliticalCalibration(value:unknown):value is PoliticalCalibration{return typeof value==='string'&&Object.prototype.hasOwnProperty.call(POLITICAL_CALIBRATIONS,value);}
export function calibrationOrBaseline(value:unknown):PoliticalCalibration{return isPoliticalCalibration(value)?value:'BASELINE';}
export function depositionVulnerability(stability:number|undefined,cities:number,majorShock:boolean,policy:PoliticalCalibration='BASELINE'){
 const p=POLITICAL_CALIBRATIONS[policy];return (stability!==undefined&&stability<=p.vulnerableStability)||(cities>=1&&cities<=p.vulnerableCities)||majorShock&&stability!==undefined&&stability<=p.majorShockStability;
}
