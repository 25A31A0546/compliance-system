import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import ComplianceBadge from '../components/ComplianceBadge';
import DeclarationRow from '../components/DeclarationRow';
import { useReports } from '../context/ReportsContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { getInspections } from '../db/database';

export default function SupervisorScreen() {
  const { reports, stats, updateReportStatus } = useReports();
  const { user, switchRole } = useAuth();

  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL | PENDING | VIOLATIONS | COMPLIANT
  const [selectedReport, setSelectedReport] = useState(null);
  const [supervisorRemark, setSupervisorRemark] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // SQLite persistent audit log
  const [dbRecords, setDbRecords] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);

  useEffect(() => {
    const loadDbHistory = async () => {
      try {
        const records = await getInspections();
        setDbRecords(records);
      } catch (err) {
        console.error('Failed to load inspection history from SQLite:', err);
      } finally {
        setDbLoading(false);
      }
    };
    loadDbHistory();
  }, []);

  // Filter logic
  const filteredReports = reports.filter((rep) => {
    if (activeFilter === 'PENDING') return rep.status === 'Pending Review';
    if (activeFilter === 'VIOLATIONS') return !rep.isCompliant;
    if (activeFilter === 'COMPLIANT') return rep.isCompliant;
    return true;
  });

  const openReportDetail = (report) => {
    setSelectedReport(report);
    setSupervisorRemark(report.supervisorRemarks || '');
    setModalVisible(true);
  };

  const handleAction = (reportId, newStatus) => {
    updateReportStatus(reportId, newStatus, supervisorRemark);
    if (selectedReport && selectedReport.id === reportId) {
      setSelectedReport((prev) => ({
        ...prev,
        status: newStatus,
        supervisorRemarks: supervisorRemark,
      }));
    }
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Enforcement Audit Dashboard"
        subtitle={`Supervisor: ${user?.name || 'Director V. Raman'}`}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Metric Cards Row */}
        <View style={styles.statsRow}>
          <StatCard
            title="Total Audits"
            value={stats.total}
            subtitle="Field Inspections"
            accentColor={COLORS.primaryLight}
            icon="📋"
          />
          <StatCard
            title="Pending"
            value={stats.pending}
            subtitle="Needs Review"
            accentColor={COLORS.warning}
            icon="⏳"
          />
        </View>

        <View style={[styles.statsRow, { marginTop: SPACING.sm }]}>
          <StatCard
            title="Compliant"
            value={stats.compliant}
            subtitle="Clean Packages"
            accentColor={COLORS.compliant}
            icon="✓"
          />
          <StatCard
            title="Violations"
            value={stats.violations}
            subtitle="Non-Compliant"
            accentColor={COLORS.violation}
            icon="⚠️"
          />
        </View>

        {/* Quick Launch Switcher Banner */}
        <View style={[styles.switchBanner, SHADOWS.sm]}>
          <View style={styles.switchBannerTextGroup}>
            <Text style={styles.switchBannerTitle}>Test Field Officer Mode</Text>
            <Text style={styles.switchBannerSub}>
              Scan new packaging with camera to simulate a live inspection submission
            </Text>
          </View>
          <TouchableOpacity
            style={styles.switchBannerBtn}
            onPress={() => switchRole('officer')}
            activeOpacity={0.8}
          >
            <Text style={styles.switchBannerBtnText}>Launch Camera 📷</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionHeading}>
            SUBMITTED INSPECTION REPORTS ({filteredReports.length})
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabsContainer}
          >
            {[
              { id: 'ALL', label: `All (${reports.length})` },
              { id: 'PENDING', label: `Pending (${stats.pending})` },
              { id: 'VIOLATIONS', label: `Violations (${stats.violations})` },
              { id: 'COMPLIANT', label: `Compliant (${stats.compliant})` },
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.filterTab, isActive && styles.filterTabActive]}
                  onPress={() => setActiveFilter(tab.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      isActive && styles.filterTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Reports List */}
        {filteredReports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>No Reports Found</Text>
            <Text style={styles.emptyDesc}>
              No inspection reports match the selected filter criteria.
            </Text>
          </View>
        ) : (
          filteredReports.map((report) => (
            <TouchableOpacity
              key={report.id}
              style={[styles.reportCard, SHADOWS.sm]}
              onPress={() => openReportDetail(report)}
              activeOpacity={0.85}
            >
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.idGroup}>
                  <Text style={styles.reportId}>{report.id}</Text>
                  <Text style={styles.timestamp}>{report.timestamp}</Text>
                </View>
                <ComplianceBadge
                  isCompliant={report.isCompliant}
                  status={report.status}
                  size="small"
                />
              </View>

              {/* Product & Retailer */}
              <Text style={styles.productName}>{report.productName}</Text>
              <Text style={styles.retailerName}>📍 {report.retailerName}</Text>

              {/* Declarations Micro Matrix */}
              <View style={styles.declarationMatrix}>
                <View style={styles.matrixCol}>
                  <Text style={styles.matrixLabel}>MRP</Text>
                  <Text style={styles.matrixValue} numberOfLines={1}>
                    {report.mrp}
                  </Text>
                </View>
                <View style={styles.matrixDivider} />
                <View style={styles.matrixCol}>
                  <Text style={styles.matrixLabel}>NET QTY</Text>
                  <Text style={styles.matrixValue}>{report.netQuantity}</Text>
                </View>
                <View style={styles.matrixDivider} />
                <View style={styles.matrixCol}>
                  <Text style={styles.matrixLabel}>MFG DATE</Text>
                  <Text style={styles.matrixValue}>{report.mfgDate}</Text>
                </View>
                <View style={styles.matrixDivider} />
                <View style={styles.matrixCol}>
                  <Text style={styles.matrixLabel}>ORIGIN</Text>
                  <Text
                    style={[
                      styles.matrixValue,
                      report.countryOfOrigin.includes('NOT') && styles.matrixViolation,
                    ]}
                    numberOfLines={1}
                  >
                    {report.countryOfOrigin}
                  </Text>
                </View>
              </View>

              {/* Violation Snippet if non-compliant */}
              {!report.isCompliant && report.violations?.length > 0 && (
                <View style={styles.violationSnippet}>
                  <Text style={styles.violationSnippetText} numberOfLines={1}>
                    ⚠️ {report.violations[0]}
                  </Text>
                </View>
              )}

              {/* Card Footer: Officer and Action */}
              <View style={styles.cardFooter}>
                <Text style={styles.officerTag}>
                  Officer: {report.officerName} ({report.officerId})
                </Text>

                <View style={styles.reviewPrompt}>
                  <Text style={styles.reviewPromptText}>
                    {report.status === 'Pending Review' ? 'Review & Sign Off →' : 'View Audit →'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* ── SQLite Persistent Audit Log ── */}
        <View style={styles.dbSection}>
          <View style={styles.dbSectionHeader}>
            <Text style={styles.dbSectionTitle}>
              💾 ON-DEVICE AUDIT LOG ({dbRecords.length})
            </Text>
            <Text style={styles.dbSectionSub}>Persisted in SQLite · survives app restarts</Text>
          </View>

          {dbLoading ? (
            <ActivityIndicator
              size="small"
              color={COLORS.primaryLight}
              style={{ marginTop: SPACING.md }}
            />
          ) : dbRecords.length === 0 ? (
            <View style={styles.dbEmpty}>
              <Text style={styles.dbEmptyIcon}>🗄️</Text>
              <Text style={styles.dbEmptyText}>
                No records yet. Submit an inspection to persist it here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={dbRecords}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isCompliant = item.status === 'COMPLIANT';
                const dateStr = item.created_at
                  ? new Date(item.created_at).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  : '—';
                return (
                  <View style={[styles.dbRow, SHADOWS.sm]}>
                    <View style={styles.dbRowLeft}>
                      <Text style={styles.dbProductName} numberOfLines={1}>
                        {item.product_name}
                      </Text>
                      <Text style={styles.dbDate}>{dateStr}</Text>
                    </View>
                    <View
                      style={[
                        styles.dbBadge,
                        isCompliant ? styles.dbBadgeCompliant : styles.dbBadgeViolation,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dbBadgeText,
                          isCompliant ? styles.dbBadgeTextCompliant : styles.dbBadgeTextViolation,
                        ]}
                      >
                        {isCompliant ? '✓ COMPLIANT' : '⚠ NON-COMPLIANT'}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </ScrollView>

      {/* Drill-down Detail & Sign-off Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalReportId}>{selectedReport?.id}</Text>
                <Text style={styles.modalTimestamp}>{selectedReport?.timestamp}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.modalSection}>
                <Text style={styles.modalProduct}>{selectedReport?.productName}</Text>
                <Text style={styles.modalCategory}>Category: {selectedReport?.category}</Text>
                <Text style={styles.modalRetailer}>📍 Retailer: {selectedReport?.retailerName}</Text>

                <View style={styles.modalBadgeRow}>
                  <Text style={styles.modalBadgeLabel}>Status:</Text>
                  {selectedReport && (
                    <ComplianceBadge
                      isCompliant={selectedReport.isCompliant}
                      status={selectedReport.status}
                    />
                  )}
                </View>
              </View>

              {/* Declarations audit list */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>RULE 6 STATUTORY DECLARATIONS AUDIT (7 FIELDS)</Text>
                <DeclarationRow
                  label="1. Generic Name of Commodity"
                  value={selectedReport?.genericName || selectedReport?.productName || 'N/A'}
                  status="valid"
                  rule="Rule 6(1)(b)"
                />
                <DeclarationRow
                  label="2. Net Quantity"
                  value={selectedReport?.netQuantity || 'N/A'}
                  status="valid"
                  rule="Rule 6(1)(c)"
                />
                <DeclarationRow
                  label="3. Maximum Retail Price (MRP)"
                  value={selectedReport?.mrp || 'N/A'}
                  status={selectedReport?.isCompliant ? 'valid' : 'violation'}
                  rule="Rule 6(1)(da)"
                />
                <DeclarationRow
                  label="4. Month & Year of Mfg / Packing"
                  value={selectedReport?.mfgDate || 'N/A'}
                  status={selectedReport?.mfgDate === 'NOT FOUND' ? 'violation' : 'valid'}
                  rule="Rule 6(1)(d)"
                />
                <DeclarationRow
                  label="5. Country of Origin"
                  value={selectedReport?.countryOfOrigin || 'N/A'}
                  status={
                    selectedReport?.countryOfOrigin?.includes('NOT') ? 'violation' : 'valid'
                  }
                  rule="Rule 6(1)(e)"
                />
                <DeclarationRow
                  label="6. Manufacturer / Packer / Importer"
                  value={selectedReport?.manufacturer || 'Declared on package'}
                  status="valid"
                  rule="Rule 6(1)(a)"
                />
                <DeclarationRow
                  label="7. Consumer Care Details"
                  value={selectedReport?.consumerCare || 'NOT AVAILABLE (MISSING)'}
                  status={
                    selectedReport?.consumerCare?.includes('NOT') ? 'violation' : 'valid'
                  }
                  rule="Rule 6(1)(n)"
                  isLast={true}
                />
              </View>

              {/* Officer Notes */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>FIELD INSPECTOR OBSERVATIONS</Text>
                <View style={styles.inspectorNoteBox}>
                  <Text style={styles.inspectorName}>
                    {selectedReport?.officerName} ({selectedReport?.officerId}):
                  </Text>
                  <Text style={styles.inspectorNoteText}>
                    {selectedReport?.officerNotes || 'No specific field notes recorded.'}
                  </Text>
                </View>
              </View>

              {/* Supervisor Sign-Off & Remarks */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>SUPERVISOR REMARKS / DIRECTIVE</Text>
                <TextInput
                  style={styles.remarkInput}
                  value={supervisorRemark}
                  onChangeText={setSupervisorRemark}
                  placeholder="Enter supervisory instructions or penalty decision..."
                  multiline
                  numberOfLines={2}
                />
              </View>
              {/* Offline SQLite Inspection History Section */}
              <View style={{ marginVertical: SPACING.md, paddingHorizontal: SPACING.lg }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 10 }}>
                  Offline SQLite Audit Logs ({dbRecords.length})
                </Text>

                {dbLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : dbRecords.length === 0 ? (
                  <Text style={{ color: COLORS.textMuted }}>No offline logs stored yet.</Text>
                ) : (
                  dbRecords.map((item) => (
                    <View
                      key={item.id}
                      style={{
                        backgroundColor: COLORS.card || '#FFF',
                        padding: 12,
                        borderRadius: RADIUS.lg || 8,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: COLORS.border || '#DDD',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 15, color: COLORS.textPrimary }}>
                          {item.product_name}
                        </Text>
                        <ComplianceBadge status={item.status} />
                      </View>

                      <Text style={{ color: COLORS.textMuted, marginTop: 6, fontSize: 13 }}>
                        {item.details}
                      </Text>

                      <Text style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                        Saved: {new Date(item.created_at).toLocaleString()}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>

            {/* Supervisor Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.approveBtn]}
                onPress={() => handleAction(selectedReport?.id, 'Approved')}
              >
                <Text style={styles.modalBtnText}>✓ Approve Audit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.noticeBtn]}
                onPress={() => handleAction(selectedReport?.id, 'Notice Issued')}
              >
                <Text style={styles.modalBtnText}>⚠️ Issue Show-Cause</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  statsRow: {
    flexDirection: 'row',
  },
  switchBanner: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchBannerTextGroup: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  switchBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3730A3',
  },
  switchBannerSub: {
    fontSize: 11,
    color: '#4F46E5',
    marginTop: 1,
  },
  switchBannerBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  switchBannerBtnText: {
    color: COLORS.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  filterSection: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  filterTabsContainer: {
    gap: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  emptyContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.md,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptyDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  reportCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  idGroup: {
    flex: 1,
  },
  reportId: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  timestamp: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  retailerName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  declarationMatrix: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.xs,
    alignItems: 'center',
  },
  matrixCol: {
    flex: 1,
    alignItems: 'center',
  },
  matrixDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
  },
  matrixLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  matrixValue: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  matrixViolation: {
    color: COLORS.violationDark,
  },
  violationSnippet: {
    backgroundColor: COLORS.violationBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    marginTop: SPACING.xs,
  },
  violationSnippetText: {
    fontSize: 11,
    color: COLORS.violationDark,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  officerTag: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  reviewPrompt: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  reviewPromptText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
  },
  modalReportId: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalTimestamp: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  modalScroll: {
    marginVertical: SPACING.sm,
  },
  modalSection: {
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
  },
  modalProduct: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalCategory: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalRetailer: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 4,
    fontWeight: '600',
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  modalBadgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginRight: SPACING.sm,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  inspectorNoteBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  inspectorName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  inspectorNoteText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    lineHeight: 17,
  },
  remarkInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtn: {
    backgroundColor: COLORS.compliantDark,
  },
  noticeBtn: {
    backgroundColor: COLORS.violationDark,
  },
  modalBtnText: {
    color: COLORS.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── SQLite Audit Log styles ──
  dbSection: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  dbSectionHeader: {
    marginBottom: SPACING.sm,
  },
  dbSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  dbSectionSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  dbEmpty: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dbEmptyIcon: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  dbEmptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  dbRow: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dbRowLeft: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  dbProductName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  dbDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  dbBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  dbBadgeCompliant: {
    backgroundColor: COLORS.compliantBg,
    borderColor: COLORS.compliantBorder,
  },
  dbBadgeViolation: {
    backgroundColor: COLORS.violationBg,
    borderColor: COLORS.violationBorder,
  },
  dbBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dbBadgeTextCompliant: {
    color: COLORS.compliantDark,
  },
  dbBadgeTextViolation: {
    color: COLORS.violationDark,
  },
});
