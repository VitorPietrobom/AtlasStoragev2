import { router } from 'expo-router';
import { Alert, Platform, View } from 'react-native';

import { Card, Hairline, ListRow, Screen, SectionLabel, T, TopBar } from '../components/ui';
import { useAtlas } from '../data/store';

export default function Settings() {
  const t = useAtlas((s) => s.tables);
  const loadSample = useAtlas((s) => s.loadSample);
  const erase = useAtlas((s) => s.eraseEverything);
  const s = t.settings.settings;
  const units = Object.keys(t.units).length;
  const cats = Object.values(t.categories).filter((c) => !c.isOthers).length;

  const confirm = (title: string, message: string, go: () => void) => {
    if (Platform.OS === 'web') return go();
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: title, style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <T v="display">Settings</T>

      <SectionLabel>Storage</SectionLabel>
      <Card style={{ paddingVertical: 4 }}>
        <ListRow title="Storage units" value={String(units)} onPress={() => router.replace('/units')} />
        <Hairline />
        <ListRow title="Categories" value={`${cats} + Others`} chevron={false} />
      </Card>

      <SectionLabel>AI · from M3</SectionLabel>
      <Card style={{ paddingVertical: 4 }}>
        <ListRow title="File in a category when sure" value={`${Math.round(s.aiCutoff * 100)}%+`} chevron={false} />
        <Hairline />
        <ListRow title="Suggest sorting Others at" value={`${s.othersSortAt} items`} chevron={false} />
        <Hairline />
        <ListRow title="Front-row nudge" value={`${s.nudgeTakeouts}+ in ${s.nudgeDays} days`} chevron={false} />
        <Hairline />
        <ListRow title="Stale after" value={`${s.staleMonths} months`} chevron={false} />
      </Card>

      <SectionLabel>Data</SectionLabel>
      <Card style={{ paddingVertical: 4 }}>
        <ListRow title="Stored" value="On this phone" chevron={false} />
        <Hairline />
        <ListRow
          title="Load the sample house"
          value="Replaces everything"
          onPress={() =>
            confirm('Load sample', 'The wardrobe and under-bed drawer from the designs replace what is stored now.', () => {
              loadSample();
              router.dismissTo('/');
            })
          }
        />
        <Hairline />
        <ListRow
          title="Erase everything"
          onPress={() =>
            confirm('Erase', 'Every unit, bin, item and its history is deleted from this phone.', () => {
              void erase().then(() => router.dismissTo('/'));
            })
          }
        />
      </Card>
      <View style={{ height: 20 }} />
      <T v="small">Sync between devices and export arrive in M2.</T>
    </Screen>
  );
}
