import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useHousehold } from '../../src/hooks/useHousehold';
import { showMessage } from '../../src/utils/alert';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppHeader } from '../../src/components/AppHeader';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { maskPhone, maskTime } from '../../src/utils/format';

// Avatares rápidos disponíveis para escolha
const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, isUpdatingProfile, updatePhone, isUpdatingPhone } = useAuth();
  const {
    household,
    joinHousehold,
    isJoining,
    updateHousehold,
    isUpdating: isUpdatingHousehold,
    deleteHousehold,
    isDeleting: isDeletingHousehold,
    leaveHousehold,
    isLeaving: isLeavingHousehold,
  } = useHousehold();
  const { theme, isDark, toggleTheme } = useTheme();

  // Estados de Edição de Foto
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState('');

  // Estados de Edição de Nome
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');

  // Estados de Edição do Espaço Compartilhado
  const [householdModalVisible, setHouseholdModalVisible] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [householdEditError, setHouseholdEditError] = useState('');

  // Estados de Sair e Excluir Espaço
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [switchModalVisible, setSwitchModalVisible] = useState(false);

  // Estado de Compartilhamento de Gastos Privados
  const [isSharingPrivate, setIsSharingPrivate] = useState<boolean>(!!user?.sharePrivateExpenses);

  useEffect(() => {
    if (user?.sharePrivateExpenses !== undefined) {
      setIsSharingPrivate(!!user.sharePrivateExpenses);
    }
  }, [user?.sharePrivateExpenses]);

  // Estados de Convite e Telefone
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ? maskPhone(user.phoneNumber) : '');
  const [phoneSaved, setPhoneSaved] = useState(false);
  // Estados de Notificação e Resumos no WhatsApp
  const [dailyTime, setDailyTime] = useState(user?.dailySummaryTime ? maskTime(user.dailySummaryTime) : '06:00');
  const [enableDaily, setEnableDaily] = useState(user?.enableDailySummary !== false);
  const [periodicType, setPeriodicType] = useState<string>(user?.periodicSummaryType || "none");
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);

  const handleSaveNotificationSettings = async () => {
    setIsSavingNotifs(true);
    try {
      await updateProfile({
        dailySummaryTime: dailyTime,
        enableDailySummary: enableDaily,
        periodicSummaryType: periodicType,
      });
      showMessage("Preferências Salvas!", "Seus horários de resumos e lembretes foram configurados.");
    } catch {
      showMessage("Erro", "Não foi possível salvar as configurações de notificação.");
    } finally {
      setIsSavingNotifs(false);
    }
  };


  const handleOpenPhotoModal = () => {
    setNewAvatarUrl(user?.avatarUrl || '');
    setPhotoModalVisible(true);
  };

  const handleSavePhoto = async (urlToSave?: string) => {
    const finalUrl = (urlToSave !== undefined ? urlToSave : newAvatarUrl).trim();
    try {
      await updateProfile({ avatarUrl: finalUrl || undefined });
      setPhotoModalVisible(false);
      showMessage('Sucesso', 'Foto de perfil atualizada!');
    } catch {
      showMessage('Erro', 'Não foi possível atualizar a foto.');
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      showMessage('Atenção', 'Informe seu nome.');
      return;
    }
    try {
      await updateProfile({ name: newName.trim() });
      setNameModalVisible(false);
      showMessage('Sucesso', 'Nome atualizado!');
    } catch {
      showMessage('Erro', 'Não foi possível atualizar o nome.');
    }
  };

  const handleSavePhone = async () => {
    if (!phoneNumber.trim()) {
      showMessage('Atenção', 'Informe seu número de WhatsApp com DDD (ex: +55 11 99999-9999)');
      return;
    }

    try {
      await updatePhone(phoneNumber.trim());
      setPhoneSaved(true);
      showMessage('Sucesso!', 'Seu WhatsApp foi vinculado ao assistente Nexo.');
    } catch {
      showMessage('Erro', 'Não foi possível salvar o número.');
    }
  };

  const handleToggleSharePrivateExpenses = async () => {
    const nextVal = !isSharingPrivate;
    setIsSharingPrivate(nextVal);
    try {
      await updateProfile({ sharePrivateExpenses: nextVal });
    } catch {
      setIsSharingPrivate(!nextVal);
      showMessage('Erro', 'Não foi possível atualizar a permissão de gastos pessoais.');
    }
  };

  const handleSaveHouseholdName = async () => {
    setHouseholdEditError('');
    if (!newHouseholdName.trim()) {
      setHouseholdEditError('Informe o nome do espaço.');
      return;
    }
    try {
      await updateHousehold({ name: newHouseholdName.trim() });
      setHouseholdModalVisible(false);
    } catch (err: any) {
      setHouseholdEditError(err?.response?.data?.message || 'Não foi possível atualizar o nome do espaço.');
    }
  };

  const handleConfirmLeave = async () => {
    setLeaveError('');
    try {
      await leaveHousehold();
      setLeaveModalVisible(false);
    } catch (err: any) {
      setLeaveError(err?.response?.data?.message || 'Não foi possível sair do espaço.');
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError('');
    try {
      await deleteHousehold();
      setDeleteModalVisible(false);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Não foi possível excluir o espaço.');
    }
  };

  const handleShareInvite = async () => {
    if (!household?.inviteCode) return;
    try {
      await Share.share({
        message: `Oi! Entra comigo no Nexo para organizarmos nossas contas e tarefas juntos. Use nosso código de convite: ${household.inviteCode}`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const executeJoin = async () => {
    const code = inviteCode.trim().toUpperCase();
    try {
      await joinHousehold({ inviteCode: code });
      setInviteCode('');
      setSwitchModalVisible(false);
    } catch (err: any) {
      setJoinError(err?.response?.data?.message || 'Código inválido ou expirado.');
      setSwitchModalVisible(false);
    }
  };

  const handleJoinWithCode = () => {
    setJoinError('');
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setJoinError('Digite o código de convite.');
      return;
    }
    if (household) {
      setSwitchModalVisible(true);
    } else {
      executeJoin();
    }
  };

  const userInitials = user?.name
    ? user.name
      .split(' ')
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    : 'NX';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER PRINCIPAL COM HAMBÚRGUER & LOGO */}
      <AppHeader title="Nexo" subtitle="Meu Perfil" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* CARTÃO DE PERFIL COM FOTO DO GOOGLE / NOVA FOTO */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
          <View style={styles.avatarWrapper}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.largeAvatar} />
            ) : (
              <View style={[styles.largeAvatarFallback, { backgroundColor: theme.primary }]}>
                <Text style={styles.largeAvatarText}>{userInitials}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.cameraBadge, { backgroundColor: theme.primary, borderColor: theme.surface }]}
              onPress={handleOpenPhotoModal}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, color: '#FFFFFF' }}>📷</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.profileMeta}>
            <View style={styles.nameRow}>
              <Text style={[styles.profileName, { color: theme.textPrimary }]}>
                {user?.name || 'Usuário Nexo'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setNewName(user?.name || '');
                  setNameModalVisible(true);
                }}
                style={styles.editNameBtn}
              >
                <Text style={{ fontSize: 13 }}>✏️</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
              {user?.email || ''}
            </Text>

            <TouchableOpacity
              style={[styles.changePhotoPill, { backgroundColor: theme.primaryLight }]}
              onPress={handleOpenPhotoModal}
              activeOpacity={0.8}
            >
              <Text style={[styles.changePhotoPillText, { color: theme.primary }]}>
                {user?.avatarUrl ? 'Trocar foto de perfil' : '+ Adicionar foto de perfil'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.statusBadge, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={[styles.statusBadgeText, { color: theme.textSecondary }]}>
                {household?.name ? `🏠 Espaço: ${household.name}` : '👤 Conta Individual'}
              </Text>
            </View>
          </View>
        </View>

        {/* SEÇÃO 1: WHATSAPP INTEGRADO */}
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' }]}>
              <Text style={{ fontSize: 18 }}>💬</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Assistente WhatsApp
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Envie áudios, fotos de comprovantes e listas
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <Input
              label="Número do WhatsApp (com DDI e DDD)"
              placeholder="+55 11 99999-9999"
              mask="phone"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
            <Button
              title={phoneSaved ? '✓ WhatsApp Vinculado' : 'Salvar e Conectar'}
              onPress={handleSavePhone}
              isLoading={isUpdatingPhone}
              style={{ marginTop: -4 }}
            />
          </View>

          <View style={[styles.tipBanner, { backgroundColor: theme.surfaceSubtle }]}>
            <Text style={[styles.tipText, { color: theme.textSecondary }]}>
              💡 <Text style={{ fontWeight: '700' }}>Dica:</Text> Você pode mandar áudios como <Text style={{ fontStyle: 'italic' }}>"Gastei 50 no mercado hoje"</Text>, foto de cupom fiscal, ou mandar fotos de listas de compras escritas no papel!
            </Text>
          </View>
        </View>

        {/* SEÇÃO 1.5: RESUMOS & LEMBRETES NO WHATSAPP */}
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7" }]}>
              <Text style={{ fontSize: 18 }}>⏰</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Resumos Diários & Periódicos
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Receba sua programação matinal direto no seu WhatsApp
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.settingRowTitle, { color: theme.textPrimary }]}>
                  Resumo Matinal Diário
                </Text>
                <Text style={[styles.settingRowDesc, { color: theme.textSecondary }]}>
                  Receba compromissos, tarefas e compras do dia no seu WhatsApp às {dailyTime}.
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggleSwitch,
                  { backgroundColor: enableDaily ? theme.primary : theme.surfaceSubtle },
                ]}
                onPress={() => setEnableDaily(!enableDaily)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    enableDaily && { alignSelf: "flex-end", backgroundColor: "#FFFFFF" },
                  ]}
                />
              </TouchableOpacity>
            </View>

            {enableDaily && (
              <View style={{ marginTop: 10 }}>
                <Input
                  label="Horário do envio matinal (Horário de Brasília)"
                  placeholder="06:00"
                  mask="time"
                  value={dailyTime}
                  onChangeText={setDailyTime}
                />
              </View>
            )}

            <View style={{ marginTop: 14 }}>
              <Text style={[styles.settingRowTitle, { color: theme.textPrimary, marginBottom: 4 }]}>
                Visão Geral Periódica
              </Text>
              <Text style={[styles.settingRowDesc, { color: theme.textSecondary, marginBottom: 10 }]}>
                Receba um panorama completo dos compromissos e tarefas futuras da semana.
              </Text>

              <View style={styles.periodicSelector}>
                {[
                  { id: "none", label: "Desativado" },
                  { id: "weekly", label: "Semanal (Segundas)" },
                  { id: "biweekly", label: "Quinzenal" },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.periodicOption,
                      periodicType === opt.id && {
                        backgroundColor: theme.primaryLight,
                        borderColor: theme.primary,
                      },
                      { borderColor: theme.border },
                    ]}
                    onPress={() => setPeriodicType(opt.id)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.periodicOptionText,
                        {
                          color: periodicType === opt.id ? theme.primary : theme.textSecondary,
                          fontWeight: periodicType === opt.id ? "700" : "500",
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button
              title="Salvar Preferências de Notificação"
              variant="primary"
              onPress={handleSaveNotificationSettings}
              isLoading={isSavingNotifs}
              style={{ marginTop: 14 }}
            />
          </View>
        </View>


        {/* SEÇÃO 2: ESPAÇO DO LAR / HOUSEHOLD */}
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: theme.primaryLight }]}>
              <Text style={{ fontSize: 18 }}>🏠</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Espaço do Lar
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Gestão compartilhada com seu par ou família
              </Text>
            </View>
          </View>

          {household ? (
            <View style={{ marginTop: 14 }}>
              <View style={styles.householdHeaderRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.householdTitle, { color: theme.textPrimary }]}>
                    {household.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setNewHouseholdName(household.name);
                    setHouseholdModalVisible(true);
                  }}
                  style={[styles.editHouseholdBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, color: theme.textPrimary, fontWeight: '600' }}>✏️ Editar</Text>
                </TouchableOpacity>
              </View>

              {/* Box de Código de Convite */}
              <View style={[styles.inviteBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <View>
                  <Text style={[styles.inviteLabel, { color: theme.textSecondary }]}>
                    Código de Convite do Casal
                  </Text>
                  <Text style={[styles.inviteCode, { color: theme.primary }]}>
                    {household.inviteCode}
                  </Text>
                </View>
                <Button
                  title="Compartilhar"
                  variant="secondary"
                  onPress={handleShareInvite}
                  style={styles.shareButton}
                />
              </View>

              {/* Permissão de Compartilhamento de Gastos Pessoais */}
              <View
                style={[
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.settingRowTitle, { color: theme.textPrimary }]}>
                    👁️ Compartilhar meus gastos pessoais
                  </Text>
                  <Text style={[styles.settingRowDesc, { color: theme.textSecondary, marginTop: 4, lineHeight: 18 }]}>
                    Permitir que quem estiver no espaço veja seus lançamentos privados nas finanças.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleToggleSharePrivateExpenses}
                  disabled={isUpdatingProfile}
                  style={[
                    styles.toggleSwitch,
                    {
                      backgroundColor: isSharingPrivate ? theme.primary : (isDark ? '#334155' : '#CBD5E1'),
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      isSharingPrivate
                        ? { alignSelf: 'flex-end', backgroundColor: '#FFFFFF' }
                        : { alignSelf: 'flex-start', backgroundColor: '#94A3B8' },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              <Text style={[styles.subSectionTitle, { color: theme.textSecondary, marginTop: 16 }]}>
                Membros Conectados ({household.members?.length || 1}):
              </Text>
              {household.members?.map((member) => {
                const isMe = member.id === user?.id;
                const sharesPrivate = isMe ? isSharingPrivate : !!member.sharePrivateExpenses;
                return (
                  <View key={member.id} style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                    {member.avatarUrl ? (
                      <Image source={{ uri: member.avatarUrl }} style={styles.memberAvatarImg} />
                    ) : (
                      <View style={[styles.memberAvatar, { backgroundColor: theme.primaryLight }]}>
                        <Text style={[styles.memberAvatarText, { color: theme.primary }]}>
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: theme.textPrimary }]}>
                        {member.name} {isMe ? '(Você)' : ''}
                      </Text>
                      <Text style={[styles.memberEmail, { color: theme.textSecondary }]}>
                        {member.email}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <Text style={{ fontSize: 11, color: sharesPrivate ? theme.primary : theme.textMuted, fontWeight: '600' }}>
                          {sharesPrivate
                            ? (isMe ? '👁️ Você compartilha gastos pessoais' : '👁️ Compartilha gastos pessoais com você')
                            : (isMe ? '🔒 Seus gastos pessoais são privados' : '🔒 Mantém gastos pessoais privados')}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Ações de Gestão do Espaço */}
              <View style={styles.householdActionsRow}>
                <TouchableOpacity
                  style={[styles.dangerOutlineBtn, { borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5' }]}
                  onPress={() => {
                    setLeaveError('');
                    setLeaveModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dangerOutlineBtnText}>🚪 Sair do Espaço</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dangerSolidBtn, { backgroundColor: '#EF4444' }]}
                  onPress={() => {
                    setDeleteError('');
                    setDeleteModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dangerSolidBtnText}>🗑️ Excluir Espaço</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 14 }}>
              <Text style={[styles.noHouseholdText, { color: theme.textSecondary }]}>
                Você ainda está em modo individual. Crie ou entre em um espaço compartilhado para dividir contas automaticamente.
              </Text>
              <Button
                title="Criar ou Entrar em um Lar"
                onPress={() => router.push('/(household)/join')}
                style={{ marginTop: 12 }}
              />
            </View>
          )}

          {/* Entrar em outro espaço com código */}
          <View style={[styles.joinBox, { borderTopColor: theme.border }]}>
            <Text style={[styles.subSectionTitle, { color: theme.textSecondary, marginBottom: 8 }]}>
              Entrar em outro espaço com código:
            </Text>
            <Input
              placeholder="Digite o CÓDIGO (ex: ABCD12)"
              value={inviteCode}
              onChangeText={(text) => {
                setInviteCode(text.toUpperCase());
                setJoinError('');
              }}
              error={joinError || undefined}
              autoCapitalize="characters"
            />
            <Button
              title="Trocar de Espaço"
              variant="secondary"
              onPress={handleJoinWithCode}
              isLoading={isJoining}
              style={{ marginTop: -4 }}
            />
          </View>
        </View>

        {/* SEÇÃO 3: TEMA & APARÊNCIA */}
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE' }]}>
              <Text style={{ fontSize: 18 }}>🎨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Aparência
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Escolha o tema para toda a interface
              </Text>
            </View>
          </View>

          <View style={styles.themeSelectorRow}>
            <TouchableOpacity
              style={[
                styles.themeOptionCard,
                {
                  backgroundColor: !isDark ? theme.primaryLight : theme.surfaceSubtle,
                  borderColor: !isDark ? theme.primary : theme.border,
                },
              ]}
              onPress={() => isDark && toggleTheme()}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24 }}>☀️</Text>
              <Text style={[styles.themeOptionTitle, { color: !isDark ? theme.primary : theme.textPrimary }]}>
                Modo Claro
              </Text>
              <Text style={[styles.themeOptionDesc, { color: theme.textSecondary }]}>
                Fundos limpos off-white
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOptionCard,
                {
                  backgroundColor: isDark ? theme.primaryLight : theme.surfaceSubtle,
                  borderColor: isDark ? theme.primary : theme.border,
                },
              ]}
              onPress={() => !isDark && toggleTheme()}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24 }}>🌙</Text>
              <Text style={[styles.themeOptionTitle, { color: isDark ? theme.primary : theme.textPrimary }]}>
                Modo Escuro
              </Text>
              <Text style={[styles.themeOptionDesc, { color: theme.textSecondary }]}>
                Tons profundos elegantes
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SEÇÃO 4: INFORMAÇÕES & ENCERRAMENTO */}
        <View style={[styles.infoCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
          <Text style={[styles.infoTitle, { color: theme.textPrimary }]}>
            Nexo — Versão 1.0.0
          </Text>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Gestão financeira compartilhada, listas e assistente pessoal para o lar.
          </Text>
          <Text style={[styles.infoNotice, { color: theme.textMuted }]}>
            🔒 Para encerrar a sessão da conta, abra o menu lateral (botão ☰ no topo) e selecione "Sair da Conta".
          </Text>
        </View>
      </ScrollView>

      {/* MODAL ALTERAR FOTO DE PERFIL */}
      <Modal visible={photoModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.sheetHandleContainer}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Foto de Perfil</Text>
              <TouchableOpacity onPress={() => setPhotoModalVisible(false)} style={{ padding: 4 }}>
                <Text style={[styles.closeText, { color: theme.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              {/* Preview atual */}
              <View style={styles.previewContainer}>
                {newAvatarUrl ? (
                  <Image source={{ uri: newAvatarUrl }} style={styles.previewAvatar} />
                ) : user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.previewAvatar} />
                ) : (
                  <View style={[styles.previewAvatar, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 28, color: '#FFFFFF', fontWeight: '800' }}>{userInitials}</Text>
                  </View>
                )}
                <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>
                  {newAvatarUrl ? 'Pré-visualização da nova foto' : 'Sua foto atual'}
                </Text>
              </View>

              {/* Input de URL de Imagem */}
              <Input
                label="URL da Imagem ou Foto"
                placeholder="https://exemplo.com/sua-foto.jpg"
                value={newAvatarUrl}
                onChangeText={setNewAvatarUrl}
                autoCapitalize="none"
              />

              <Button
                title="Salvar esta Foto"
                onPress={() => handleSavePhoto()}
                isLoading={isUpdatingProfile}
                style={{ marginBottom: 16 }}
              />

              {/* Avatares Rápidos */}
              <Text style={[styles.subSectionTitle, { color: theme.textSecondary, marginBottom: 10 }]}>
                Ou escolha um avatar:
              </Text>
              <View style={styles.presetsGrid}>
                {AVATAR_PRESETS.map((preset, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setNewAvatarUrl(preset);
                      handleSavePhoto(preset);
                    }}
                    style={[
                      styles.presetItem,
                      {
                        borderColor: user?.avatarUrl === preset ? theme.primary : theme.border,
                        borderWidth: user?.avatarUrl === preset ? 2.5 : 1,
                      },
                    ]}
                  >
                    <Image source={{ uri: preset }} style={styles.presetImage} />
                  </TouchableOpacity>
                ))}
              </View>

              {user?.avatarUrl && (
                <Button
                  title="Remover Foto Atual"
                  variant="ghost"
                  onPress={() => handleSavePhoto('')}
                  style={{ marginTop: 20, marginBottom: 30 }}
                />
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL EDITAR NOME */}
      <Modal visible={nameModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.dialogBox, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
            <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>Editar Nome</Text>
            <Input
              placeholder="Seu Nome Completo"
              value={newName}
              onChangeText={setNewName}
              containerStyle={{ marginTop: 12, marginBottom: 16 }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setNameModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Salvar"
                onPress={handleSaveName}
                isLoading={isUpdatingProfile}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL EDITAR NOME DO ESPAÇO */}
      <Modal visible={householdModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.dialogBox, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
            <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>Editar Nome do Espaço</Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
              Dê um nome para o seu lar compartilhado (ex: Nossa Casa, Nosso Cantinho)
            </Text>
            <Input
              placeholder="Nome do Espaço"
              value={newHouseholdName}
              onChangeText={(t) => {
                setNewHouseholdName(t);
                setHouseholdEditError('');
              }}
              error={householdEditError || undefined}
              containerStyle={{ marginTop: 12, marginBottom: 16 }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setHouseholdModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Salvar"
                onPress={handleSaveHouseholdName}
                isLoading={isUpdatingHousehold}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL SAIR DO ESPAÇO */}
      <Modal visible={leaveModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.dialogBox, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
            <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>🚪 Sair do Espaço</Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 18 }}>
              Você sairá deste lar compartilhado e sua conta voltará ao modo individual. Seus registros privados continuarão intactos.
            </Text>
            {leaveError ? (
              <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 10, fontWeight: '600' }}>
                {leaveError}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setLeaveModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Confirmar Saída"
                variant="danger"
                onPress={handleConfirmLeave}
                isLoading={isLeavingHousehold}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL EXCLUIR ESPAÇO */}
      <Modal visible={deleteModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.dialogBox, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
            <Text style={[styles.dialogTitle, { color: '#EF4444' }]}>🗑️ Excluir Espaço</Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 18 }}>
              Tem certeza? Esta ação dissolverá o grupo compartilhado e desvinculará todos os membros conectados, voltando ambos ao modo individual.
            </Text>
            {deleteError ? (
              <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 10, fontWeight: '600' }}>
                {deleteError}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setDeleteModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Excluir Espaço"
                variant="danger"
                onPress={handleConfirmDelete}
                isLoading={isDeletingHousehold}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL TROCAR DE ESPAÇO */}
      <Modal visible={switchModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.dialogBox, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
            <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>🔄 Trocar de Espaço?</Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 18 }}>
              Você sairá do espaço compartilhado atual e passará a fazer parte do espaço vinculado a este código de convite.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setSwitchModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Confirmar Troca"
                variant="primary"
                onPress={executeJoin}
                isLoading={isJoining}
                style={{ flex: 1 }}
              />
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
    paddingTop: 14,
    paddingBottom: 40,
    gap: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
  },
  avatarWrapper: {
    position: 'relative',
  },
  largeAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  largeAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  profileMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
  },
  editNameBtn: {
    padding: 2,
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  changePhotoPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
  },
  changePhotoPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  sectionCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  tipBanner: {
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 18,
  },
  householdTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  inviteBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  inviteLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  inviteCode: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 2,
  },
  shareButton: {
    paddingHorizontal: 16,
    height: 38,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  memberAvatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberEmail: {
    fontSize: 11,
    marginTop: 1,
  },
  noHouseholdText: {
    fontSize: 13,
    lineHeight: 18,
  },
  joinBox: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  themeOptionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 6,
  },
  themeOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  themeOptionDesc: {
    fontSize: 10,
    textAlign: 'center',
  },
  infoCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 11,
    textAlign: 'center',
  },
  infoNotice: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
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
  previewContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 12,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 8,
  },
  presetItem: {
    borderRadius: 28,
    padding: 2,
  },
  presetImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  settingRowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingRowDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  toggleSwitch: {
    width: 48,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#94A3B8',
  },
  periodicSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  periodicOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodicOptionText: {
    fontSize: 11,
  },
  householdHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  editHouseholdBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  householdActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  dangerOutlineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerOutlineBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  dangerSolidBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerSolidBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
