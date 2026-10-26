import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { isCutoutAvailable } from '../../modules/atlas-cutout';
import { BinPicker } from '../components/BinPicker';
import { Sticker } from '../components/Sticker';
import { Button, Field, Row, Screen, SectionLabel, SmallButton, Stepper, T, TopBar } from '../components/ui';
import { binName } from '../core/naming';
import { addItem, type Home } from '../core/ops';
import { binNumberLabel } from '../core/reach';
import { storeWithSticker, takePhoto, type StoredPhoto } from '../data/capture';
import { useAtlas } from '../data/store';
import { newUuid } from '../data/uuid';
import { useTheme } from '../theme';
import { attempt } from '../util/format';

/**
 * Register an item: photo on a plain surface → cut-out sticker → name → where.
 * M1 files by hand; the AI filing step (Place, board D8) arrives in M3.
 */
export default function AddItem() {
  const p = useTheme();
  const params = useLocalSearchParams<{ binId?: string; zoneId?: string; name?: string }>();
  const t = useAtlas((s) => s.tables);
  const apply = useAtlas((s) => s.apply);
  const [photo, setPhoto] = useState<StoredPhoto | null>(null);
  const [working, setWorking] = useState(false);
  const [name, setName] = useState(params.name ?? '');
  const [qty, setQty] = useState(1);
  const [home, setHome] = useState<Home | null>(params.binId ? { binId: params.binId } : params.zoneId ? { zoneId: params.zoneId } : null);
  const [tempId] = useState(() => newUuid());

  const shoot = async (source: 'camera' | 'library') => {
    const uri = await takePhoto(source);
    if (!uri) return;
    setWorking(true);
    try {
      setPhoto(await storeWithSticker(uri, tempId));
    } finally {
      setWorking(false);
    }
  };

  const target = home && 'binId' in home ? t.bins[home.binId] : undefined;
  const save = () => {
    let newId = '';
    const ok = attempt(() =>
      apply((x) => {
        const r = addItem(x, { name, home, quantity: qty, photoUri: photo?.photoRef, stickerUri: photo?.stickerRef });
        newId = r.itemId;
        return r.tables;
      }),
    );
    if (ok) router.replace({ pathname: '/item/[id]', params: { id: newId } });
  };

  const preview = { id: tempId, name: name || '?', photoUri: photo?.photoRef, stickerUri: photo?.stickerRef };

  return (
    <Screen
      footer={
        <Button
          title={target ? `File in ${binNumberLabel(target.number)}` : home ? 'File here' : 'Pick where it goes'}
          disabled={!name.trim() || !home}
          onPress={save}
        />
      }
    >
      <TopBar backIcon="close" caption="new · unfiled" onBack={() => router.back()} />

      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          height: 220,
          borderRadius: 16,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: p.hairline,
        }}
      >
        {working ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={p.inkMuted} />
            <T v="label">cutting out</T>
          </View>
        ) : photo ? (
          <Sticker item={preview} size={170} />
        ) : (
          <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 20 }}>
            <T v="serif" style={{ textAlign: 'center' }}>
              Photograph it on a plain surface.
            </T>
            <T v="small" style={{ textAlign: 'center' }}>
              One item, nothing else in frame. The background falls away and a white border snaps on.
            </T>
          </View>
        )}
      </View>

      <Row style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <T v="label">die-cut</T>
        <T v="label" style={{ color: photo?.stickerRef ? p.inOk : p.inkMuted }}>
          {!photo
            ? '—'
            : photo.stickerRef
              ? '● clean edge'
              : isCutoutAvailable()
                ? 'no subject found · plain photo'
                : 'plain photo · cut-outs need a device build'}
        </T>
      </Row>
      <Row style={{ marginTop: 10 }} gap={8}>
        {Platform.OS !== 'web' ? <SmallButton title={photo ? 'Retake' : 'Take photo'} onPress={() => shoot('camera')} /> : null}
        <SmallButton title="From library" onPress={() => shoot('library')} />
      </Row>

      <SectionLabel>Name</SectionLabel>
      <Field serif placeholder="Label maker" value={name} onChangeText={setName} autoCapitalize="sentences" />
      <Row style={{ marginTop: 14, justifyContent: 'space-between' }}>
        <T v="body">How many</T>
        <View style={{ width: 170, flexDirection: 'row' }}>
          <Stepper value={qty} min={1} max={999} onChange={setQty} />
        </View>
      </Row>

      <SectionLabel right={target ? <T v="small">{`${binNumberLabel(target.number)} ${binName(t, target)}`}</T> : null}>
        Where it goes
      </SectionLabel>
      <BinPicker t={t} value={home} onPick={setHome} />
    </Screen>
  );
}
