import React from 'react';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {Modal, Pressable, Text, View} from 'react-native';
import {colors} from '../../../theme';
import {styles} from './DashboardOverview.styles';
import {
  cycleTimeOption,
  dateToTimeValue,
  formatTimeValueLabel,
  timeValueToDate,
} from './DashboardOverview.time';

const IS_IOS = process.env.EXPO_OS === 'ios';
const IS_ANDROID = process.env.EXPO_OS === 'android';

type TimeAdjustFieldProps = {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (nextValue: string) => void;
};

export function DashboardOverviewTimeAdjustField({
  label,
  value,
  disabled = false,
  onChange,
}: TimeAdjustFieldProps) {
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const [draftDate, setDraftDate] = React.useState(() => timeValueToDate(value));

  const openPicker = () => {
    if (disabled) return;

    const nextDraftDate = timeValueToDate(value);
    setDraftDate(nextDraftDate);

    if (IS_ANDROID) {
      DateTimePickerAndroid.open({
        value: nextDraftDate,
        mode: 'time',
        display: 'clock',
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type !== 'set' || !selectedDate) return;
          const nextValue = dateToTimeValue(selectedDate);
          if (nextValue !== value) {
            onChange(nextValue);
          }
        },
      });
      return;
    }

    if (IS_IOS) {
      setPickerVisible(true);
    }
  };

  const closePicker = () => setPickerVisible(false);

  const commitPickerValue = () => {
    const nextValue = dateToTimeValue(draftDate);
    setPickerVisible(false);
    if (nextValue !== value) {
      onChange(nextValue);
    }
  };

  return (
    <>
      <View style={[styles.timeField, disabled && styles.timeFieldDisabled]}>
        <Text style={styles.timeFieldLabel}>{label}</Text>
        {IS_IOS || IS_ANDROID ? (
          <Pressable style={styles.timePickerButton} onPress={openPicker} disabled={disabled}>
            <Text style={styles.timePickerValue}>{formatTimeValueLabel(value)}</Text>
          </Pressable>
        ) : (
          <View style={styles.timeFieldControls}>
            <Pressable
              style={styles.timeFieldButton}
              onPress={() => onChange(cycleTimeOption(value, -1))}
              disabled={disabled}>
              <Text style={styles.timeFieldButtonText}>-</Text>
            </Pressable>
            <Text style={styles.timeFieldValue}>{value}</Text>
            <Pressable
              style={styles.timeFieldButton}
              onPress={() => onChange(cycleTimeOption(value, 1))}
              disabled={disabled}>
              <Text style={styles.timeFieldButtonText}>+</Text>
            </Pressable>
          </View>
        )}
      </View>

      {IS_IOS ? (
        <Modal
          visible={pickerVisible}
          transparent
          animationType="fade"
          onRequestClose={closePicker}>
          <Pressable style={styles.timePickerModalBackdrop} onPress={closePicker}>
            <Pressable style={styles.timePickerModalSheet} onPress={() => {}}>
              <View style={styles.timePickerModalHeader}>
                <Pressable onPress={closePicker} style={styles.timePickerModalAction}>
                  <Text style={styles.timePickerModalActionText}>Cancel</Text>
                </Pressable>
                <Text style={styles.timePickerModalTitle}>{label}</Text>
                <Pressable onPress={commitPickerValue} style={styles.timePickerModalAction}>
                  <Text style={[styles.timePickerModalActionText, styles.timePickerModalActionTextPrimary]}>
                    Done
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draftDate}
                mode="time"
                display="spinner"
                onChange={(_event, selectedDate) => {
                  if (selectedDate) setDraftDate(selectedDate);
                }}
                accentColor={colors.accent}
                themeVariant="dark"
                style={styles.timePickerModalControl}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}
