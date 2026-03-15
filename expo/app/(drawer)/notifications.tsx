import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Bell, Check, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import type { Notification, NotificationFormData, NotificationType, NotificationTarget } from '@/types/notification';
import type { Patient } from '@/types/patient';

const NOTIFICATION_TYPES: NotificationType[] = ['announcement', 'festive', 'poster', 'video', 'link'];

const EMPTY_FORM: NotificationFormData = {
  title: '',
  message: '',
  type: 'announcement',
  image_url: '',
  link_url: '',
  target_type: 'all',
  start_date: '',
  end_date: '',
  is_active: true,
  target_patient_ids: [],
};

function getTypeBadgeColor(type: NotificationType): { bg: string; text: string } {
  switch (type) {
    case 'announcement': return { bg: '#e8f0eb', text: '#5b8a72' };
    case 'festive': return { bg: '#fce8e8', text: '#d94f4f' };
    case 'poster': return { bg: '#f5dcc8', text: '#e07a3a' };
    case 'video': return { bg: '#e0e8f5', text: '#4a6fa5' };
    case 'link': return { bg: '#f0e8f5', text: '#7a5ba5' };
    default: return { bg: Colors.borderLight, text: Colors.textSecondary };
  }
}

function getNotifStatus(notif: Notification): 'active' | 'inactive' | 'scheduled' | 'expired' {
  if (!notif.is_active) return 'inactive';
  const now = new Date().toISOString().split('T')[0];
  if (notif.start_date && notif.start_date > now) return 'scheduled';
  if (notif.end_date && notif.end_date < now) return 'expired';
  return 'active';
}

export default function NotificationsScreen() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [formVisible, setFormVisible] = useState(false);
  const [editingNotif, setEditingNotif] = useState<Notification | null>(null);
  const [form, setForm] = useState<NotificationFormData>(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [patientPickerVisible, setPatientPickerVisible] = useState(false);

  const notifsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      console.log('[Notifications] Fetching notifications');
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  const targetsQuery = useQuery({
    queryKey: ['notification_targets'],
    queryFn: async () => {
      console.log('[Notifications] Fetching targets');
      const { data, error } = await supabase
        .from('notification_targets')
        .select('*');
      if (error) throw error;
      return (data ?? []) as NotificationTarget[];
    },
  });

  const patientsQuery = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('patient_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Patient[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: NotificationFormData & { id?: string }) => {
      const row = {
        title: payload.title.trim(),
        message: payload.message.trim() || null,
        type: payload.type,
        image_url: payload.image_url.trim() || null,
        link_url: payload.link_url.trim() || null,
        target_type: payload.target_type,
        start_date: payload.start_date.trim() || null,
        end_date: payload.end_date.trim() || null,
        is_active: payload.is_active,
      };

      let notifId = payload.id;

      if (payload.id) {
        console.log('[Notifications] Updating:', payload.id);
        const { error } = await supabase.from('notifications').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        console.log('[Notifications] Inserting new notification');
        const { data, error } = await supabase.from('notifications').insert(row).select('id').single();
        if (error) throw error;
        notifId = data.id;
      }

      if (notifId) {
        await supabase.from('notification_targets').delete().eq('notification_id', notifId);
        if (payload.target_type === 'specific' && payload.target_patient_ids.length > 0) {
          const targets = payload.target_patient_ids.map((pid) => ({
            notification_id: notifId as string,
            patient_id: pid,
          }));
          const { error: tErr } = await supabase.from('notification_targets').insert(targets);
          if (tErr) throw tErr;
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notification_targets'] });
      setFormVisible(false);
      setEditingNotif(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to save');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[Notifications] Deleting:', id);
      await supabase.from('notification_targets').delete().eq('notification_id', id);
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notification_targets'] });
    },
  });

  const handleAdd = useCallback(() => {
    setEditingNotif(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  }, []);

  const handleEdit = useCallback((notif: Notification) => {
    const notifTargets = (targetsQuery.data ?? []).filter((t) => t.notification_id === notif.id);
    setEditingNotif(notif);
    setForm({
      title: notif.title,
      message: notif.message ?? '',
      type: notif.type,
      image_url: notif.image_url ?? '',
      link_url: notif.link_url ?? '',
      target_type: notif.target_type,
      start_date: notif.start_date ?? '',
      end_date: notif.end_date ?? '',
      is_active: notif.is_active,
      target_patient_ids: notifTargets.map((t) => t.patient_id),
    });
    setFormVisible(true);
  }, [targetsQuery.data]);

  const handleDelete = useCallback((notif: Notification) => {
    Alert.alert(t('notif.delete'), t('notif.delete_confirm'), [
      { text: t('notif.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteMutation.mutate(notif.id) },
    ]);
  }, [t, deleteMutation]);

  const handleSave = useCallback(() => {
    if (!form.title.trim()) {
      Alert.alert('', t('notif.title_required'));
      return;
    }
    saveMutation.mutate({ ...form, id: editingNotif?.id });
  }, [form, editingNotif, saveMutation, t]);

  const updateForm = useCallback((key: keyof NotificationFormData, value: string | boolean | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const togglePatient = useCallback((patientId: string) => {
    setForm((prev) => {
      const ids = prev.target_patient_ids.includes(patientId)
        ? prev.target_patient_ids.filter((id) => id !== patientId)
        : [...prev.target_patient_ids, patientId];
      return { ...prev, target_patient_ids: ids };
    });
  }, []);

  const getTargetLabel = useCallback((notif: Notification) => {
    if (notif.target_type === 'all') return t('notif.target_all');
    const targets = (targetsQuery.data ?? []).filter((t) => t.notification_id === notif.id);
    return `${targets.length} ${t('notif.target_specific').toLowerCase()}`;
  }, [t, targetsQuery.data]);

  const filteredNotifs = useMemo(() => {
    const list = notifsQuery.data ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((n) => n.title.toLowerCase().includes(q) || n.type.includes(q));
  }, [notifsQuery.data, searchQuery]);

  const patients = patientsQuery.data ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('notif.title')} />

      <View style={styles.actionBar}>
        <View style={styles.searchContainer}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('patients.search')}
            placeholderTextColor={Colors.textTertiary}
          />
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.7}>
          <Plus size={16} color={Colors.white} />
          <Text style={styles.primaryBtnText}>{t('notif.add')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={notifsQuery.isRefetching}
            onRefresh={() => {
              void notifsQuery.refetch();
              void targetsQuery.refetch();
            }}
            tintColor={Colors.accent}
          />
        }
      >
        {notifsQuery.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>{t('notif.loading')}</Text>
          </View>
        ) : filteredNotifs.length === 0 ? (
          <View style={styles.centered}>
            <Bell size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>{t('notif.no_notifications')}</Text>
          </View>
        ) : (
          filteredNotifs.map((notif) => {
            const typeBadge = getTypeBadgeColor(notif.type);
            const status = getNotifStatus(notif);
            const statusKey = `notif.status_${status}` as string;
            return (
              <View key={notif.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{notif.title}</Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: typeBadge.bg }]}>
                        <Text style={[styles.badgeText, { color: typeBadge.text }]}>
                          {t(`notif.type_${notif.type}`)}
                        </Text>
                      </View>
                      <View style={[styles.badge, {
                        backgroundColor: status === 'active' ? Colors.greenLight : status === 'scheduled' ? '#e0e8f5' : status === 'expired' ? Colors.dangerLight : Colors.borderLight
                      }]}>
                        <Text style={[styles.badgeText, {
                          color: status === 'active' ? Colors.green : status === 'scheduled' ? '#4a6fa5' : status === 'expired' ? Colors.danger : Colors.textSecondary
                        }]}>
                          {t(statusKey)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                {notif.message ? (
                  <Text style={styles.cardMessage} numberOfLines={2}>{notif.message}</Text>
                ) : null}
                <View style={styles.cardFooter}>
                  <View style={styles.cardMeta}>
                    <Text style={styles.metaText}>{t('notif.target')}: {getTargetLabel(notif)}</Text>
                    {(notif.start_date || notif.end_date) ? (
                      <Text style={styles.metaText}>
                        {t('notif.period')}: {notif.start_date ?? '—'} → {notif.end_date ?? '—'}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => handleEdit(notif)} style={styles.iconBtn}>
                      <Pencil size={15} color={Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(notif)} style={styles.iconBtn}>
                      <Trash2 size={15} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={formVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFormVisible(false)} style={styles.closeBtn}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingNotif ? t('notif.edit') : t('notif.add')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('notif.title_field')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={form.title} onChangeText={(v) => updateForm('title', v)} placeholder={t('notif.title_field')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('notif.message')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={form.message} onChangeText={(v) => updateForm('message', v)} multiline textAlignVertical="top" placeholder={t('notif.message')} placeholderTextColor={Colors.textTertiary} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('notif.type')}</Text>
              <View style={styles.chipRow}>
                {NOTIFICATION_TYPES.map((nt) => (
                  <TouchableOpacity
                    key={nt}
                    style={[styles.chip, form.type === nt && styles.chipActive]}
                    onPress={() => updateForm('type', nt)}
                  >
                    <Text style={[styles.chipText, form.type === nt && styles.chipTextActive]}>
                      {t(`notif.type_${nt}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('notif.image_url')}</Text>
              <TextInput style={styles.input} value={form.image_url} onChangeText={(v) => updateForm('image_url', v)} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('notif.link_url')}</Text>
              <TextInput style={styles.input} value={form.link_url} onChangeText={(v) => updateForm('link_url', v)} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('notif.target')}</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, form.target_type === 'all' && styles.chipActive]}
                  onPress={() => updateForm('target_type', 'all')}
                >
                  <Text style={[styles.chipText, form.target_type === 'all' && styles.chipTextActive]}>
                    {t('notif.target_all')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, form.target_type === 'specific' && styles.chipActive]}
                  onPress={() => updateForm('target_type', 'specific')}
                >
                  <Text style={[styles.chipText, form.target_type === 'specific' && styles.chipTextActive]}>
                    {t('notif.target_specific')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {form.target_type === 'specific' && (
              <View style={styles.fieldGroup}>
                <TouchableOpacity
                  style={styles.selectPatientsBtn}
                  onPress={() => setPatientPickerVisible(true)}
                >
                  <Text style={styles.selectPatientsBtnText}>
                    {t('notif.select_patients')} ({form.target_patient_ids.length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.label}>{t('notif.start_date')}</Text>
                <TextInput style={styles.input} value={form.start_date} onChangeText={(v) => updateForm('start_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.label}>{t('notif.end_date')}</Text>
                <TextInput style={styles.input} value={form.end_date} onChangeText={(v) => updateForm('end_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('notif.is_active')}</Text>
              <Switch
                value={form.is_active}
                onValueChange={(v) => updateForm('is_active', v)}
                trackColor={{ false: Colors.borderLight, true: Colors.greenLight }}
                thumbColor={form.is_active ? Colors.green : Colors.textTertiary}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saveMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saveMutation.isPending}
              activeOpacity={0.8}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{t('notif.save')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={patientPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPatientPickerVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPatientPickerVisible(false)} style={styles.closeBtn}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('notif.select_patients')}</Text>
            <TouchableOpacity onPress={() => setPatientPickerVisible(false)} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>{t('common.confirm')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}>
            {patients.map((p) => {
              const selected = form.target_patient_ids.includes(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.patientOption, selected && styles.patientOptionActive]}
                  onPress={() => togglePatient(p.id)}
                >
                  <View style={styles.patientOptionInfo}>
                    <Text style={styles.patientOptionName}>{p.patient_name}</Text>
                    <Text style={styles.patientOptionCode}>{p.access_code}</Text>
                  </View>
                  {selected && <Check size={18} color={Colors.green} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    marginBottom: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
  cardMessage: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardMeta: {
    flex: 1,
    gap: 2,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
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
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  required: {
    color: Colors.danger,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  chipActive: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  selectPatientsBtn: {
    backgroundColor: Colors.accentLight,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  selectPatientsBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateField: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 20,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  doneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.accent,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  patientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.card,
  },
  patientOptionActive: {
    backgroundColor: Colors.greenLight,
  },
  patientOptionInfo: {
    flex: 1,
  },
  patientOptionName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  patientOptionCode: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
});
