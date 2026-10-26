import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { levelsOfUnit, slotsOfLevel, zoneCode, zonesOfLevel } from '../core/grid';
import { binName, binSlotCode } from '../core/naming';
import type { Home } from '../core/ops';
import { binNumberLabel, reachCost } from '../core/reach';
import { normalize } from '../core/search';
import type { Bin, ID, Tables } from '../core/types';
import { radius, useTheme } from '../theme';
import { Field, ReachChip, T } from './ui';

/** Every bin (and loose-shelf zone), grouped by unit and level, with reach. */
export function BinPicker({ t, value, onPick }: { t: Tables; value?: Home | null; onPick: (home: Home) => void }) {
  const p = useTheme();
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const out: { title: string; rows: { key: string; home: Home; title: string; sub: string; cost: number }[] }[] = [];
    const used = new Set<ID>();
    const binRow = (b: Bin) => ({
      key: b.id,
      home: { binId: b.id } as Home,
      title: `${binNumberLabel(b.number)} ${binName(t, b)}`,
      sub: binSlotCode(t, b) ?? 'unplaced',
      cost: reachCost(t, b.id),
    });
    for (const unit of Object.values(t.units).sort((a, b) => a.order - b.order)) {
      for (const level of levelsOfUnit(t, unit.id)) {
        const rows = [];
        for (const s of slotsOfLevel(t, level.id)) {
          const b = Object.values(t.bins).find((x) => x.slotId === s.id);
          if (b && !used.has(b.id)) {
            used.add(b.id);
            rows.push(binRow(b));
          }
        }
        for (const z of zonesOfLevel(t, level.id))
          rows.push({
            key: z.id,
            home: { zoneId: z.id } as Home,
            title: `${level.name}, ${z.name.toLowerCase()}`,
            sub: zoneCode(level, z),
            cost: 0,
          });
        if (rows.length) out.push({ title: `${unit.name} › ${level.name}`, rows });
      }
    }
    const unplaced = Object.values(t.bins).filter((b) => !used.has(b.id));
    if (unplaced.length) out.push({ title: 'Unplaced', rows: unplaced.map(binRow) });
    return out;
  }, [t]);

  const nq = normalize(q);
  const filtered = nq
    ? groups.map((g) => ({ ...g, rows: g.rows.filter((r) => normalize(`${r.title} ${r.sub}`).includes(nq)) })).filter((g) => g.rows.length)
    : groups;
  const selectedKey = value ? ('binId' in value ? value.binId : value.zoneId) : undefined;

  return (
    <View>
      <Field placeholder="Find a bin: number or name" value={q} onChangeText={setQ} autoCorrect={false} />
      {filtered.map((g) => (
        <View key={g.title}>
          <T v="label" style={{ marginTop: 16, marginBottom: 6 }}>
            {g.title}
          </T>
          <View
            style={{ backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: p.hairline }}
          >
            {g.rows.map((r, i) => {
              const on = r.key === selectedKey;
              return (
                <Pressable
                  key={r.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => onPick(r.home)}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    borderTopWidth: i ? StyleSheet.hairlineWidth : 0,
                    borderTopColor: p.hairline,
                    backgroundColor: on ? p.tray : 'transparent',
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <T v="bodyMedium" numberOfLines={1}>
                      {r.title}
                    </T>
                    <T v="label" style={{ fontSize: 10 }}>
                      {r.sub}
                    </T>
                  </View>
                  <ReachChip cost={r.cost} />
                  {on ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.signal }} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
