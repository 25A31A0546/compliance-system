import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export default function DeclarationRow({ label, value, status = 'valid', rule, note, isLast = false }) {
  const isViolation = status === 'violation';

  return (
    <View style={[styles.container, !isLast && styles.bottomBorder]}>
      <View style={styles.topRow}>
        <View style={styles.labelGroup}>
          <Text style={styles.label}>{label}</Text>
          {rule && <Text style={styles.rule}>{rule}</Text>}
        </View>
        <View
          style={[
            styles.statusTag,
            isViolation ? styles.statusViolation : styles.statusValid,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isViolation ? styles.textViolation : styles.textValid,
            ]}
          >
            {isViolation ? '⚠️ Violation' : '✓ Compliant'}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.value,
          isViolation && styles.valueViolation,
        ]}
      >
        {value}
      </Text>
      {note && (
        <Text style={[styles.noteText, isViolation ? styles.noteViolation : styles.noteValid]}>
          {isViolation ? '• ' : '✓ '}
          {note}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
  },
  bottomBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  labelGroup: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rule: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  statusTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  statusValid: {
    backgroundColor: COLORS.compliantBg,
    borderColor: COLORS.compliantBorder,
  },
  statusViolation: {
    backgroundColor: COLORS.violationBg,
    borderColor: COLORS.violationBorder,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textValid: {
    color: COLORS.compliantDark,
  },
  textViolation: {
    color: COLORS.violationDark,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  valueViolation: {
    color: COLORS.violationDark,
  },
  noteText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  noteValid: {
    color: COLORS.compliantDark,
  },
  noteViolation: {
    color: COLORS.violationDark,
  },
});
