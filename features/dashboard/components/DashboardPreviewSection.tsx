import React from 'react';
import {StyleSheet, View} from 'react-native';
import {spacing} from '../../../theme';
import Display3DPreview, {type Display3DSlot} from './Display3DPreview';

type Props = {
  slots: Display3DSlot[];
  displayType?: number;
  onSelectSlot: (id: string) => void;
  onReorderSlot: (id: string) => void;
  onDragStateChange?: (dragging: boolean) => void;
  showHint?: boolean;
  brightness?: number;
};

export default function DashboardPreviewSection({
  slots,
  displayType = 1,
  onSelectSlot,
  onReorderSlot,
  onDragStateChange,
  showHint,
  brightness,
}: Props) {
  return (
    <View style={styles.previewSection}>
      <Display3DPreview
        slots={slots}
        displayType={displayType}
        onSelectSlot={onSelectSlot}
        onReorderSlot={onReorderSlot}
        onDragStateChange={onDragStateChange}
        showHint={showHint}
        brightness={brightness}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  previewSection: {
    gap: spacing.xs,
  },
});
