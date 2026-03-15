import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import {
  Users,
  BarChart3,
  LayoutGrid,
  Music,
  PlayCircle,
  Coffee,
  CheckSquare,
  Grid3x3,
  Bell,
  Building2,
  UserPlus,
  ImageIcon,
  Settings,
  Briefcase,
  Flower2,
  LogOut,
  Globe,
  X,
  MessageCircle,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useDrawer } from '@/providers/DrawerProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';

const SIDEBAR_WIDTH = 280;

interface NavItem {
  key: string;
  route: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  translationKey: string;
}

const navItems: NavItem[] = [
  { key: 'patients', route: '/', icon: Users, translationKey: 'nav.patients' },
  { key: 'exercise-library', route: '/exercise-library', icon: BarChart3, translationKey: 'nav.exercise_library' },
  { key: 'programs', route: '/programs', icon: LayoutGrid, translationKey: 'nav.programs' },
  { key: 'reinforcement-audio', route: '/reinforcement-audio', icon: Music, translationKey: 'nav.reinforcement_audio' },
  { key: 'knowledge-videos', route: '/knowledge-videos', icon: PlayCircle, translationKey: 'nav.knowledge_videos' },
  { key: 'feeding-skills', route: '/feeding-skills', icon: Coffee, translationKey: 'nav.feeding_skills' },
  { key: 'assessments', route: '/assessments', icon: CheckSquare, translationKey: 'nav.assessments' },
  { key: 'dashboard', route: '/dashboard', icon: Grid3x3, translationKey: 'nav.dashboard' },
  { key: 'notifications', route: '/notifications', icon: Bell, translationKey: 'nav.notifications' },
  { key: 'organisations', route: '/organisations', icon: Building2, translationKey: 'nav.organisations' },
  { key: 'clinicians', route: '/clinicians', icon: UserPlus, translationKey: 'nav.clinicians' },
  { key: 'splash-ads', route: '/splash-ads', icon: ImageIcon, translationKey: 'nav.splash_ads' },
  { key: 'therapist-settings', route: '/therapist-settings', icon: Settings, translationKey: 'nav.therapist_settings' },
  { key: 'managing-organisation', route: '/managing-organisation', icon: Briefcase, translationKey: 'nav.managing_organisation' },
  { key: 'flower-garden', route: '/flower-garden', icon: Flower2, translationKey: 'nav.flower_garden' },
];

function isRouteActive(pathname: string, route: string): boolean {
  if (route === '/') {
    return pathname === '/' || pathname === '';
  }
  return pathname === route || pathname.startsWith(route + '/');
}

export default function Sidebar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, closeDrawer } = useDrawer();
  const { t, language, toggleLanguage } = useLanguage();
  const { logout, logoutPending, user } = useAuth();

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, slideAnim, overlayAnim]);

  const handleNavPress = useCallback((route: string) => {
    closeDrawer();
    setTimeout(() => {
      if (route === '/') {
        router.replace('/');
      } else {
        router.replace(route as never);
      }
    }, 50);
  }, [closeDrawer, router]);

  const handleLogout = useCallback(() => {
    closeDrawer();
    Alert.alert(
      t('settings.logout'),
      t('settings.logout_confirm'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.confirm'),
          style: 'destructive',
          onPress: () => { void logout(); },
        },
      ]
    );
  }, [closeDrawer, t, logout]);

  const handleSettingsPress = useCallback(() => {
    closeDrawer();
    setTimeout(() => {
      router.replace('/settings' as never);
    }, 50);
  }, [closeDrawer, router]);

  if (!isOpen) return null;

  const adminEmail = user?.email ?? '';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.overlay,
          { opacity: overlayAnim },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={closeDrawer}
          activeOpacity={1}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                <MessageCircle size={20} color={Colors.white} />
              </View>
              <View>
                <Text style={styles.logoTitle}>SLP Jason</Text>
                <Text style={styles.logoSubtitle}>{t('app.subtitle')}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={closeDrawer} style={styles.closeButton} activeOpacity={0.7}>
              <X size={20} color="#9a958e" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.navList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.navListContent}
        >
          {navItems.map((item) => {
            const active = isRouteActive(pathname, item.route);
            const IconComponent = item.icon;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => handleNavPress(item.route)}
                activeOpacity={0.7}
                testID={`nav-${item.key}`}
              >
                <IconComponent
                  size={20}
                  color={active ? Colors.accent : '#8a857e'}
                />
                <Text style={[styles.navItemLabel, active && styles.navItemLabelActive]}>
                  {t(item.translationKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerDivider} />

          <View style={styles.langRow}>
            <Globe size={16} color="#8a857e" />
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
          </View>

          <TouchableOpacity
            style={[styles.navItem, isRouteActive(pathname, '/settings') && styles.navItemActive]}
            onPress={handleSettingsPress}
            activeOpacity={0.7}
          >
            <Settings size={20} color={isRouteActive(pathname, '/settings') ? Colors.accent : '#8a857e'} />
            <Text style={[styles.navItemLabel, isRouteActive(pathname, '/settings') && styles.navItemLabelActive]}>
              {t('nav.settings')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutRow}
            onPress={handleLogout}
            disabled={logoutPending}
            activeOpacity={0.7}
          >
            <LogOut size={18} color={Colors.danger} />
            <Text style={styles.logoutText}>{t('settings.logout')}</Text>
          </TouchableOpacity>

          <Text style={styles.emailText} numberOfLines={1}>{adminEmail}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 100,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#2e2a25',
    zIndex: 101,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
      web: {
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
    }),
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#f0ebe4',
    letterSpacing: -0.3,
  },
  logoSubtitle: {
    fontSize: 11,
    color: '#8a857e',
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#3a3530',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navList: {
    flex: 1,
    marginTop: 8,
  },
  navListContent: {
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: '#3d3731',
  },
  navItemLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#c5bfb6',
  },
  navItemLabelActive: {
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  footer: {
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  footerDivider: {
    height: 1,
    backgroundColor: '#3d3731',
    marginHorizontal: 6,
    marginBottom: 10,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  langPill: {
    flexDirection: 'row',
    backgroundColor: '#3a3530',
    borderRadius: 7,
    overflow: 'hidden',
  },
  langOption: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  langOptionActive: {
    backgroundColor: Colors.accent,
    borderRadius: 6,
  },
  langOptionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#8a857e',
  },
  langOptionTextActive: {
    color: Colors.white,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.danger,
  },
  emailText: {
    fontSize: 11,
    color: '#6a655e',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
});
