import { router, useLocalSearchParams } from 'expo-router';

import { BinPicker } from '../../../components/BinPicker';
import { Screen, T, TopBar } from '../../../components/ui';
import { moveItem, returnItem } from '../../../core/ops';
import { useAtlas } from '../../../data/store';

/** Pick the item's new home. Its category becomes the new bin's. If it was out, it's back in. */
export default function MoveItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useAtlas((s) => s.tables);
  const apply = useAtlas((s) => s.apply);
  const item = t.items[id];
  if (!item) return null;
  const current = item.binId ? { binId: item.binId } : item.zoneId ? { zoneId: item.zoneId } : null;

  return (
    <Screen>
      <TopBar caption="move to" onBack={() => router.back()} backIcon="close" />
      <T v="title">{`Where does ${item.name} live now?`}</T>
      <T v="small" style={{ marginTop: 6 }}>
        Items take their bin’s category. Moving it changes its category.
      </T>
      <BinPicker
        t={t}
        value={current}
        onPick={(home) => {
          apply((x) => {
            let next = moveItem(x, item.id, home);
            if (next.items[item.id].quantityOut > 0) next = returnItem(next, item.id);
            return next;
          });
          router.back();
        }}
      />
    </Screen>
  );
}
