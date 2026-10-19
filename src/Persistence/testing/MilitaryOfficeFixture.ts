import type {WorldEvent} from "../../History/WorldHistory";
import type {WorldSaveV18} from "../WorldSaveSchema";
/** Explicitly construct the initial office fact in manually authored current-schema test archives. */
export function addInitialOfficeFacts(save:WorldSaveV18){
  for(const person of save.registries.militaryCommandRegistry.people){
    for(const appointment of person.appointments){
      const eventId=`military-office-${appointment.commandId}-PIJIANG`;
      appointment.officeHistory=[{office:"PIJIANG",month:appointment.startMonth,eventId,serviceMonths:0,captureEventIds:[]}];
      (save.worldHistory.events as WorldEvent[]).push({id:eventId,year:appointment.startMonth,monthIndex:appointment.startMonth,type:"military-office-granted",category:"politics",
        actorFactionId:appointment.factionId,factionIds:[appointment.factionId],title:"授任裨将",importance:"normal",
        metadata:{personId:person.personId,sourceUserId:person.sourceUserId,personalName:person.personalName!,commandId:appointment.commandId,
          office:"PIJIANG",previousOffice:"NONE",serviceMonths:0,captureEventIds:"[]"}});
    }
  }
}
