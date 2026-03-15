import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { Colors } from '@/constants/colors';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, loginPending, loginError } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shakeAnim] = useState(() => new Animated.Value(0));

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) return;
    try {
      await login(email.trim(), password);
    } catch {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [email, password, login, shakeAnim]);

  const errorMessage = loginError
    ? (loginError.message?.includes('Invalid') ? t('login.error.invalid') : t('login.error.generic'))
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.topSection}>
          <TouchableOpacity
            onPress={toggleLanguage}
            style={styles.langToggle}
            testID="lang-toggle"
            activeOpacity={0.7}
          >
            <Text style={styles.langText}>
              {language === 'en' ? '繁中' : 'EN'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.centerSection}>
          <View style={styles.iconContainer}>
            <MessageCircle size={36} color={Colors.white} strokeWidth={2} />
          </View>

          <Text style={styles.appTitle}>{t('app.title')}</Text>
          <Text style={styles.appSubtitle}>
            {t('app.subtitle')} {language === 'en' ? '管理平台' : 'Admin Portal'}
          </Text>

          <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('login.email')}</Text>
              <TextInput
                style={styles.input}
                placeholder="admin@example.com"
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="email-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('login.password')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                testID="password-input"
              />
            </View>

            {errorMessage && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.loginButton, loginPending && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loginPending || !email.trim() || !password.trim()}
              activeOpacity={0.8}
              testID="login-button"
            >
              {loginPending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.loginButtonText}>{t('login.button')}</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.bottomSection}>
          <Text style={styles.footerText}>SLP Jason Admin v1.0</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0ebe4',
  },
  keyboardView: {
    flex: 1,
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  langToggle: {
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  langText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  appTitle: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 36,
    letterSpacing: 0.3,
  },
  formCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
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
  loginButton: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  bottomSection: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
});
