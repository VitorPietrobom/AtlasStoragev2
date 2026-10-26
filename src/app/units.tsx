import { router } from 'expo-router';
import { View } from 'react-native';

import { Card, Hairline, ListRow, Screen, SectionLabel, T } from '../components/ui';
import { levelsOfUnit } from '../core/grid';
import { outItems } from '../core/naming';
import { useAtlas } from '../data/store';
import { useTheme } from '../theme';

/** The unit title menu: switch unit, add one, and the few places outside the level view. */
export default function Units() {
  const p = useTheme();
  const t = useAtlas((s) => s.tables);
  const current = useAtlas((s) => s.unitId);
  const show = useAtlas((s) => s.show);
  const units = Object.values(t.units).sort((a, b) => a.order - b.order);
  const out = outItems(t).length;

  return (
    <Screen>
      <T v="title" style={{ marginTop: 8 }}>
        Storage
      </T>
      <SectionLabel>Units</SectionLabel>
      <Card style={{ paddingVertical: 4 }}>
        {units.map((u, i) => {
          const levels = levelsOfUnit(t, u.id);
          return (
            <View key={u.id}>
              {i > 0 ? <Hairline /> : null}
              <ListRow
                title={u.name}
                value={`${u.room ? `${u.room} · ` : ''}${levels.length} level${levels.length === 1 ? '' : 's'}`}
                left={
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: u.id === current ? p.signal : 'transparent' }} />
                }
                onPress={() => {
                  show(u.id);
                  router.back();
                }}
              />
            </View>
          );
        })}
        <Hairline />
        <ListRow title="+ Add storage" onPress={() => router.replace('/setup')} chevron={false} />
      </Card>
      <SectionLabel>Elsewhere</SectionLabel>
      <Card style={{ paddingVertical: 4 }}>
        <ListRow title="Everything out" value={String(out)} onPress={() => router.replace('/out')} />
        <Hairline />
        <ListRow title="History" onPress={() => router.replace('/history')} />
        <Hairline />
        <ListRow title="Settings" onPress={() => router.replace('/settings')} />
      </Card>
    </Screen>
  );
}
