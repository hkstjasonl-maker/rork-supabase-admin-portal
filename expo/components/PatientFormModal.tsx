import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { X, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import type { Patient, PatientFormData } from '@/types/patient';
import { generateAccessCode } from '@/types/patient';

interface PatientFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: PatientFormData) => void;
  patient?: Patient | null;
  saving?: boolean;
}

export default function PatientFormModal({
  visible,
  onClose,
  onSave,
  patient,
  saving,
}: PatientFormModalProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (patient) {
        setName(patient.patient_name);
        setAccessCode(patient.access_code);
        setDiagnosis(patient.diagnosis ?? '');
        setIsActive(patient.is_active);
        setIsFrozen(patient.is_frozen);
      } else {
        setName('');
        setAccessCode(generateAccessCode());
        setDiagnosis('');
        setIsActive(true);
        setIsFrozen(false);
      }
      setError(null);
    }
  }, [visible, patient]);

  const handleRegenerateCode = useCallback(() => {
    setAccessCode(generateAccessCode());
  }, []);

  const handleSave = useCallback(() => {
    setError(null);
    if (!name.trim()) {
      setError(t('patients.name_required'));
      return;
    }
    onSave({
      patient_name: name.trim(),
      access_code: accessCode,
      diagnosis: diagnosis.trim(),
      is_active: isActive,
      is_frozen: isFrozen,
    });
  }, [name, accessCode, diagnosis, isActive, isFrozen, onSave, t]);

  const isEditing = !!patient;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? t('patients.edit') : t('patients.add')}
          </Text>
          <View style={styles.closeBtn} />
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('patients.patient_name')} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('patients.patient_name')}
              placeholderTextColor={Colors.textTertiary}
              autoFocus={!isEditing}
              testID="patient-name-input"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('patients.access_code')}</Text>
            <View style={styles.codeRow}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={accessCode}
                onChangeText={setAccessCode}
                maxLength={8}
                autoCapitalize="characters"
                testID="patient-code-input"
              />
              <TouchableOpacity
                onPress={handleRegenerateCode}
                style={styles.regenerateBtn}
                activeOpacity={0.7}
              >
                <RefreshCw size={16} color={Colors.accent} />
                <Text style={styles.regenerateText}>{t('patients.regenerate')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('patients.diagnosis')} <Text style={styles.optionalLabel}>({t('patients.optional')})</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder={t('patients.diagnosis')}
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              testID="patient-diagnosis-input"
            />
          </View>

          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('patients.is_active')}</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: Colors.borderLight, true: Colors.greenLight }}
                thumbColor={isActive ? Colors.green : Colors.textTertiary}
                testID="patient-active-toggle"
              />
            </View>
            <View style={styles.toggleDivider} />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('patients.is_frozen')}</Text>
              <Switch
                value={isFrozen}
                onValueChange={setIsFrozen}
                trackColor={{ false: Colors.borderLight, true: '#fde2c8' }}
                thumbColor={isFrozen ? Colors.accent : Colors.textTertiary}
                testID="patient-frozen-toggle"
              />
            </View>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
            testID="patient-save-button"
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>{t('patients.save')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.card,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  required: {
    color: Colors.danger,
  },
  optionalLabel: {
    fontWeight: '400' as const,
    color: Colors.textTertiary,
    fontSize: 12,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeInput: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
    fontSize: 17,
    fontWeight: '600' as const,
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  regenerateText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  toggleCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 16,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  errorContainer: {
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
