import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Sticker } from '../../components/Sticker';
import { Button, Screen, T, TopBar } from '../../components/ui';
import { zoneCode } from '../../core/grid';
import { itemLabel, itemsInZone } from '../../core/naming';
import { useAtlas } from '../../data/store';

/** A loose-shelf zone: things without bins. No rows, no lifting. */
export default function ZoneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useAtlas((s) => s.tables);
  const zone = t.zones[id];
  if (!zone) return null;
  const level = t.levels[zone.levelId];
  const items = itemsInZone(t, zone.id);

  return (
    <Screen footer={<Button title="Add an item here" onPress={() => router.push({ pathname: '/add', params: { zoneId: zone.id } })} />}>
      <TopBar caption={zoneCode(level, zone)} onBack={() => router.back()} />
      <T v="display">{`${level.name}, ${zone.name.toLowerCase()}`}</T>
      <T v="label" style={{ marginBottom: 12 }}>
        loose shelf · no lifting
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {items.map((i) => (
          <Pressable
            key={i.id}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: i.id } })}
            style={{ width: '50%', alignItems: 'center', paddingVertical: 14 }}
          >
            <Sticker item={i} size={92} />
            <T v="bodyMedium" style={{ marginTop: 10, textAlign: 'center' }}>
              {itemLabel(i)}
            </T>
          </Pressable>
        ))}
      </View>
      {items.length === 0 ? <T v="small">Nothing here yet.</T> : null}
    </Screen>
  );
}
