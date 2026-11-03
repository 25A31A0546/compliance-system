import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import Header from '../components/Header';
import { PRESET_COMMODITIES } from '../constants/mockData';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { INSPECTION_API_URL } from '../constants/api';

const formatDeclValue = (decl, fallback) => {
  if (!decl || !decl.detected) return fallback || 'NOT DETECTED';
  if (Array.isArray(decl.extractedText)) {
    const validItems = decl.extractedText.filter((t) => t && t !== 'Not Detected' && t !== 'NOT DETECTED');
    if (validItems.length > 0) return validItems.join(', ');
  } else if (typeof decl.extractedText === 'string' && decl.extractedText !== 'Not Detected' && decl.extractedText !== 'NOT DETECTED') {
    return decl.extractedText;
  }
  return fallback || 'Detected';
};

const mapApiResponseToCommodity = (apiData, photoUri) => {
  if (!apiData || !apiData.declarations) return null;

  const findDecl = (ruleId) => apiData.declarations.find((d) => d.id === ruleId);

  const commDecl = findDecl('rule_6_1_a_commodity');
  const netQtyDecl = findDecl('rule_6_1_c_netqty');
  const mrpDecl = findDecl('rule_6_1_e_mrp');
  const uspDecl = findDecl('rule_6_1_s_usp');
  const mfgDecl = findDecl('rule_6_1_d_mfg');
  const mfrDecl = findDecl('rule_6_1_a_mfr');
  const careDecl = findDecl('rule_6_1_h_care');
  const originDecl = findDecl('rule_6_1_n_origin');

  const isCompliant = apiData.overallStatus === 'COMPLIANT';

  // Use violations calculated by backend or synthesize from failed declarations
  let violations = apiData.violations || [];
  if (violations.length === 0) {
    apiData.declarations.forEach((d) => {
      if (!d.detected) {
        violations.push(`Statutory contravention under ${d.rule}: ${d.title} absent or unreadable on package.`);
      }
    });
  }

  // productName from backend IS the detected category (e.g. "Edible Oil", "Dairy / Ghee")
  // Use it directly as the primary results card title
  const detectedCategory = apiData.productName || apiData.category || 'General Packaged Commodity';

  // genericName is the actual OCR-detected text description (brand / product words)
  const genericName = apiData.genericName || formatDeclValue(commDecl, 'Packaged Commodity');

  const extractedFields = [
    {
      key: 'genericName',
      label: '1. Common / Generic Name',
      value: formatDeclValue(commDecl, 'NOT DECLARED (MISSING)'),
      status: commDecl?.detected ? 'valid' : 'violation',
      rule: 'Rule 6(1)(b)',
      note: commDecl?.detected ? 'Detected on package display panel via OCR' : 'Common or generic name missing',
    },
    {
      key: 'netQuantity',
      label: '2. Net Quantity',
      value: formatDeclValue(netQtyDecl, 'NOT DECLARED (MISSING)'),
      status: netQtyDecl?.detected ? 'valid' : 'violation',
      rule: 'Rule 6(1)(c)',
      note: netQtyDecl?.detected ? 'Standard SI metric unit detected' : 'Metric weight or measure absent',
    },
    {
      key: 'mrp',
      label: '3. Maximum Retail Price (MRP)',
      value: formatDeclValue(mrpDecl, 'NOT DECLARED (MISSING)'),
      status: mrpDecl?.detected ? 'valid' : 'violation',
      rule: 'Rule 6(1)(da)',
      note: uspDecl?.detected
        ? `Unit sale price: ${formatDeclValue(uspDecl, '')}`
        : (mrpDecl?.detected ? 'Inclusive of all taxes' : 'Mandatory MRP declaration absent'),
    },
    {
      key: 'mfgDate',
      label: '4. Month & Year of Mfg / Packing',
      value: formatDeclValue(mfgDecl, 'NOT FOUND'),
      status: mfgDecl?.detected ? 'valid' : 'violation',
      rule: 'Rule 6(1)(d)',
      note: mfgDecl?.detected ? 'Manufacturing/packing date detected' : 'Mandatory date absent',
    },
    {
      key: 'countryOfOrigin',
      label: '5. Country of Origin',
      value: formatDeclValue(originDecl, 'NOT DECLARED (MISSING)'),
      status: originDecl?.detected ? 'valid' : 'violation',
      rule: 'Rule 6(1)(e)',
      note: originDecl?.detected ? 'Country of origin statement declared' : 'Mandatory origin statement absent',
    },
    {
      key: 'manufacturer',
      label: '6. Manufacturer / Packer Details',
      value: formatDeclValue(mfrDecl, 'NOT DECLARED (MISSING)'),
      status: mfrDecl?.detected ? 'valid' : 'violation',
      rule: 'Rule 6(1)(a)',
      note: mfrDecl?.detected ? 'Complete name & address details found' : 'Corporate address missing',
    },
    {
      key: 'consumerCare',
      label: '7. Consumer Care Details',
      value: formatDeclValue(careDecl, 'NOT AVAILABLE (MISSING)'),
      status: careDecl?.detected ? 'valid' : 'violation',
      rule: 'Rule 6(1)(n)',
      note: careDecl?.detected ? 'Grievance officer contact declared' : 'Mandatory consumer care details absent',
    },
  ];

  return {
    id: `scan-${Date.now()}`,
    productName: detectedCategory,          // primary card title = detected category
    genericName: genericName,               // OCR-extracted description text
    category: detectedCategory,
    brand: genericName.split(' ')[0] || 'Scanned Brand',
    barcode: 'DETECTED-ON-PACKAGE',
    batchNo: 'PKG-BATCH-AUDIT',
    netQuantity: formatDeclValue(netQtyDecl, 'NOT DECLARED (MISSING)'),
    mrp: formatDeclValue(mrpDecl, 'NOT DECLARED (MISSING)'),
    mrpDetails: mrpDecl?.detected
      ? `${formatDeclValue(mrpDecl, '')} ${uspDecl?.detected ? `(${formatDeclValue(uspDecl, '')})` : ''}`
      : 'Not Declared',
    mfgDate: formatDeclValue(mfgDecl, 'NOT FOUND'),
    countryOfOrigin: formatDeclValue(originDecl, 'NOT DECLARED (MISSING)'),
    manufacturer: formatDeclValue(mfrDecl, 'NOT DECLARED (MISSING)'),
    consumerCare: formatDeclValue(careDecl, 'NOT AVAILABLE (MISSING)'),
    isCompliant,
    complianceScore: apiData.complianceScore ?? (isCompliant ? 100 : 50),
    rulesPassed: apiData.rulesPassed || (isCompliant ? '9/9' : `${9 - violations.length}/9`),
    rawExtractedText: apiData.rawExtractedText || '',
    violations: violations.length > 0 ? violations : ['All statutory declarations verified compliant.'],
    extractedFields,
    isLiveApiResult: true,
  };
};

export default function InspectionScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [torch, setTorch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const cameraRef = useRef(null);

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleTorch = () => {
    setTorch((prev) => !prev);
  };

  const uploadInspectionImage = async (uri) => {
    const formData = new FormData();
    if (Platform.OS === 'web' || uri.startsWith('blob:') || uri.startsWith('data:')) {
      const res = await fetch(uri);
      const blob = await res.blob();
      formData.append('image', blob, 'package_photo.jpg');
    } else {
      formData.append('image', {
        uri: uri,
        name: 'package_photo.jpg',
        type: 'image/jpeg',
      });
    }

    const response = await axios.post(
      INSPECTION_API_URL,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          Accept: 'application/json',
        },
        timeout: 45000,
      }
    );

    return response.data;
  };

  const handleScanCommodity = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setUploadStatus('Capturing package frame...');

    let photoUri = null;

    try {
      if (cameraRef.current && permission?.granted) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: true,
        });
        if (photo?.uri) {
          photoUri = photo.uri;
        }
      }
    } catch (err) {
      console.log('Camera capture notice:', err?.message);
    }

    if (!photoUri) {
      setIsProcessing(false);
      setUploadStatus('');
      Alert.alert(
        'Camera Sensor Inactive',
        'Unable to capture camera frame on this device/simulator. Would you like to select a package photo from your gallery instead?',
        [
          { text: 'Pick from Gallery', onPress: () => handlePickImage() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    try {
      setUploadStatus(`Uploading package to inspection engine (${INSPECTION_API_URL})...`);
      const apiData = await uploadInspectionImage(photoUri);
      if (apiData) {
        setUploadStatus('Analyzing Legal Metrology Rule 6 & Rule 9 compliance...');
        const realCommodity = mapApiResponseToCommodity(apiData, photoUri);
        setIsProcessing(false);
        setUploadStatus('');
        navigation.navigate('Results', {
          commodity: realCommodity,
          photoUri: photoUri,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        return;
      }
    } catch (uploadErr) {
      console.warn('Axios upload error:', uploadErr?.message);
      setIsProcessing(false);
      setUploadStatus('');
      Alert.alert(
        'Inspection Server Error',
        `Could not reach the Legal Metrology OCR backend at:\n${INSPECTION_API_URL}\n\nError: ${uploadErr.message}\n\nPlease ensure your Python backend is running:\npython3 main.py`
      );
      return;
    }

    setIsProcessing(false);
    setUploadStatus('');
  };

  const handlePickImage = async () => {
    if (isProcessing) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedUri = result.assets[0].uri;
        setIsProcessing(true);
        setUploadStatus(`Uploading package to inspection engine (${INSPECTION_API_URL})...`);

        try {
          const apiData = await uploadInspectionImage(pickedUri);
          if (apiData) {
            setUploadStatus('Analyzing Legal Metrology Rule 6 & Rule 9 compliance...');
            const realCommodity = mapApiResponseToCommodity(apiData, pickedUri);
            setIsProcessing(false);
            setUploadStatus('');
            navigation.navigate('Results', {
              commodity: realCommodity,
              photoUri: pickedUri,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
            return;
          }
        } catch (uploadErr) {
          console.warn('Axios upload error:', uploadErr?.message);
          setIsProcessing(false);
          setUploadStatus('');
          Alert.alert(
            'Inspection Server Error',
            `Could not reach the Legal Metrology OCR backend at:\n${INSPECTION_API_URL}\n\nError: ${uploadErr.message}\n\nPlease ensure your Python backend is running:\npython3 main.py`
          );
          return;
        }
      }
    } catch (pickerErr) {
      console.error('Image picker error:', pickerErr);
      setIsProcessing(false);
      setUploadStatus('');
    }
  };

  const handleTestPreset = (preset) => {
    navigation.navigate('Results', {
      commodity: preset,
      photoUri: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Commodity Scanner"
        subtitle="Align label declarations within the inspection reticle"
      />

      {/* Main Viewport Container */}
      <View style={styles.cameraContainer}>
        {/* If permissions are still loading */}
        {!permission ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primaryLight} />
            <Text style={styles.stateText}>Initializing camera sensor...</Text>
          </View>
        ) : !permission.granted ? (
          /* Permission rationale and fallback */
          <View style={styles.permissionCard}>
            <View style={styles.permIconCircle}>
              <Text style={styles.permEmoji}>📷</Text>
            </View>
            <Text style={styles.permTitle}>Camera Permission Required</Text>
            <Text style={styles.permDescription}>
              The field inspection module utilizes the device camera to scan and extract Legal Metrology packaging declarations (MRP, Net Qty, Mfg Date, Origin).
            </Text>

            <TouchableOpacity
              style={styles.grantBtn}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.grantBtn, { backgroundColor: '#1E293B', marginTop: SPACING.sm }]}
              onPress={handlePickImage}
              activeOpacity={0.8}
            >
              <Text style={styles.grantBtnText}>📁 Pick Package from Gallery</Text>
            </TouchableOpacity>

            <View style={styles.dividerOr}>
              <View style={styles.line} />
              <Text style={styles.orText}>OR TEST WITH PRESETS</Text>
              <View style={styles.line} />
            </View>

            <Text style={styles.simulatorHint}>
              Running on Simulator or Web? You can scan preloaded real-world test commodities below:
            </Text>
          </View>
        ) : (
          /* Live Camera with Target Reticle Overlay */
          <View style={StyleSheet.absoluteFill}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              enableTorch={torch}
            />

            {/* Reticle / Optical Target Overlay */}
            <View style={styles.overlayContainer}>
              <View style={styles.overlayTop}>
                <View style={styles.hintBadge}>
                  <Text style={styles.hintBadgeText}>
                    🔍 Align Principal Display Panel inside frame
                  </Text>
                </View>
              </View>

              <View style={styles.reticleRow}>
                <View style={styles.overlaySide} />
                <View style={styles.reticleBox}>
                  {/* Four corner markers */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />

                  {/* Horizontal Scan Target Bar */}
                  <View style={styles.scanTargetLine} />

                  <View style={styles.reticleContent}>
                    <Text style={styles.reticleTargetText}>
                      LEGAL METROLOGY DECLARATIONS
                    </Text>
                    <Text style={styles.reticleSubtext}>
                      MRP • Net Quantity • Mfg Date • Country of Origin
                    </Text>
                  </View>
                </View>
                <View style={styles.overlaySide} />
              </View>

              <View style={styles.overlayBottom} />
            </View>

            {/* In-Camera Floating Controls */}
            <View style={styles.cameraControlsRow}>
              <TouchableOpacity
                style={styles.cameraControlBtn}
                onPress={handlePickImage}
                activeOpacity={0.7}
              >
                <Text style={styles.cameraControlIcon}>📁 Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cameraControlBtn, torch && styles.cameraControlBtnActive]}
                onPress={toggleTorch}
                activeOpacity={0.7}
              >
                <Text style={styles.cameraControlIcon}>{torch ? '🔦 ON' : '🔦 OFF'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraControlBtn}
                onPress={toggleCameraFacing}
                activeOpacity={0.7}
              >
                <Text style={styles.cameraControlIcon}>🔄 Flip</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.processingText}>
              {uploadStatus || 'Extracting Label Declarations...'}
            </Text>
            <Text style={styles.processingSubtext}>
              Target: {INSPECTION_API_URL}
            </Text>
          </View>
        )}
      </View>

      {/* Preset Commodity Selector Bar */}
      <View style={styles.presetSection}>
        <View style={styles.presetHeader}>
          <Text style={styles.presetTitle}>Or Test Preloaded Package Demos:</Text>
          <Text style={styles.presetSubtitle}>Tap chip to view preset</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScroll}
        >
          {PRESET_COMMODITIES.map((commodity, index) => {
            const isSelected = activePresetIndex === index;
            return (
              <TouchableOpacity
                key={commodity.id}
                style={[
                  styles.presetChip,
                  isSelected && styles.presetChipSelected,
                  !commodity.isCompliant && isSelected && styles.presetChipViolation,
                ]}
                onPress={() => {
                  setActivePresetIndex(index);
                  handleTestPreset(commodity);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.chipHeader}>
                  <Text style={styles.chipStatus}>
                    {commodity.isCompliant ? '✓ COMPLIANT' : '⚠️ VIOLATION'}
                  </Text>
                </View>
                <Text style={styles.chipName} numberOfLines={1}>
                  {commodity.productName}
                </Text>
                <Text style={styles.chipDetails}>
                  {commodity.netQuantity} • {commodity.mrp}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Bottom Shutter / Action Row */}
        <View style={styles.shutterRow}>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedLabel}>LIVE INSPECTION:</Text>
            <Text style={styles.selectedName} numberOfLines={1}>
              {permission?.granted ? 'Ready to Scan Package' : 'Upload from Gallery'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.galleryBtn}
            onPress={handlePickImage}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Text style={styles.galleryBtnIcon}>📁</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureBtn, isProcessing && styles.captureBtnDisabled]}
            onPress={() => handleScanCommodity()}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            <View style={styles.captureInnerCircle}>
              <Text style={styles.captureIcon}>📸</Text>
            </View>
            <Text style={styles.captureBtnText}>SCAN REAL PRODUCT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceDark,
  },
  stateText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: SPACING.md,
  },
  permissionCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permIconCircle: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  permEmoji: {
    fontSize: 32,
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  permDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.lg,
  },
  grantBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    width: '100%',
    alignItems: 'center',
  },
  grantBtnText: {
    color: COLORS.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
  dividerOr: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  orText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginHorizontal: SPACING.md,
  },
  simulatorHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  hintBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  reticleRow: {
    height: 240,
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  reticleBox: {
    width: 290,
    height: 240,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: COLORS.reticle,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 6,
  },
  scanTargetLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: COLORS.reticle,
    opacity: 0.6,
  },
  reticleContent: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
  },
  reticleTargetText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  reticleSubtext: {
    fontSize: 10,
    color: '#BAE6FD',
    marginTop: 2,
  },
  overlayBottom: {
    flex: 1.2,
    backgroundColor: COLORS.overlay,
  },
  cameraControlsRow: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  cameraControlBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cameraControlBtnActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#FDE68A',
  },
  cameraControlIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  processingSubtext: {
    color: '#93C5FD',
    fontSize: 12,
    marginTop: 4,
  },
  presetSection: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  presetHeader: {
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  presetTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  presetSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  presetScroll: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  presetChip: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    width: 170,
  },
  presetChipSelected: {
    borderColor: COLORS.compliant,
    backgroundColor: COLORS.compliantBg,
  },
  presetChipViolation: {
    borderColor: COLORS.violation,
    backgroundColor: COLORS.violationBg,
  },
  chipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  chipStatus: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  chipName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  chipDetails: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  selectedInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  selectedLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  selectedName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  captureBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    ...SHADOWS.md,
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureInnerCircle: {
    marginRight: SPACING.xs + 2,
  },
  captureIcon: {
    fontSize: 16,
  },
  captureBtnText: {
    color: COLORS.textInverse,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  galleryBtn: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs,
  },
  galleryBtnIcon: {
    fontSize: 18,
  },
});
