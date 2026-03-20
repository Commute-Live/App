import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {styles} from './DashboardOverview.styles';

type TimeAdjustFieldProps = {
  label: string;
  value: string;
  onPrev: () => void;
  onNext: () => void;
};

export function DashboardOverviewTimeAdjustField({label, value, onPrev, onNext}: TimeAdjustFieldProps) {
  return (
    <View style={styles.timeField}>
      <Text style={styles.timeFieldLabel}>{label}</Text>
      <View style={styles.timeFieldControls}>
        <Pressable style={styles.timeFieldButton} onPress={onPrev}>
          <Text style={styles.timeFieldButtonText}>-</Text>
        </Pressable>
        <Text style={styles.timeFieldValue}>{value}</Text>
        <Pressable style={styles.timeFieldButton} onPress={onNext}>
          <Text style={styles.timeFieldButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
