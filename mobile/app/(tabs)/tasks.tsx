import React, { useState, useMemo } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
  Image,
  useColorScheme,
  StatusBar,
} from 'react-native';
import { RecordScope, TaskDto } from '../../../packages/shared/src';
import { useTasks } from '../../src/hooks/useTasks';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppHeader } from '../../src/components/AppHeader';
import { maskDateTime } from '../../src/utils/format';

const HarryLogo = require('../../assets/harry-logo.png');

// ============================================================================
// SISTEMA DE TEMAS DINÂMICO (LIGHT & DARK MODE - MATERIAL 3 & IOS HIG)
// ============================================================================
export const LightTheme = {
  isDark: false,
  background: '#F8FAFC',        // Off-white suave e refinado
  surface: '#FFFFFF',           // Branco puro para elevação dos cartões
  surfaceElevated: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  textPrimary: '#0F172A',       // Slate profundo para leitura nítida
  textSecondary: '#64748B',     // Slate médio com excelente contraste
  textMuted: '#94A3B8',
  primary: '#0284C7',           // Azul Nexo (harmônico com o logotipo)
  primaryLight: '#E0F2FE',
  primaryDark: '#0369A1',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  inputBg: '#F8FAFC',
  inputBorder: '#CBD5E1',
  tagSharedBg: '#EFF6FF',
  tagSharedText: '#1D4ED8',
  tagPrivateBg: '#F1F5F9',
  tagPrivateText: '#475569',
  cardShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  fabShadow: {
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const DarkTheme = {
  isDark: true,
  background: '#0B0F19',        // Tom escuro profundo
  surface: '#151D2A',           // Cartão elevado em cinza ardósia
  surfaceElevated: '#1E293B',
  surfaceSubtle: '#1A2333',
  border: '#2A3649',
  borderSubtle: '#1E293B',
  textPrimary: '#F8FAFC',       // Branco nítido
  textSecondary: '#94A3B8',     // Cinza neutro legível
  textMuted: '#64748B',
  primary: '#38BDF8',           // Ciano/azul Nexo vibrante
  primaryLight: 'rgba(56, 189, 248, 0.15)',
  primaryDark: '#0284C7',
  success: '#34D399',
  successLight: 'rgba(52, 211, 153, 0.15)',
  warning: '#FBBF24',
  warningLight: 'rgba(251, 191, 36, 0.15)',
  danger: '#F87171',
  dangerLight: 'rgba(248, 113, 113, 0.15)',
  inputBg: '#1A2333',
  inputBorder: '#2A3649',
  tagSharedBg: 'rgba(56, 189, 248, 0.12)',
  tagSharedText: '#7DD3FC',
  tagPrivateBg: 'rgba(148, 163, 184, 0.12)',
  tagPrivateText: '#CBD5E1',
  cardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  fabShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
};

type FilterCategory = 'ALL' | 'PENDING' | 'TODAY' | 'SHARED' | 'COMPLETED';

export default function TasksScreen() {
  const { theme, isDark: isDarkMode } = useTheme();

  // Modais de Criação e Edição
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDto | null>(null);

  // Filtros e Busca
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Estados dos Formulários
  const [title, setTitle] = useState('');
  const [dueDateStr, setDueDateStr] = useState('');
  const [scope, setScope] = useState<RecordScope>(RecordScope.PRIVATE);

  const {
    tasks,
    isLoading,
    createTask,
    isCreating,
    updateTask,
    isUpdating,
    toggleTask,
    deleteTask,
    refetch,
    isRefetching,
  } = useTasks();

  // Presets rápidos para data (ergonomia do polegar no modal)
  const applyQuickPreset = (type: 'TODAY_18' | 'TOMORROW_09' | 'IN_10M' | 'WEEKEND') => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatBr = (d: Date) =>
      `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

    const now = new Date();
    if (type === 'TODAY_18') {
      const d = new Date(now);
      d.setHours(18, 0, 0, 0);
      setDueDateStr(formatBr(d));
    } else if (type === 'TOMORROW_09') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      setDueDateStr(formatBr(d));
    } else if (type === 'IN_10M') {
      const d = new Date(now.getTime() + 10 * 60 * 1000);
      setDueDateStr(formatBr(d));
    } else if (type === 'WEEKEND') {
      const d = new Date(now);
      const diff = (6 - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(10, 0, 0, 0);
      setDueDateStr(formatBr(d));
    }
  };

  const handleOpenCreate = () => {
    setTitle('');
    setDueDateStr('');
    setScope(RecordScope.PRIVATE);
    setCreateModalVisible(true);
  };

  const handleOpenEdit = (task: TaskDto) => {
    setEditingTask(task);
    setTitle(task.title);
    setScope(task.scope);
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      setDueDateStr(`${day}/${month}/${year} ${hours}:${mins}`);
    } else {
      setDueDateStr('');
    }
    setEditModalVisible(true);
  };

  const parseDateTimeInput = (str: string) => {
    const trimmed = str.trim();
    if (!trimmed) return undefined;

    const parts = trimmed.split(' ');
    const dateParts = parts[0].split('/');
    if (dateParts.length !== 3) return undefined;

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);

    let hours = 8;
    let minutes = 0;

    if (parts.length > 1) {
      const timeParts = parts[1].split(':');
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
      }
    }

    const d = new Date(year, month, day, hours, minutes, 0);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Atenção', 'Informe o título do lembrete.');
      return;
    }

    let isoDue: string | undefined = undefined;
    if (dueDateStr.trim()) {
      isoDue = parseDateTimeInput(dueDateStr);
      if (!isoDue) {
        Alert.alert('Data Inválida', 'Use o formato DD/MM/AAAA ou DD/MM/AAAA HH:MM');
        return;
      }
    }

    try {
      await createTask({
        title: title.trim(),
        dueDate: isoDue,
        scope,
      });
      setCreateModalVisible(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o lembrete.');
    }
  };

  const handleUpdate = async () => {
    if (!editingTask) return;
    if (!title.trim()) {
      Alert.alert('Atenção', 'Informe o título do lembrete.');
      return;
    }

    let isoDue: string | undefined = undefined;
    if (dueDateStr.trim()) {
      isoDue = parseDateTimeInput(dueDateStr);
      if (!isoDue) {
        Alert.alert('Data Inválida', 'Use o formato DD/MM/AAAA ou DD/MM/AAAA HH:MM');
        return;
      }
    }

    try {
      await updateTask({
        id: editingTask.id,
        dto: {
          title: title.trim(),
          dueDate: isoDue,
          scope,
        },
      });
      setEditModalVisible(false);
      setEditingTask(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o lembrete.');
    }
  };

  const handleDelete = async (id: string, taskTitle: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Deseja realmente remover o lembrete "${taskTitle}"?`);
      if (confirmed) {
        try {
          await deleteTask(id);
          if (editModalVisible) {
            setEditModalVisible(false);
            setEditingTask(null);
          }
        } catch {
          alert('Não foi possível excluir o lembrete.');
        }
      }
      return;
    }

    Alert.alert('Excluir Lembrete', `Deseja realmente remover "${taskTitle}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(id);
            if (editModalVisible) {
              setEditModalVisible(false);
              setEditingTask(null);
            }
          } catch {
            Alert.alert('Erro', 'Não foi possível excluir o lembrete.');
          }
        },
      },
    ]);
  };

  // Estatísticas para resumo visual no topo
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.isCompleted).length;
    const pending = total - completed;

    const todayDate = new Date();
    const todayTasks = tasks.filter((t) => {
      if (!t.dueDate || t.isCompleted) return false;
      const d = new Date(t.dueDate);
      return (
        d.getDate() === todayDate.getDate() &&
        d.getMonth() === todayDate.getMonth() &&
        d.getFullYear() === todayDate.getFullYear()
      );
    }).length;

    return { total, completed, pending, todayTasks };
  }, [tasks]);

  // Lista filtrada e buscável
  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const todayDate = new Date();

    return tasks.filter((task) => {
      if (query && !task.title.toLowerCase().includes(query)) {
        return false;
      }

      if (activeFilter === 'PENDING') return !task.isCompleted;
      if (activeFilter === 'COMPLETED') return task.isCompleted;
      if (activeFilter === 'SHARED') return task.scope === RecordScope.SHARED;
      if (activeFilter === 'TODAY') {
        if (!task.dueDate) return false;
        const d = new Date(task.dueDate);
        return (
          d.getDate() === todayDate.getDate() &&
          d.getMonth() === todayDate.getMonth() &&
          d.getFullYear() === todayDate.getFullYear()
        );
      }

      return true; // 'ALL'
    });
  }, [tasks, activeFilter, searchQuery]);

  // Helper para badge de prazo formatado
  const getDueStatus = (dueDateStr?: string | null) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    if (isNaN(due.getTime())) return null;

    const now = new Date();
    const isToday =
      due.getDate() === now.getDate() &&
      due.getMonth() === now.getMonth() &&
      due.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      due.getDate() === tomorrow.getDate() &&
      due.getMonth() === tomorrow.getMonth() &&
      due.getFullYear() === tomorrow.getFullYear();

    const isOverdue = due.getTime() < now.getTime() && !isToday;

    const hours = String(due.getHours()).padStart(2, '0');
    const mins = String(due.getMinutes()).padStart(2, '0');
    const hasTime = !(hours === '00' && mins === '00');
    const timeText = hasTime ? ` ${hours}:${mins}` : '';

    if (isOverdue) {
      return {
        text: `Atrasado${timeText} (${due.getDate()}/${due.getMonth() + 1})`,
        color: theme.danger,
        bg: theme.dangerLight,
        icon: '⚠️',
      };
    }
    if (isToday) {
      return {
        text: `Hoje${timeText}`,
        color: theme.warning,
        bg: theme.warningLight,
        icon: '⚡',
      };
    }
    if (isTomorrow) {
      return {
        text: `Amanhã${timeText}`,
        color: theme.primary,
        bg: theme.primaryLight,
        icon: '🗓️',
      };
    }

    return {
      text: `${String(due.getDate()).padStart(2, '0')}/${String(due.getMonth() + 1).padStart(2, '0')}${timeText}`,
      color: theme.textSecondary,
      bg: theme.surfaceSubtle,
      icon: '📅',
    };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <AppHeader title="Harry" subtitle="Rotina & Lembretes" />

      {/* TÍTULO PRINCIPAL (iOS HIG TYPOGRAPHY) & CARDS DE RESUMO */}
      <View style={styles.titleSection}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
              Rotina & Lembretes
            </Text>
            <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>
              Organize tarefas e seus compromissos pessoais ou compartilhados.
            </Text>
          </View>
        </View>

        {/* Resumo em Glances (Métricas rápidas) */}
        <View style={styles.glanceRow}>
          <View style={[styles.glanceCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
            <Text style={[styles.glanceNumber, { color: theme.primary }]}>{stats.pending}</Text>
            <Text style={[styles.glanceLabel, { color: theme.textSecondary }]}>Pendentes</Text>
          </View>
          <View style={[styles.glanceCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
            <Text style={[styles.glanceNumber, { color: theme.warning }]}>{stats.todayTasks}</Text>
            <Text style={[styles.glanceLabel, { color: theme.textSecondary }]}>Para Hoje</Text>
          </View>
          <View style={[styles.glanceCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
            <Text style={[styles.glanceNumber, { color: theme.success }]}>{stats.completed}</Text>
            <Text style={[styles.glanceLabel, { color: theme.textSecondary }]}>Concluídas</Text>
          </View>
        </View>
      </View>

      {/* BARRA DE PESQUISA MODERNA */}
      <View style={styles.searchSection}>
        <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Buscar lembrete..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: theme.textPrimary }]}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* FILTROS SEGMENTADOS ERGONÔMICOS (SCROLL HORIZONTAL TOUCH-FRIENDLY) */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {[
            { id: 'ALL', label: 'Todas', badge: stats.total },
            { id: 'PENDING', label: 'Pendentes', badge: stats.pending },
            { id: 'TODAY', label: 'Hoje', badge: stats.todayTasks },
            { id: 'SHARED', label: '🏠 Casa' },
            { id: 'COMPLETED', label: '✓ Feitas', badge: stats.completed },
          ].map((item) => {
            const isActive = activeFilter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? theme.primary : theme.surface,
                    borderColor: isActive ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setActiveFilter(item.id as FilterCategory)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isActive ? '#FFFFFF' : theme.textSecondary,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {item.label}
                </Text>
                {item.badge !== undefined && (
                  <View
                    style={[
                      styles.filterBadge,
                      {
                        backgroundColor: isActive
                          ? 'rgba(255, 255, 255, 0.25)'
                          : theme.surfaceSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterBadgeText,
                        { color: isActive ? '#FFFFFF' : theme.textSecondary },
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* LISTA DE TAREFAS */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              {searchQuery ? 'Nenhum resultado encontrado' : 'Nenhuma tarefa pendente'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {searchQuery
                ? 'Tente buscar com outros termos.'
                : 'Você está em dia com suas tarefas! Envie um áudio no WhatsApp ou toque abaixo para criar.'}
            </Text>
            <TouchableOpacity
              style={[styles.emptyActionBtn, { backgroundColor: theme.primary }]}
              onPress={handleOpenCreate}
            >
              <Text style={styles.emptyActionBtnText}>+ Criar Primeiro Lembrete</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const dueStatus = getDueStatus(item.dueDate);
          const isShared = item.scope === RecordScope.SHARED;

          return (
            <View
              style={[
                styles.taskCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: item.isCompleted ? theme.borderSubtle : theme.border,
                },
                theme.cardShadow,
                item.isCompleted && styles.taskCardCompleted,
              ]}
            >
              {/* Checkbox Ergonômico de Grande Área de Toque */}
              <TouchableOpacity
                style={[
                  styles.checkboxTouchTarget,
                  {
                    borderColor: item.isCompleted ? theme.success : theme.border,
                    backgroundColor: item.isCompleted ? theme.success : 'transparent',
                  },
                ]}
                onPress={() => toggleTask(item.id)}
                activeOpacity={0.7}
              >
                {item.isCompleted && <Text style={styles.checkmarkIcon}>✓</Text>}
              </TouchableOpacity>

              {/* Informações da Tarefa */}
              <TouchableOpacity
                style={styles.taskContent}
                activeOpacity={0.8}
                onPress={() => toggleTask(item.id)}
              >
                <Text
                  style={[
                    styles.taskTitle,
                    { color: item.isCompleted ? theme.textMuted : theme.textPrimary },
                    item.isCompleted && styles.taskTitleCompleted,
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>

                <View style={styles.tagRow}>
                  {/* Escopo da Tarefa */}
                  <View
                    style={[
                      styles.scopePill,
                      {
                        backgroundColor: isShared ? theme.tagSharedBg : theme.tagPrivateBg,
                      },
                    ]}
                  >
                    <Text style={styles.scopePillIcon}>{isShared ? '🏠' : '🔒'}</Text>
                    <Text
                      style={[
                        styles.scopePillText,
                        { color: isShared ? theme.tagSharedText : theme.tagPrivateText },
                      ]}
                    >
                      {isShared ? 'Casa' : 'Pessoal'}
                    </Text>
                  </View>

                  {/* Badge de Prazo / Horário */}
                  {dueStatus && (
                    <View style={[styles.duePill, { backgroundColor: dueStatus.bg }]}>
                      <Text style={styles.duePillIcon}>{dueStatus.icon}</Text>
                      <Text style={[styles.duePillText, { color: dueStatus.color }]}>
                        {dueStatus.text}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* Botões de Ação Rápidos (Editar e Excluir) */}
              <View style={styles.actionButtonsCol}>
                <TouchableOpacity
                  style={[styles.quickActionBtn, { backgroundColor: theme.surfaceSubtle }]}
                  onPress={() => handleOpenEdit(item)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13 }}>✏️</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickActionBtn, { backgroundColor: theme.surfaceSubtle }]}
                  onPress={() => handleDelete(item.id, item.title)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* FAB FLUTUANTE NA ZONA NATURAL DO POLEGAR (THUMB-ZONE ERGONOMICS) */}
      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: theme.primary }, theme.fabShadow]}
        onPress={handleOpenCreate}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>＋</Text>
        <Text style={styles.fabText}>Novo Lembrete</Text>
      </TouchableOpacity>

      {/* ==================================================================== */}
      {/* MODAL DE CRIAÇÃO (BOTTOM SHEET STYLE - IOS HIG)                     */}
      {/* ==================================================================== */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            {/* Handle do Bottom Sheet */}
            <View style={styles.sheetHandleContainer}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalHeading, { color: theme.textPrimary }]}>
                Novo Lembrete
              </Text>
              <TouchableOpacity
                onPress={() => setCreateModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseBtnText, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Campo do Título */}
              <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
                O que você precisa fazer ou lembrar?
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Ex: Pagar fatura de energia, comprar café..."
                placeholderTextColor={theme.textMuted}
                value={title}
                onChangeText={setTitle}
                autoFocus
              />

              {/* Campo de Data e Horário */}
              <Text style={[styles.fieldLabel, { color: theme.textPrimary, marginTop: 16 }]}>
                Data e Horário (Opcional)
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="DD/MM/AAAA ou DD/MM/AAAA HH:MM"
                placeholderTextColor={theme.textMuted}
                value={dueDateStr}
                onChangeText={(t) => setDueDateStr(maskDateTime(t))}
                keyboardType="numeric"
                maxLength={16}
              />

              {/* Presets Rápidos de Data (1 toque com o polegar) */}
              <View style={styles.presetsContainer}>
                <Text style={[styles.presetsLabel, { color: theme.textSecondary }]}>
                  Atalhos Rápidos:
                </Text>
                <View style={styles.presetChipsRow}>
                  <TouchableOpacity
                    style={[styles.presetChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                    onPress={() => applyQuickPreset('TODAY_18')}
                  >
                    <Text style={[styles.presetChipText, { color: theme.textPrimary }]}>Hoje 18h</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                    onPress={() => applyQuickPreset('TOMORROW_09')}
                  >
                    <Text style={[styles.presetChipText, { color: theme.textPrimary }]}>Amanhã 09h</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                    onPress={() => applyQuickPreset('IN_10M')}
                  >
                    <Text style={[styles.presetChipText, { color: theme.textPrimary }]}>+10 min</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                    onPress={() => applyQuickPreset('WEEKEND')}
                  >
                    <Text style={[styles.presetChipText, { color: theme.textPrimary }]}>Sábado 10h</Text>
                  </TouchableOpacity>

                  {dueDateStr ? (
                    <TouchableOpacity
                      style={[styles.presetChip, { backgroundColor: theme.dangerLight, borderColor: 'transparent' }]}
                      onPress={() => setDueDateStr('')}
                    >
                      <Text style={[styles.presetChipText, { color: theme.danger }]}>✕ Limpar Data</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Seletor de Escopo (Privado por Padrão) */}
              <Text style={[styles.fieldLabel, { color: theme.textPrimary, marginTop: 18 }]}>
                Escopo do Lembrete
              </Text>
              <View style={styles.scopeSelector}>
                <TouchableOpacity
                  style={[
                    styles.scopeCardOption,
                    {
                      backgroundColor: scope === RecordScope.PRIVATE ? theme.primaryLight : theme.surfaceSubtle,
                      borderColor: scope === RecordScope.PRIVATE ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.PRIVATE)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.scopeCardEmoji}>🔒</Text>
                  <View style={styles.scopeCardTexts}>
                    <Text
                      style={[
                        styles.scopeCardTitle,
                        { color: scope === RecordScope.PRIVATE ? theme.primary : theme.textPrimary },
                      ]}
                    >
                      Lembrete Pessoal
                    </Text>
                    <Text style={[styles.scopeCardDesc, { color: theme.textSecondary }]}>
                      Visível apenas por você (Padrão)
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeCardOption,
                    {
                      backgroundColor: scope === RecordScope.SHARED ? theme.primaryLight : theme.surfaceSubtle,
                      borderColor: scope === RecordScope.SHARED ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.SHARED)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.scopeCardEmoji}>🏠</Text>
                  <View style={styles.scopeCardTexts}>
                    <Text
                      style={[
                        styles.scopeCardTitle,
                        { color: scope === RecordScope.SHARED ? theme.primary : theme.textPrimary },
                      ]}
                    >
                      Lembrete compartilhado
                    </Text>
                    <Text style={[styles.scopeCardDesc, { color: theme.textSecondary }]}>
                      Compartilhado com o par / lar
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Botão de Salvar Lembrete */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: theme.primary },
                  isCreating && { opacity: 0.7 },
                ]}
                onPress={handleCreate}
                disabled={isCreating}
                activeOpacity={0.85}
              >
                <Text style={styles.submitButtonText}>
                  {isCreating ? 'Salvando...' : 'Salvar Lembrete'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL DE EDIÇÃO                                                      */}
      {/* ==================================================================== */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.sheetHandleContainer}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalHeading, { color: theme.textPrimary }]}>
                Editar Lembrete
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setEditModalVisible(false);
                  setEditingTask(null);
                }}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseBtnText, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
                Título do Lembrete
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary,
                  },
                ]}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={[styles.fieldLabel, { color: theme.textPrimary, marginTop: 16 }]}>
                Data e Horário (DD/MM/AAAA ou DD/MM/AAAA HH:MM)
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="DD/MM/AAAA ou DD/MM/AAAA HH:MM"
                placeholderTextColor={theme.textMuted}
                value={dueDateStr}
                onChangeText={(t) => setDueDateStr(maskDateTime(t))}
                keyboardType="numeric"
                maxLength={16}
              />

              {/* Atalhos Rápidos */}
              <View style={styles.presetsContainer}>
                <View style={styles.presetChipsRow}>
                  <TouchableOpacity
                    style={[styles.presetChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                    onPress={() => applyQuickPreset('TODAY_18')}
                  >
                    <Text style={[styles.presetChipText, { color: theme.textPrimary }]}>Hoje 18h</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.presetChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                    onPress={() => applyQuickPreset('TOMORROW_09')}
                  >
                    <Text style={[styles.presetChipText, { color: theme.textPrimary }]}>Amanhã 09h</Text>
                  </TouchableOpacity>
                  {dueDateStr ? (
                    <TouchableOpacity
                      style={[styles.presetChip, { backgroundColor: theme.dangerLight, borderColor: 'transparent' }]}
                      onPress={() => setDueDateStr('')}
                    >
                      <Text style={[styles.presetChipText, { color: theme.danger }]}>✕ Limpar Data</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textPrimary, marginTop: 18 }]}>
                Escopo do Lembrete
              </Text>
              <View style={styles.scopeSelector}>
                <TouchableOpacity
                  style={[
                    styles.scopeCardOption,
                    {
                      backgroundColor: scope === RecordScope.PRIVATE ? theme.primaryLight : theme.surfaceSubtle,
                      borderColor: scope === RecordScope.PRIVATE ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.PRIVATE)}
                >
                  <Text style={styles.scopeCardEmoji}>🔒</Text>
                  <View style={styles.scopeCardTexts}>
                    <Text
                      style={[
                        styles.scopeCardTitle,
                        { color: scope === RecordScope.PRIVATE ? theme.primary : theme.textPrimary },
                      ]}
                    >
                      Lembrete Pessoal
                    </Text>
                    <Text style={[styles.scopeCardDesc, { color: theme.textSecondary }]}>
                      Individual
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeCardOption,
                    {
                      backgroundColor: scope === RecordScope.SHARED ? theme.primaryLight : theme.surfaceSubtle,
                      borderColor: scope === RecordScope.SHARED ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.SHARED)}
                >
                  <Text style={styles.scopeCardEmoji}>🏠</Text>
                  <View style={styles.scopeCardTexts}>
                    <Text
                      style={[
                        styles.scopeCardTitle,
                        { color: scope === RecordScope.SHARED ? theme.primary : theme.textPrimary },
                      ]}
                    >
                      Lembrete compartilhado
                    </Text>
                    <Text style={[styles.scopeCardDesc, { color: theme.textSecondary }]}>
                      Compartilhado
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: theme.primary },
                  isUpdating && { opacity: 0.7 },
                ]}
                onPress={handleUpdate}
                disabled={isUpdating}
              >
                <Text style={styles.submitButtonText}>
                  {isUpdating ? 'Atualizando...' : 'Atualizar Lembrete'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS MODERNOS (MATERIAL 3 & IOS HIG - ALTA ERGONOMIA)
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  brandMeta: {
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandCaption: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: -1,
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  themeToggleIcon: {
    fontSize: 13,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 4,
  },
  glanceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  glanceCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  glanceNumber: {
    fontSize: 22,
    fontWeight: '800',
  },
  glanceLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  clearSearchBtn: {
    padding: 6,
  },
  filterSection: {
    paddingVertical: 8,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
  },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100, // Espaço seguro para o FAB flutuante
    gap: 12,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  taskCardCompleted: {
    opacity: 0.6,
  },
  checkboxTouchTarget: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkmarkIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  taskContent: {
    flex: 1,
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  scopePillIcon: {
    fontSize: 10,
  },
  scopePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  duePillIcon: {
    fontSize: 10,
  },
  duePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtonsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 10,
  },
  quickActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  emptyActionBtn: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Estilos do Modal Bottom Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 38,
    height: 5,
    borderRadius: 3,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  presetsContainer: {
    marginTop: 10,
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scopeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  scopeCardOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  scopeCardEmoji: {
    fontSize: 20,
  },
  scopeCardTexts: {
    flex: 1,
  },
  scopeCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  scopeCardDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 40,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
