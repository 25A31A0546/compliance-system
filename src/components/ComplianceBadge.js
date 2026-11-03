import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export default function ComplianceBadge({ isCompliant, status, size = 'medium' }) {
  let bg = COLORS.compliantBg;
  let border = COLORS.compliantBorder;
  let text = COLORS.compliantDark;
  let label = 'COMPLIANT';
  let symbol = '✓';

  if (status === 'Pending Review') {
    bg = COLORS.warningBg;
    border = COLORS.warningBorder;
    text = COLORS.warningDark;
    label = 'PENDING REVIEW';
    symbol = '⏳';
  } else if (status === 'Notice Issued') {
    bg = COLORS.violationBg;
    border = COLORS.violationBorder;
    text = COLORS.violationDark;
    label = 'NOTICE ISSUED';
    symbol = '⚠️';
  } else if (!isCompliant) {
    bg = COLORS.violationBg;
    border = COLORS.violationBorder;
    text = COLORS.violationDark;
    label = 'NON-COMPLIANT';
    symbol = '✕';
  }

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: border },
        isSmall && styles.badgeSmall,
      ]}
    >
      <Text style={[styles.symbol, { color: text }, isSmall && styles.symbolSmall]}>
        {symbol}
      </Text>
      <Text style={[styles.label, { color: text }, isSmall && styles.labelSmall]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  symbol: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4,
  },
  symbolSmall: {
    fontSize: 10,
    marginRight: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
