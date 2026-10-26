import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { CategoryPicker, resolveCategory } from '../../../components/CategoryPicker';
import { Button, Field, Hairline, ListRow, Row, Screen, SectionLabel, Segmented, Stepper, T, TopBar } from '../../../components/ui';
import { binOrdinal, binSlotCode, categoryOf, itemsInBin } from '../../../core/naming';
import { createCategory, deleteBin, placeBin, updateBin } from '../../../core/ops';
import { binNumberLabel } from '../../../core/reach';
import type { BinSize } from '../../../core/types';
import { useAtlas } from '../../../data/store';
import { attempt } from '../../../util/format';

/** Bin settings: category, nickname, size, fill; move to Unplaced; delete. */
export default function EditBin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useAtlas((s) => s.tables);
  const apply = useAtlas((s) => s.apply);
  const bin = t.bins[id];
  const [category, setCategory] = useState<string | null>(bin?.categoryId ?? null);
  const [nickname, setNickname] = useState(bin?.nickname ?? '');
  const [size, setSize] = useState<BinSize>(bin?.size ?? 'M');
  const [fill, setFill] = useState<number>(bin?.fillEstimate ?? -10);
  if (!bin) return null;

  const cat = categoryOf(t, bin);
  const ord = binOrdinal(t, bin);
  const code = binSlotCode(t, bin);

  const save = () => {
    const ok = attempt(() =>
      apply((x) => {
        let next = x;
        const catId = resolveCategory(category, (name) => {
          const r = createCategory(next, { name });
          next = r.tables;
          return r.categoryId;
        });
        return updateBin(next, bin.id, {
          categoryId: bin.isOthers ? undefined : (catId ?? undefined),
          nickname,
          size,
          fillEstimate: fill < 0 ? undefined : fill,
        });
      }),
    );
    if (ok) router.back();
  };

  const confirm = (title: string, message: string, action: () => void) => {
    if (Platform.OS === 'web') return action();
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: title, style: 'destructive', onPress: action },
    ]);
  };

  const n = itemsInBin(t, bin.id).length;

  return (
    <Screen
      footer={
        <Row gap={10}>
          {code ? (
            <Button
              kind="secondary"
              flex
              title="Unplace"
              onPress={() =>
                confirm('Unplace', `${binNumberLabel(bin.number)} goes to the Unplaced tray; place it again from the level view.`, () => {
                  apply((x) => placeBin(x, bin.id, null));
                  router.back();
                })
              }
            />
          ) : null}
          {!bin.isOthers ? (
            <Button
              kind="danger"
              flex
              title="Delete bin"
              onPress={() =>
                confirm(
                  'Delete',
                  n
                    ? `Its ${n} item${n === 1 ? '' : 's'} move to Others. The number ${binNumberLabel(bin.number)} is never reused.`
                    : 'The number is never reused.',
                  () => {
                    if (attempt(() => apply((x) => deleteBin(x, bin.id)))) router.dismissTo('/');
                  },
                )
              }
            />
          ) : null}
        </Row>
      }
    >
      <TopBar
        backIcon="close"
        caption={`bin ${binNumberLabel(bin.number)}${code ? ` · ${code}` : ''}`}
        onBack={() => router.back()}
        right={<Button kind="dark" title="Save" onPress={save} style={{ minHeight: 40, paddingHorizontal: 16 }} />}
      />
      {bin.isOthers ? (
        <ListRow title="Category" value="Others · the catch-all" chevron={false} />
      ) : (
        <>
          <SectionLabel right={<T v="small">{cat ? `now ${cat.name}${ord ? ` · ${ord}` : ''}` : ''}</T>}>Category</SectionLabel>
          <CategoryPicker t={t} value={category} onChange={setCategory} />
        </>
      )}
      <SectionLabel>Nickname · optional</SectionLabel>
      <Field
        placeholder={`Shown instead of “${cat?.name ?? 'Category'}${ord ? ` · ${ord}` : ''}”`}
        value={nickname}
        onChangeText={setNickname}
      />
      <SectionLabel>Size</SectionLabel>
      <Segmented
        value={size}
        onChange={setSize}
        options={[
          { key: 'S', label: 'Small' },
          { key: 'M', label: 'Medium' },
          { key: 'L', label: 'Large' },
        ]}
      />
      <SectionLabel>Fill level</SectionLabel>
      <View style={{ flexDirection: 'row' }}>
        <Stepper value={Math.max(0, fill)} min={0} max={100} step={10} caption={fill < 0 ? 'unknown' : '% full'} onChange={setFill} />
      </View>
      <T v="small" style={{ marginTop: 6 }}>
        Rough is fine. Atlas uses it to avoid suggesting a full bin. Audit photos will set it for you later.
      </T>
      <Hairline style={{ marginVertical: 16 }} />
      <T v="small">The slot code is printed small on the label: it changes if you move the bin; the number doesn’t.</T>
    </Screen>
  );
}
