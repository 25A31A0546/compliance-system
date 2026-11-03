import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';

export default function StatCard({ title, value, subtitle, accentColor = COLORS.primary, icon = '📊' }) {
  return (
    <View style={[styles.card, SHADOWS.sm]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={[styles.indicator, { backgroundColor: accentColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  icon: {
    fontSize: 14,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
});
