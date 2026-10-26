import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DEPTH_WORD, gridRows, slotCode, slotsOfLevel, zoneCode, zonesOfLevel, type GridCell } from '../core/grid';
import { binName, isOut, itemsInZone, monthsBetween } from '../core/naming';
import { binNumberLabel } from '../core/reach';
import type { Bin, ID, Item, Level, Tables } from '../core/types';
import { font, radius, useTheme } from '../theme';
import { OutGhost, Sticker } from './Sticker';
import { FrontEdge, T } from './ui';

export interface LevelGridProps {
  t: Tables;
  level: Level;
  onPressBin?: (binId: ID) => void;
  onPressSlot?: (slotId: ID) => void;
  onPressZone?: (zoneId: ID) => void;
  /** Placing an unplaced bin: every slot becomes a target. */
  placing?: boolean;
  now?: Date;
}

function useIndex(t: Tables) {
  return useMemo(() => {
    const binBySlot = new Map<ID, Bin>();
    for (const b of Object.values(t.bins)) if (b.slotId) binBySlot.set(b.slotId, b);
    const itemsByBin = new Map<ID, Item[]>();
    for (const i of Object.values(t.items)) {
      if (!i.binId) continue;
      const list = itemsByBin.get(i.binId) ?? [];
      list.push(i);
      itemsByBin.set(i.binId, list);
    }
    for (const list of itemsByBin.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { binBySlot, itemsByBin };
  }, [t.bins, t.items]);
}

export function LevelGrid(props: LevelGridProps) {
  const { level } = props;
  if (level.type === 'drawers') return <DrawersLevel {...props} />;
  if (level.type === 'looseShelf') return <LooseShelf {...props} />;
  return <BinGrid {...props} />;
}

function BinGrid({ t, level, onPressBin, onPressSlot, placing, now = new Date() }: LevelGridProps) {
  const p = useTheme();
  const { binBySlot, itemsByBin } = useIndex(t);
  const rows = useMemo(() => gridRows(level, slotsOfLevel(t, level.id)), [t, level]);
  const settings = t.settings.settings;

  return (
    <View>
      <T v="label" style={{ marginBottom: 6 }}>
        {level.backLabel}
      </T>
      <View style={{ backgroundColor: p.tray, borderRadius: radius.lg, padding: 8, gap: 6 }}>
        {rows.map((cells, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 6 }}>
            {cells.map((cell) => (
              <Cell
                key={`${cell.depth}${cell.column}`}
                t={t}
                level={level}
                cell={cell}
                binBySlot={binBySlot}
                itemsByBin={itemsByBin}
                staleMonths={settings.staleMonths}
                now={now}
                placing={placing}
                onPressBin={onPressBin}
                onPressSlot={onPressSlot}
              />
            ))}
          </View>
        ))}
      </View>
      <FrontEdge label={level.frontLabel} />
    </View>
  );
}

function Cell({
  t,
  level,
  cell,
  binBySlot,
  itemsByBin,
  staleMonths,
  now,
  placing,
  onPressBin,
  onPressSlot,
}: {
  t: Tables;
  level: Level;
  cell: GridCell;
  binBySlot: Map<ID, Bin>;
  itemsByBin: Map<ID, Item[]>;
  staleMonths: number;
  now: Date;
  placing?: boolean;
  onPressBin?: (binId: ID) => void;
  onPressSlot?: (slotId: ID) => void;
}) {
  const p = useTheme();
  const stack = cell.slots.map((s) => ({ slot: s, bin: binBySlot.get(s.id) }));
  const bins = stack.filter((x) => x.bin).map((x) => x.bin!);
  const top = bins[bins.length - 1];
  const firstFree = stack.find((x) => !x.bin)?.slot;
  const code = slotCode(level, cell.slots[0]);
  const items = top ? (itemsByBin.get(top.id) ?? []) : [];
  const stale = !!top && monthsBetween(new Date(top.lastConfirmedAt), now) >= staleMonths;
  const anyOut = bins.some((b) => (itemsByBin.get(b.id) ?? []).some(isOut));
  const stacked = level.high > 1 && bins.length > 1;

  let caption: string;
  let captionStale = false;
  if (!top) caption = 'Free slot';
  else if (stale) {
    caption = `${binName(t, top).replace(/ · \d+ of \d+$/, '')} · not checked ${Math.round(monthsBetween(new Date(top.lastConfirmedAt), now))} mo`;
    captionStale = true;
  } else if (stacked) {
    const names = [...new Set(bins.map((b) => binName(t, b).replace(/ · \d+ of \d+$/, '')))];
    caption = names.length === 1 ? `${names[0]} ×${bins.length}` : names.join(', ');
  } else caption = binName(t, top);

  const numbers = bins.length
    ? bins
        .map((b) => b.number)
        .sort((a, b) => a - b)
        .map(binNumberLabel)
        .join('/')
        .replace(/\/#/g, '/')
    : '';
  const isFree = bins.length === 0;
  const target = placing && firstFree;

  const a11y = isFree
    ? `${code}, ${DEPTH_WORD[cell.depth]} row, free slot`
    : `${code}, ${DEPTH_WORD[cell.depth]} row, ${caption}, bin ${bins.map((b) => b.number).join(' and ')}, ${items.length} item${items.length === 1 ? '' : 's'}`;

  const onPress = () => {
    if (placing) onPressSlot?.((firstFree ?? cell.slots[cell.slots.length - 1]).id);
    else if (top) onPressBin?.(top.id);
    else onPressSlot?.(cell.slots[0].id);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => ({ flex: cell.span, opacity: pressed ? 0.75 : 1 })}
    >
      {/* Tab with the slot code */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View
          style={{
            backgroundColor: isFree ? 'transparent' : p.surface,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
            paddingHorizontal: 5,
            paddingTop: 2,
            borderBottomWidth: isFree ? 2 : 0,
            borderBottomColor: p.inkMuted,
            borderStyle: isFree ? 'dashed' : 'solid',
          }}
        >
          <Text style={{ fontFamily: font.monoBold, fontSize: 10, color: isFree ? p.inkMuted : p.ink }} maxFontSizeMultiplier={1.3}>
            {code}
          </Text>
        </View>
        {anyOut ? (
          <View style={{ marginLeft: 'auto', width: 9, height: 9, borderRadius: 5, backgroundColor: p.signal, marginBottom: 3 }} />
        ) : null}
      </View>
      <View>
        {stacked ? (
          <View
            style={{
              position: 'absolute',
              top: -3,
              left: 3,
              right: -3,
              bottom: 3,
              borderRadius: radius.sm,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: p.hairline,
              backgroundColor: p.surface,
            }}
          />
        ) : null}
        <View
          style={{
            height: 58,
            borderRadius: radius.sm,
            borderTopLeftRadius: 0,
            backgroundColor: isFree ? 'transparent' : p.surface,
            borderWidth: isFree || target ? 1.2 : StyleSheet.hairlineWidth,
            borderStyle: isFree || target ? 'dashed' : 'solid',
            borderColor: target ? p.signal : isFree ? p.hairline : p.hairline,
            padding: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            overflow: 'hidden',
          }}
        >
          {items
            .slice(0, cell.span === 2 ? 4 : 2)
            .map((it, i) =>
              isOut(it) && it.quantityOut >= it.quantityTotal ? (
                <OutGhost key={it.id} size={24} />
              ) : (
                <Sticker key={it.id} item={it} size={i === 0 ? 30 : 26} faded={stale} />
              ),
            )}
          {numbers ? (
            <Text
              style={{ position: 'absolute', right: 5, bottom: 3, fontFamily: font.mono, fontSize: 10, color: p.inkMuted }}
              maxFontSizeMultiplier={1.2}
            >
              {numbers}
            </Text>
          ) : null}
        </View>
      </View>
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={{ fontFamily: font.ui, fontSize: 11, marginTop: 3, color: captionStale ? p.signalText : p.inkMuted }}
      >
        {caption}
      </Text>
    </Pressable>
  );
}

function DrawersLevel({ t, level, onPressBin, onPressSlot, placing }: LevelGridProps) {
  const p = useTheme();
  const { binBySlot, itemsByBin } = useIndex(t);
  const slots = slotsOfLevel(t, level.id).sort((a, b) => a.column - b.column);
  return (
    <View style={{ gap: 8 }}>
      {slots.map((s) => {
        const bin = binBySlot.get(s.id);
        const items = bin ? (itemsByBin.get(bin.id) ?? []) : [];
        const code = slotCode(level, s);
        const count = items.reduce((n, i) => n + i.quantityTotal, 0);
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={bin ? `${code}, ${binName(t, bin)}, bin ${bin.number}, ${items.length} items` : `${code}, empty drawer`}
            onPress={() => (placing || !bin ? onPressSlot?.(s.id) : onPressBin?.(bin.id))}
            style={({ pressed }) => ({
              minHeight: 68,
              backgroundColor: p.surface,
              borderRadius: radius.md,
              borderWidth: placing ? 1.2 : StyleSheet.hairlineWidth,
              borderStyle: placing ? 'dashed' : 'solid',
              borderColor: placing ? p.signal : p.hairline,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{ position: 'absolute', top: 6, left: '45%', width: 40, height: 4, borderRadius: 2, backgroundColor: p.hairline }}
            />
            <Text style={{ fontFamily: font.monoBold, fontSize: 13, color: p.ink, width: 28 }}>{code}</Text>
            <View style={{ flex: 1 }}>
              <T v="bodyMedium">{bin ? binName(t, bin) : 'Empty'}</T>
              <T v="label" style={{ fontSize: 10 }}>
                {bin ? `${count} item${count === 1 ? '' : 's'}` : '—'}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {items.slice(0, 2).map((it) => (
                <Sticker key={it.id} item={it} size={30} />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function LooseShelf({ t, level, onPressZone }: LevelGridProps) {
  const p = useTheme();
  const zones = zonesOfLevel(t, level.id);
  return (
    <View>
      <View style={{ backgroundColor: p.tray, borderRadius: radius.lg, padding: 8, flexDirection: 'row', gap: 6 }}>
        {zones.map((z) => {
          const items = itemsInZone(t, z.id);
          const caption =
            items.length === 1 && items[0].quantityTotal > 1
              ? `${items[0].name} · ${items[0].quantityTotal}`
              : items.map((i) => i.name).join(', ') || 'Empty';
          return (
            <Pressable
              key={z.id}
              accessibilityRole="button"
              accessibilityLabel={`${zoneCode(level, z)}, ${z.name.toLowerCase()} zone, ${items.length} items`}
              onPress={() => onPressZone?.(z.id)}
              style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.75 : 1 })}
            >
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: p.surface,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  paddingHorizontal: 5,
                  paddingTop: 2,
                }}
              >
                <Text style={{ fontFamily: font.monoBold, fontSize: 10, color: p.ink }}>{zoneCode(level, z)}</Text>
              </View>
              <View
                style={{
                  height: 104,
                  backgroundColor: p.surface,
                  borderRadius: radius.sm,
                  borderTopLeftRadius: 0,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: p.hairline,
                  padding: 8,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 4,
                  alignContent: 'center',
                  justifyContent: 'center',
                }}
              >
                {items.slice(0, 3).map((it) => (
                  <Sticker key={it.id} item={it} size={34} />
                ))}
              </View>
              <Text numberOfLines={1} style={{ fontFamily: font.ui, fontSize: 11, marginTop: 3, color: p.inkMuted }}>
                {caption}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <T v="small" style={{ marginTop: 10 }}>
        Loose things are registered to a zone, left to right. Answers say “on {level.name.toLowerCase()}, right side”: no rows, no lifting.
      </T>
    </View>
  );
}

/** One-line summary under the level name: "4 × 3 · 11 BINS · 1 FREE · REACH FROM FRONT". */
export function levelSummary(t: Tables, level: Level): string {
  const slots = slotsOfLevel(t, level.id);
  const used = new Set(Object.values(t.bins).map((b) => b.slotId));
  const bins = slots.filter((s) => used.has(s.id)).length;
  const free = slots.length - bins;
  if (level.type === 'looseShelf') {
    const zones = zonesOfLevel(t, level.id);
    const items = zones.reduce((n, z) => n + itemsInZone(t, z.id).length, 0);
    return `loose shelf · ${zones.length} zones · ${items} items`;
  }
  if (level.type === 'drawers') return `${level.across} drawers · open top · no lifting`;
  const dims = level.high > 1 ? `${level.across} × ${level.deep} × ${level.high} high` : `${level.across} × ${level.deep}`;
  const parts = [dims, `${bins} bins`];
  if (free) parts.push(`${free} free`);
  parts.push(level.reach === 'fromFront' ? 'reach from front' : 'open top');
  return parts.join(' · ');
}
