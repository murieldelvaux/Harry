import React, { useState } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { ScopeBadge } from '../../src/components/ScopeBadge';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';
import { useGoals } from '../../src/hooks/useGoals';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppHeader } from '../../src/components/AppHeader';
import { formatCurrency, formatDate, maskCurrency, unmaskCurrency, maskDate } from '../../src/utils/format';
import { RecordScope, GoalDto } from '../../../packages/shared/src';

export default function GoalsScreen() {
  const { theme, isDark } = useTheme();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<GoalDto | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [scope, setScope] = useState<RecordScope>(RecordScope.PRIVATE);
  const [targetDate, setTargetDate] = useState('');
  const [amountToAdd, setAmountToAdd] = useState('');

  const {
    goals,
    isLoading,
    createGoal,
    isCreating,
    updateGoal,
    isUpdating,
    addProgress,
    deleteGoal,
    refetch,
    isRefetching,
  } = useGoals();

  const handleOpenCreate = () => {
    setTitle('');
    setTargetAmount('');
    setCurrentAmount('');
    setScope(RecordScope.PRIVATE);
    setTargetDate('');
    setCreateModalVisible(true);
  };

  const handleOpenEdit = (goal: GoalDto) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setTargetAmount(maskCurrency(goal.targetAmount));
    setCurrentAmount(maskCurrency(goal.currentAmount || 0));
    setScope(goal.scope);
    if (goal.targetDate) {
      const d = new Date(goal.targetDate);
      setTargetDate(
        maskDate(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`)
      );
    } else {
      setTargetDate('');
    }
    setEditModalVisible(true);
  };

  const parseDateInput = (str: string) => {
    const parts = str.trim().split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  const handleCreate = async () => {
    const target = unmaskCurrency(targetAmount);
    const current = currentAmount ? unmaskCurrency(currentAmount) : 0;

    if (!title.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Atenção', 'Informe um título e um valor alvo válido.');
      return;
    }

    let isoTargetDate: string | undefined = undefined;
    if (targetDate) {
      const parsed = parseDateInput(targetDate);
      if (parsed) isoTargetDate = new Date(parsed).toISOString();
    }

    try {
      await createGoal({
        title: title.trim(),
        targetAmount: target,
        currentAmount: current,
        scope,
        targetDate: isoTargetDate,
      });
      setCreateModalVisible(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a meta.');
    }
  };

  const handleUpdate = async () => {
    if (!editingGoal) return;
    const target = unmaskCurrency(targetAmount);
    const current = currentAmount ? unmaskCurrency(currentAmount) : 0;

    if (!title.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Atenção', 'Informe um título e um valor alvo válido.');
      return;
    }

    let isoTargetDate: string | undefined = undefined;
    if (targetDate) {
      const parsed = parseDateInput(targetDate);
      if (parsed) isoTargetDate = new Date(parsed).toISOString();
    }

    try {
      await updateGoal({
        id: editingGoal.id,
        dto: {
          title: title.trim(),
          targetAmount: target,
          currentAmount: current,
          scope,
          targetDate: isoTargetDate,
        },
      });
      setEditModalVisible(false);
      setEditingGoal(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar a meta.');
    }
  };

  const handleAddProgress = async () => {
    const val = unmaskCurrency(amountToAdd);
    if (!selectedGoalId || isNaN(val) || val <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido a adicionar.');
      return;
    }

    try {
      await addProgress({
        id: selectedGoalId,
        dto: { amountToAdd: val },
      });
      setAmountToAdd('');
      setProgressModalVisible(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar o progresso.');
    }
  };

  const handleDelete = async (id: string, goalTitle: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Deseja realmente remover a meta "${goalTitle}"?`);
      if (confirmed) {
        try {
          await deleteGoal(id);
          if (editModalVisible) {
            setEditModalVisible(false);
            setEditingGoal(null);
          }
        } catch {
          alert('Não foi possível excluir a meta.');
        }
      }
      return;
    }

    Alert.alert('Excluir Meta', `Deseja realmente remover a meta "${goalTitle}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGoal(id);
            if (editModalVisible) {
              setEditModalVisible(false);
              setEditingGoal(null);
            }
          } catch {
            Alert.alert('Erro', 'Não foi possível excluir o meta.');
          }
        },
      },
    ]);
  };

  if (isLoading) return <LoadingState />;

  const totalSaved = goals.reduce((acc, g) => acc + Number(g.currentAmount || 0), 0);
  const totalTarget = goals.reduce((acc, g) => acc + Number(g.targetAmount || 0), 0);
  const overallPercent = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader title="Harry" subtitle="Metas Financeiras" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* TÍTULO & BOTÃO NOVA META */}
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Metas Financeiras</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Economias e objetivos compartilhados
            </Text>
          </View>
        </View>

        {/* HERO CARD DE METAS ACUMULADAS */}
        {goals.length > 0 && (
          <View
            style={[
              styles.summaryHeroCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              theme.cardShadow,
            ]}
          >
            <View style={styles.summaryHeroTop}>
              <View>
                <Text style={[styles.summaryHeroLabel, { color: theme.textSecondary }]}>
                  Total Guardado
                </Text>
                <Text style={[styles.summaryHeroValue, { color: theme.textPrimary }]}>
                  {formatCurrency(totalSaved)}
                </Text>
              </View>
              <View style={[styles.percentBadge, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.percentBadgeText, { color: theme.primary }]}>
                  {overallPercent}% da meta global
                </Text>
              </View>
            </View>

            {/* BARRA DE PROGRESSO GLOBAL */}
            <View style={[styles.progressBarBg, { backgroundColor: theme.surfaceSubtle }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${overallPercent}%`,
                    backgroundColor: overallPercent >= 100 ? theme.success : theme.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.targetGlobalText, { color: theme.textMuted }]}>
              Objetivo total: {formatCurrency(totalTarget)}
            </Text>
          </View>
        )}

        {/* LISTAGEM DE METAS */}
        <View style={styles.listSection}>
          <Text style={[styles.listSectionTitle, { color: theme.textPrimary }]}>
            Suas Metas ({goals.length})
          </Text>

          {goals.length === 0 ? (
            <EmptyState
              title="Nenhuma meta cadastrada"
              description="Crie metas para viagens, reservas de emergência ou reformas da casa."
              actionTitle="+ Criar Primeira Meta"
              onAction={handleOpenCreate}
            />
          ) : (
            goals.map((item) => {
              const progressPercent = Math.min(
                100,
                Math.round((Number(item.currentAmount) / Number(item.targetAmount)) * 100) || 0
              );
              const isCompleted = progressPercent >= 100;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.goalCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                    theme.cardShadow,
                  ]}
                >
                  <View style={styles.goalHeader}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={[styles.goalTitle, { color: theme.textPrimary }]}>
                        {item.title}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <ScopeBadge scope={item.scope} />
                        {item.targetDate && (
                          <Text style={[styles.dateBadge, { color: theme.textMuted }]}>
                            Alvo: {formatDate(item.targetDate)}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.headerActions}>
                      <TouchableOpacity
                        style={[
                          styles.iconBtn,
                          { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                        ]}
                        onPress={() => handleOpenEdit(item)}
                      >
                        <Text style={{ fontSize: 13 }}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.iconBtn,
                          { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                        ]}
                        onPress={() => handleDelete(item.id, item.title)}
                      >
                        <Text style={{ fontSize: 13 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.amountRow}>
                    <Text
                      style={[
                        styles.currentVal,
                        { color: isCompleted ? theme.success : theme.primary },
                      ]}
                    >
                      {formatCurrency(item.currentAmount)}
                    </Text>
                    <Text style={[styles.targetVal, { color: theme.textSecondary }]}>
                      de {formatCurrency(item.targetAmount)}
                    </Text>
                  </View>

                  {/* BARRA DE PROGRESSO */}
                  <View style={[styles.progressBarBg, { backgroundColor: theme.surfaceSubtle }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${progressPercent}%`,
                          backgroundColor: isCompleted ? theme.success : theme.primary,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.progressRow}>
                    <Text style={[styles.progressText, { color: theme.textMuted }]}>
                      {progressPercent}% atingido
                    </Text>
                    {isCompleted && (
                      <Text style={[styles.completedBadge, { color: theme.success }]}>
                        ✓ Concluída!
                      </Text>
                    )}
                  </View>

                  <View style={styles.cardBottomRow}>
                    <Button
                      title="+ Guardar Valor"
                      variant="secondary"
                      onPress={() => {
                        setSelectedGoalId(item.id);
                        setProgressModalVisible(true);
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* FAB FLUTUANTE NA ZONA DO POLEGAR */}
      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: theme.primary }, theme.fabShadow]}
        onPress={handleOpenCreate}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>＋</Text>
        <Text style={styles.fabText}>Nova Meta</Text>
      </TouchableOpacity>

      {/* MODAL CRIAR META */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.sheetHandleContainer}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Nova Meta</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={{ padding: 4 }}>
                <Text style={[styles.closeText, { color: theme.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              <Input
                label="Título da Meta"
                placeholder="Ex: Viagem para a praia"
                value={title}
                onChangeText={setTitle}
              />

              <Input
                label="Valor Alvo"
                placeholder="R$ 0,00"
                mask="currency"
                value={targetAmount}
                onChangeText={setTargetAmount}
              />

              <Input
                label="Valor Já Guardado"
                placeholder="R$ 0,00"
                mask="currency"
                value={currentAmount}
                onChangeText={setCurrentAmount}
              />

              <Input
                label="Data Alvo (Opcional - DD/MM/AAAA)"
                placeholder="DD/MM/AAAA"
                mask="date"
                value={targetDate}
                onChangeText={setTargetDate}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Escopo da Meta
              </Text>
              <View style={styles.scopeSelector}>
                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: scope === RecordScope.SHARED ? theme.primaryLight : theme.inputBg,
                      borderColor: scope === RecordScope.SHARED ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.SHARED)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🏠</Text>
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: scope === RecordScope.SHARED ? theme.primary : theme.textPrimary },
                    ]}
                  >
                    Meta Compartilhada
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: scope === RecordScope.PRIVATE ? theme.primaryLight : theme.inputBg,
                      borderColor: scope === RecordScope.PRIVATE ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.PRIVATE)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🔒</Text>
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: scope === RecordScope.PRIVATE ? theme.primary : theme.textPrimary },
                    ]}
                  >
                    Meta Individual
                  </Text>
                </TouchableOpacity>
              </View>

              <Button
                title="Criar Meta"
                onPress={handleCreate}
                isLoading={isCreating}
                style={{ marginTop: 24, marginBottom: 40 }}
              />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL EDITAR META */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.sheetHandleContainer}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Editar Meta</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={{ padding: 4 }}>
                <Text style={[styles.closeText, { color: theme.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              <Input
                label="Título da Meta"
                placeholder="Ex: Viagem para a praia"
                value={title}
                onChangeText={setTitle}
              />

              <Input
                label="Valor Alvo"
                placeholder="R$ 0,00"
                mask="currency"
                value={targetAmount}
                onChangeText={setTargetAmount}
              />

              <Input
                label="Valor Já Guardado"
                placeholder="R$ 0,00"
                mask="currency"
                value={currentAmount}
                onChangeText={setCurrentAmount}
              />

              <Input
                label="Data Alvo (DD/MM/AAAA)"
                placeholder="DD/MM/AAAA"
                mask="date"
                value={targetDate}
                onChangeText={setTargetDate}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Escopo da Meta
              </Text>
              <View style={styles.scopeSelector}>
                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: scope === RecordScope.SHARED ? theme.primaryLight : theme.inputBg,
                      borderColor: scope === RecordScope.SHARED ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.SHARED)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🏠</Text>
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: scope === RecordScope.SHARED ? theme.primary : theme.textPrimary },
                    ]}
                  >
                    Meta Compartilhada
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: scope === RecordScope.PRIVATE ? theme.primaryLight : theme.inputBg,
                      borderColor: scope === RecordScope.PRIVATE ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.PRIVATE)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🔒</Text>
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: scope === RecordScope.PRIVATE ? theme.primary : theme.textPrimary },
                    ]}
                  >
                    Meta Individual
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 24, gap: 12, marginBottom: 40 }}>
                <Button
                  title="Salvar Alterações"
                  onPress={handleUpdate}
                  isLoading={isUpdating}
                />
                {editingGoal && (
                  <Button
                    title="Excluir Meta"
                    variant="ghost"
                    onPress={() => handleDelete(editingGoal.id, editingGoal.title)}
                    style={{ borderColor: theme.danger, borderWidth: 1 }}
                  />
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL ADICIONAR PROGRESSO */}
      <Modal visible={progressModalVisible} animationType="fade" transparent>
        <View style={styles.progressOverlay}>
          <View
            style={[
              styles.progressDialog,
              { backgroundColor: theme.surface, borderColor: theme.border },
              theme.cardShadow,
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Guardar Dinheiro
            </Text>
            <Text style={[styles.dialogSubtitle, { color: theme.textSecondary }]}>
              Quanto você quer adicionar nesta meta?
            </Text>

            <Input
              label="Valor a Guardar"
              placeholder="R$ 0,00"
              mask="currency"
              value={amountToAdd}
              onChangeText={setAmountToAdd}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setProgressModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button title="Confirmar" onPress={handleAddProgress} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 80,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  summaryHeroCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  summaryHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  summaryHeroLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryHeroValue: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  percentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  percentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  targetGlobalText: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'right',
  },
  listSection: {
    marginTop: 2,
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  goalCard: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  goalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  dateBadge: {
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 14,
    marginBottom: 8,
  },
  currentVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  targetVal: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
  },
  completedBadge: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 26,
    gap: 8,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  scopeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  scopeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  scopeOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  progressDialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
  },
  dialogSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
});
