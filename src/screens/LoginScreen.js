import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';

export default function LoginScreen() {
  const { login } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Top Official Banner */}
        <View style={styles.headerHero}>
          <View style={styles.emblemContainer}>
            <Text style={styles.emblemIcon}>⚖️</Text>
          </View>
          <Text style={styles.govTitle}>GOVERNMENT OF INDIA</Text>
          <Text style={styles.deptTitle}>Department of Legal Metrology</Text>
          <Text style={styles.portalSubtitle}>
            Packaged Commodities Inspection & Compliance Portal
          </Text>
          <View style={styles.rulesPill}>
            <Text style={styles.rulesPillText}>
              Legal Metrology (Packaged Commodities) Rules, 2011
            </Text>
          </View>
        </View>

        {/* Role Selection Prompt */}
        <View style={styles.selectionSection}>
          <Text style={styles.sectionTitle}>Select Access Role to Continue</Text>
          <Text style={styles.sectionSubtitle}>
            Authenticated role-based access for field enforcement and supervisory oversight
          </Text>

          {/* Role 1: Officer */}
          <TouchableOpacity
            style={[styles.roleCard, styles.officerBorder, SHADOWS.md]}
            onPress={() => login('officer')}
            activeOpacity={0.85}
          >
            <View style={styles.roleCardHeader}>
              <View style={[styles.roleIconCircle, styles.officerIconBg]}>
                <Text style={styles.roleEmoji}>🛡️</Text>
              </View>
              <View style={styles.roleTitleGroup}>
                <View style={styles.badgeRow}>
                  <Text style={styles.roleTagOfficer}>FIELD ENFORCEMENT</Text>
                  <Text style={styles.roleIdText}>OFF-402</Text>
                </View>
                <Text style={styles.roleName}>Field Inspection Officer</Text>
                <Text style={styles.roleOfficerName}>Inspector A. Sharma</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureList}>
              <Text style={styles.featureItem}>
                📷 Live camera scanner for commodity labels (MRP, Net Qty, Mfg Date, Origin)
              </Text>
              <Text style={styles.featureItem}>
                ⚡ Instant automated compliance validation against mandatory rules
              </Text>
              <Text style={styles.featureItem}>
                📝 File official violation reports directly to the Directorate
              </Text>
            </View>

            <View style={[styles.loginBtn, styles.officerBtn]}>
              <Text style={styles.loginBtnText}>Login as Field Officer →</Text>
            </View>
          </TouchableOpacity>

          {/* Role 2: Supervisor */}
          <TouchableOpacity
            style={[styles.roleCard, styles.supervisorBorder, SHADOWS.md]}
            onPress={() => login('supervisor')}
            activeOpacity={0.85}
          >
            <View style={styles.roleCardHeader}>
              <View style={[styles.roleIconCircle, styles.supervisorIconBg]}>
                <Text style={styles.roleEmoji}>📋</Text>
              </View>
              <View style={styles.roleTitleGroup}>
                <View style={styles.badgeRow}>
                  <Text style={styles.roleTagSupervisor}>SUPERVISORY AUDIT</Text>
                  <Text style={styles.roleIdText}>SUP-101</Text>
                </View>
                <Text style={styles.roleName}>Supervisory Officer</Text>
                <Text style={styles.roleOfficerName}>Director V. Raman</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureList}>
              <Text style={styles.featureItem}>
                📊 Centralized dashboard of all field inspection submissions
              </Text>
              <Text style={styles.featureItem}>
                ⚖️ Review and approve violation cases with evidence audit
              </Text>
              <Text style={styles.featureItem}>
                📨 Issue Show-Cause notices and track penal compliance
              </Text>
            </View>

            <View style={[styles.loginBtn, styles.supervisorBtn]}>
              <Text style={styles.loginBtnText}>Login as Supervisor →</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Security / Legal Notice Footer */}
        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            🔒 Secured with role-based native routing. Authorized personnel only under Section 15 of Legal Metrology Act, 2009.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
  },
  headerHero: {
    backgroundColor: COLORS.primaryDark,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    borderBottomLeftRadius: RADIUS.xl * 1.5,
    borderBottomRightRadius: RADIUS.xl * 1.5,
  },
  emblemContainer: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  emblemIcon: {
    fontSize: 28,
  },
  govTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#93C5FD',
    letterSpacing: 2,
    marginBottom: 2,
  },
  deptTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textInverse,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  portalSubtitle: {
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: 4,
  },
  rulesPill: {
    marginTop: SPACING.md,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.3)',
  },
  rulesPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93C5FD',
  },
  selectionSection: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  roleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1.5,
  },
  officerBorder: {
    borderColor: '#93C5FD',
  },
  supervisorBorder: {
    borderColor: '#C7D2FE',
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleIconCircle: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  officerIconBg: {
    backgroundColor: '#EFF6FF',
  },
  supervisorIconBg: {
    backgroundColor: '#EEF2FF',
  },
  roleEmoji: {
    fontSize: 26,
  },
  roleTitleGroup: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  roleTagOfficer: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.8,
  },
  roleTagSupervisor: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.8,
  },
  roleIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  roleName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  roleOfficerName: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  featureList: {
    gap: SPACING.xs + 2,
    marginBottom: SPACING.lg,
  },
  featureItem: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  loginBtn: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  officerBtn: {
    backgroundColor: COLORS.primary,
  },
  supervisorBtn: {
    backgroundColor: COLORS.supervisor,
  },
  loginBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textInverse,
    letterSpacing: 0.3,
  },
  footerNote: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
