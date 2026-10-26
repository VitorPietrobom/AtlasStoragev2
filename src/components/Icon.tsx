import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'search'
  | 'camera'
  | 'back'
  | 'chevronDown'
  | 'chevronRight'
  | 'close'
  | 'plus'
  | 'minus'
  | 'edit'
  | 'gridPlus'
  | 'more'
  | 'up'
  | 'down'
  | 'check';

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color: string }) {
  const p = { stroke: color, strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'search' && (
        <>
          <Circle cx={10.5} cy={10.5} r={6} {...p} />
          <Path d="M15 15l5 5" {...p} />
        </>
      )}
      {name === 'camera' && (
        <>
          <Path d="M4 8.5h3l1.6-2.2h6.8L17 8.5h3v10H4z" {...p} />
          <Circle cx={12} cy={13.2} r={3.3} {...p} />
        </>
      )}
      {name === 'back' && <Path d="M14.5 5.5L8 12l6.5 6.5" {...p} />}
      {name === 'chevronDown' && <Path d="M7 10l5 5 5-5" {...p} />}
      {name === 'chevronRight' && <Path d="M10 7l5 5-5 5" {...p} />}
      {name === 'up' && <Path d="M7 14l5-5 5 5" {...p} />}
      {name === 'down' && <Path d="M7 10l5 5 5-5" {...p} />}
      {name === 'close' && <Path d="M7 7l10 10M17 7L7 17" {...p} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === 'minus' && <Path d="M5 12h14" {...p} />}
      {name === 'check' && <Path d="M5.5 12.5l4 4 9-9" {...p} />}
      {name === 'edit' && <Path d="M5 19l1-4L15.5 5.5l3 3L9 18zM13.5 7.5l3 3" {...p} />}
      {name === 'more' && (
        <>
          <Circle cx={6.5} cy={12} r={1.2} fill={color} />
          <Circle cx={12} cy={12} r={1.2} fill={color} />
          <Circle cx={17.5} cy={12} r={1.2} fill={color} />
        </>
      )}
      {name === 'gridPlus' && (
        <>
          <Rect x={4.5} y={4.5} width={6} height={6} rx={1.2} {...p} />
          <Rect x={13.5} y={4.5} width={6} height={6} rx={1.2} {...p} />
          <Rect x={4.5} y={13.5} width={6} height={6} rx={1.2} {...p} />
          <Path d="M16.5 13.5v6M13.5 16.5h6" {...p} />
        </>
      )}
    </Svg>
  );
}
