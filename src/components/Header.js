import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';

export default function Header({ title, subtitle, showLogout = true }) {
  const { user, role, logout, switchRole } = useAuth();

  const isOfficer = role === 'officer';

  return (
    <View style={[styles.container, SHADOWS.sm]}>
      <View style={styles.content}>
        <View style={styles.titleSection}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.roleBadge,
                isOfficer ? styles.officerBadge : styles.supervisorBadge,
              ]}
            >
              <Text style={styles.roleBadgeIcon}>{isOfficer ? '🛡️' : '⚖️'}</Text>
              <Text
                style={[
                  styles.roleBadgeText,
                  isOfficer ? styles.officerText : styles.supervisorText,
                ]}
              >
                {isOfficer ? 'FIELD OFFICER' : 'SUPERVISOR'}
              </Text>
            </View>
            <Text style={styles.badgeId}>{user?.badgeNumber || user?.id}</Text>
          </View>

          <Text style={styles.title}>{title || user?.name || 'Enforcement Portal'}</Text>
          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : (
            <Text style={styles.subtitle}>{user?.zone || 'Legal Metrology Department'}</Text>
          )}
        </View>

        {showLogout && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => switchRole(isOfficer ? 'supervisor' : 'officer')}
              activeOpacity={0.7}
            >
              <Text style={styles.switchButtonText}>
                {isOfficer ? '👁️ View Supv' : '🔍 View Off.'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={logout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleSection: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  officerBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  supervisorBadge: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  roleBadgeIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  officerText: {
    color: '#1D4ED8',
  },
  supervisorText: {
    color: '#4338CA',
  },
  badgeId: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  switchButton: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switchButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.violationDark,
  },
});
