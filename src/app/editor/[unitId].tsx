import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, FrontEdge, IconButton, Row, Screen, Segmented, SmallButton, Stepper, T, TopBar } from '../../components/ui';
import {
  GridError,
  gridRows,
  levelsOfUnit,
  MAX_ACROSS,
  MAX_DEEP,
  MAX_DRAWERS,
  MAX_HIGH,
  MAX_ZONES,
  mergeSlots,
  reshapeLevel,
  slotCode,
  slotsOfLevel,
  splitSlot,
  type GridCell,
} from '../../core/grid';
import { addLevel, deleteLevel, moveLevel, updateUnit } from '../../core/ops';
import type { ID, Level, LevelType, Reach, Tables } from '../../core/types';
import { useAtlas } from '../../data/store';
import { font, radius, useTheme } from '../../theme';

const TYPE_LABEL: Record<LevelType, string> = { binGrid: 'bins', looseShelf: 'loose', drawers: 'drawers' };

/**
 * Each level has a type and a reach. Bin grids take any size, merge slots
 * across, and stack. Bin numbers never change; removing a slot sends its bin
 * to Unplaced. Edits apply to a draft until Save.
 */
export default function StorageEditor() {
  const p = useTheme();
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const stored = useAtlas((s) => s.tables);
  const apply = useAtlas((s) => s.apply);
  const [draft, setDraft] = useState<Tables>(stored);
  const [open, setOpen] = useState<ID | null>(() => levelsOfUnit(stored, unitId)[0]?.id ?? null);
  const [renaming, setRenaming] = useState(false);
  const unit = draft.units[unitId];
  if (!unit) return null;

  const levels = levelsOfUnit(draft, unitId);
  const unitsCount = Object.keys(draft.units).length;
  const binsHere = levels.reduce(
    (n, l) => n + slotsOfLevel(draft, l.id).filter((s) => Object.values(draft.bins).some((b) => b.slotId === s.id)).length,
    0,
  );
  const unplaced = Object.values(draft.bins).filter((b) => !b.slotId).length;
  const wasUnplaced = Object.values(stored.bins).filter((b) => !b.slotId).length;
  const dirty = draft !== stored;

  const edit = (fn: (t: Tables) => Tables) => {
    try {
      setDraft(fn(draft));
    } catch (e) {
      if (e instanceof GridError) Platform.OS === 'web' ? console.warn(e.message) : Alert.alert('Can’t do that', e.message);
      else throw e;
    }
  };

  const leave = () => {
    if (!dirty || Platform.OS === 'web') return router.back();
    Alert.alert('Discard changes?', 'Nothing you changed here is saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  return (
    <Screen
      footer={
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="label" style={{ flex: 1, color: unplaced > wasUnplaced ? p.signalText : p.inkMuted }}>
            {`${levels.length} level${levels.length === 1 ? '' : 's'} · ${binsHere} bins · ${unplaced} unplaced`}
          </T>
          <Button
            title="Save"
            disabled={!dirty}
            onPress={() => {
              apply(() => draft);
              router.back();
            }}
            style={{ paddingHorizontal: 28 }}
          />
        </Row>
      }
    >
      <TopBar onBack={leave} right={<IconButton icon="edit" label="Rename unit" onPress={() => setRenaming(!renaming)} />} />
      {renaming ? (
        <View style={{ gap: 8 }}>
          <Field serif value={unit.name} onChangeText={(name) => edit((t) => updateUnit(t, unitId, { name }))} autoFocus />
          <Field
            placeholder="Room (optional)"
            value={unit.room ?? ''}
            onChangeText={(room) => edit((t) => updateUnit(t, unitId, { room }))}
          />
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <T v="display">{unit.name}</T>
          <T v="label">{`unit ${unit.order + 1} of ${unitsCount}${unit.room ? ` · ${unit.room}` : ''}`}</T>
        </View>
      )}

      <Row style={{ justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
        <T v="label">levels, top to bottom</T>
        <SmallButton
          title="+ Add level"
          onPress={() => {
            let id: ID = '';
            edit((t) => {
              const r = addLevel(t, unitId, {});
              id = r.levelId;
              return r.tables;
            });
            setOpen(id);
          }}
        />
      </Row>

      <View style={{ gap: 8 }}>
        {levels.map((l, i) =>
          open === l.id ? (
            <LevelEditor
              key={l.id}
              t={draft}
              level={l}
              first={i === 0}
              last={i === levels.length - 1}
              edit={edit}
              onClose={() => setOpen(null)}
            />
          ) : (
            <Pressable
              key={l.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${l.name}`}
              onPress={() => setOpen(l.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                minHeight: 52,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: p.hairline,
              }}
            >
              <CodeChip code={l.code} />
              <T v="body" style={{ flex: 1 }}>
                {l.name}
              </T>
              <View style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: p.hairline, borderRadius: 3, paddingHorizontal: 5 }}>
                <Text style={{ fontFamily: font.mono, fontSize: 10, color: p.inkMuted }}>{TYPE_LABEL[l.type].toUpperCase()}</Text>
              </View>
              <T v="mono" style={{ color: p.inkMuted, width: 52, textAlign: 'right' }}>
                {dims(l)}
              </T>
            </Pressable>
          ),
        )}
      </View>
    </Screen>
  );
}

function dims(l: Level): string {
  if (l.type === 'binGrid') return l.high > 1 ? `${l.across}×${l.deep}×${l.high}` : `${l.across}×${l.deep}`;
  return String(l.across);
}

function CodeChip({ code, active }: { code: string; active?: boolean }) {
  const p = useTheme();
  return (
    <View
      style={{
        minWidth: 24,
        height: 24,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: active ? p.signal : p.ink,
        backgroundColor: active ? p.signal : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
      }}
    >
      <Text style={{ fontFamily: font.monoBold, fontSize: 11, color: active ? p.onSignal : p.ink }}>{code}</Text>
    </View>
  );
}

function LevelEditor({
  t,
  level,
  first,
  last,
  edit,
  onClose,
}: {
  t: Tables;
  level: Level;
  first: boolean;
  last: boolean;
  edit: (fn: (t: Tables) => Tables) => void;
  onClose: () => void;
}) {
  const p = useTheme();
  const [picked, setPicked] = useState<GridCell | null>(null);
  const reshape = (patch: Parameters<typeof reshapeLevel>[2]) => edit((x) => reshapeLevel(x, level.id, patch).tables);
  const isGrid = level.type === 'binGrid';
  const binAt = new Map<ID, number>();
  for (const b of Object.values(t.bins)) if (b.slotId) binAt.set(b.slotId, b.number);

  const tapCell = (cell: GridCell) => {
    if (!isGrid) return;
    if (cell.span === 2) {
      setPicked(null);
      return edit((x) => splitSlot(x, cell.slots[0].id));
    }
    if (picked && picked.depth === cell.depth && Math.abs(picked.column - cell.column) === 1 && picked.span === 1) {
      const left = Math.min(picked.column, cell.column);
      setPicked(null);
      return edit((x) => mergeSlots(x, level.id, cell.depth, left).tables);
    }
    setPicked(picked && picked.column === cell.column && picked.depth === cell.depth ? null : cell);
  };

  const remove = () => {
    const go = () => {
      edit((x) => deleteLevel(x, level.id));
      onClose();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Remove level', 'Its bins go to Unplaced; loose items go to Others. Nothing is lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <View style={{ backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1.2, borderColor: p.ink, padding: 12, gap: 12 }}>
      <Row>
        <CodeChip code={level.code} active />
        <Field
          value={level.name}
          onChangeText={(name) => reshape({ name })}
          style={{ flex: 1, minHeight: 40, backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 4 }}
        />
        <T v="mono" style={{ color: p.inkMuted }}>
          {dims(level)}
        </T>
      </Row>
      <Segmented<LevelType>
        value={level.type}
        onChange={(type) => reshape({ type, reach: type === 'binGrid' ? level.reach : 'openTop' })}
        options={[
          { key: 'binGrid', label: 'Bin grid' },
          { key: 'looseShelf', label: 'Loose shelf' },
          { key: 'drawers', label: 'Drawers' },
        ]}
      />
      {isGrid ? (
        <>
          <T v="label">how you reach it</T>
          <Segmented<Reach>
            value={level.reach}
            onChange={(reach) => reshape({ reach })}
            options={[
              { key: 'fromFront', label: 'From the front' },
              { key: 'openTop', label: 'Open top' },
            ]}
          />
        </>
      ) : null}
      <Row>
        <Stepper
          value={level.across}
          min={1}
          max={level.type === 'drawers' ? MAX_DRAWERS : level.type === 'looseShelf' ? MAX_ZONES : MAX_ACROSS}
          caption={level.type === 'drawers' ? 'drawers' : level.type === 'looseShelf' ? 'zones' : 'across'}
          onChange={(across) => reshape({ across })}
        />
        {isGrid ? <Stepper value={level.deep} min={1} max={MAX_DEEP} caption="deep" onChange={(deep) => reshape({ deep })} /> : null}
        {isGrid ? <Stepper value={level.high} min={1} max={MAX_HIGH} caption="high" onChange={(high) => reshape({ high })} /> : null}
      </Row>

      {level.type !== 'looseShelf' ? (
        <View>
          {isGrid ? (
            <T v="label" style={{ marginBottom: 6 }}>
              {level.backLabel}
            </T>
          ) : null}
          <View style={{ backgroundColor: p.tray, borderRadius: radius.md, padding: 6, gap: 5 }}>
            {(isGrid
              ? gridRows(level, slotsOfLevel(t, level.id))
              : [gridRows({ ...level, deep: 1 }, slotsOfLevel(t, level.id))[0] ?? []]
            ).map((cells, r) => (
              <View key={r} style={{ flexDirection: isGrid ? 'row' : 'column', gap: 5 }}>
                {cells.map((cell) => {
                  const numbers = cell.slots.map((s) => binAt.get(s.id)).filter((n): n is number => n !== undefined);
                  const isPicked = picked?.column === cell.column && picked.depth === cell.depth;
                  const label = numbers.length ? `#${numbers.map((n) => String(n).padStart(2, '0')).join('/')}` : 'free';
                  return (
                    <Pressable
                      key={`${cell.depth}${cell.column}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${slotCode(level, cell.slots[0])}, ${numbers.length ? `bin ${numbers.join(' and ')}` : 'free'}${cell.span === 2 ? ', merged; tap to split' : ', tap then tap a neighbour to merge'}`}
                      onPress={() => tapCell(cell)}
                      style={{
                        flex: cell.span,
                        minHeight: 40,
                        borderRadius: 5,
                        backgroundColor: numbers.length ? p.surface : 'transparent',
                        borderWidth: isPicked || cell.span === 2 ? 1.5 : 1,
                        borderStyle: numbers.length ? 'solid' : 'dashed',
                        borderColor: isPicked ? p.signal : cell.span === 2 ? p.signalText : p.hairline,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: font.monoBold, fontSize: 11, color: p.ink }}>{label}</Text>
                      <Text style={{ fontFamily: font.mono, fontSize: 9, color: p.inkMuted }}>{slotCode(level, cell.slots[0])}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          {isGrid ? <FrontEdge label={level.frontLabel} /> : null}
          <T v="small" style={{ marginTop: 8 }}>
            {isGrid
              ? level.reach === 'openTop'
                ? 'Open top: once it’s out, every bin is in reach. Answers never list lift steps for this level. Tap two neighbours to merge them for a wide bin; tap a merged slot to split it.'
                : 'Tap a slot, then its neighbour, to merge them for a wide bin; tap a merged slot to split it.'
              : 'Each drawer is one place. Open top, nothing to lift.'}
          </T>
        </View>
      ) : (
        <T v="small">
          Loose shelf: things without bins, in zones left to right. Answers say “on the shelf, right side”: no rows, no lifting.
        </T>
      )}

      <Row style={{ flexWrap: 'wrap' }}>
        {isGrid ? (
          <SmallButton title="Flip front" onPress={() => reshape({ frontLabel: level.backLabel, backLabel: level.frontLabel })} />
        ) : null}
        {!first ? <SmallButton title="Move up" onPress={() => edit((x) => moveLevel(x, level.id, -1))} /> : null}
        {!last ? <SmallButton title="Move down" onPress={() => edit((x) => moveLevel(x, level.id, 1))} /> : null}
        <SmallButton title="Remove" onPress={remove} />
        <View style={{ flex: 1 }} />
        <SmallButton title="Done" onPress={onClose} />
      </Row>
    </View>
  );
}
