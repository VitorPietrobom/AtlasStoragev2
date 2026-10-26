import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Field, Hairline, ListRow, Row, Screen, SectionLabel, SmallButton, T, TopBar } from '../components/ui';
import { authMessage, useSync } from '../sync/controller';
import { useTheme } from '../theme';
import { ago } from '../util/format';

/** Sign in to sync with Firebase. Atlas works fully without it. */
export default function Account() {
  const p = useTheme();
  const { configured, user, status, signIn, signUp, signOut, syncNow, resetPassword } = useSync();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage(ok);
    } catch (e) {
      setMessage(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <T v="display">Sync</T>

      {!configured ? (
        <>
          <T v="body" style={{ marginTop: 10 }}>
            Sync isn’t set up in this build. Everything stays on this phone.
          </T>
          <T v="small" style={{ marginTop: 10 }}>
            To turn it on, create a Firebase project and put its web config in a .env file (see the README, “Sync with Firebase”).
          </T>
        </>
      ) : user ? (
        <>
          <T v="small" style={{ marginTop: 6 }}>
            Your storage is kept in your Firebase project and on every device you sign in on.
          </T>
          <SectionLabel>Account</SectionLabel>
          <Card style={{ paddingVertical: 4 }}>
            <ListRow title="Signed in as" value={user.email ?? user.uid} chevron={false} />
            <Hairline />
            <ListRow
              title="Status"
              value={
                !status
                  ? 'Starting…'
                  : status.state === 'error'
                    ? 'Error'
                    : status.state === 'syncing'
                      ? `Syncing ${status.pending}…`
                      : status.pending
                        ? `${status.pending} waiting`
                        : `Up to date${status.lastSyncedAt ? ` · ${ago(new Date(status.lastSyncedAt).toISOString())}` : ''}`
              }
              chevron={false}
            />
          </Card>
          {status?.state === 'error' ? (
            <T v="small" style={{ color: p.signalText, marginTop: 8 }}>
              {status.message}
            </T>
          ) : null}
          <View style={{ gap: 10, marginTop: 18 }}>
            <Button kind="secondary" title="Sync now" busy={busy} onPress={() => run(syncNow)} />
            <Button kind="danger" title="Sign out" onPress={() => run(signOut)} />
          </View>
          <T v="small" style={{ marginTop: 12 }}>
            Signing out stops syncing; what’s on this phone stays here.
          </T>
        </>
      ) : (
        <>
          <T v="small" style={{ marginTop: 6 }}>
            Sign in to back up your storage and use it on more than one device. What’s on this phone now is uploaded on first sign-in.
          </T>
          <SectionLabel>Email</SectionLabel>
          <Field
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <SectionLabel>Password</SectionLabel>
          <Field value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="At least 6 characters" />
          {message ? (
            <T v="small" style={{ color: p.signalText, marginTop: 10 }}>
              {message}
            </T>
          ) : null}
          <Row style={{ marginTop: 18 }} gap={10}>
            <Button flex title="Sign in" busy={busy} disabled={!email || !password} onPress={() => run(() => signIn(email, password))} />
            <Button
              flex
              kind="secondary"
              title="Create account"
              disabled={busy || !email || password.length < 6}
              onPress={() => run(() => signUp(email, password))}
            />
          </Row>
          <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
            <SmallButton title="Forgot password" onPress={() => run(() => resetPassword(email), 'Check your email for a reset link.')} />
          </View>
        </>
      )}
    </Screen>
  );
}
