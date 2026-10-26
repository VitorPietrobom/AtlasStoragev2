import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { Sticker } from '../../components/Sticker';
import { Button, Card, ReachChip, Row, Screen, SmallButton, T, TopBar } from '../../components/ui';
import { DEPTH_WORD, slotCode } from '../../core/grid';
import { binName, binOrdinal, categoryOf, daysBetween, isOut, isStale, itemLabel, itemsInBin } from '../../core/naming';
import { confirmBin } from '../../core/ops';
import { binNumberLabel, liftPlan, locateBin, stackWord } from '../../core/reach';
import { useAtlas } from '../../data/store';
import { font, radius, useTheme } from '../../theme';
import { ago, shortDate } from '../../util/format';

/** The drawer front: number on the tab, fill as ticks, items as stickers, items out below. */
export default function BinScreen() {
  const p = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useAtlas((s) => s.tables);
  const apply = useAtlas((s) => s.apply);
  const bin = t.bins[id];
  if (!bin) return <Missing />;

  const cat = categoryOf(t, bin);
  const items = itemsInBin(t, bin.id);
  const inside = items.filter((i) => i.quantityOut < i.quantityTotal);
  const out = items.filter(isOut);
  const loc = locateBin(t, bin.id);
  const plan = liftPlan(t, bin.id);
  const stale = isStale(bin, t.settings.settings);
  const fill = bin.fillEstimate;
  const ord = binOrdinal(t, bin);
  const facts = [
    `${cat?.name ?? '—'}${ord ? ` ${ord}` : ''}`,
    fill !== undefined ? `fill ~${fill}%` : null,
    `${inside.length} in`,
    out.length ? `${out.length} out` : null,
    `confirmed ${ago(bin.lastConfirmedAt)}`,
  ].filter(Boolean);
  const where = loc
    ? [
        slotCode(loc.level, loc.slot),
        loc.level.name,
        loc.level.type === 'binGrid' && loc.level.deep > 1 ? `${DEPTH_WORD[loc.slot.depth]} row` : null,
        stackWord(loc.level, loc.slot.stackIndex) || null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Unplaced';
  const liftText = plan.cost
    ? `lift ${plan.steps
        .flatMap((s) => s.binIds)
        .map((b) => binNumberLabel(t.bins[b].number))
        .join(', ')}`
    : undefined;
  const stackmates = loc
    ? Object.values(t.bins).filter(
        (b) =>
          b.id !== bin.id &&
          b.slotId &&
          t.slots[b.slotId]?.levelId === loc.level.id &&
          t.slots[b.slotId].column === loc.slot.column &&
          t.slots[b.slotId].depth === loc.slot.depth,
      )
    : [];

  return (
    <Screen
      footer={
        <Row gap={10}>
          <Pressable
            accessibilityRole="search"
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
            }}
          >
            <Icon name="search" color={p.inkMuted} size={18} />
            <T v="body" style={{ color: p.inkMuted }} numberOfLines={1}>
              {inside[0] ? `try ‘${inside[0].name.toLowerCase()}’` : 'Search everywhere'}
            </T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add an item to bin ${bin.number}`}
            onPress={() => router.push({ pathname: '/add', params: { binId: bin.id } })}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.signal, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="camera" color={p.onSignal} size={22} />
          </Pressable>
        </Row>
      }
    >
      <TopBar
        onBack={() => router.back()}
        right={<SmallButton title="Edit" onPress={() => router.push({ pathname: '/bin/edit/[id]', params: { id: bin.id } })} />}
      />

      {/* Tab + drawer front */}
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: p.surface,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          paddingHorizontal: 12,
          paddingTop: 6,
          paddingBottom: 2,
          marginLeft: 14,
        }}
      >
        <Text style={{ fontFamily: font.monoBold, fontSize: 22, color: p.ink }}>{binNumberLabel(bin.number)}</Text>
      </View>
      <Card
        style={{
          borderRadius: radius.lg,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <T v="display" style={{ marginBottom: 10 }}>
          {binName(t, bin)}
        </T>
        <FillTicks value={fill} />
        <T v="label" style={{ fontSize: 10, marginTop: 8 }}>
          {facts.join(' · ')}
        </T>
        <Row style={{ marginTop: 10, flexWrap: 'wrap' }}>
          {loc ? <ReachChip cost={plan.cost} text={liftText} /> : null}
          <T v="label" style={{ fontSize: 10 }}>
            {where}
          </T>
        </Row>
        {stale ? (
          <T v="small" style={{ color: p.signalText, marginTop: 8 }}>
            Not checked for a while. Look inside and confirm it still holds these.
          </T>
        ) : null}
      </Card>

      {stackmates.length ? (
        <T v="small" style={{ marginTop: 10 }}>
          {`Same stack: `}
          {stackmates.map((b, i) => (
            <Text
              key={b.id}
              onPress={() => router.push({ pathname: '/bin/[id]', params: { id: b.id } })}
              style={{ color: p.ink, textDecorationLine: 'underline' }}
            >
              {`${i ? ', ' : ''}${binNumberLabel(b.number)} ${binName(t, b)}`}
            </Text>
          ))}
        </T>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 18 }}>
        {inside.map((i) => (
          <Pressable
            key={i.id}
            accessibilityRole="button"
            accessibilityLabel={itemLabel(i)}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: i.id } })}
            style={({ pressed }) => ({ width: '50%', alignItems: 'center', paddingVertical: 14, opacity: pressed ? 0.7 : 1 })}
          >
            <Sticker item={i} size={92} faded={stale} />
            <T v="bodyMedium" style={{ marginTop: 10, textAlign: 'center' }} numberOfLines={2}>
              {i.name}
              {i.quantityTotal > 1 ? <T v="small">{`  ×${i.quantityTotal - i.quantityOut}`}</T> : null}
            </T>
          </Pressable>
        ))}
        {inside.length === 0 ? (
          <T v="small" style={{ paddingVertical: 20 }}>
            Nothing registered here yet. Tap the camera to add the first item.
          </T>
        ) : null}
      </View>

      {out.length ? (
        <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: p.signal, marginTop: 8, paddingTop: 10 }}>
          {out.map((i) => (
            <Pressable
              key={i.id}
              onPress={() => router.push({ pathname: '/item/[id]', params: { id: i.id } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
            >
              <Text style={{ fontFamily: font.monoBold, fontSize: 11, color: p.signalText, width: 34 }}>OUT</Text>
              <Sticker item={i} size={36} />
              <View style={{ flex: 1 }}>
                <T v="bodyMedium">{i.quantityTotal > 1 ? `${i.name} · ${i.quantityOut} of ${i.quantityTotal}` : i.name}</T>
                {i.outSince ? (
                  <T v="label" style={{ fontSize: 10 }}>
                    {`since ${shortDate(i.outSince)} · ${daysBetween(i.outSince)} days`}
                  </T>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: 20 }}>
        <Button
          kind="secondary"
          title={stale ? 'I checked it: all still here' : 'Mark checked'}
          onPress={() => apply((x) => confirmBin(x, bin.id))}
        />
      </View>
    </Screen>
  );
}

/** Ten ticks; filled up to the fill estimate. Unknown fill shows all muted. */
function FillTicks({ value }: { value?: number }) {
  const p = useTheme();
  const filled = value === undefined ? 0 : Math.round(value / 10);
  return (
    <View accessibilityLabel={value === undefined ? 'Fill unknown' : `About ${value}% full`} style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 8, borderRadius: 2, backgroundColor: i < filled ? p.ink : p.hairline }} />
      ))}
    </View>
  );
}

function Missing() {
  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <T v="title">This bin no longer exists.</T>
    </Screen>
  );
}
