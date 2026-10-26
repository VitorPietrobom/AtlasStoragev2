import { useState } from 'react';
import { View } from 'react-native';

import type { ID, Tables } from '../core/types';
import { Field, SmallButton } from './ui';

/**
 * Pick an existing category or type a new one. A typed name that matches an
 * existing category (any case) picks that category.
 */
export function CategoryPicker({
  t,
  value,
  onChange,
  includeOthers = false,
}: {
  t: Tables;
  /** An existing category id, or a new name prefixed with "new:". */
  value: string | null;
  onChange: (v: string) => void;
  includeOthers?: boolean;
}) {
  const cats = Object.values(t.categories)
    .filter((c) => includeOthers || !c.isOthers)
    .sort((a, b) => a.name.localeCompare(b.name));
  const [typing, setTyping] = useState(value?.startsWith('new:') ? value.slice(4) : '');

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {cats.map((c) => (
          <SmallButton
            key={c.id}
            title={c.name}
            active={value === c.id}
            onPress={() => {
              setTyping('');
              onChange(c.id);
            }}
          />
        ))}
      </View>
      <Field
        placeholder="Or a new category, e.g. Winter"
        value={typing}
        onChangeText={(s) => {
          setTyping(s);
          const match = cats.find((c) => c.name.toLowerCase() === s.trim().toLowerCase());
          onChange(match ? match.id : `new:${s}`);
        }}
        autoCapitalize="words"
      />
    </View>
  );
}

/** Resolve a picker value to a category id, creating the category if new. */
export function resolveCategory(value: string | null, create: (name: string) => ID): ID | null {
  if (!value) return null;
  if (!value.startsWith('new:')) return value;
  const name = value.slice(4).trim();
  return name ? create(name) : null;
}
