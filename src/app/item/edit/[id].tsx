import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Sticker } from '../../../components/Sticker';
import { Button, Field, Hairline, ListRow, Row, Screen, SectionLabel, SmallButton, Stepper, T, TopBar } from '../../../components/ui';
import { binName, binSlotCode, itemCategory } from '../../../core/naming';
import { deleteItem, updateItem } from '../../../core/ops';
import { binNumberLabel } from '../../../core/reach';
import { storeWithSticker, takePhoto } from '../../../data/capture';
import { deletePhoto } from '../../../data/photos';
import { useAtlas } from '../../../data/store';
import { attempt } from '../../../util/format';

export default function EditItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useAtlas((s) => s.tables);
  const apply = useAtlas((s) => s.apply);
  const item = t.items[id];
  const [name, setName] = useState(item?.name ?? '');
  const [qty, setQty] = useState(item?.quantityTotal ?? 1);
  const [busy, setBusy] = useState(false);
  if (!item) return null;

  const bin = item.binId ? t.bins[item.binId] : undefined;
  const cat = itemCategory(t, item);

  const retake = async () => {
    const uri = await takePhoto('camera');
    if (!uri) return;
    setBusy(true);
    try {
      const stored = await storeWithSticker(uri, `${item.id}-${Date.now().toString(36)}`);
      deletePhoto(item.photoUri);
      deletePhoto(item.stickerUri);
      apply((x) => updateItem(x, item.id, { photoUri: stored.photoRef, stickerUri: stored.stickerRef }));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (attempt(() => apply((x) => updateItem(x, item.id, { name, quantityTotal: qty })))) router.back();
  };

  const remove = () => {
    const go = () => {
      deletePhoto(item.photoUri);
      deletePhoto(item.stickerUri);
      apply((x) => deleteItem(x, item.id));
      router.dismissTo('/');
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete item', `${item.name} and its history go. This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Screen footer={<Button kind="danger" title="Delete item" onPress={remove} />}>
      <TopBar
        backIcon="close"
        caption="edit item"
        onBack={() => router.back()}
        right={<Button kind="dark" title="Save" onPress={save} style={{ minHeight: 40, paddingHorizontal: 16 }} />}
      />
      <Row gap={16}>
        <Sticker item={item} size={88} />
        <View style={{ gap: 8 }}>
          <SmallButton title={busy ? 'Cutting out…' : 'Retake photo'} onPress={retake} />
        </View>
      </Row>
      <SectionLabel>Name</SectionLabel>
      <Field value={name} onChangeText={setName} />
      <Row style={{ marginTop: 16, justifyContent: 'space-between' }}>
        <T v="body">How many</T>
        <View style={{ width: 170, flexDirection: 'row' }}>
          <Stepper value={qty} min={Math.max(1, item.quantityOut)} max={999} onChange={setQty} />
        </View>
      </Row>
      <Hairline style={{ marginTop: 12 }} />
      <ListRow
        title="Bin"
        value={bin ? `${binNumberLabel(bin.number)} ${binName(t, bin)}${binSlotCode(t, bin) ? ` · ${binSlotCode(t, bin)}` : ''}` : 'Loose'}
        onPress={() => router.push({ pathname: '/item/move/[id]', params: { id: item.id } })}
      />
      <Hairline />
      <ListRow title="Category" value={cat ? `${cat.name}, from its bin` : '—'} chevron={false} />
      <Hairline />
      <T v="small" style={{ marginTop: 12 }}>
        Items take their bin’s category. To change it, move the item.
      </T>
    </Screen>
  );
}
