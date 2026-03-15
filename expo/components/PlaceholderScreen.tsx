import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import ScreenHeader from '@/components/ScreenHeader';

interface PlaceholderScreenProps {
  titleKey: string;
  icon: React.ReactNode;
}

export default function PlaceholderScreen({ titleKey, icon }: PlaceholderScreenProps) {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t(titleKey)} />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {icon}
        </View>
        <Text style={styles.title}>{t('placeholder.coming_soon')}</Text>
        <Text style={styles.subtitle}>{t('placeholder.under_development')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
