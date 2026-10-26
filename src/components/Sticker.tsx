import { Image } from 'expo-image';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Item } from '../core/types';
import { photoUri } from '../data/photos';
import { font, useTheme } from '../theme';

/** A stable tilt in [-3°, 3°] from the item id, so a sticker always sits the same way. */
export function tiltFor(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 601) / 100 - 3;
}

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return (words[0]?.[0] ?? '?').toUpperCase() + (words[1]?.[0] ?? '').toLowerCase();
}

/**
 * Items are always their real cut-out photos. A cut-out PNG already carries its
 * white die-cut border; a plain photo (no cut-out available) gets a white frame;
 * with no photo at all, a paper tag with initials stands in.
 */
export function Sticker({
  item,
  size = 44,
  faded,
  tilt = true,
  style,
}: {
  item: Pick<Item, 'id' | 'name' | 'photoUri' | 'stickerUri'>;
  size?: number;
  faded?: boolean;
  tilt?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useTheme();
  const rotate = tilt ? `${tiltFor(item.id)}deg` : '0deg';
  const sticker = photoUri(item.stickerUri);
  const photo = photoUri(item.photoUri);
  const shadow: ViewStyle = {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 2,
  };
  const common: StyleProp<ViewStyle> = [{ width: size, height: size, transform: [{ rotate }], opacity: faded ? 0.4 : 1 }, style];

  if (sticker) {
    return (
      <View style={[common, shadow]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Image source={{ uri: sticker }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
      </View>
    );
  }
  if (photo) {
    const border = Math.max(2, Math.round(size * 0.06));
    return (
      <View
        style={[common, shadow, { backgroundColor: '#FFFFFF', padding: border, borderRadius: size * 0.18 }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Image source={{ uri: photo }} style={{ flex: 1, borderRadius: size * 0.14 }} contentFit="cover" />
      </View>
    );
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        common,
        shadow,
        {
          backgroundColor: p.scheme === 'dark' ? '#E8EEF5' : '#FFFFFF',
          borderRadius: size * 0.22,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: p.scheme === 'dark' ? '#C9D5E3' : '#E7E1D5',
        },
      ]}
    >
      <Text style={{ fontFamily: font.serif, fontSize: size * 0.42, color: '#1C1B19' }}>{initials(item.name)}</Text>
    </View>
  );
}

/** Dashed signal outline where a taken-out item used to sit. */
export function OutGhost({ size = 28 }: { size?: number }) {
  const p = useTheme();
  return <View style={{ width: size, height: size, borderRadius: 5, borderWidth: 1.2, borderStyle: 'dashed', borderColor: p.signal }} />;
}
