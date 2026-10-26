import { binNumberLabel } from '../core/reach';
import type { AtlasEvent, Tables } from '../core/types';

/** One line for the history log and item timelines. */
export function describeEvent(t: Tables, e: AtlasEvent): { title: string; detail?: string } {
  const item = e.itemId ? t.items[e.itemId] : undefined;
  const name = item?.name ?? 'an item';
  const bin = e.binId ? t.bins[e.binId] : undefined;
  const binNo = bin ? binNumberLabel(bin.number) : e.toBin !== undefined ? binNumberLabel(e.toBin) : '';
  switch (e.type) {
    case 'registered':
      return { title: `Registered ${name}${binNo ? ` in ${binNo}` : ''}`, detail: e.toSlot };
    case 'tookOut': {
      const left = item ? item.quantityTotal - item.quantityOut : undefined;
      return {
        title: `Took ${e.quantity && e.quantity > 1 ? `${e.quantity} ` : item && item.quantityTotal > 1 ? '1 ' : ''}${name}${binNo ? ` from ${binNo}` : ''}`,
        detail: item && item.quantityTotal > 1 && left !== undefined ? `${left} left` : undefined,
      };
    }
    case 'returned':
      return { title: `Returned ${name}${binNo ? ` to ${binNo}` : ''}` };
    case 'moved':
      return {
        title: `Moved ${name}${e.toBin !== undefined ? ` to ${binNumberLabel(e.toBin)}` : ''}`,
        detail: e.fromSlot || e.toSlot ? `from ${e.fromSlot ?? '—'} to ${e.toSlot ?? '—'}` : undefined,
      };
    case 'binMoved':
      return { title: `Moved bin ${binNo}`, detail: `from ${e.fromSlot ?? 'unplaced'} to ${e.toSlot ?? 'unplaced'}` };
    case 'audited':
      return { title: `Checked ${binNo}` };
    case 'missing':
      return { title: `${name} wasn't in ${binNo || 'its bin'}`, detail: 'marked missing' };
    case 'labelPrinted':
      return { title: `Printed label for ${binNo}` };
    case 'aiFiled':
      return {
        title: `AI filed “${name}” in ${binNo}`,
        detail: e.aiConfidence !== undefined ? `${Math.round(e.aiConfidence * 100)}%` : undefined,
      };
    case 'corrected':
      return { title: `You moved “${name}”`, detail: 'correction learned' };
  }
}
