import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { QuantitySheet } from '../../components/QuantitySheet';
import { Sticker } from '../../components/Sticker';
import { Button, Hairline, IconButton, Row, Screen, T, TopBar } from '../../components/ui';
import { binName, binSlotCode, daysBetween, isOut } from '../../core/naming';
import { returnItem, takeOut } from '../../core/ops';
import { binNumberLabel, reachSummary } from '../../core/reach';
import { useAtlas } from '../../data/store';
import { font, useTheme } from '../../theme';
import { describeEvent } from '../../util/events';
import { longDate, timeOrDate } from '../../util/format';

/** A specimen page: the sticker large, attributes as museum tags, every move on the record. */
export default function ItemScreen() {
  const p = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useAtlas((s) => s.tables);
  const apply = useAtlas((s) => s.apply);
  const [asking, setAsking] = useState(false);
  const item = t.items[id];
  if (!item) {
    return (
      <Screen>
        <TopBar onBack={() => router.back()} />
        <T v="title">This item no longer exists.</T>
      </Screen>
    );
  }

  const bin = item.binId ? t.bins[item.binId] : undefined;
  const zone = item.zoneId ? t.zones[item.zoneId] : undefined;
  const out = isOut(item);
  const allOut = item.quantityOut >= item.quantityTotal;
  const ordinal = Object.values(t.items).filter((i) => i.createdAt <= item.createdAt).length;
  const events = Object.values(t.events)
    .filter((e) => e.itemId === item.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const takeOuts = events.filter((e) => e.type === 'tookOut').length;
  const binLine = bin
    ? `${binNumberLabel(bin.number)} ${binName(t, bin)}${binSlotCode(t, bin) ? ` · ${binSlotCode(t, bin)}` : ''}`
    : zone
      ? `${t.levels[zone.levelId]?.name}, ${zone.name.toLowerCase()}`
      : 'Unfiled';
  const home = bin ? binNumberLabel(bin.number) : 'its place';

  const take = () => {
    if (item.quantityTotal - item.quantityOut > 1) setAsking(true);
    else apply((x) => takeOut(x, item.id, 1));
  };

  const status = out ? (
    <Badge
      color={p.signal}
      text={
        item.missing
          ? 'missing'
          : `out${item.quantityTotal > 1 ? ` ${item.quantityOut} of ${item.quantityTotal}` : ''} · ${daysBetween(item.outSince ?? item.createdAt)} days`
      }
      filled
    />
  ) : (
    <Badge color={p.inOk} text={`in ${bin ? binNumberLabel(bin.number) : zone ? 'zone' : '—'}`} />
  );

  return (
    <Screen
      footer={
        <Row gap={10}>
          {out ? <Button flex title={`Return to ${home}`} onPress={() => apply((x) => returnItem(x, item.id))} /> : null}
          {out ? (
            <Button
              kind="secondary"
              flex
              title="Moved elsewhere"
              onPress={() => router.push({ pathname: '/item/move/[id]', params: { id: item.id } })}
            />
          ) : null}
          {!allOut && !out ? <Button flex title="Take out" onPress={take} /> : null}
          {!allOut && out ? <Button kind="secondary" title="Take more" onPress={take} /> : null}
        </Row>
      }
    >
      <TopBar
        caption={`no. ${String(ordinal).padStart(4, '0')}`}
        onBack={() => router.back()}
        right={
          <IconButton icon="more" label="Edit item" onPress={() => router.push({ pathname: '/item/edit/[id]', params: { id: item.id } })} />
        }
      />
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Sticker item={item} size={176} />
        <View style={{ marginTop: 20 }}>{status}</View>
        <T v="display" style={{ fontSize: 40, lineHeight: 44, marginTop: 8, textAlign: 'center' }}>
          {item.name}
          {item.quantityTotal > 1 ? <T v="serif" style={{ color: p.inkMuted }}>{`  ×${item.quantityTotal}`}</T> : null}
        </T>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 }}>
        <Tag
          label={out ? 'Home bin' : 'Bin'}
          value={binLine}
          onPress={bin ? () => router.push({ pathname: '/bin/[id]', params: { id: bin.id } }) : undefined}
        />
        <Tag
          label={out ? 'Out since' : 'Confirmed'}
          value={out && item.outSince ? longDate(item.outSince) : bin ? longDate(bin.lastConfirmedAt) : '—'}
        />
        <Tag label={out ? 'Goes back to' : 'Reach'} value={bin ? reachSummary(t, bin.id) : 'Loose shelf · no lifting'} />
        <Tag label="Taken out" value={`${takeOuts} time${takeOuts === 1 ? '' : 's'}`} />
      </View>

      <T v="label" style={{ marginTop: 18, marginBottom: 6 }}>
        Events
      </T>
      {events.slice(0, 12).map((e) => {
        const d = describeEvent(t, e);
        const dot = e.type === 'tookOut' || e.type === 'missing' ? p.signal : e.type === 'returned' ? p.inOk : p.inkMuted;
        return (
          <Row key={e.id} style={{ paddingVertical: 6 }} gap={10}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
            <T v="body" style={{ flex: 1 }} numberOfLines={2}>
              {d.title}
            </T>
            <T v="label" style={{ fontSize: 10 }}>
              {timeOrDate(e.at)}
            </T>
          </Row>
        );
      })}

      {bin ? (
        <QuantitySheet
          item={item}
          binNumber={bin.number}
          visible={asking}
          onClose={() => setAsking(false)}
          onTake={(n) => {
            apply((x) => takeOut(x, item.id, n));
            setAsking(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

function Tag({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <View style={{ width: '50%', paddingRight: 12, paddingVertical: 8 }}>
      <Hairline style={{ marginBottom: 8 }} />
      <T v="label" style={{ fontSize: 10 }}>
        {label}
      </T>
      <T v="body" onPress={onPress} style={onPress ? { textDecorationLine: 'underline' } : undefined}>
        {value}
      </T>
    </View>
  );
}

function Badge({ text, color, filled }: { text: string; color: string; filled?: boolean }) {
  const p = useTheme();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: color,
        backgroundColor: filled ? color : 'transparent',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {!filled ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} /> : null}
      <Text style={{ fontFamily: font.monoBold, fontSize: 11, letterSpacing: 1, color: filled ? p.onSignal : color }}>
        {text.toUpperCase()}
      </Text>
    </View>
  );
}
