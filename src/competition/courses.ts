export interface CompetitionCourse {
  id:string;
  name:string;
  island:string;
  overviewEye:readonly [number,number,number];
  overviewTarget:readonly [number,number,number];
}
export const COMPETITION_COURSES:Readonly<Record<string,CompetitionCourse>>={
  'jungle-cup':{id:'jungle-cup',name:'Jungle Cup',island:'ISLAND 1',overviewEye:[90,85,54],overviewTarget:[0,1,-46]},
  'waterpark-cup':{id:'waterpark-cup',name:'Deadwater Cup',island:'ISLAND 2',overviewEye:[245,150,155],overviewTarget:[28,10,-60]},
};
export const isCompetitionLevel=(id:string):boolean=>Object.prototype.hasOwnProperty.call(COMPETITION_COURSES,id);
export const competitionCourse=(id:string):CompetitionCourse=>isCompetitionLevel(id)?COMPETITION_COURSES[id]:COMPETITION_COURSES['jungle-cup'];
