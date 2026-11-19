import poses from './cargoRiderExpressions.json';

export type CargoPerformance = keyof typeof poses;
export type CargoExpression = 'live' | 'wink' | 'smile' | 'surprise' | CargoPerformance;
export const cargoPerformances = Object.keys(poses) as CargoPerformance[];
export function performanceControls(name: CargoExpression): Readonly<Record<string, number>> | undefined {
  return Object.prototype.hasOwnProperty.call(poses, name) ? poses[name as CargoPerformance] : undefined;
}
