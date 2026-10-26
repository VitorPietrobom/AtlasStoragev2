import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Sticker } from '../components/Sticker';
import { Hairline, Screen, SmallButton, T, TopBar } from '../components/ui';
import { daysBetween, outItems } from '../core/naming';
import { returnItem } from '../core/ops';
import { binNumberLabel } from '../core/reach';
import { useAtlas } from '../data/store';
import { useTheme } from '../theme';
import { shortDate } from '../util/format';

const OLD_DAYS = 14;

/** Everything not in a bin, oldest first. Over 14 days shows in signal. */
export default function Out() {
  const p = useTheme();
  const t = useAtlas((s) => s.tables);
  const apply = useAtlas((s) => s.apply);
  const items = outItems(t);

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <T v="display">{`Out · ${items.length}`}</T>
      <T v="label" style={{ marginBottom: 12 }}>
        oldest first · over {OLD_DAYS} days in signal
      </T>
      {items.length === 0 ? <T v="small">Everything is in its bin.</T> : null}
      {items.map((i) => {
        const bin = i.binId ? t.bins[i.binId] : undefined;
        const days = i.outSince ? daysBetween(i.outSince) : 0;
        const from = bin ? `from ${binNumberLabel(bin.number)}` : 'loose';
        const line = i.missing
          ? `missing · last seen ${i.outSince ? shortDate(i.outSince) : '—'}`
          : `${from} · ${days === 0 ? 'today' : `${days} days`}`;
        const warn = i.missing || days > OLD_DAYS;
        const partial = i.quantityTotal > 1 ? ` · ${i.quantityOut} of ${i.quantityTotal}` : '';
        return (
          <View key={i.id}>
            <Pressable
              onPress={() => router.push({ pathname: '/item/[id]', params: { id: i.id } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
            >
              <Sticker item={i} size={40} />
              <View style={{ flex: 1 }}>
                <T v="bodyMedium">{i.name + partial}</T>
                <T v="label" style={{ fontSize: 10, color: warn ? p.signalText : p.inkMuted }}>
                  {line}
                </T>
              </View>
              <SmallButton title="Return" onPress={() => apply((x) => returnItem(x, i.id))} />
            </Pressable>
            <Hairline />
          </View>
        );
      })}
    </Screen>
  );
}
