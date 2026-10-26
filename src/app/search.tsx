import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '../components/Icon';
import { Sticker } from '../components/Sticker';
import { Button, Hairline, noWebOutline, Screen, T } from '../components/ui';
import { binName, binSlotCode, itemCategory, itemPlaceCode, itemsInBin, othersBin } from '../core/naming';
import { binNumberLabel, reachCost } from '../core/reach';
import { closeMatches, search } from '../core/search';
import type { Item, Tables } from '../core/types';
import { useAtlas } from '../data/store';
import { font, radius, TOUCH, useTheme } from '../theme';
import { shortDate } from '../util/format';

/** Local search: categories first, then items easiest to reach. No network. */
export default function Search() {
  const p = useTheme();
  const t = useAtlas((s) => s.tables);
  const [q, setQ] = useState('');
  const r = useMemo(() => search(t, q), [t, q]);
  const others = othersBin(t);
  const nothing = q.trim().length > 1 && r.items.length === 0 && r.categories.length === 0 && r.bins.length === 0;

  return (
    <Screen
      footer={
        nothing ? (
          <Button
            kind="secondary"
            title={`Register “${q.trim()}”`}
            onPress={() => router.replace({ pathname: '/add', params: { name: q.trim() } })}
          />
        ) : undefined
      }
    >
      <View
        style={{
          minHeight: 52,
          borderRadius: radius.pill,
          backgroundColor: p.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: p.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 18,
          gap: 10,
        }}
      >
        <Icon name="search" color={p.inkMuted} size={18} />
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder="Search everywhere"
          placeholderTextColor={p.inkMuted}
          returnKeyType="search"
          autoCorrect={false}
          style={[{ flex: 1, fontFamily: font.ui, fontSize: 16, color: p.ink, minHeight: 50 }, noWebOutline]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={q ? 'Clear' : 'Close'}
          onPress={() => (q ? setQ('') : router.back())}
          style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" color={p.inkMuted} size={16} />
        </Pressable>
      </View>

      {r.categories.slice(0, 1).map((c) => (
        <View key={c.category.id}>
          <T v="label" style={{ marginTop: 18, marginBottom: 8 }}>
            {`category · ${c.category.name} · ${c.bins.length} bin${c.bins.length === 1 ? '' : 's'}`}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {c.bins.map((b) => {
              const cost = reachCost(t, b.id);
              return (
                <Pressable
                  key={b.id}
                  onPress={() => router.push({ pathname: '/bin/[id]', params: { id: b.id } })}
                  style={{
                    width: '48%',
                    backgroundColor: p.surface,
                    borderRadius: radius.md,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: p.hairline,
                    padding: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: font.monoBold, fontSize: 11, color: p.ink }}>{binNumberLabel(b.number)}</Text>
                    <Text style={{ fontFamily: font.monoMedium, fontSize: 10, color: cost ? p.inkMuted : p.inOk }}>
                      {cost ? `LIFT ${cost}` : 'NO LIFTING'}
                    </Text>
                  </View>
                  <T v="bodyMedium" numberOfLines={1} style={{ marginTop: 6 }}>
                    {binName(t, b)}
                  </T>
                  <T v="label" style={{ fontSize: 10 }}>
                    {`${binSlotCode(t, b) ?? 'unplaced'} · ${itemsInBin(t, b.id).length} items`}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {r.bins.length ? (
        <>
          <T v="label" style={{ marginTop: 18, marginBottom: 4 }}>
            bins
          </T>
          {r.bins.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => router.push({ pathname: '/bin/[id]', params: { id: b.id } })}
              style={{ paddingVertical: 10 }}
            >
              <T v="bodyMedium">{`${binNumberLabel(b.number)} ${binName(t, b)}`}</T>
              <T v="label" style={{ fontSize: 10 }}>
                {binSlotCode(t, b) ?? 'unplaced'}
              </T>
            </Pressable>
          ))}
        </>
      ) : null}

      {r.items.length ? (
        <>
          <T v="label" style={{ marginTop: 18, marginBottom: 4 }}>
            {`items · ${r.items.length} match${r.items.length === 1 ? '' : 'es'} · easiest to reach first`}
          </T>
          {r.items.slice(0, 40).map((h) => (
            <ItemRow key={h.item.id} t={t} item={h.item} cost={h.reachCost} />
          ))}
        </>
      ) : null}

      {nothing ? (
        <View style={{ marginTop: 18 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              borderWidth: 1.2,
              borderStyle: 'dashed',
              borderColor: p.inkMuted,
              transform: [{ rotate: '-3deg' }],
            }}
          />
          <T v="display" style={{ marginTop: 14 }}>
            Not in any bin.
          </T>
          <T v="small">{`Nothing registered as “${q.trim()}”.`}</T>
          {closeMatches(t, q).length ? (
            <>
              <T v="label" style={{ marginTop: 18, marginBottom: 4 }}>
                close matches
              </T>
              {closeMatches(t, q).map((i) => (
                <ItemRow key={i.id} t={t} item={i} cost={i.binId ? reachCost(t, i.binId) : 0} />
              ))}
            </>
          ) : null}
          {others ? (
            <Pressable
              onPress={() => router.push({ pathname: '/bin/[id]', params: { id: others.id } })}
              style={{
                marginTop: 14,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: p.hairline,
                borderRadius: radius.md,
                padding: 14,
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <T v="body">{`Look through Others (${itemsInBin(t, others.id).length} unsorted items)`}</T>
              <Text style={{ fontFamily: font.monoBold, fontSize: 11, color: p.ink }}>#00</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function ItemRow({ t, item, cost }: { t: Tables; item: Item; cost: number }) {
  const p = useTheme();
  const bin = item.binId ? t.bins[item.binId] : undefined;
  const cat = itemCategory(t, item);
  const out = item.quantityOut >= item.quantityTotal;
  const parts = out
    ? [`out since ${item.outSince ? shortDate(item.outSince) : '—'}`]
    : [
        bin ? (binSlotCode(t, bin) ?? 'unplaced') : itemPlaceCode(t, item),
        cost ? `lift ${cost}` : 'no lifting',
        cat && !cat.isOthers ? cat.name : null,
      ].filter(Boolean);
  return (
    <>
      <Pressable
        onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}
      >
        <Sticker item={item} size={36} />
        <View style={{ flex: 1 }}>
          <T v="bodyMedium" numberOfLines={1}>
            {item.quantityTotal > 1 ? `${item.name} ×${item.quantityTotal}` : item.name}
          </T>
          <T v="label" style={{ fontSize: 10, color: out ? p.signalText : p.inkMuted }} numberOfLines={1}>
            {parts.join(' · ')}
          </T>
        </View>
        {bin ? (
          <View
            style={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: p.hairline,
              borderRadius: 4,
              paddingHorizontal: 5,
              paddingVertical: 2,
              backgroundColor: p.surface,
            }}
          >
            <Text style={{ fontFamily: font.monoBold, fontSize: 10, color: p.ink }}>{binNumberLabel(bin.number)}</Text>
          </View>
        ) : null}
      </Pressable>
      <Hairline />
    </>
  );
}
