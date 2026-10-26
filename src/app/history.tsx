import { router } from 'expo-router';
import { View } from 'react-native';

import { Hairline, Screen, T, TopBar } from '../components/ui';
import type { AtlasEvent } from '../core/types';
import { useAtlas } from '../data/store';
import { useTheme, type Palette } from '../theme';
import { describeEvent } from '../util/events';
import { timeOrDate } from '../util/format';

/** The audit trail, newest first, grouped by day. */
export default function History() {
  const p = useTheme();
  const t = useAtlas((s) => s.tables);
  const events = Object.values(t.events)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 300);
  let lastDay = '';

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <T v="display" style={{ marginBottom: 8 }}>
        History
      </T>
      {events.length === 0 ? <T v="small">Nothing yet.</T> : null}
      {events.map((e) => {
        const day = dayLabel(e.at);
        const header = day !== lastDay ? day : null;
        lastDay = day;
        const { title, detail } = describeEvent(t, e);
        return (
          <View key={e.id}>
            {header ? (
              <T v="label" style={{ marginTop: 16, marginBottom: 4 }}>
                {header}
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: dotColor(p, e) }} />
              <View style={{ flex: 1 }}>
                <T v="body">{title}</T>
                {detail ? (
                  <T v="label" style={{ fontSize: 10 }}>
                    {detail}
                  </T>
                ) : null}
              </View>
              <T v="label" style={{ fontSize: 10 }}>
                {timeOrDate(e.at)}
              </T>
            </View>
            <Hairline />
          </View>
        );
      })}
    </Screen>
  );
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toDateString().slice(4);
}

function dotColor(p: Palette, e: AtlasEvent): string {
  if (e.type === 'tookOut' || e.type === 'missing') return p.signal;
  if (e.type === 'returned' || e.type === 'moved' || e.type === 'corrected' || e.type === 'registered') return p.inOk;
  return p.inkMuted;
}
