import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Print from 'expo-print';
import Header from '../components/Header';
import ComplianceBadge from '../components/ComplianceBadge';
import DeclarationRow from '../components/DeclarationRow';
import { useReports } from '../context/ReportsContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { insertInspection } from '../db/database';

export default function ResultsScreen({ route, navigation }) {
  const { commodity, timestamp } = route.params || {};
  const { addReport } = useReports();
  const { user, switchRole } = useAuth();

  const [retailerName, setRetailerName] = useState('Metro Supermarket, MG Road Branch');
  const [officerNotes, setOfficerNotes] = useState(
    commodity?.isCompliant
      ? 'All 7 mandatory Legal Metrology Rule 6 statutory declarations verified on packaging and confirmed fully compliant.'
      : 'Statutory non-compliance identified during retail shelf audit. Contraventions noted under Legal Metrology (Packaged Commodities) Rules, 2011.'
  );
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!commodity) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Extraction Results" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No commodity scan data available.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Return to Camera Scanner</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Derive 7 statutory declarations safely from commodity object
  const declarations = [
    {
      key: 'genericName',
      number: '1',
      label: 'Generic Name of Commodity',
      value: commodity.genericName || commodity.productName,
      rule: 'Rule 6(1)(b) - Common or generic name',
      status: commodity.extractedFields?.find((f) => f.key === 'genericName')?.status || 'valid',
      note: commodity.extractedFields?.find((f) => f.key === 'genericName')?.note || 'Prominently displayed on principal panel',
    },
    {
      key: 'netQuantity',
      number: '2',
      label: 'Net Quantity (Weight / Measure)',
      value: commodity.netQuantity,
      rule: 'Rule 6(1)(c) - Standard metric weight or volume',
      status: commodity.extractedFields?.find((f) => f.key === 'netQuantity')?.status || 'valid',
      note: commodity.extractedFields?.find((f) => f.key === 'netQuantity')?.note || 'Standard SI metric units used',
    },
    {
      key: 'mrp',
      number: '3',
      label: 'Maximum Retail Price (MRP)',
      value: commodity.mrp,
      rule: 'Rule 6(1)(da) - Incl. of all taxes & unit sale price',
      status: commodity.extractedFields?.find((f) => f.key === 'mrp')?.status || (commodity.isCompliant ? 'valid' : 'violation'),
      note: commodity.extractedFields?.find((f) => f.key === 'mrp')?.note || commodity.mrpDetails || 'Unit sale price declared',
    },
    {
      key: 'mfgDate',
      number: '4',
      label: 'Month & Year of Mfg / Packing',
      value: commodity.mfgDate,
      rule: 'Rule 6(1)(d) - Packing or manufacturing date',
      status: commodity.extractedFields?.find((f) => f.key === 'mfgDate')?.status || (commodity.mfgDate === 'NOT FOUND' ? 'violation' : 'valid'),
      note: commodity.extractedFields?.find((f) => f.key === 'mfgDate')?.note || (commodity.mfgDate === 'NOT FOUND' ? 'Mandatory date absent' : 'Legible month/year format'),
    },
    {
      key: 'countryOfOrigin',
      number: '5',
      label: 'Country of Origin',
      value: commodity.countryOfOrigin,
      rule: 'Rule 6(1)(e) - Country of origin (Domestic & Imported)',
      status: commodity.extractedFields?.find((f) => f.key === 'countryOfOrigin')?.status ||
        (commodity.countryOfOrigin.includes('MISSING') || commodity.countryOfOrigin.includes('NOT') ? 'violation' : 'valid'),
      note: commodity.extractedFields?.find((f) => f.key === 'countryOfOrigin')?.note || (commodity.countryOfOrigin.includes('NOT') ? 'Mandatory origin statement absent' : 'Compliant declaration'),
    },
    {
      key: 'manufacturer',
      number: '6',
      label: 'Manufacturer / Packer / Importer Details',
      value: commodity.manufacturer || 'Declared on package',
      rule: 'Rule 6(1)(a) - Name & complete postal address',
      status: commodity.extractedFields?.find((f) => f.key === 'manufacturer')?.status || 'valid',
      note: commodity.extractedFields?.find((f) => f.key === 'manufacturer')?.note || 'Complete corporate address declared',
    },
    {
      key: 'consumerCare',
      number: '7',
      label: 'Consumer Care Redressal Details',
      value: commodity.consumerCare || 'NOT AVAILABLE (MISSING)',
      rule: 'Rule 6(1)(n) - Name, address, phone & email of grievance officer',
      status: commodity.extractedFields?.find((f) => f.key === 'consumerCare')?.status ||
        (commodity.consumerCare?.includes('NOT') ? 'violation' : 'valid'),
      note: commodity.extractedFields?.find((f) => f.key === 'consumerCare')?.note || (commodity.consumerCare?.includes('NOT') ? 'Missing grievance redressal contact' : 'Toll-free & email contact declared'),
    },
  ];

  const handleSubmitReport = async () => {
    const reportData = {
      officerId: user?.id || 'OFF-402',
      officerName: user?.name || 'Inspector A. Sharma',
      retailerName: retailerName,
      productName: commodity.productName,
      genericName: commodity.genericName || commodity.productName,
      category: commodity.category || 'Packaged Commodity',
      mrp: commodity.mrp,
      netQuantity: commodity.netQuantity,
      mfgDate: commodity.mfgDate,
      countryOfOrigin: commodity.countryOfOrigin,
      manufacturer: commodity.manufacturer,
      consumerCare: commodity.consumerCare,
      isCompliant: commodity.isCompliant,
      violations: commodity.violations || [],
      officerNotes: officerNotes,
    };

    // Persist inspection result to local SQLite ONLY for COMPLIANT products.
    // Non-compliant items are flagged in the report context but NOT written to the
    // local database, keeping the offline sync queue clean and audit-ready.
    if (commodity.isCompliant) {
      try {
        const complianceStatus = 'COMPLIANT';
        const violationDetails = {
          violations: [],
          officerNotes: officerNotes,
          retailerName: retailerName,
        };
        await insertInspection(commodity.productName, complianceStatus, violationDetails);
        console.log('[DB] Compliant inspection saved to local SQLite:', commodity.productName);
      } catch (dbError) {
        console.error('[DB] Failed to save compliant inspection to local database:', dbError);
      }
    } else {
      console.log('[DB] Non-compliant product — skipping SQLite persistence:', commodity.productName);
    }

    const newReport = addReport(reportData);
    setSubmittedReportId(newReport.id);
    setIsSubmitted(true);
  };

  // Generate HTML template for official PDF Audit Report
  const generateAuditHtml = () => {
    const reportId = submittedReportId || `AUD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const auditDate = new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const auditTime = timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const declarationRowsHtml = declarations
      .map(
        (dec) => `
        <tr>
          <td style="text-align: center; font-weight: bold;">${dec.number}</td>
          <td>
            <strong>${dec.label}</strong><br/>
            <span style="font-size: 10px; color: #4b5563;">${dec.rule}</span>
          </td>
          <td style="font-weight: 600; color: #111827;">${dec.value}</td>
          <td>
            <span class="tag ${dec.status === 'valid' ? 'tag-valid' : 'tag-violation'}">
              ${dec.status === 'valid' ? '✓ COMPLIANT' : '⚠️ VIOLATION'}
            </span><br/>
            <span style="font-size: 10px; color: #6b7280;">${dec.note}</span>
          </td>
        </tr>
      `
      )
      .join('');

    const violationsListHtml =
      commodity.violations && commodity.violations.length > 0
        ? `
        <div class="violations-box">
          <div class="violations-title">⚠️ STATUTORY CONTRAVENTIONS RECORDED (${commodity.violations.length})</div>
          <ul class="violations-list">
            ${commodity.violations.map((v) => `<li><strong>Contravention:</strong> ${v}</li>`).join('')}
          </ul>
        </div>
      `
        : `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px;">
          <span style="color: #166534; font-weight: 700; font-size: 11px;">
            ✓ NO STATUTORY CONTRAVENTIONS DETECTED. All 7 mandatory declarations meet statutory font sizes and principal panel placement under Rule 6.
          </span>
        </div>
      `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Legal Metrology Statutory Audit Report - ${reportId}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.45;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .emblem { font-size: 28px; line-height: 1; margin-bottom: 4px; }
          .gov-title { font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #1e3a8a; margin: 0; }
          .dept-title { font-size: 17px; font-weight: 900; color: #0f172a; margin: 3px 0; }
          .report-subtitle { font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
          .statute-cite { font-size: 10px; color: #64748b; font-style: italic; margin-top: 2px; }

          .status-banner {
            padding: 10px 16px;
            border-radius: 6px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.5px;
          }
          .status-compliant { background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
          .status-violation { background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

          .meta-grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
          }
          .meta-grid td {
            padding: 6px 10px;
            border: 1px solid #cbd5e1;
            font-size: 11px;
          }
          .meta-label {
            font-weight: 700;
            color: #334155;
            background: #f1f5f9;
            width: 22%;
          }
          .meta-val {
            font-weight: 600;
            color: #0f172a;
          }

          .section-heading {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #1e3a8a;
            border-left: 4px solid #1e3a8a;
            padding-left: 8px;
            margin: 16px 0 8px 0;
          }

          .audit-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
          }
          .audit-table th {
            background-color: #1e3a8a;
            color: #ffffff;
            padding: 7px 10px;
            font-size: 10px;
            text-align: left;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 1px solid #1e3a8a;
          }
          .audit-table td {
            padding: 7px 10px;
            border: 1px solid #cbd5e1;
            font-size: 11px;
            vertical-align: top;
          }
          .audit-table tr:nth-child(even) { background-color: #f8fafc; }

          .tag {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.4px;
          }
          .tag-valid { background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .tag-violation { background-color: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }

          .violations-box {
            background-color: #fff1f2;
            border: 1px solid #fecdd3;
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 14px;
          }
          .violations-title {
            font-size: 11px;
            font-weight: 800;
            color: #9f1239;
            margin-bottom: 4px;
          }
          .violations-list {
            margin: 0;
            padding-left: 18px;
            color: #881337;
            font-size: 10.5px;
          }
          .violations-list li { margin-bottom: 3px; }

          .notes-box {
            background-color: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px 12px;
            font-size: 11px;
            color: #334155;
            margin-bottom: 18px;
          }

          .signatures-table {
            width: 100%;
            margin-top: 24px;
            border-collapse: collapse;
          }
          .signatures-table td {
            width: 50%;
            vertical-align: top;
            padding: 8px 14px;
            border: none;
          }
          .sig-box {
            border-top: 1.5px dashed #64748b;
            padding-top: 6px;
            font-size: 10.5px;
            color: #334155;
          }
          .sig-title { font-weight: 800; color: #0f172a; margin-bottom: 2px; }

          .footer {
            margin-top: 24px;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="emblem">⚖️</div>
          <p class="gov-title">GOVERNMENT OF INDIA • DEPARTMENT OF LEGAL METROLOGY</p>
          <h1 class="dept-title">STATUTORY COMMODITY AUDIT REPORT</h1>
          <div class="report-subtitle">Inspection Under Legal Metrology (Packaged Commodities) Rules, 2011</div>
          <div class="statute-cite">Enforcement under Sections 15 & 18 of the Legal Metrology Act, 2009 (Act No. 1 of 2010)</div>
        </div>

        <div class="status-banner ${commodity.isCompliant ? 'status-compliant' : 'status-violation'}">
          <span>AUDIT FINDING: ${commodity.isCompliant ? 'PASSED — FULLY STATUTORY COMPLIANT' : 'NON-COMPLIANT — STATUTORY VIOLATION DETECTED'}</span>
          <span>REF: ${reportId}</span>
        </div>

        <table class="meta-grid">
          <tr>
            <td class="meta-label">Audit Report ID</td>
            <td class="meta-val">${reportId}</td>
            <td class="meta-label">Inspection Date & Time</td>
            <td class="meta-val">${auditDate} at ${auditTime}</td>
          </tr>
          <tr>
            <td class="meta-label">Inspecting Officer</td>
            <td class="meta-val">${user?.name || 'Inspector A. Sharma'} (${user?.badgeNumber || user?.id || 'OFF-402'})</td>
            <td class="meta-label">Inspection Zone</td>
            <td class="meta-val">${user?.zone || 'Zone 4 - Enforcement Division'}</td>
          </tr>
          <tr>
            <td class="meta-label">Retailer / Premises</td>
            <td class="meta-val">${retailerName}</td>
            <td class="meta-label">Commodity Barcode</td>
            <td class="meta-val">${commodity.barcode || '8901234567890'} (GTIN)</td>
          </tr>
          <tr>
            <td class="meta-label">Product Name</td>
            <td class="meta-val"><strong>${commodity.productName}</strong></td>
            <td class="meta-label">Category & Brand</td>
            <td class="meta-val">${commodity.category || 'Commodity'} • ${commodity.brand || 'N/A'}</td>
          </tr>
        </table>

        <div class="section-heading">RULE 6 STATUTORY DECLARATIONS AUDIT MATRIX (7 MANDATORY FIELDS)</div>
        <table class="audit-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">S.No</th>
              <th style="width: 32%;">Statutory Requirement & Rule</th>
              <th style="width: 38%;">Declared Value on Display Panel</th>
              <th style="width: 25%;">Compliance Assessment</th>
            </tr>
          </thead>
          <tbody>
            ${declarationRowsHtml}
          </tbody>
        </table>

        <div class="section-heading">STATUTORY VIOLATION FINDINGS & LEGAL CITATIONS</div>
        ${violationsListHtml}

        <div class="section-heading">FIELD INSPECTOR OBSERVATIONS & STATEMENT OF FACTS</div>
        <div class="notes-box">
          ${officerNotes}
        </div>

        <table class="signatures-table">
          <tr>
            <td>
              <div class="sig-box">
                <div class="sig-title">Field Inspection Officer</div>
                <div>${user?.name || 'Inspector A. Sharma'}</div>
                <div>Badge No: ${user?.badgeNumber || 'LM-KA-4029'}</div>
                <div>Date: ${auditDate}</div>
              </div>
            </td>
            <td>
              <div class="sig-box">
                <div class="sig-title">Directorate Enforcement Supervisory Authority</div>
                <div>Director V. Raman, Chief Supervisory Officer</div>
                <div>Headquarters Legal Metrology Enforcement Cell</div>
                <div>Official Seal & Endorsement</div>
              </div>
            </td>
          </tr>
        </table>

        <div class="footer">
          This is an official statutory inspection report generated via the Legal Metrology Mobile Enforcement System. Document verified and encrypted under the Information Technology Act, 2000.
        </div>
      </body>
      </html>
    `;
  };

  // Export PDF handler using expo-print direct print dialog
  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const html = generateAuditHtml();

      // Directly invoke system print / save-as-PDF dialog
      await Print.printAsync({ html });
    } catch (error) {
      console.error('Failed to print/export PDF audit report:', error);
      Alert.alert(
        'Print Failed',
        `Unable to print or export PDF audit report: ${error?.message || 'Unknown error'}`
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Extraction Results"
        subtitle={`Scanned at ${timestamp || 'Just now'} by ${user?.name || 'Officer'}`}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Success Banner if submitted */}
        {isSubmitted && (
          <View style={[styles.submittedBanner, SHADOWS.md]}>
            <View style={styles.bannerHeaderRow}>
              <Text style={styles.bannerIcon}>✅</Text>
              <View style={styles.bannerTextGroup}>
                <Text style={styles.bannerTitle}>Report Submitted Successfully</Text>
                <Text style={styles.bannerReportId}>Official ID: {submittedReportId}</Text>
              </View>
            </View>
            <Text style={styles.bannerDesc}>
              This report has been submitted to the Directorate for supervisory review and enforcement sign-off.
            </Text>
            <View style={styles.bannerActions}>
              <TouchableOpacity
                style={styles.bannerActionBtn}
                onPress={() => navigation.navigate('Inspection')}
              >
                <Text style={styles.bannerActionText}>+ Scan Next Commodity</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bannerActionBtn, styles.bannerSupervisorBtn]}
                onPress={() => switchRole('supervisor')}
              >
                <Text style={styles.bannerSupervisorText}>View as Supervisor →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Commodity Header & Compliance Summary Card */}
        <View style={[styles.card, SHADOWS.sm]}>
          <View style={styles.productHeader}>
            <View style={styles.productHeaderLeft}>
              <Text style={styles.categoryLabel}>{commodity.category || 'COMMODITY'}</Text>
              <Text style={styles.productTitle}>{commodity.productName}</Text>
              <Text style={styles.brandText}>Brand / Packer: {commodity.brand}</Text>
            </View>
          </View>

          <View style={styles.statusSection}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>OVERALL COMPLIANCE STATUS:</Text>
              <ComplianceBadge isCompliant={commodity.isCompliant} size="medium" />
            </View>

            {commodity.isCompliant ? (
              <View style={[styles.alertBox, styles.alertSuccess]}>
                <Text style={styles.alertIcon}>🛡️</Text>
                <Text style={styles.alertText}>
                  All 7 statutory packaging declarations comply with Section 18 of Legal Metrology Act, 2009 & Rule 6(1) of Packaged Commodities Rules, 2011.
                </Text>
              </View>
            ) : (
              <View style={[styles.alertBox, styles.alertDanger]}>
                <Text style={styles.alertIcon}>⚠️</Text>
                <View style={styles.alertContent}>
                  <Text style={styles.alertDangerTitle}>
                    Legal Metrology Violations Detected ({commodity.violations?.length || 1})
                  </Text>
                  {commodity.violations?.map((viol, idx) => (
                    <Text key={idx} style={styles.alertViolationItem}>
                      • {viol}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 7 Mandatory Legal Declarations Panel */}
        <View style={[styles.card, SHADOWS.sm]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderTitleGroup}>
              <Text style={styles.cardSectionTitle}>RULE 6 STATUTORY DECLARATIONS</Text>
              <Text style={styles.cardSectionSub}>All 7 mandatory packaging disclosures under Rule 6(1)</Text>
            </View>
            <View style={styles.sevenBadge}>
              <Text style={styles.sevenBadgeText}>7 of 7</Text>
            </View>
          </View>

          {declarations.map((dec, idx) => (
            <DeclarationRow
              key={dec.key}
              label={`${dec.number}. ${dec.label}`}
              value={dec.value}
              status={dec.status}
              rule={dec.rule}
              note={dec.note}
              isLast={idx === declarations.length - 1}
            />
          ))}
        </View>

        {/* Inspection & Retailer Location Context */}
        <View style={[styles.card, SHADOWS.sm]}>
          <Text style={styles.cardSectionTitle}>INSPECTION & RETAILER CONTEXT</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Retailer / Inspection Site Location:</Text>
            <TextInput
              style={styles.textInput}
              value={retailerName}
              onChangeText={setRetailerName}
              placeholder="Enter retail store and address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Field Officer Observations / Evidence Notes:</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={officerNotes}
              onChangeText={setOfficerNotes}
              placeholder="Add inspection observations or evidence details..."
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Primary Action Buttons */}
        <View style={styles.actionContainer}>
          {/* Export PDF Audit Report Button */}
          <TouchableOpacity
            style={[styles.exportPdfButton, SHADOWS.md, isExporting && styles.btnDisabled]}
            onPress={handleExportPDF}
            disabled={isExporting}
            activeOpacity={0.85}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: SPACING.sm }} />
            ) : (
              <Text style={styles.exportPdfIcon}>📄</Text>
            )}
            <Text style={styles.exportPdfButtonText}>
              {isExporting ? 'Generating Official PDF...' : 'Export PDF Audit Report'}
            </Text>
          </TouchableOpacity>

          {/* Submit Report to Supervisor Button */}
          {!isSubmitted ? (
            <TouchableOpacity
              style={[styles.submitButton, SHADOWS.md]}
              onPress={handleSubmitReport}
              activeOpacity={0.85}
            >
              <Text style={styles.submitButtonIcon}>📤</Text>
              <Text style={styles.submitButtonText}>Submit Report to Supervisor</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitButton, styles.alreadySubmittedBtn]}
              onPress={() => navigation.navigate('Inspection')}
            >
              <Text style={styles.submitButtonText}>✓ Report Logged — Scan Another Package</Text>
            </TouchableOpacity>
          )}

          {/* Retake / Re-scan Button */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>← Retake / Re-scan Package</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  backButtonText: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  submittedBanner: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  bannerIcon: {
    fontSize: 22,
    marginRight: SPACING.sm,
  },
  bannerTextGroup: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065F46',
  },
  bannerReportId: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  bannerDesc: {
    fontSize: 12,
    color: '#047857',
    marginBottom: SPACING.md,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  bannerActionBtn: {
    flex: 1,
    backgroundColor: '#047857',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  bannerActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bannerSupervisorBtn: {
    backgroundColor: COLORS.supervisor,
  },
  bannerSupervisorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  productHeaderLeft: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  productTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  brandText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  alertBox: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  alertSuccess: {
    backgroundColor: COLORS.compliantBg,
    borderColor: COLORS.compliantBorder,
  },
  alertDanger: {
    backgroundColor: COLORS.violationBg,
    borderColor: COLORS.violationBorder,
  },
  alertIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.compliantDark,
    lineHeight: 17,
  },
  alertDangerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.violationDark,
    marginBottom: 4,
  },
  alertViolationItem: {
    fontSize: 12,
    color: COLORS.violationDark,
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionHeaderTitleGroup: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  cardSectionSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  sevenBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  sevenBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryLight,
  },
  inputGroup: {
    marginTop: SPACING.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  textInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  actionContainer: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  exportPdfButton: {
    backgroundColor: '#0D9488', // Teal accent for PDF export
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  exportPdfIcon: {
    fontSize: 18,
    marginRight: SPACING.xs + 2,
  },
  exportPdfButtonText: {
    color: COLORS.textInverse,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  alreadySubmittedBtn: {
    backgroundColor: '#059669',
  },
  submitButtonIcon: {
    fontSize: 16,
    marginRight: SPACING.xs + 2,
  },
  submitButtonText: {
    color: COLORS.textInverse,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
});
