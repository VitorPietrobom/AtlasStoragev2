import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { CategoryPicker, resolveCategory } from '../components/CategoryPicker';
import { Sticker } from '../components/Sticker';
import { Button, Field, FrontEdge, Hairline, Row, Screen, SmallButton, Stepper, T } from '../components/ui';
import { depthCodes, MAX_ACROSS, MAX_DEEP, MAX_DRAWERS, MAX_HIGH, slotCode, slotsOfLevel, zoneCodes } from '../core/grid';
import { binName, binsOfCategory } from '../core/naming';
import { createBin, createCategory, createUnit, defaultsForKind, nextLevelCode, RuleError } from '../core/ops';
import { binNumberLabel } from '../core/reach';
import type { ID, Reach, Tables, UnitKind } from '../core/types';
import { takePhoto } from '../data/capture';
import { keepPhoto } from '../data/photos';
import { useAtlas } from '../data/store';
import { newUuid } from '../data/uuid';
import { font, radius, useTheme } from '../theme';
import { attempt } from '../util/format';

const KINDS: { key: UnitKind; title: string; sub: string }[] = [
  { key: 'shelving', title: 'Shelving', sub: 'Levels of bins, reached from the front' },
  { key: 'pullOutDrawer', title: 'Pull-out drawer', sub: 'One layer of bins, open from the top' },
  { key: 'drawerUnit', title: 'Drawer unit', sub: 'Each drawer is one place' },
  { key: 'looseShelf', title: 'Loose shelf', sub: 'Things without bins, in zones' },
];

/** Three steps: what it is, its shape, then fill it slot by slot. The empty app opens here. */
export default function Setup() {
  const p = useTheme();
  const { first } = useLocalSearchParams<{ first?: string }>();
  const t = useAtlas((s) => s.tables);
  const apply = useAtlas((s) => s.apply);
  const show = useAtlas((s) => s.show);
  const loadSample = useAtlas((s) => s.loadSample);

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<UnitKind>('shelving');
  const d = defaultsForKind(kind);
  const [across, setAcross] = useState(d.across);
  const [deep, setDeep] = useState(d.deep);
  const [high, setHigh] = useState(d.high);
  const [reach, setReach] = useState<Reach>(d.reach);
  const [flipped, setFlipped] = useState(false);
  const [levelName, setLevelName] = useState('');
  const [made, setMade] = useState<{ unitId: ID; levelId: ID } | null>(null);

  const pickKind = (k: UnitKind) => {
    const x = defaultsForKind(k);
    setKind(k);
    setAcross(x.across);
    setDeep(x.deep);
    setHigh(x.high);
    setReach(x.reach);
    setFlipped(false);
  };

  const isGrid = kind === 'shelving' || kind === 'pullOutDrawer';
  const front = flipped ? d.backLabel : d.frontLabel;
  const back = flipped ? d.frontLabel : d.backLabel;

  const create = () => {
    let r: ReturnType<typeof createUnit> | undefined;
    apply((x) => {
      r = createUnit(x, {
        name: name.trim() || KINDS.find((k) => k.key === kind)!.title,
        kind,
        level: {
          name: levelName.trim() || undefined,
          across,
          deep: isGrid ? deep : 1,
          high: isGrid ? high : 1,
          reach,
          frontLabel: front,
          backLabel: back,
        },
      });
      return r.tables;
    });
    if (!r) return;
    setMade({ unitId: r.unitId, levelId: r.levelId });
    show(r.unitId, r.levelId);
    if (kind === 'looseShelf') router.dismissTo('/');
    else setStep(3);
  };

  return (
    <Screen
      footer={
        step === 1 ? (
          <Button title="Continue" onPress={() => setStep(2)} disabled={!name.trim()} />
        ) : step === 2 ? (
          <Row gap={10}>
            <Button kind="secondary" title="Back" onPress={() => setStep(1)} />
            <Button flex title={kind === 'looseShelf' ? 'Done' : 'Continue'} onPress={create} />
          </Row>
        ) : (
          <Button kind="secondary" title="Finish later" onPress={() => router.dismissTo('/')} />
        )
      }
    >
      <Progress step={step} />
      {step === 1 ? (
        <>
          <T v="label" style={{ marginTop: 14 }}>
            step 1 of 3
          </T>
          <T v="display">What is it?</T>
          <T v="label" style={{ marginTop: 16, marginBottom: 6 }}>
            name
          </T>
          <Field serif placeholder="Wardrobe" value={name} onChangeText={setName} autoFocus={!first} autoCapitalize="words" />
          <View style={{ gap: 8, marginTop: 16 }}>
            {KINDS.map((k) => {
              const on = k.key === kind;
              return (
                <Pressable
                  key={k.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => pickKind(k.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: 12,
                    backgroundColor: p.surface,
                    borderRadius: radius.md,
                    borderWidth: on ? 2 : StyleSheet.hairlineWidth,
                    borderColor: on ? p.signal : p.hairline,
                  }}
                >
                  <KindIcon kind={k.key} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyMedium">{k.title}</T>
                    <T v="small">{k.sub}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {first ? (
            <View style={{ marginTop: 24, alignItems: 'center', gap: 6 }}>
              <T v="small">Just looking around?</T>
              <SmallButton
                title="Try with a sample house"
                onPress={() => {
                  loadSample();
                  router.replace('/');
                }}
              />
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              <SmallButton title="Cancel" onPress={() => router.back()} />
            </View>
          )}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <T v="label" style={{ marginTop: 14 }}>
            {`step 2 of 3 · ${name}`}
          </T>
          <T v="display">
            {kind === 'looseShelf' ? 'How many zones?' : kind === 'drawerUnit' ? 'How many drawers?' : 'How many bins fit?'}
          </T>
          {kind === 'shelving' ? (
            <>
              <T v="label" style={{ marginTop: 14, marginBottom: 6 }}>
                first shelf
              </T>
              <Field placeholder="Top shelf" value={levelName} onChangeText={setLevelName} />
            </>
          ) : null}
          <Row style={{ marginTop: 14 }}>
            <Stepper
              value={across}
              onChange={setAcross}
              min={1}
              max={kind === 'drawerUnit' ? MAX_DRAWERS : kind === 'looseShelf' ? 3 : MAX_ACROSS}
              caption={kind === 'drawerUnit' ? 'drawers' : kind === 'looseShelf' ? 'zones' : 'across'}
            />
            {isGrid ? <Stepper value={deep} onChange={setDeep} min={1} max={MAX_DEEP} caption="deep" /> : null}
            {isGrid ? <Stepper value={high} onChange={setHigh} min={1} max={MAX_HIGH} caption="high" /> : null}
          </Row>
          <Preview t={t} kind={kind} across={across} deep={isGrid ? deep : 1} high={isGrid ? high : 1} front={front} back={back} />
          {isGrid ? (
            <>
              <Row style={{ minHeight: 50, justifyContent: 'space-between' }}>
                <T v="body">Reach</T>
                <Row>
                  <T v="small">{reach === 'fromFront' ? 'From the front' : 'Open top'}</T>
                  <SmallButton title="Change" onPress={() => setReach(reach === 'fromFront' ? 'openTop' : 'fromFront')} />
                </Row>
              </Row>
              <Hairline />
              <Row style={{ minHeight: 50, justifyContent: 'space-between' }}>
                <T v="body">Front edge</T>
                <Row>
                  <T v="small">{front}</T>
                  <SmallButton title="Flip" onPress={() => setFlipped(!flipped)} />
                </Row>
              </Row>
              <Hairline />
              <T v="small" style={{ marginTop: 10 }}>
                {kind === 'shelving'
                  ? 'More shelves, and mixed sizes: add levels and merge slots later in the editor.'
                  : 'Mixed sizes? Merge slots later in the editor.'}
              </T>
            </>
          ) : null}
        </>
      ) : null}

      {step === 3 && made ? <FillSlots levelId={made.levelId} /> : null}
    </Screen>
  );
}

function Progress({ step }: { step: number }) {
  const p = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? p.ink : p.hairline }} />
      ))}
    </View>
  );
}

function KindIcon({ kind }: { kind: UnitKind }) {
  const p = useTheme();
  const s = { stroke: p.ink, strokeWidth: 1.4, fill: 'none' };
  return (
    <Svg width={40} height={30} viewBox="0 0 40 30">
      {kind === 'shelving' && [2, 11, 20].map((y) => <Rect key={y} x={2} y={y} width={36} height={7} rx={1} {...s} />)}
      {kind === 'pullOutDrawer' && [2, 14, 26].map((x) => <Rect key={x} x={x} y={3} width={10} height={24} rx={1} {...s} />)}
      {kind === 'drawerUnit' && [2, 9, 16, 23].map((y) => <Rect key={y} x={2} y={y} width={36} height={5} rx={1} {...s} />)}
      {kind === 'looseShelf' && <Rect x={3} y={3} width={34} height={24} rx={1} {...s} strokeDasharray="3 3" />}
    </Svg>
  );
}

function Preview({
  t,
  kind,
  across,
  deep,
  high,
  front,
  back,
}: {
  t: Tables;
  kind: UnitKind;
  across: number;
  deep: number;
  high: number;
  front: string;
  back: string;
}) {
  const p = useTheme();
  const code = nextLevelCode(t);
  if (kind === 'looseShelf') {
    return (
      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 16, backgroundColor: p.tray, padding: 8, borderRadius: radius.lg }}>
        {zoneCodes(across).map((z) => (
          <View
            key={z}
            style={{
              flex: 1,
              height: 80,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: p.hairline,
              padding: 6,
              justifyContent: 'flex-end',
            }}
          >
            <Text style={{ fontFamily: font.mono, fontSize: 10, color: p.inkMuted }}>{`${code}·${z}`}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (kind === 'drawerUnit') {
    return (
      <View style={{ gap: 6, marginVertical: 16 }}>
        {Array.from({ length: across }, (_, i) => (
          <View
            key={i}
            style={{
              height: 34,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: p.hairline,
              paddingHorizontal: 10,
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: font.mono, fontSize: 11, color: p.inkMuted }}>{`${code}${i + 1}`}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ marginVertical: 16 }}>
      <T v="label" style={{ marginBottom: 6 }}>
        {back}
      </T>
      <View style={{ backgroundColor: p.tray, padding: 8, borderRadius: radius.lg, gap: 6 }}>
        {depthCodes(deep).map((dc) => (
          <View key={dc} style={{ flexDirection: 'row', gap: 6 }}>
            {Array.from({ length: across }, (_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: p.hairline,
                  backgroundColor: p.surface,
                  padding: 5,
                  justifyContent: 'flex-end',
                }}
              >
                <Text style={{ fontFamily: font.mono, fontSize: 10, color: p.inkMuted }} numberOfLines={1}>
                  {`${code}${i + 1}·${dc}${high > 1 ? ` ×${high}` : ''}`}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      <FrontEdge label={front} />
    </View>
  );
}

/** Step 3: each slot gets a bin with a number and a category, optionally a photo. */
function FillSlots({ levelId }: { levelId: ID }) {
  const p = useTheme();
  const t = useAtlas((s) => s.tables);
  const apply = useAtlas((s) => s.apply);
  const level = t.levels[levelId];
  const slots = slotsOfLevel(t, levelId);
  const binAt = (slotId: ID) => Object.values(t.bins).find((b) => b.slotId === slotId);
  const done = slots.filter((s) => binAt(s.id)).length;
  const nextFree = slots.find((s) => !binAt(s.id));
  const [open, setOpen] = useState<ID | null>(nextFree?.id ?? null);
  const [category, setCategory] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();

  const shoot = async () => {
    const uri = await takePhoto('camera');
    if (uri) setPhoto(await keepPhoto(uri, `bin-${newUuid()}`));
  };

  const make = (slotId: ID) => {
    const ok = attempt(() =>
      apply((x) => {
        let next = x;
        const catId = resolveCategory(category, (n) => {
          const r = createCategory(next, { name: n });
          next = r.tables;
          return r.categoryId;
        });
        if (!catId) throw new RuleError('Pick or type a category');
        return createBin(next, { categoryId: catId, slotId, nickname, photoUri: photo }).tables;
      }),
    );
    if (!ok) return;
    setCategory(null);
    setNickname('');
    setPhoto(undefined);
    const after = slotsOfLevel(useAtlas.getState().tables, levelId).find(
      (s) => s.id !== slotId && !Object.values(useAtlas.getState().tables.bins).some((b) => b.slotId === s.id),
    );
    setOpen(after?.id ?? null);
  };

  return (
    <>
      <T v="label" style={{ marginTop: 14 }}>
        {`step 3 of 3 · ${done} of ${slots.length} done`}
      </T>
      <T v="display">{level.type === 'drawers' ? 'Name each drawer.' : 'Photograph each bin.'}</T>
      <T v="small" style={{ marginTop: 6, marginBottom: 10 }}>
        Tip one out on a plain surface, shoot it, put it back. Each bin gets a number for its label and a category, so the AI knows what
        belongs there.
      </T>
      {slots.map((s) => {
        const bin = binAt(s.id);
        const code = slotCode(level, s);
        const isOpen = open === s.id && !bin;
        return (
          <View key={s.id}>
            <Pressable
              onPress={() => !bin && setOpen(isOpen ? null : s.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 }}
            >
              <Text style={{ fontFamily: font.monoBold, fontSize: 12, color: p.ink, width: 52 }}>{code}</Text>
              {bin ? (
                <>
                  {bin.photoUri ? <Sticker item={{ id: bin.id, name: binName(t, bin), photoUri: bin.photoUri }} size={34} /> : null}
                  <T v="body" style={{ flex: 1 }} numberOfLines={1}>
                    {binName(t, bin)}
                  </T>
                  <Text style={{ fontFamily: font.monoBold, fontSize: 12, color: p.inOk }}>{`${binNumberLabel(bin.number)} ✓`}</Text>
                </>
              ) : (
                <>
                  <T v="body" style={{ flex: 1, color: s.id === nextFree?.id ? p.ink : p.inkMuted }}>
                    {s.id === nextFree?.id ? 'Next up' : 'Waiting · or leave free'}
                  </T>
                  {!isOpen ? <SmallButton title="Fill" active={s.id === nextFree?.id} onPress={() => setOpen(s.id)} /> : null}
                </>
              )}
            </Pressable>
            {isOpen ? (
              <View style={{ gap: 10, paddingBottom: 14 }}>
                <Row>
                  <SmallButton title={photo ? 'Retake bin photo' : 'Shoot the bin (optional)'} onPress={shoot} />
                  {photo ? <Sticker item={{ id: s.id, name: '', photoUri: photo }} size={36} /> : null}
                </Row>
                <CategoryPicker t={t} value={category} onChange={setCategory} />
                {category && !category.startsWith('new:') && binsOfCategory(t, category).length ? (
                  <T v="small">{`This will be ${t.categories[category].name} · ${binsOfCategory(t, category).length + 1} of ${binsOfCategory(t, category).length + 1}.`}</T>
                ) : null}
                <Field placeholder="Nickname (optional)" value={nickname} onChangeText={setNickname} />
                <Button
                  title={`Make bin ${binNumberLabel(t.settings.settings.lastBinNumber + 1)}`}
                  onPress={() => make(s.id)}
                  disabled={!category || category === 'new:'}
                />
              </View>
            ) : null}
            <Hairline />
          </View>
        );
      })}
    </>
  );
}
