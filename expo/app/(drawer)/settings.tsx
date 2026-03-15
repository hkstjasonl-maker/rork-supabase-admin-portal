import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Lock,
  LogOut,
  Globe,
  Mail,
  Info,
  ChevronRight,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import ScreenHeader from '@/components/ScreenHeader';

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  showChevron?: boolean;
  loading?: boolean;
  rightContent?: React.ReactNode;
}

function SettingsRow({ icon, label, value, onPress, danger, showChevron = true, loading, rightContent }: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress || loading}
    >
      <View style={styles.settingsRowLeft}>
        {icon}
        <Text style={[styles.settingsRowLabel, danger && styles.dangerText]}>{label}</Text>
      </View>
      <View style={styles.settingsRowRight}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.textTertiary} />
        ) : rightContent ? (
          rightContent
        ) : (
          <>
            {value && <Text style={styles.settingsRowValue}>{value}</Text>}
            {showChevron && onPress && <ChevronRight size={18} color={Colors.textTertiary} />}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, logoutPending } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();

  const handleLogout = useCallback(() => {
    Alert.alert(
      t('settings.logout'),
      t('settings.logout_confirm'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.confirm'),
          style: 'destructive',
          onPress: () => {
            void logout();
          },
        },
      ]
    );
  }, [t, logout]);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings.title')} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(user?.email?.charAt(0) ?? 'A').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
          <Text style={styles.profileRole}>Administrator</Text>
        </View>

        <Text style={styles.sectionLabel}>{t('settings.account')}</Text>
        <View style={styles.settingsCard}>
          <SettingsRow
            icon={<Mail size={20} color={Colors.textSecondary} />}
            label={t('settings.admin_email')}
            value={user?.email ?? ''}
            showChevron={false}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Lock size={20} color={Colors.accent} />}
            label={t('settings.change_password')}
            onPress={() => router.push('/(drawer)/change-password' as never)}
          />
        </View>

        <Text style={styles.sectionLabel}>{t('settings.preferences')}</Text>
        <View style={styles.settingsCard}>
          <SettingsRow
            icon={<Globe size={20} color={Colors.green} />}
            label={t('settings.language')}
            showChevron={false}
            rightContent={
              <TouchableOpacity
                onPress={toggleLanguage}
                style={styles.langPill}
                activeOpacity={0.7}
              >
                <View style={[styles.langOption, language === 'en' && styles.langOptionActive]}>
                  <Text style={[styles.langOptionText, language === 'en' && styles.langOptionTextActive]}>EN</Text>
                </View>
                <View style={[styles.langOption, language === 'zh' && styles.langOptionActive]}>
                  <Text style={[styles.langOptionText, language === 'zh' && styles.langOptionTextActive]}>繁中</Text>
                </View>
              </TouchableOpacity>
            }
          />
        </View>

        <Text style={styles.sectionLabel}>{t('settings.about')}</Text>
        <View style={styles.settingsCard}>
          <SettingsRow
            icon={<Info size={20} color={Colors.textSecondary} />}
            label={t('settings.app_version')}
            value="1.0.0"
            showChevron={false}
          />
        </View>

        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
            disabled={logoutPending}
          >
            {logoutPending ? (
              <ActivityIndicator size="small" color={Colors.danger} />
            ) : (
              <>
                <LogOut size={20} color={Colors.danger} />
                <Text style={styles.logoutText}>{t('settings.logout')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  profileCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileAvatarText: {
    color: Colors.white,
    fontSize: 26,
    fontWeight: '700' as const,
  },
  profileEmail: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  profileRole: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  settingsCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsRowLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsRowValue: {
    fontSize: 14,
    color: Colors.textTertiary,
    maxWidth: 180,
  },
  dangerText: {
    color: Colors.danger,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 48,
  },
  langPill: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBg,
    borderRadius: 8,
    overflow: 'hidden',
  },
  langOption: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  langOptionActive: {
    backgroundColor: Colors.accent,
    borderRadius: 7,
  },
  langOptionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  langOptionTextActive: {
    color: Colors.white,
  },
  logoutSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dangerLight,
    borderRadius: 14,
    paddingVertical: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
});
