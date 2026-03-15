import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import ScreenHeader from '@/components/ScreenHeader';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { changePassword, changePasswordPending, changePasswordError, changePasswordSuccess, resetChangePassword } = useAuth();
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (changePasswordSuccess) {
      Alert.alert(t('password.success'), '', [
        { text: 'OK', onPress: () => { resetChangePassword(); router.back(); } },
      ]);
    }
  }, [changePasswordSuccess, t, resetChangePassword, router]);

  const handleSubmit = useCallback(async () => {
    setLocalError(null);
    if (newPassword.length < 6) {
      setLocalError(t('password.too_short'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError(t('password.mismatch'));
      return;
    }
    try {
      await changePassword(newPassword);
    } catch {
      console.log('[ChangePassword] Error changing password');
    }
  }, [newPassword, confirmPassword, changePassword, t]);

  const errorMsg = localError ?? (changePasswordError ? t('password.error') : null);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('password.title')} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.iconRow}>
            <View style={styles.iconCircle}>
              <Shield size={28} color={Colors.accent} />
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('password.new')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textTertiary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                testID="new-password-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('password.confirm')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                testID="confirm-password-input"
              />
            </View>

            {errorMsg && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, changePasswordPending && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={changePasswordPending || !newPassword || !confirmPassword}
              activeOpacity={0.8}
              testID="change-password-button"
            >
              {changePasswordPending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <View style={styles.submitRow}>
                  <Check size={20} color={Colors.white} />
                  <Text style={styles.submitButtonText}>{t('password.save')}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  errorContainer: {
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
