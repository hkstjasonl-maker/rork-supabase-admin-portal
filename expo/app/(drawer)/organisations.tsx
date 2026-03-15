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
  Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Building2, Globe, Handshake, Heart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import type { Organisation, OrganisationFormData, OrganisationType } from '@/types/organisation';

const EMPTY_FORM: OrganisationFormData = {
  name_en: '',
  name_zh: '',
  type: 'partner',
  logo_url: '',
  website: '',
  description_en: '',
  description_zh: '',
  is_active: true,
  sort_order: '0',
};

export default function OrganisationsScreen() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<OrganisationType>('partner');
  const [formVisible, setFormVisible] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);
  const [form, setForm] = useState<OrganisationFormData>(EMPTY_FORM);

  const orgsQuery = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      console.log('[Organisations] Fetching organisations');
      const { data, error } = await supabase
        .from('organisations')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Organisation[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: OrganisationFormData & { id?: string }) => {
      const row = {
        name_en: payload.name_en.trim(),
        name_zh: payload.name_zh.trim() || null,
        type: payload.type,
        logo_url: payload.logo_url.trim() || null,
        website: payload.website.trim() || null,
        description_en: payload.description_en.trim() || null,
        description_zh: payload.description_zh.trim() || null,
        is_active: payload.is_active,
        sort_order: parseInt(payload.sort_order, 10) || 0,
      };
      if (payload.id) {
        console.log('[Organisations] Updating:', payload.id);
        const { error } = await supabase.from('organisations').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        console.log('[Organisations] Inserting new organisation');
        const { error } = await supabase.from('organisations').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organisations'] });
      setFormVisible(false);
      setEditingOrg(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to save');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[Organisations] Deleting:', id);
      const { error } = await supabase.from('organisations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organisations'] });
    },
  });

  const handleAdd = useCallback(() => {
    setEditingOrg(null);
    setForm({ ...EMPTY_FORM, type: activeTab });
    setFormVisible(true);
  }, [activeTab]);

  const handleEdit = useCallback((org: Organisation) => {
    setEditingOrg(org);
    setForm({
      name_en: org.name_en,
      name_zh: org.name_zh ?? '',
      type: org.type,
      logo_url: org.logo_url ?? '',
      website: org.website ?? '',
      description_en: org.description_en ?? '',
      description_zh: org.description_zh ?? '',
      is_active: org.is_active,
      sort_order: String(org.sort_order),
    });
    setFormVisible(true);
  }, []);

  const handleDelete = useCallback((org: Organisation) => {
    Alert.alert(t('org.delete'), t('org.delete_confirm'), [
      { text: t('org.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteMutation.mutate(org.id) },
    ]);
  }, [t, deleteMutation]);

  const handleSave = useCallback(() => {
    if (!form.name_en.trim()) {
      Alert.alert('', t('org.name_required'));
      return;
    }
    saveMutation.mutate({ ...form, id: editingOrg?.id });
  }, [form, editingOrg, saveMutation, t]);

  const updateForm = useCallback((key: keyof OrganisationFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const getName = useCallback((org: Organisation) => {
    if (language === 'zh' && org.name_zh) return org.name_zh;
    return org.name_en;
  }, [language]);

  const filteredOrgs = useMemo(() => {
    return (orgsQuery.data ?? []).filter((o) => o.type === activeTab);
  }, [orgsQuery.data, activeTab]);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('org.title')} />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'partner' && styles.tabActive]}
          onPress={() => setActiveTab('partner')}
          activeOpacity={0.7}
        >
          <Handshake size={14} color={activeTab === 'partner' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'partner' && styles.tabTextActive]}>{t('org.partners')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'supporter' && styles.tabActive]}
          onPress={() => setActiveTab('supporter')}
          activeOpacity={0.7}
        >
          <Heart size={14} color={activeTab === 'supporter' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'supporter' && styles.tabTextActive]}>{t('org.supporters')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={orgsQuery.isRefetching}
            onRefresh={() => { void orgsQuery.refetch(); }}
            tintColor={Colors.accent}
          />
        }
      >
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.7}>
            <Plus size={16} color={Colors.white} />
            <Text style={styles.primaryBtnText}>{t('org.add')}</Text>
          </TouchableOpacity>
        </View>

        {orgsQuery.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>{t('org.loading')}</Text>
          </View>
        ) : filteredOrgs.length === 0 ? (
          <View style={styles.centered}>
            <Building2 size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>{t('org.no_organisations')}</Text>
          </View>
        ) : (
          filteredOrgs.map((org) => (
            <View key={org.id} style={styles.card}>
              <View style={styles.cardRow}>
                {org.logo_url ? (
                  <Image source={{ uri: org.logo_url }} style={styles.logo} resizeMode="contain" />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Building2 size={24} color={Colors.textTertiary} />
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>{getName(org)}</Text>
                  {org.name_zh && language === 'en' ? (
                    <Text style={styles.cardSubName} numberOfLines={1}>{org.name_zh}</Text>
                  ) : org.name_en && language === 'zh' ? (
                    <Text style={styles.cardSubName} numberOfLines={1}>{org.name_en}</Text>
                  ) : null}
                  {org.website ? (
                    <View style={styles.websiteRow}>
                      <Globe size={12} color={Colors.textTertiary} />
                      <Text style={styles.websiteText} numberOfLines={1}>{org.website}</Text>
                    </View>
                  ) : null}
                  <View style={styles.statusRow}>
                    <View style={[styles.statusBadge, { backgroundColor: org.is_active ? Colors.greenLight : Colors.dangerLight }]}>
                      <Text style={[styles.statusBadgeText, { color: org.is_active ? Colors.green : Colors.danger }]}>
                        {org.is_active ? t('notif.status_active') : t('notif.status_inactive')}
                      </Text>
                    </View>
                    <Text style={styles.sortText}>#{org.sort_order}</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => handleEdit(org)} style={styles.iconBtn}>
                    <Pencil size={15} color={Colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(org)} style={styles.iconBtn}>
                    <Trash2 size={15} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={formVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFormVisible(false)} style={styles.closeBtn}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingOrg ? t('org.edit') : t('org.add')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('org.name_en')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={form.name_en} onChangeText={(v) => updateForm('name_en', v)} placeholder={t('org.name_en')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('org.name_zh')}</Text>
              <TextInput style={styles.input} value={form.name_zh} onChangeText={(v) => updateForm('name_zh', v)} placeholder={t('org.name_zh')} placeholderTextColor={Colors.textTertiary} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('org.type')}</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, form.type === 'partner' && styles.chipActive]}
                  onPress={() => updateForm('type', 'partner')}
                >
                  <Text style={[styles.chipText, form.type === 'partner' && styles.chipTextActive]}>
                    {t('org.type_partner')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, form.type === 'supporter' && styles.chipActive]}
                  onPress={() => updateForm('type', 'supporter')}
                >
                  <Text style={[styles.chipText, form.type === 'supporter' && styles.chipTextActive]}>
                    {t('org.type_supporter')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('org.logo_url')}</Text>
              <TextInput style={styles.input} value={form.logo_url} onChangeText={(v) => updateForm('logo_url', v)} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('org.website')}</Text>
              <TextInput style={styles.input} value={form.website} onChangeText={(v) => updateForm('website', v)} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('org.desc_en')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={form.description_en} onChangeText={(v) => updateForm('description_en', v)} multiline textAlignVertical="top" placeholder={t('org.desc_en')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('org.desc_zh')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={form.description_zh} onChangeText={(v) => updateForm('description_zh', v)} multiline textAlignVertical="top" placeholder={t('org.desc_zh')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('org.sort_order')}</Text>
              <TextInput style={styles.input} value={form.sort_order} onChangeText={(v) => updateForm('sort_order', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textTertiary} />
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('org.is_active')}</Text>
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
                <Text style={styles.saveBtnText}>{t('org.save')}</Text>
              )}
            </TouchableOpacity>
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
    backgroundColor: Colors.background,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tabActive: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.accent,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
  },
  logoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cardSubName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  websiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  websiteText: {
    fontSize: 12,
    color: Colors.textTertiary,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
  sortText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  cardActions: {
    flexDirection: 'column',
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
    minHeight: 70,
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
});
