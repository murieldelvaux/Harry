import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useShoppingList } from '../../src/hooks/useShoppingList';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppHeader } from '../../src/components/AppHeader';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { ScopeBadge } from '../../src/components/ScopeBadge';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingState } from '../../src/components/LoadingState';
import { RecordScope, ShoppingItemDto } from '../../../packages/shared/src';

const QUICK_CATEGORIES = ['Geral', 'Hortifrúti', 'Laticínios', 'Carnes', 'Padaria', 'Bebidas', 'Limpeza', 'Higiene'];

export default function ShoppingListScreen() {
  const { theme, isDark } = useTheme();

  // Filtro de Escopo
  const [activeScope, setActiveScope] = useState<'ALL' | 'SHARED' | 'PRIVATE'>('ALL');
  const scopeFilter = activeScope === 'ALL' ? undefined : (activeScope as RecordScope);

  const {
    items,
    pendingItems,
    completedItems,
    isLoading,
    isRefetching,
    refetch,
    createItem,
    isCreating,
    toggleItem,
    updateItem,
    deleteItem,
    clearCompleted,
    isClearing,
    importSpreadsheet,
    isImporting,
  } = useShoppingList(scopeFilter);

  // Inserção Rápida
  const [quickName, setQuickName] = useState('');
  const [quickScope, setQuickScope] = useState<RecordScope>(RecordScope.SHARED);

  // Modal de Detalhes / Edição
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItemDto | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editCategory, setEditCategory] = useState('Geral');
  const [editScope, setEditScope] = useState<RecordScope>(RecordScope.SHARED);

  // Controle de visualização dos itens comprados
  const [showCompleted, setShowCompleted] = useState(true);
  // Modal de Importação de Planilha / Foto
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importTab, setImportTab] = useState<"IMAGE" | "FILE" | "TEXT">("IMAGE");
  const [importText, setImportText] = useState("");
  const [selectedFileBase64, setSelectedFileBase64] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [importScope, setImportScope] = useState<RecordScope>(RecordScope.SHARED);
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);


    const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64 = asset.base64;
        if (!base64 && asset.uri) {
          // On web or file uri
          if (Platform.OS === "web" && typeof window !== "undefined") {
            const resp = await fetch(asset.uri);
            const blob = await resp.blob();
            base64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const res = reader.result as string;
                resolve(res.split(",")[1]);
              };
              reader.readAsDataURL(blob);
            });
          }
        }
        if (base64) {
          setSelectedFileBase64(base64);
          setSelectedFileName(asset.fileName || "print_planilha.jpg");
          setImportStatusMsg("Imagem selecionada com sucesso!");
        }
      }
    } catch (e: any) {
      Alert.alert("Erro", "Não foi possível carregar a imagem.");
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (Platform.OS === "web" && (file as any).file) {
          const rawFile = (file as any).file as File;
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            setSelectedFileBase64(res.split(",")[1]);
            setSelectedFileName(file.name);
            setImportStatusMsg("Arquivo selecionado: " + file.name);
          };
          reader.readAsDataURL(rawFile);
        } else if (file.uri) {
          const resp = await fetch(file.uri);
          const blob = await resp.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(",")[1]);
            };
            reader.readAsDataURL(blob);
          });
          setSelectedFileBase64(base64);
          setSelectedFileName(file.name);
          setImportStatusMsg("Arquivo selecionado: " + file.name);
        }
      }
    } catch (e: any) {
      Alert.alert("Erro", "Não foi possível abrir o arquivo.");
    }
  };

  const handleExecuteImport = async () => {
    if (importTab === "TEXT" && !importText.trim()) {
      Alert.alert("Atenção", "Cole o texto ou tabela da planilha antes de processar.");
      return;
    }
    if ((importTab === "IMAGE" || importTab === "FILE") && !selectedFileBase64) {
      Alert.alert("Atenção", "Selecione uma imagem ou arquivo antes de processar.");
      return;
    }

    try {
      setImportStatusMsg("Processando com IA...");
      const res = await importSpreadsheet({
        text: importTab === "TEXT" ? importText.trim() : undefined,
        fileBase64: (importTab === "IMAGE" || importTab === "FILE") && selectedFileBase64 ? selectedFileBase64 : undefined,
        filename: selectedFileName || undefined,
        scope: importScope,
      });

      if (res.success) {
        const count = res.count || 0;
        setImportModalVisible(false);
        setSelectedFileBase64(null);
        setSelectedFileName(null);
        setImportText("");
        setImportStatusMsg(null);
        if (Platform.OS === "web") {
          window.alert("🎉 Sucesso! " + count + " itens adicionados à sua lista de compras.");
        } else {
          Alert.alert("🎉 Sucesso!", count + " itens adicionados à sua lista de compras.");
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Erro ao processar planilha.";
      setImportStatusMsg("Erro: " + msg);
      Alert.alert("Falha ao Importar", msg);
    }
  };

  const handleQuickAdd = async () => {
    let trimmed = quickName.trim();
    if (!trimmed) return;

    trimmed = trimmed
      .replace(/^(?:adicionar|colocar|por|pôr|bota|botar|comprar|incluir)\s+(?:na\s+|pra\s+|para\s+|no\s+)?(?:minha\s+)?(?:lista\s*(?:de\s*(?:compras|mercado))?)?\s*/gi, '')
      .replace(/\s*(?:na|pra|para|no)\s+(?:minha\s+)?lista\s*(?:de\s*(?:compras|mercado))?/gi, '')
      .replace(/^(?:adicionar|colocar|por|pôr|bota|botar|comprar|incluir)\s+/gi, '')
      .trim();

    if (!trimmed) return;
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    try {
      await createItem({
        name: formatted,
        quantity: '1',
        category: 'Geral',
        scope: quickScope,
      });
      setQuickName('');
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar o item.');
    }
  };

  const handleOpenEdit = (item: ShoppingItemDto) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditQuantity(item.quantity || '1');
    setEditCategory(item.category || 'Geral');
    setEditScope(item.scope);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editName.trim()) return;

    try {
      await updateItem({
        id: editingItem.id,
        dto: {
          name: editName.trim(),
          quantity: editQuantity.trim() || undefined,
          category: editCategory,
          scope: editScope,
        },
      });
      setEditModalVisible(false);
      setEditingItem(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar alterações.');
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Remover "${name}" da lista?`)) {
        await deleteItem(id);
        if (editModalVisible) setEditModalVisible(false);
      }
      return;
    }

    Alert.alert('Remover Item', `Remover "${name}" da lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await deleteItem(id);
          if (editModalVisible) setEditModalVisible(false);
        },
      },
    ]);
  };

  const handleClearCompleted = () => {
    if (completedItems.length === 0) return;

    const doClear = async () => {
      try {
        await clearCompleted();
      } catch {
        Alert.alert('Erro', 'Não foi possível limpar os itens comprados.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Deseja limpar todos os itens já comprados?')) {
        doClear();
      }
      return;
    }

    Alert.alert(
      'Limpar Comprados',
      `Deseja remover ${completedItems.length} itens já comprados da lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpar', style: 'destructive', onPress: doClear },
      ]
    );
  };

  if (isLoading) return <LoadingState />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader title="Nexo" subtitle="Lista de Compras" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* TÍTULO E SUBTÍTULO */}
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Lista de Compras</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {pendingItems.length} {pendingItems.length === 1 ? 'item pendente' : 'itens pendentes'}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setImportModalVisible(true)}
              style={[
                styles.quickScopePill,
                {
                  backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                  borderColor: theme.primary,
                  borderWidth: 1.5,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.quickScopeText, { color: theme.primary, fontWeight: "700" }]}>
                📊 Importar Planilha
              </Text>
            </TouchableOpacity>

            {/* Seletor rápido de escopo para novos itens */}
          <TouchableOpacity
            onPress={() => setQuickScope(quickScope === RecordScope.SHARED ? RecordScope.PRIVATE : RecordScope.SHARED)}
            style={[
              styles.quickScopePill,
              {
                backgroundColor: quickScope === RecordScope.SHARED ? theme.tagSharedBg : theme.tagPrivateBg,
                borderColor: theme.border,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.quickScopeText,
                {
                  color: quickScope === RecordScope.SHARED
                    ? (isDark ? '#7DD3FC' : '#1D4ED8')
                    : theme.textPrimary,
                },
              ]}
            >
              {quickScope === RecordScope.SHARED ? '🏠 Compartilhada' : '🔒 Pessoal'}
            </Text>
          </TouchableOpacity>
          </View>
        </View>

        {/* INPUT DE INSERÇÃO RÁPIDA (TOPO) */}
        <View
          style={[
            styles.quickAddCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            theme.cardShadow,
          ]}
        >
          <View style={styles.quickAddRow}>
            <TextInput
              placeholder="Adicionar item (ex: Leite, Ovos, Café...)"
              placeholderTextColor={theme.textMuted}
              value={quickName}
              onChangeText={setQuickName}
              onSubmitEditing={handleQuickAdd}
              returnKeyType="done"
              style={[
                styles.quickInput,
                {
                  backgroundColor: theme.surfaceSubtle,
                  borderColor: theme.border,
                  color: theme.textPrimary,
                },
              ]}
            />
            <Button
              title="＋"
              onPress={handleQuickAdd}
              isLoading={isCreating}
              style={styles.quickAddBtn}
              textStyle={{ fontSize: 20 }}
            />
          </View>
        </View>

        {/* SELETOR DE ESCOPO (CHIPS DE FILTRO) */}
        <View style={styles.chipsRow}>
          {(['ALL', 'SHARED', 'PRIVATE'] as const).map((sc) => {
            const isSelected = activeScope === sc;
            return (
              <TouchableOpacity
                key={sc}
                onPress={() => setActiveScope(sc)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.surface,
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected ? '#FFFFFF' : theme.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {sc === 'ALL' ? 'Todos' : sc === 'SHARED' ? '🏠 Compartilhado' : '🔒 Meus'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* BANNER ASSISTENTE WHATSAPP */}
        <View
          style={[
            styles.whatsappBanner,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0',
            },
          ]}
        >
          <Text style={{ fontSize: 16 }}>🛒</Text>
          <Text style={[styles.whatsappBannerText, { color: isDark ? '#A7F3D0' : '#047857' }]}>
            <Text style={{ fontWeight: '700' }}>Adicione pelo WhatsApp:</Text> Mande foto de uma lista no papel, planilha, áudio ou texto e a IA inclui automaticamente!
          </Text>
        </View>

        {/* SEÇÃO 1: ITENS PARA COMPRAR (PENDENTES) */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Para Comprar ({pendingItems.length})
          </Text>
        </View>

        {pendingItems.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
              theme.cardShadow,
            ]}
          >
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🧺</Text>
            <Text style={[styles.emptyCardTitle, { color: theme.textPrimary }]}>
              Nenhum item pendente
            </Text>
            <Text style={[styles.emptyCardDesc, { color: theme.textSecondary }]}>
              Digite no campo acima ou mande mensagem no WhatsApp para montar a lista de compras.
            </Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {pendingItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                  theme.cardShadow,
                ]}
                activeOpacity={0.7}
                onPress={() => toggleItem(item.id)}
              >
                {/* Checkbox Circular Estilo Alexa */}
                <TouchableOpacity
                  style={[styles.checkboxCircle, { borderColor: theme.primary }]}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.6}
                />

                <View style={styles.itemMeta}>
                  <Text style={[styles.itemName, { color: theme.textPrimary }]}>
                    {item.name}
                  </Text>
                  <View style={styles.itemSubRow}>
                    {item.quantity && item.quantity !== '1' && (
                      <View style={[styles.qtyBadge, { backgroundColor: theme.surfaceSubtle }]}>
                        <Text style={[styles.qtyText, { color: theme.textSecondary }]}>
                          Qtd: {item.quantity}
                        </Text>
                      </View>
                    )}
                    {item.category && item.category !== 'Geral' && (
                      <View style={[styles.qtyBadge, { backgroundColor: theme.surfaceSubtle }]}>
                        <Text style={[styles.qtyText, { color: theme.textSecondary }]}>
                          {item.category}
                        </Text>
                      </View>
                    )}
                    <ScopeBadge scope={item.scope} />
                  </View>
                </View>

                {/* Botões de Ação */}
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                    onPress={() => handleOpenEdit(item)}
                  >
                    <Text style={{ fontSize: 13 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                    onPress={() => handleDeleteItem(item.id, item.name)}
                  >
                    <Text style={{ fontSize: 13 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* SEÇÃO 2: ITENS COMPRADOS (ESTILO ALEXA) */}
        {completedItems.length > 0 && (
          <View style={styles.completedSection}>
            <View style={styles.completedHeaderRow}>
              <TouchableOpacity
                style={styles.completedToggleBtn}
                onPress={() => setShowCompleted(!showCompleted)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14 }}>{showCompleted ? '▼' : '▶'}</Text>
                <Text style={[styles.completedHeaderTitle, { color: theme.textSecondary }]}>
                  Comprados ({completedItems.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleClearCompleted}
                disabled={isClearing}
                style={[styles.clearBtn, { backgroundColor: theme.surfaceSubtle }]}
              >
                <Text style={[styles.clearBtnText, { color: theme.danger }]}>
                  {isClearing ? 'Limpando...' : 'Limpar'}
                </Text>
              </TouchableOpacity>
            </View>

            {showCompleted && (
              <View style={styles.itemsList}>
                {completedItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemCard,
                      styles.itemCardCompleted,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => toggleItem(item.id)}
                  >
                    {/* Checkbox Preenchido (ao tocar desmarca e volta para cima!) */}
                    <TouchableOpacity
                      style={[styles.checkboxCircleChecked, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                      onPress={() => toggleItem(item.id)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.checkmarkIcon}>✓</Text>
                    </TouchableOpacity>

                    <View style={styles.itemMeta}>
                      <Text style={[styles.itemNameCompleted, { color: theme.textMuted }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.readdNotice, { color: theme.textMuted }]}>
                        Toque para recolocar na lista
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => handleDeleteItem(item.id, item.name)}
                    >
                      <Text style={{ fontSize: 13 }}>🗑️</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL DE EDIÇÃO DE ITEM */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.sheetHandleContainer}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Editar Item</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={{ padding: 4 }}>
                <Text style={[styles.closeText, { color: theme.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              <Input
                label="Nome do Item"
                placeholder="Ex: Leite Integral"
                value={editName}
                onChangeText={setEditName}
              />

              <Input
                label="Quantidade ou Embalagem"
                placeholder="Ex: 2 unidades, 1kg, 1 fardo..."
                value={editQuantity}
                onChangeText={setEditQuantity}
              />

              {/* Categorias Rápidas */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Categoria</Text>
              <View style={styles.categoriesRow}>
                {QUICK_CATEGORIES.map((cat) => {
                  const isCatSelected = editCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setEditCategory(cat)}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: isCatSelected ? theme.primary : theme.surfaceSubtle,
                          borderColor: isCatSelected ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          {
                            color: isCatSelected ? '#FFFFFF' : theme.textPrimary,
                            fontWeight: isCatSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Escopo */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 14 }]}>
                Destino do Item
              </Text>
              <View style={styles.scopeSelector}>
                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: editScope === RecordScope.SHARED ? theme.primaryLight : theme.inputBg,
                      borderColor: editScope === RecordScope.SHARED ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setEditScope(RecordScope.SHARED)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🏠</Text>
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: editScope === RecordScope.SHARED ? theme.primary : theme.textPrimary },
                    ]}
                  >
                    Compartilhado
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: editScope === RecordScope.PRIVATE ? theme.primaryLight : theme.inputBg,
                      borderColor: editScope === RecordScope.PRIVATE ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setEditScope(RecordScope.PRIVATE)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🔒</Text>
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: editScope === RecordScope.PRIVATE ? theme.primary : theme.textPrimary },
                    ]}
                  >
                    Pessoal
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 24, gap: 10, marginBottom: 40 }}>
                <Button title="Salvar Alterações" onPress={handleSaveEdit} />
                {editingItem && (
                  <Button
                    title="Excluir da Lista"
                    variant="ghost"
                    onPress={() => handleDeleteItem(editingItem.id, editingItem.name)}
                    style={{ borderColor: theme.danger, borderWidth: 1 }}
                  />
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
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
    paddingBottom: 60,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
  quickScopeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  quickScopePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickScopeTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickAddCard: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  quickInput: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    borderWidth: 1,
  },
  quickAddBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  whatsappBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 18,
  },
  whatsappBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    textAlign: 'center',
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyCardDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  itemsList: {
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  itemCardCompleted: {
    opacity: 0.75,
  },
  checkboxCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCircleChecked: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  itemMeta: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemNameCompleted: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  readdNotice: {
    fontSize: 10,
    marginTop: 2,
  },
  itemSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  qtyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  qtyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  completedSection: {
    marginTop: 24,
  },
  completedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  completedToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
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
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
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
});
