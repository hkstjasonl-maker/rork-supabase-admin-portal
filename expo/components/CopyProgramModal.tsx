import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, UserRound, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import type { Patient } from '@/types/patient';
import type { ProgramExercise, ExerciseProgram } from '@/types/program';

interface CopyProgramModalProps {
  visible: boolean;
  onClose: () => void;
  onCopy: (exercises: ProgramExercise[], program: ExerciseProgram) => void;
  excludePatientId: string;
}

export default function CopyProgramModal({
  visible,
  onClose,
  onCopy,
  excludePatientId,
}: CopyProgramModalProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const filteredPatients = (patientsQuery.data ?? []).filter(
    (p) => p.id !== excludePatientId
  );

  const handleCopy = useCallback(async () => {
    if (!selectedPatientId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      console.log('[CopyProgram] Fetching program for patient:', selectedPatientId);
      const { data: programs, error: progError } = await supabase
        .from('exercise_programs')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (progError) throw progError;
      if (!programs || programs.length === 0) {
        setErrorMsg(t('program.no_program_to_copy'));
        setLoading(false);
        return;
      }

      const program = programs[0] as ExerciseProgram;

      const { data: exercises, error: exError } = await supabase
        .from('exercises')
        .select('*')
        .eq('program_id', program.id)
        .order('sort_order', { ascending: true });

      if (exError) throw exError;

      console.log('[CopyProgram] Copied', (exercises ?? []).length, 'exercises');
      onCopy((exercises ?? []) as ProgramExercise[], program);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to copy program';
      console.error('[CopyProgram] Error:', message);
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }, [selectedPatientId, onCopy, t]);

  const renderPatient = useCallback(({ item }: { item: Patient }) => {
    const isSelected = item.id === selectedPatientId;
    return (
      <TouchableOpacity
        style={[styles.patientItem, isSelected && styles.patientItemSelected]}
        onPress={() => setSelectedPatientId(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.patientAvatar}>
          <UserRound size={16} color={isSelected ? Colors.white : Colors.accent} />
        </View>
        <View style={styles.patientInfo}>
          <Text style={[styles.patientName, isSelected && styles.patientNameSelected]}>
            {item.patient_name}
          </Text>
          <Text style={styles.patientCode}>{item.access_code}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkCircle}>
            <Check size={14} color={Colors.white} />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedPatientId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('program.copy_title')}</Text>
          <View style={styles.closeBtn} />
        </View>

        <Text style={styles.subtitle}>{t('program.copy_select')}</Text>

        {patientsQuery.isLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={styles.loader} />
        ) : (
          <FlatList
            data={filteredPatients}
            renderItem={renderPatient}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.copyBtn, (!selectedPatientId || loading) && styles.copyBtnDisabled]}
            onPress={handleCopy}
            disabled={!selectedPatientId || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.copyBtnText}>{t('program.copy_confirm')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  patientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  patientItemSelected: {
    borderColor: Colors.accent,
    backgroundColor: '#fef6f0',
  },
  patientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  patientNameSelected: {
    color: Colors.accent,
  },
  patientCode: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.card,
  },
  copyBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  copyBtnDisabled: {
    opacity: 0.5,
  },
  copyBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
