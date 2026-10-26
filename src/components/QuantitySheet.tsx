import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { binNumberLabel } from '../core/reach';
import type { Item } from '../core/types';
import { radius, useTheme } from '../theme';
import { Sticker } from './Sticker';
import { Button, Row, SmallButton, Stepper, T } from './ui';

/** "How many did you take?" Only that many go to the Out tray. */
export function QuantitySheet({
  item,
  binNumber,
  visible,
  onClose,
  onTake,
}: {
  item: Item;
  binNumber?: number;
  visible: boolean;
  onClose: () => void;
  onTake: (n: number) => void;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const available = item.quantityTotal - item.quantityOut;
  const [n, setN] = useState(1);
  useEffect(() => {
    if (visible) setN(1);
  }, [visible]);
  const where = binNumber !== undefined ? binNumberLabel(binNumber) : 'the bin';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: p.scrim }} />
      <View
        style={{
          backgroundColor: p.surface,
          borderTopLeftRadius: radius.xl + 4,
          borderTopRightRadius: radius.xl + 4,
          padding: 20,
          paddingBottom: insets.bottom + 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: p.hairline,
          gap: 14,
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: p.hairline }} />
        <Row gap={14}>
          <Sticker item={item} size={56} />
          <View style={{ flex: 1 }}>
            <T v="label">{`${available} in the bin`}</T>
            <T v="title">How many did you take?</T>
          </View>
        </Row>
        <View style={{ flexDirection: 'row' }}>
          <Stepper value={n} min={1} max={available} onChange={setN} caption="taken" />
        </View>
        <Row gap={8}>
          {[1, 2]
            .filter((x) => x < available)
            .map((x) => (
              <View key={x} style={{ flex: 1 }}>
                <SmallButton title={String(x)} active={n === x} onPress={() => setN(x)} />
              </View>
            ))}
          <View style={{ flex: 1 }}>
            <SmallButton title={`All ${available}`} active={n === available} onPress={() => setN(available)} />
          </View>
        </Row>
        <T v="small">
          {available - n > 0
            ? `${available - n} stay in ${where}. Only the ${n === 1 ? 'one' : n} you took go${n === 1 ? 'es' : ''} to the Out tray.`
            : `All of them go to the Out tray.`}
        </T>
        <Button title={`Took ${n}`} onPress={() => onTake(n)} />
      </View>
    </Modal>
  );
}
