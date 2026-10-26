import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { font, radius, TOUCH, useTheme, type Palette } from '../theme';
import { Icon, type IconName } from './Icon';

// ---------- Text ----------

type Variant = 'display' | 'title' | 'serif' | 'body' | 'bodyMedium' | 'small' | 'label' | 'mono' | 'monoLarge';

const variantStyle = (p: Palette): Record<Variant, TextStyle> => ({
  display: { fontFamily: font.serif, fontSize: 34, lineHeight: 38, color: p.ink, letterSpacing: -0.4 },
  title: { fontFamily: font.serif, fontSize: 28, lineHeight: 32, color: p.ink, letterSpacing: -0.3 },
  serif: { fontFamily: font.serif, fontSize: 22, lineHeight: 26, color: p.ink },
  body: { fontFamily: font.ui, fontSize: 15, lineHeight: 20, color: p.ink },
  bodyMedium: { fontFamily: font.uiMedium, fontSize: 15, lineHeight: 20, color: p.ink },
  small: { fontFamily: font.ui, fontSize: 13, lineHeight: 18, color: p.inkMuted },
  label: { fontFamily: font.mono, fontSize: 11, lineHeight: 14, color: p.inkMuted, letterSpacing: 1.1, textTransform: 'uppercase' },
  mono: { fontFamily: font.monoMedium, fontSize: 12, lineHeight: 16, color: p.ink },
  monoLarge: { fontFamily: font.monoBold, fontSize: 22, lineHeight: 26, color: p.ink },
});

export function T({ v = 'body', style, ...rest }: TextProps & { v?: Variant }) {
  const p = useTheme();
  return <Text {...rest} style={[variantStyle(p)[v], style]} maxFontSizeMultiplier={v === 'label' || v === 'mono' ? 1.4 : 2} />;
}

// ---------- Layout ----------

/** Faint blueprint grid in dark mode; flat paper in light. */
function Backdrop() {
  const p = useTheme();
  if (p.scheme !== 'dark') return null;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="grid" width={22} height={22} patternUnits="userSpaceOnUse">
          <Path d="M22 0H0V22" stroke="#1B2D47" strokeWidth={0.6} fill="none" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#grid)" />
    </Svg>
  );
}

export function Screen({
  children,
  scroll = true,
  footer,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  padded?: boolean;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = { paddingHorizontal: padded ? 18 : 0, paddingTop: insets.top + 8 };
  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <Backdrop />
      {scroll ? (
        <ScrollView contentContainerStyle={[pad, { paddingBottom: footer ? 24 : insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad]}>{children}</View>
      )}
      {footer ? <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: insets.bottom + 10, gap: 10 }}>{footer}</View> : null}
    </View>
  );
}

export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const p = useTheme();
  const base: ViewStyle = {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: p.hairline,
    padding: 14,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>
      {children}
    </Pressable>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  const p = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: p.hairline }, style]} />;
}

// ---------- Buttons ----------

type ButtonKind = 'primary' | 'secondary' | 'dark' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  style,
  flex,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
}) {
  const p = useTheme();
  const bg = { primary: p.signal, secondary: p.surface, dark: p.selected, danger: 'transparent' }[kind];
  const fg = { primary: p.onSignal, secondary: p.ink, dark: p.onSelected, danger: p.signalText }[kind];
  const border = kind === 'secondary' ? p.hairline : kind === 'danger' ? p.signalText : bg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 52,
          borderRadius: radius.pill,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        kind === 'primary' && { shadowColor: p.signal, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
        flex && { flex: 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ fontFamily: font.uiSemi, fontSize: 16, color: fg }}>{title}</Text>}
    </Pressable>
  );
}

export function SmallButton({ title, onPress, active }: { title: string; onPress: () => void; active?: boolean }) {
  const p = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: 34,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? p.selected : p.hairline,
        backgroundColor: active ? p.selected : p.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontFamily: font.uiMedium, fontSize: 14, color: active ? p.onSelected : p.ink }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, filled }: { icon: IconName; onPress: () => void; label: string; filled?: boolean }) {
  const p = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: TOUCH,
        height: TOUCH,
        borderRadius: TOUCH / 2,
        backgroundColor: filled ? p.signal : p.surface,
        borderWidth: filled ? 0 : StyleSheet.hairlineWidth,
        borderColor: p.hairline,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon name={icon} color={filled ? p.onSignal : p.ink} size={20} />
    </Pressable>
  );
}

/** Back button + centred mono caption + optional right action, as on D6/D7/D16. */
export function TopBar({
  caption,
  onBack,
  right,
  backIcon = 'back',
}: {
  caption?: string;
  onBack: () => void;
  right?: ReactNode;
  backIcon?: IconName;
}) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: 14, minHeight: TOUCH }}>
      <IconButton icon={backIcon} onPress={onBack} label={backIcon === 'close' ? 'Close' : 'Back'} />
      {caption ? (
        <T v="label" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
          {caption}
        </T>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={{ minWidth: TOUCH, alignItems: 'flex-end' }}>{right}</View>
    </Row>
  );
}

// ---------- Inputs ----------

/** Browsers draw a focus ring on inputs; the field's own border is enough. */
export const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  const p = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: p.surface,
        borderRadius: radius.md + 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: p.hairline,
        padding: 4,
      }}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              minHeight: TOUCH,
              borderRadius: radius.md,
              backgroundColor: on ? p.selected : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: font.uiMedium, fontSize: 14, color: on ? p.onSelected : p.ink }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  caption,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  caption?: string;
  step?: number;
}) {
  const p = useTheme();
  const btn = (icon: 'minus' | 'plus', next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${icon === 'plus' ? 'More' : 'Fewer'}${caption ? ` ${caption}` : ''}`}
      disabled={disabled}
      onPress={() => onChange(next)}
      hitSlop={4}
      style={{ width: 34, height: TOUCH, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}
    >
      <Icon name={icon} color={p.ink} size={18} />
    </Pressable>
  );
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={caption}
      accessibilityValue={{ now: value, min, max }}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: p.surface,
        borderRadius: radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: p.hairline,
      }}
    >
      {btn('minus', Math.max(min, value - step), value <= min)}
      <View style={{ alignItems: 'center' }}>
        <T v="mono" style={{ fontSize: 15 }}>
          {value}
        </T>
        {caption ? (
          <T v="small" style={{ fontSize: 11, lineHeight: 12 }}>
            {caption}
          </T>
        ) : null}
      </View>
      {btn('plus', Math.min(max, value + step), value >= max)}
    </View>
  );
}

export function Field(props: TextInputProps & { serif?: boolean }) {
  const p = useTheme();
  const { serif, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={p.inkMuted}
      {...rest}
      style={[
        {
          minHeight: 50,
          backgroundColor: p.surface,
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: p.hairline,
          paddingHorizontal: 14,
          color: p.ink,
          fontFamily: serif ? font.serif : font.ui,
          fontSize: serif ? 22 : 16,
        },
        noWebOutline,
        style,
      ]}
    />
  );
}

// ---------- Small pieces ----------

/** NO LIFTING (green, solid) or LIFT 2 (muted, dashed); "LIFT #30, #26" when bins are named. */
export function ReachChip({ cost, text }: { cost: number; text?: string }) {
  const p = useTheme();
  const ok = cost === 0;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderStyle: ok ? 'solid' : 'dashed',
        borderColor: ok ? p.inOk : p.signalText,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text style={{ fontFamily: font.monoMedium, fontSize: 11, letterSpacing: 0.8, color: ok ? p.inOk : p.signalText }}>
        {ok ? 'NO LIFTING' : (text ?? `LIFT ${cost}`).toUpperCase()}
      </Text>
    </View>
  );
}

/** A labelled row in a settings-like list. */
export function ListRow({
  title,
  value,
  onPress,
  chevron = true,
  left,
}: {
  title: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  left?: ReactNode;
}) {
  const p = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {left}
      <T v="body" style={{ flex: 1 }} numberOfLines={2}>
        {title}
      </T>
      {value ? (
        <T v="small" numberOfLines={1} style={{ maxWidth: '55%', textAlign: 'right' }}>
          {value}
        </T>
      ) : null}
      {onPress && chevron ? <Icon name="chevronRight" color={p.inkMuted} size={16} /> : null}
    </Pressable>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
      <T v="label">{children}</T>
      {right}
    </Row>
  );
}

/** The bar along the front edge of a level: "FRONT · DOORS". */
export function FrontEdge({ label }: { label: string }) {
  const p = useTheme();
  return (
    <Row style={{ marginTop: 10 }} gap={10}>
      <View
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          borderWidth: 1,
          borderColor: p.scheme === 'dark' ? '#5B8FC9' : '#B39A74',
          backgroundColor: p.scheme === 'dark' ? 'transparent' : '#E4D3B6',
        }}
      />
      <T v="label">{label}</T>
    </Row>
  );
}
