import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import {
  Smartphone,
  ClipboardList,
  Star,
  CalendarCheck,
  Timer,
  ThumbsUp,
  ChevronDown,
  TrendingUp,
  Lightbulb,
  BarChart3,
  FileText,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import ScreenHeader from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { Patient } from '@/types/patient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TimePeriod = '7' | '14' | '30' | '90' | 'all';

interface ExerciseLog {
  id: string;
  patient_id: string;
  exercise_title_en: string;
  exercise_title_zh_hant?: string;
  self_rating: number | null;
  stars_earned: number | null;
  duration_seconds: number | null;
  completed_at: string;
}

interface AppSession {
  id: string;
  patient_id: string;
  duration_seconds: number | null;
  created_at: string;
}

interface QuestionnaireResponse {
  id: string;
  patient_id: string;
  questionnaire_name: string;
  total_score: number | null;
  completed_at: string;
}

interface DashboardStats {
  appSessions: number;
  avgSessionLength: number;
  exerciseLogs: number;
  exercisesPerDay: number;
  avgSelfRating: number;
  starsEarned: number;
  daysActive: number;
  currentStreak: number;
  bestStreak: number;
  totalExerciseTime: number;
}

interface DailyCount {
  date: string;
  count: number;
}

interface ExerciseCount {
  name: string;
  count: number;
}

interface RatingEntry {
  rating: number;
  index: number;
}

function getDateCutoff(period: TimePeriod): string | null {
  if (period === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - parseInt(period, 10));
  return d.toISOString();
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function computeStreaks(dates: string[]): { current: number; best: number } {
  if (dates.length === 0) return { current: 0, best: 0 };
  const unique = [...new Set(dates.map(d => d.slice(0, 10)))].sort().reverse();
  let current = 0;
  let best = 0;
  let streak = 1;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (unique[0] === today || unique[0] === yesterday) {
    current = 1;
  }

  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1]);
    const curr = new Date(unique[i]);
    const diff = (prev.getTime() - curr.getTime()) / 86400000;
    if (diff === 1) {
      streak++;
      if (i <= current || current > 0) {
        current = streak;
      }
    } else {
      best = Math.max(best, streak);
      streak = 1;
      if (current > 0 && current < streak) break;
    }
  }
  best = Math.max(best, streak);
  if (current === 0) current = unique[0] === today || unique[0] === yesterday ? 1 : 0;
  else current = Math.max(current, 1);

  return { current: Math.min(current, best), best };
}

function HorizontalBar({ name, count, maxCount, color }: {
  name: string;
  count: number;
  maxCount: number;
  color: string;
}) {
  const animWidth = useRef(new Animated.Value(0)).current;
  const pct = maxCount > 0 ? count / maxCount : 0;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: pct * 100,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [pct, animWidth]);

  return (
    <View style={hBarStyles.row}>
      <Text style={hBarStyles.name} numberOfLines={1}>{name}</Text>
      <View style={hBarStyles.trackContainer}>
        <View style={hBarStyles.track}>
          <Animated.View
            style={[
              hBarStyles.fill,
              {
                backgroundColor: color,
                width: animWidth.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={hBarStyles.count}>{count}</Text>
      </View>
    </View>
  );
}

const hBarStyles = StyleSheet.create({
  row: {
    marginBottom: 10,
  },
  name: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  trackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flex: 1,
    height: 22,
    backgroundColor: Colors.borderLight,
    borderRadius: 11,
    overflow: 'hidden',
  },
  fill: {
    height: 22,
    borderRadius: 11,
  },
  count: {
    width: 36,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'right',
    marginLeft: 8,
  },
});

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub1?: string;
  sub2?: string;
  color: string;
  delay: number;
}

function StatCard({ icon, label, value, sub1, sub2, color, delay }: StatCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, delay]);

  return (
    <Animated.View
      style={[
        styles.statCard,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={[styles.statIconBg, { backgroundColor: color + '18' }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {(sub1 || sub2) && (
        <View style={styles.statSubRow}>
          {sub1 ? <Text style={styles.statSub}>{sub1}</Text> : null}
          {sub2 ? <Text style={[styles.statSub, { marginLeft: sub1 ? 8 : 0 }]}>{sub2}</Text> : null}
        </View>
      )}
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const { t, language } = useLanguage();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [period, setPeriod] = useState<TimePeriod>('30');
  const [loading, setLoading] = useState(false);

  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [appSessions, setAppSessions] = useState<AppSession[]>([]);
  const [responses, setResponses] = useState<QuestionnaireResponse[]>([]);

  const loadPatients = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('patients')
        .select('*')
        .order('patient_name');
      if (data) setPatients(data);
    } catch (e) {
      console.log('Failed to load patients:', e);
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!selectedPatientId) return;
    setLoading(true);
    const cutoff = getDateCutoff(period);

    try {
      let logsQuery = supabase
        .from('exercise_logs')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('completed_at', { ascending: false });
      if (cutoff) logsQuery = logsQuery.gte('completed_at', cutoff);

      let sessionsQuery = supabase
        .from('app_sessions')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('created_at', { ascending: false });
      if (cutoff) sessionsQuery = sessionsQuery.gte('created_at', cutoff);

      let responsesQuery = supabase
        .from('questionnaire_responses')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('completed_at', { ascending: false })
        .limit(20);

      const [logsRes, sessionsRes, responsesRes] = await Promise.all([
        logsQuery,
        sessionsQuery,
        responsesQuery,
      ]);

      setExerciseLogs(logsRes.data ?? []);
      setAppSessions(sessionsRes.data ?? []);
      setResponses(responsesRes.data ?? []);
    } catch (e) {
      console.log('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedPatientId, period]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    if (selectedPatientId) {
      void loadDashboardData();
    }
  }, [selectedPatientId, loadDashboardData]);

  const selectedPatient = useMemo(
    () => patients.find(p => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const stats: DashboardStats = useMemo(() => {
    const sessionCount = appSessions.length;
    const totalSessionDur = appSessions.reduce((s, a) => s + (a.duration_seconds ?? 0), 0);
    const avgSession = sessionCount > 0 ? totalSessionDur / sessionCount : 0;

    const logCount = exerciseLogs.length;
    const uniqueDates = [...new Set(exerciseLogs.map(l => l.completed_at?.slice(0, 10)).filter(Boolean))];
    const daysActive = uniqueDates.length;
    const days = period === 'all' ? Math.max(daysActive, 1) : parseInt(period, 10);
    const exercisesPerDay = days > 0 ? logCount / days : 0;

    const ratings = exerciseLogs.filter(l => l.self_rating != null).map(l => l.self_rating as number);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    const totalStars = exerciseLogs.reduce((s, l) => s + (l.stars_earned ?? 0), 0);
    const totalTime = exerciseLogs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0);

    const allDates = exerciseLogs.map(l => l.completed_at).filter(Boolean);
    const { current, best } = computeStreaks(allDates);

    return {
      appSessions: sessionCount,
      avgSessionLength: avgSession,
      exerciseLogs: logCount,
      exercisesPerDay,
      avgSelfRating: avgRating,
      starsEarned: totalStars,
      daysActive,
      currentStreak: current,
      bestStreak: best,
      totalExerciseTime: totalTime,
    };
  }, [exerciseLogs, appSessions, period]);

  const dailyActivity: DailyCount[] = useMemo(() => {
    const last14: DailyCount[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = exerciseLogs.filter(l => l.completed_at?.slice(0, 10) === dateStr).length;
      last14.push({ date: dateStr, count });
    }
    return last14;
  }, [exerciseLogs]);

  const topExercises: ExerciseCount[] = useMemo(() => {
    const counts: Record<string, number> = {};
    exerciseLogs.forEach(l => {
      const name = (language === 'zh' && l.exercise_title_zh_hant) ? l.exercise_title_zh_hant : l.exercise_title_en;
      if (name) counts[name] = (counts[name] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [exerciseLogs, language]);

  const ratingTrend: RatingEntry[] = useMemo(() => {
    return exerciseLogs
      .filter(l => l.self_rating != null)
      .slice(0, 20)
      .reverse()
      .map((l, i) => ({ rating: l.self_rating as number, index: i }));
  }, [exerciseLogs]);

  const insights: string[] = useMemo(() => {
    const msgs: string[] = [];
    if (stats.currentStreak >= 3) {
      msgs.push(`🔥 ${t('dashboard.insight_streak_hot')} (${stats.currentStreak} ${t('dashboard.days')})`);
    } else if (stats.daysActive > 0 && stats.currentStreak < 2) {
      msgs.push(`⚠️ ${t('dashboard.insight_streak_broken')}`);
    }
    if (stats.avgSelfRating >= 7) {
      msgs.push(`👍 ${t('dashboard.insight_rating_good')}`);
    } else if (stats.avgSelfRating > 0 && stats.avgSelfRating < 5) {
      msgs.push(`📉 ${t('dashboard.insight_rating_low')}`);
    }
    if (stats.exercisesPerDay < 1 && stats.exerciseLogs > 0) {
      msgs.push(`📋 ${t('dashboard.insight_low_compliance')}`);
    }
    if (topExercises.length > 0) {
      msgs.push(`🏅 ${t('dashboard.insight_most_practiced')}: ${topExercises[0].name} (${topExercises[0].count} ${t('dashboard.exercises_count')})`);
    }
    return msgs;
  }, [stats, topExercises, t]);

  const maxDaily = useMemo(() => Math.max(...dailyActivity.map(d => d.count), 1), [dailyActivity]);
  const maxExercise = useMemo(() => topExercises.length > 0 ? topExercises[0].count : 1, [topExercises]);
  const maxRating = 10;

  const periods: TimePeriod[] = ['7', '14', '30', '90', 'all'];

  const handleSelectPatient = useCallback((id: string) => {
    setSelectedPatientId(id);
    setShowPatientPicker(false);
  }, []);

  const recentLogs = useMemo(() => exerciseLogs.slice(0, 15), [exerciseLogs]);

  const exerciseColors = ['#e07a3a', '#5b8a72', '#6b8cce', '#c47db5', '#d4a44c'];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('dashboard.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.patientSelector}
            onPress={() => setShowPatientPicker(!showPatientPicker)}
            activeOpacity={0.7}
            testID="patient-selector"
          >
            <Text style={styles.patientSelectorText} numberOfLines={1}>
              {selectedPatient ? selectedPatient.patient_name : t('dashboard.select_patient')}
            </Text>
            <ChevronDown size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {showPatientPicker && (
          <View style={styles.pickerDropdown}>
            <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
              {patients.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.pickerItem,
                    p.id === selectedPatientId && styles.pickerItemActive,
                  ]}
                  onPress={() => handleSelectPatient(p.id)}
                >
                  <Text style={[
                    styles.pickerItemText,
                    p.id === selectedPatientId && styles.pickerItemTextActive,
                  ]}>
                    {p.patient_name}
                  </Text>
                  <Text style={styles.pickerItemCode}>{p.access_code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {selectedPatientId && (
          <View style={styles.periodRow}>
            {periods.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                  {p === 'all' ? t('dashboard.all') : t(`dashboard.${p}d`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!selectedPatientId && (
          <View style={styles.emptyState}>
            <BarChart3 size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>{t('dashboard.no_patient')}</Text>
          </View>
        )}

        {selectedPatientId && loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>{t('dashboard.loading')}</Text>
          </View>
        )}

        {selectedPatientId && !loading && (
          <>
            <View style={styles.statsGrid}>
              <StatCard
                icon={<Smartphone size={20} color="#6b8cce" />}
                label={t('dashboard.app_sessions')}
                value={stats.appSessions.toString()}
                sub1={`${formatDuration(stats.avgSessionLength)} ${t('dashboard.avg_session')}`}
                color="#6b8cce"
                delay={0}
              />
              <StatCard
                icon={<ClipboardList size={20} color={Colors.accent} />}
                label={t('dashboard.exercise_logs')}
                value={stats.exerciseLogs.toString()}
                sub1={`${stats.exercisesPerDay.toFixed(1)}${t('dashboard.per_day')}`}
                color={Colors.accent}
                delay={80}
              />
              <StatCard
                icon={<ThumbsUp size={20} color="#5b8a72" />}
                label={t('dashboard.avg_rating')}
                value={stats.avgSelfRating > 0 ? stats.avgSelfRating.toFixed(1) : '—'}
                sub1={stats.avgSelfRating > 0 ? t('dashboard.out_of_10') : undefined}
                color="#5b8a72"
                delay={160}
              />
              <StatCard
                icon={<Star size={20} color="#d4a44c" />}
                label={t('dashboard.stars_earned')}
                value={stats.starsEarned.toString()}
                sub1={t('dashboard.total_stars')}
                color="#d4a44c"
                delay={240}
              />
              <StatCard
                icon={<CalendarCheck size={20} color="#c47db5" />}
                label={t('dashboard.days_active')}
                value={stats.daysActive.toString()}
                sub1={`🔥${stats.currentStreak} ${t('dashboard.streak')}`}
                sub2={`⭐${stats.bestStreak} ${t('dashboard.best')}`}
                color="#c47db5"
                delay={320}
              />
              <StatCard
                icon={<Timer size={20} color="#e07a3a" />}
                label={t('dashboard.exercise_time')}
                value={formatDuration(stats.totalExerciseTime)}
                color="#e07a3a"
                delay={400}
              />
            </View>

            <View style={styles.chartsRow}>
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <TrendingUp size={16} color={Colors.accent} />
                  <Text style={styles.chartTitle}>{t('dashboard.daily_activity')}</Text>
                </View>
                {dailyActivity.length > 0 ? (
                  <View style={styles.verticalBarChart}>
                    {dailyActivity.map((d, i) => {
                      const h = maxDaily > 0 ? (d.count / maxDaily) * 80 : 0;
                      return (
                        <View key={d.date + String(i)} style={styles.verticalBarCol}>
                          <Text style={styles.verticalBarValue}>{d.count > 0 ? d.count : ''}</Text>
                          <View style={[styles.verticalBar, { height: Math.max(h, 2), backgroundColor: d.count > 0 ? Colors.accent : Colors.borderLight }]} />
                          <Text style={styles.verticalBarLabel}>{d.date.slice(8, 10)}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.noDataText}>{t('dashboard.no_data')}</Text>
                )}
              </View>

              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <BarChart3 size={16} color={Colors.green} />
                  <Text style={styles.chartTitle}>{t('dashboard.exercise_breakdown')}</Text>
                </View>
                {topExercises.length > 0 ? (
                  <View>
                    {topExercises.map((ex, i) => (
                      <HorizontalBar
                        key={ex.name}
                        name={ex.name}
                        count={ex.count}
                        maxCount={maxExercise}
                        color={exerciseColors[i % exerciseColors.length]}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noDataText}>{t('dashboard.no_data')}</Text>
                )}
              </View>
            </View>

            <View style={styles.chartsRow}>
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <ThumbsUp size={16} color="#5b8a72" />
                  <Text style={styles.chartTitle}>{t('dashboard.rating_trend')}</Text>
                </View>
                {ratingTrend.length > 0 ? (
                  <View style={styles.ratingChart}>
                    {ratingTrend.map((r, i) => {
                      const h = (r.rating / maxRating) * 70;
                      const barColor = r.rating >= 7 ? '#5b8a72' : r.rating >= 5 ? '#d4a44c' : Colors.danger;
                      return (
                        <View key={i} style={styles.ratingBarCol}>
                          <Text style={styles.ratingBarValue}>{r.rating}</Text>
                          <View style={[styles.ratingBar, { height: Math.max(h, 3), backgroundColor: barColor }]} />
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.noDataText}>{t('dashboard.no_data')}</Text>
                )}
              </View>

              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Lightbulb size={16} color="#d4a44c" />
                  <Text style={styles.chartTitle}>{t('dashboard.clinical_insights')}</Text>
                </View>
                {insights.length > 0 ? (
                  <View style={styles.insightsList}>
                    {insights.map((msg, i) => (
                      <View key={i} style={styles.insightRow}>
                        <Text style={styles.insightText}>{msg}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noDataText}>{t('dashboard.no_data')}</Text>
                )}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <FileText size={16} color="#6b8cce" />
                <Text style={styles.sectionTitle}>{t('dashboard.assessment_history')}</Text>
              </View>
              {responses.length > 0 ? (
                <View style={styles.tableContainer}>
                  <View style={styles.tableHead}>
                    <Text style={[styles.thCell, { flex: 1 }]}>{t('dashboard.date')}</Text>
                    <Text style={[styles.thCell, { flex: 2 }]}>{t('dashboard.name')}</Text>
                    <Text style={[styles.thCell, { flex: 1, textAlign: 'right' as const }]}>{t('dashboard.score')}</Text>
                  </View>
                  {responses.map(r => (
                    <View key={r.id} style={styles.tableRow}>
                      <Text style={[styles.tdCell, { flex: 1 }]}>{r.completed_at?.slice(0, 10) ?? '—'}</Text>
                      <Text style={[styles.tdCell, { flex: 2 }]} numberOfLines={1}>{r.questionnaire_name}</Text>
                      <Text style={[styles.tdCell, styles.tdScore, { flex: 1, textAlign: 'right' as const }]}>
                        {r.total_score ?? '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDataText}>{t('dashboard.no_data')}</Text>
              )}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <ClipboardList size={16} color={Colors.accent} />
                <Text style={styles.sectionTitle}>{t('dashboard.recent_logs')}</Text>
              </View>
              {recentLogs.length > 0 ? (
                <View style={styles.tableContainer}>
                  <View style={styles.tableHead}>
                    <Text style={[styles.thCell, { flex: 1 }]}>{t('dashboard.date')}</Text>
                    <Text style={[styles.thCell, { flex: 2 }]}>{t('dashboard.exercise')}</Text>
                    <Text style={[styles.thCell, { flex: 0.7, textAlign: 'center' as const }]}>{t('dashboard.rating')}</Text>
                    <Text style={[styles.thCell, { flex: 0.7, textAlign: 'center' as const }]}>{t('dashboard.stars')}</Text>
                  </View>
                  {recentLogs.map(l => {
                    const name = (language === 'zh' && l.exercise_title_zh_hant)
                      ? l.exercise_title_zh_hant : l.exercise_title_en;
                    return (
                      <View key={l.id} style={styles.tableRow}>
                        <Text style={[styles.tdCell, { flex: 1 }]}>{l.completed_at?.slice(0, 10) ?? '—'}</Text>
                        <Text style={[styles.tdCell, { flex: 2 }]} numberOfLines={1}>{name}</Text>
                        <Text style={[styles.tdCell, { flex: 0.7, textAlign: 'center' as const }]}>
                          {l.self_rating ?? '—'}
                        </Text>
                        <View style={{ flex: 0.7, alignItems: 'center' as const }}>
                          <View style={styles.starsCell}>
                            <Star size={12} color="#d4a44c" />
                            <Text style={styles.starsCellText}>{l.stars_earned ?? 0}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noDataText}>{t('dashboard.no_data')}</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const cardWidth = (SCREEN_WIDTH - 56 - 12) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  controlsRow: {
    marginBottom: 12,
  },
  patientSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  patientSelectorText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  pickerDropdown: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    maxHeight: 220,
    overflow: 'hidden',
  },
  pickerScroll: {
    paddingVertical: 4,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerItemActive: {
    backgroundColor: Colors.accentLight,
  },
  pickerItemText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  pickerItemTextActive: {
    color: Colors.accent,
    fontWeight: '700' as const,
  },
  pickerItemCode: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: 'monospace',
  },
  periodRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 6,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  periodBtnTextActive: {
    color: Colors.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: cardWidth,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statSubRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  statSub: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  chartsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  chartCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 160,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  verticalBarChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 110,
    paddingTop: 10,
  },
  verticalBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  verticalBarValue: {
    fontSize: 9,
    color: Colors.textTertiary,
    marginBottom: 2,
    fontWeight: '600' as const,
  },
  verticalBar: {
    width: 8,
    borderRadius: 4,
    minHeight: 2,
  },
  verticalBarLabel: {
    fontSize: 9,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  ratingChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
    paddingTop: 8,
  },
  ratingBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  ratingBarValue: {
    fontSize: 8,
    color: Colors.textTertiary,
    marginBottom: 2,
    fontWeight: '600' as const,
  },
  ratingBar: {
    width: 6,
    borderRadius: 3,
    minHeight: 3,
  },
  insightsList: {
    gap: 8,
  },
  insightRow: {
    backgroundColor: Colors.inputBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  insightText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  noDataText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  tableContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  thCell: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tdCell: {
    fontSize: 13,
    color: Colors.text,
  },
  tdScore: {
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  starsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  starsCellText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#d4a44c',
  },
});
