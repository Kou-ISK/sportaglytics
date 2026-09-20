export type TacticalMarkerKind = 'team1' | 'team2' | 'neutral' | 'ball';
export interface TacticalPoint {
  x: number;
  y: number;
}
export interface TacticalMarker extends TacticalPoint {
  id: string;
  kind: TacticalMarkerKind;
  label: string;
}
export interface TacticalArrow {
  id: string;
  from: TacticalPoint;
  to: TacticalPoint;
}
/** ピッチ座標はメートル。time はクリップの開始からの秒数。 */
export interface TacticalBoard {
  widthMeters: number;
  lengthMeters: number;
  time: number;
  markers: TacticalMarker[];
  arrows: TacticalArrow[];
}
