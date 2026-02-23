import React from 'react';
import {StyleSheet, View} from 'react-native';
import {spacing} from '../../../theme';
import Display3DPreview, {type Display3DSlot} from './Display3DPreview';

type Props = {
  slots: Display3DSlot[];
  onSelectSlot: (id: string) => void;
  onReorderSlot: (id: string) => void;
  onDragStateChange?: (dragging: boolean) => void;
};

export default function DashboardPreviewSection({
  slots,
  onSelectSlot,
  onReorderSlot,
  onDragStateChange,
}: Props) {
  return (
    <View style={styles.previewSection}>
      <Display3DPreview
        slots={slots}
        onSelectSlot={onSelectSlot}
        onReorderSlot={onReorderSlot}
        onDragStateChange={onDragStateChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  previewSection: {
    gap: spacing.xs,
  },
});
