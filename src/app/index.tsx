import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { LevelGrid, levelSummary } from '../components/LevelGrid';
import { Sticker } from '../components/Sticker';
import { IconButton, Row, T } from '../components/ui';
import { levelsOfUnit, slotsOfLevel, zonesOfLevel } from '../core/grid';
import { binName, binSlotCode, outItems } from '../core/naming';
import { placeBin } from '../core/ops';
import { binNumberLabel } from '../core/reach';
import type { Bin, ID, Level, Tables } from '../core/types';
import { useAtlas } from '../data/store';
import { font, radius, TOUCH, useTheme } from '../theme';
import { shortDate } from '../util/format';

export default function LevelView() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const t = useAtlas((s) => s.tables);
  const unitId = useAtlas((s) => s.unitId);
  const levelId = useAtlas((s) => s.levelId);
  const show = useAtlas((s) => s.show);
  const apply = useAtlas((s) => s.apply);
  const [placing, setPlacing] = useState<ID | null>(null);

  const units = useMemo(() => Object.values(t.units).sort((a, b) => a.order - b.order), [t.units]);
  if (units.length === 0 || !unitId || !t.units[unitId]) return <Redirect href={{ pathname: '/setup', params: { first: '1' } }} />;

  const unit = t.units[unitId];
  const levels = levelsOfUnit(t, unit.id);
  const level = (levelId && t.levels[levelId]) || levels[0];
  const unitBins = levels.reduce((n, l) => n + countBins(t, l), 0);
  const out = outItems(t);
  const unitOut = out.filter((i) => levels.some((l) => itemOnLevel(t, i.binId, i.zoneId, l)));
  const unplaced = Object.values(t.bins)
    .filter((b) => !b.slotId)
    .sort((a, b) => a.number - b.number);

  const onPressSlot = (slotId: ID) => {
    if (!placing) return;
    apply((x) => placeBin(x, placing, slotId));
    setPlacing(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 140 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${unit.name}. Switch storage unit`}
            onPress={() => router.push('/units')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: TOUCH, flexShrink: 1 }}
          >
            <T v="display" numberOfLines={1} style={{ flexShrink: 1 }}>
              {unit.name}
            </T>
            <Icon name="chevronDown" color={p.ink} size={18} />
          </Pressable>
          <IconButton
            icon="gridPlus"
            label="Edit storage"
            onPress={() => router.push({ pathname: '/editor/[unitId]', params: { unitId: unit.id } })}
          />
        </Row>
        <T v="label">
          {`unit ${unit.order + 1} of ${units.length} · ${levels.length} level${levels.length === 1 ? '' : 's'} · ${unitBins} bins · ${unitOut.length} out`}
        </T>

        {levels.length > 1 ? <LevelTabs t={t} levels={levels} current={level?.id} onPick={(id) => show(unit.id, id)} /> : null}

        {level ? (
          <View style={{ marginTop: 14 }}>
            <T v="title">{level.name}</T>
            <T v="label" style={{ marginBottom: 10 }}>
              {levelSummary(t, level)}
            </T>
            <LevelGrid
              t={t}
              level={level}
              placing={!!placing}
              onPressBin={(id) => router.push({ pathname: '/bin/[id]', params: { id } })}
              onPressSlot={onPressSlot}
              onPressZone={(id) => router.push({ pathname: '/zone/[id]', params: { id } })}
            />
            {level.high > 1 ? (
              <Row style={{ marginTop: 14 }} gap={12}>
                <View style={{ width: 24, height: 16, borderRadius: 3, borderWidth: 1, borderColor: p.inkMuted }} />
                <T v="small" style={{ flex: 1 }}>
                  Stacked slots show the top bin; the edge behind is the one underneath. Tap to see both.
                </T>
              </Row>
            ) : null}
          </View>
        ) : (
          <T v="small" style={{ marginTop: 20 }}>
            This unit has no levels yet. Tap the grid button to add one.
          </T>
        )}

        {unplaced.length > 0 ? (
          <UnplacedTray
            t={t}
            unplaced={unplaced}
            placing={placing}
            onPick={(id) => setPlacing(placing === id ? null : id)}
            onCancel={() => setPlacing(null)}
          />
        ) : null}

        {out.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${out.length} out. Open the Out list`}
            onPress={() => router.push('/out')}
            style={({ pressed }) => ({
              marginTop: 18,
              backgroundColor: p.surface,
              borderRadius: radius.lg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: p.hairline,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontFamily: font.monoBold, fontSize: 11, color: p.signalText, letterSpacing: 1 }}>OUT</Text>
            <Sticker item={out[0]} size={34} />
            <View style={{ flex: 1 }}>
              <T v="bodyMedium" numberOfLines={1}>
                {out[0].name}
                {out.length > 1 ? <T v="small">{`  +${out.length - 1} more`}</T> : null}
              </T>
              <T v="label" style={{ fontSize: 10 }} numberOfLines={1}>
                {outLine(t, out[0])}
              </T>
            </View>
          </Pressable>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + 10,
          paddingTop: 10,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Search everywhere"
          onPress={() => router.push('/search')}
          style={{
            flex: 1,
            minHeight: 52,
            borderRadius: radius.pill,
            backgroundColor: p.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: p.hairline,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 18,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
          }}
        >
          <Icon name="search" color={p.inkMuted} size={18} />
          <T v="body" style={{ color: p.inkMuted }}>
            Search everywhere
          </T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Register an item with the camera"
          onPress={() => router.push('/add')}
          style={({ pressed }) => ({
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: p.signal,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.95 : 1 }],
            shadowColor: p.signal,
            shadowOpacity: 0.35,
            shadowRadius: 10,
          })}
        >
          <Icon name="camera" color={p.onSignal} size={22} />
        </Pressable>
      </View>
    </View>
  );
}

function UnplacedTray({
  t,
  unplaced,
  placing,
  onPick,
  onCancel,
}: {
  t: Tables;
  unplaced: Bin[];
  placing: ID | null;
  onPick: (id: ID) => void;
  onCancel: () => void;
}) {
  const p = useTheme();
  return (
    <View style={{ marginTop: 18, borderWidth: 1.2, borderStyle: 'dashed', borderColor: p.signal, borderRadius: radius.lg, padding: 12 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Text
          style={{ fontFamily: font.monoBold, fontSize: 11, color: p.signalText, letterSpacing: 1 }}
        >{`UNPLACED · ${unplaced.length}`}</Text>
        <T v="label">{placing ? 'now tap a slot' : 'tap a bin, then a slot'}</T>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {unplaced.map((b) => {
          const items = Object.values(t.items).filter((i) => i.binId === b.id);
          const on = placing === b.id;
          return (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              accessibilityLabel={`Bin ${b.number}, ${binName(t, b)}. ${on ? 'Selected, tap a slot to place it' : 'Tap to place'}`}
              onPress={() => onPick(b.id)}
              onLongPress={() => router.push({ pathname: '/bin/[id]', params: { id: b.id } })}
              style={{ width: 96 }}
            >
              <T v="mono" style={{ fontSize: 11 }}>
                {binNumberLabel(b.number)}
              </T>
              <View
                style={{
                  height: 52,
                  borderRadius: radius.sm,
                  backgroundColor: p.surface,
                  borderWidth: on ? 2 : StyleSheet.hairlineWidth,
                  borderColor: on ? p.signal : p.hairline,
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 6,
                  gap: 2,
                }}
              >
                {items.slice(0, 2).map((i) => (
                  <Sticker key={i.id} item={i} size={28} />
                ))}
              </View>
              <T v="small" numberOfLines={1} style={{ fontSize: 11 }}>
                {binName(t, b)}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
      {placing ? (
        <Pressable onPress={onCancel} style={{ alignSelf: 'flex-end', marginTop: 6, minHeight: 32, justifyContent: 'center' }}>
          <T v="small">Cancel</T>
        </Pressable>
      ) : null}
    </View>
  );
}

function LevelTabs({ t, levels, current, onPick }: { t: Tables; levels: Level[]; current?: ID; onPick: (id: ID) => void }) {
  const p = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        marginTop: 12,
        flexDirection: 'row',
        backgroundColor: p.surface,
        borderRadius: radius.md + 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: p.hairline,
        padding: 4,
      }}
    >
      {levels.map((l) => {
        const on = l.id === current;
        const sub = l.type === 'looseShelf' ? 'loose' : l.type === 'drawers' ? `${l.across} dr.` : String(countBins(t, l));
        return (
          <Pressable
            key={l.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${l.name}, level ${l.code}`}
            onPress={() => onPick(l.id)}
            style={{
              flex: 1,
              minHeight: TOUCH,
              borderRadius: radius.md,
              backgroundColor: on ? p.selected : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontFamily: font.monoBold, fontSize: 12, color: on ? p.onSelected : p.ink }}>{l.code}</Text>
            <Text style={{ fontFamily: font.mono, fontSize: 10, color: on ? p.onSelected : p.inkMuted }}>{sub}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function countBins(t: Tables, level: Level): number {
  const slotIds = new Set(slotsOfLevel(t, level.id).map((s) => s.id));
  return Object.values(t.bins).filter((b) => b.slotId && slotIds.has(b.slotId)).length;
}

function itemOnLevel(t: Tables, binId: ID | null, zoneId: ID | null, level: Level): boolean {
  if (zoneId) return zonesOfLevel(t, level.id).some((z) => z.id === zoneId);
  const bin = binId ? t.bins[binId] : undefined;
  if (!bin?.slotId) return false;
  return t.slots[bin.slotId]?.levelId === level.id;
}

function outLine(t: Tables, item: { binId: ID | null; outSince?: string; missing?: boolean }): string {
  const bin = item.binId ? t.bins[item.binId] : undefined;
  const from = bin ? `from ${binNumberLabel(bin.number)}${binSlotCode(t, bin) ? ` · ${binSlotCode(t, bin)}` : ''}` : 'loose';
  if (item.missing) return `missing · ${from}`;
  return item.outSince ? `${from} · since ${shortDate(item.outSince)}` : from;
}
