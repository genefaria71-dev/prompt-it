import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import * as api from '../../services/api';
import type { BillingStatus, SystemStatus } from '../../services/api';

// ── Color constants ──────────────────────────────────────────────────

const C = {
  bg: '#080a0f',
  card: '#11141c',
  cardAlt: '#161a24',
  text: '#f4f7fb',
  muted: '#8c96aa',
  cyan: '#43f5d5',
  purple: '#9d70ff',
  danger: '#ff6f91',
  border: '#272d3c',
  green: '#43f5d5',
  orange: '#f5a623',
  yellow: '#f5d543',
};

// ── Plan helpers ─────────────────────────────────────────────────────

function planColor(plan: string): string {
  const map: Record<string, string> = {
    free: C.muted,
    pro: C.cyan,
    enterprise: C.purple,
  };
  return map[plan?.toLowerCase()] ?? C.muted;
}

function planBgColor(plan: string): string {
  const map: Record<string, string> = {
    free: C.muted + '1a',
    pro: C.cyan + '1a',
    enterprise: C.purple + '1a',
  };
  return map[plan?.toLowerCase()] ?? C.muted + '1a';
}

function planBorderColor(plan: string): string {
  const map: Record<string, string> = {
    free: C.muted + '40',
    pro: C.cyan + '40',
    enterprise: C.purple + '40',
  };
  return map[plan?.toLowerCase()] ?? C.muted + '40';
}

// ── AI Providers ────────────────────────────────────────────────────

const AI_PROVIDERS: { value: string; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'groq', label: 'Groq' },
];

// ── Settings Screen ──────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  // ── Section 1: Account ──────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');

  const [verifyToken, setVerifyToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  // ── Section 3: Billing Status ───────────────────────────────────
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState('');

  // ── Section 4: System Status ────────────────────────────────────
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemLoading, setSystemLoading] = useState(true);
  const [systemError, setSystemError] = useState('');

  // ── Sign Out ────────────────────────────────────────────────────
  const [loggingOut, setLoggingOut] = useState(false);

  // ── Billing actions ──────────────────────────────────────────────
  const [upgrading, setUpgrading] = useState(false);
  const [managing, setManaging] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');
  const [manageError, setManageError] = useState('');

  // ── Section 5: AI Providers ──────────────────────────────────────
  const [activeProvider, setActiveProviderState] = useState('openai');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savedKeys, setSavedKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);

  // ── Load saved provider & keys on mount ───────────────────────────

  useEffect(() => {
    async function loadKeys() {
      const provider = await api.getActiveProvider();
      setActiveProviderState(provider);

      const keys: Record<string, string> = {};
      for (const p of AI_PROVIDERS) {
        const key = await api.getApiKey(p.value);
        if (key) keys[p.value] = key;
      }
      setSavedKeys(keys);

      // If the active provider has a saved key, pre-fill input
      if (keys[provider]) {
        setApiKeyInput(keys[provider]);
      }
    }
    loadKeys();
  }, []);

  // ── Fetchers ────────────────────────────────────────────────────

  const fetchBillingStatus = useCallback(async () => {
    try {
      setBillingError('');
      const data = await api.getBillingStatus();
      setBillingStatus(data);
    } catch (e: unknown) {
      setBillingError(
        e instanceof Error ? e.message : 'Failed to load billing status.',
      );
    } finally {
      setBillingLoading(false);
    }
  }, []);

  const fetchSystemStatus = useCallback(async () => {
    try {
      setSystemError('');
      const data = await api.getSystemStatus();
      setSystemStatus(data);
    } catch (e: unknown) {
      setSystemError(
        e instanceof Error ? e.message : 'Failed to load system status.',
      );
    } finally {
      setSystemLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBillingStatus();
    fetchSystemStatus();
  }, [fetchBillingStatus, fetchSystemStatus]);

  // ── Handlers ────────────────────────────────────────────────────

  function startEditName() {
    setNewName(user?.name ?? '');
    setNameError('');
    setEditingName(true);
  }

  function cancelEditName() {
    setEditingName(false);
    setNewName('');
    setNameError('');
  }

  async function handleSaveName() {
    if (!newName.trim()) {
      setNameError('Name cannot be empty.');
      return;
    }
    setSavingName(true);
    setNameError('');
    try {
      await api.updateAccount({ name: newName.trim() });
      await refreshUser();
      setEditingName(false);
    } catch (e: unknown) {
      setNameError(e instanceof Error ? e.message : 'Failed to update name.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleVerifyEmail() {
    if (!verifyToken.trim()) return;
    setVerifying(true);
    setVerifyMsg('');
    try {
      await api.verifyEmail(verifyToken.trim());
      await refreshUser();
      setVerifyMsg('Email verified successfully!');
      setVerifyToken('');
    } catch (e: unknown) {
      setVerifyMsg(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResendVerification() {
    setResending(true);
    setResendMsg('');
    try {
      const res = await api.resendVerification();
      setResendMsg(res.detail || 'Verification email sent.');
    } catch (e: unknown) {
      setResendMsg(e instanceof Error ? e.message : 'Failed to resend.');
    } finally {
      setResending(false);
    }
  }

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const { url } = await api.startCheckout('pro');
      await Linking.openURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start checkout.';
      setManageError(msg);
    } finally {
      setUpgrading(false);
    }
  }

  async function handleManageBilling() {
    setManageError('');
    setManaging(true);
    try {
      const { url } = await api.openBillingPortal();
      Linking.openURL(url);
    } catch (e: unknown) {
      setManageError(e instanceof Error ? e.message : 'Failed to open billing portal.');
    } finally {
      setManaging(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  }

  // ── AI Provider handlers ─────────────────────────────────────────

  async function handleProviderChange(provider: string) {
    setActiveProviderState(provider);
    await api.setActiveProvider(provider);
    setShowProviderDropdown(false);
    setKeyError('');

    // Load saved key for this provider
    if (savedKeys[provider]) {
      setApiKeyInput(savedKeys[provider]);
      setEditingProvider(null);
    } else {
      setApiKeyInput('');
      setEditingProvider(provider);
    }
  }

  function handleEditKey() {
    setEditingProvider(activeProvider);
    setApiKeyInput(savedKeys[activeProvider] || '');
    setKeyError('');
  }

  async function handleSaveKey() {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setKeyError('API key cannot be empty.');
      return;
    }
    setSavingKey(true);
    setKeyError('');
    try {
      await api.setApiKey(activeProvider, trimmed);
      setSavedKeys((prev) => ({ ...prev, [activeProvider]: trimmed }));
      setEditingProvider(null);
    } catch (e: unknown) {
      setKeyError(e instanceof Error ? e.message : 'Failed to save key.');
    } finally {
      setSavingKey(false);
    }
  }

  function toggleKeyVisibility(provider: string) {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  }

  // ── Derived data ────────────────────────────────────────────────

  const planLabel = (user?.plan ?? 'FREE').toUpperCase();
  const isVerified = user?.email_verified ?? false;
  const planClr = planColor(planLabel);
  const planBg = planBgColor(planLabel);
  const planBdr = planBorderColor(planLabel);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══════════════════════════════════════════════════════════
            SECTION 1: ACCOUNT
            ═══════════════════════════════════════════════════════════ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>

          {/* Name */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Name</Text>
            {editingName ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Your name"
                  placeholderTextColor={C.muted}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />
                <TouchableOpacity
                  style={styles.editSaveBtn}
                  onPress={handleSaveName}
                  disabled={savingName}
                  activeOpacity={0.7}
                >
                  {savingName ? (
                    <ActivityIndicator size="small" color={C.cyan} />
                  ) : (
                    <Text style={styles.editSaveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editCancelBtn}
                  onPress={cancelEditName}
                  disabled={savingName}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={startEditName}
                activeOpacity={0.7}
                style={styles.valueRow}
              >
                <Text style={styles.value}>{user?.name ?? '—'}</Text>
                <Text style={styles.editHint}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {nameError ? <Text style={styles.inlineError}>{nameError}</Text> : null}

          {/* Email */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email ?? '—'}</Text>
          </View>

          {/* Verification */}
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Verification</Text>
            <View style={styles.verifyRow}>
              {isVerified ? (
                <Text style={styles.verifiedText}>✓ Verified</Text>
              ) : (
                <Text style={styles.unverifiedText}>⚠ Unverified</Text>
              )}
            </View>
          </View>

          {/* Unverified actions */}
          {!isVerified && (
            <View style={styles.verifyActions}>
              {/* Token input + Verify button */}
              <View style={styles.verifyTokenRow}>
                <TextInput
                  style={styles.verifyTokenInput}
                  value={verifyToken}
                  onChangeText={setVerifyToken}
                  placeholder="Verification token"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.verifyBtn}
                  onPress={handleVerifyEmail}
                  disabled={verifying || !verifyToken.trim()}
                  activeOpacity={0.7}
                >
                  {verifying ? (
                    <ActivityIndicator size="small" color={C.cyan} />
                  ) : (
                    <Text style={styles.verifyBtnText}>Verify</Text>
                  )}
                </TouchableOpacity>
              </View>
              {verifyMsg ? (
                <Text
                  style={[
                    styles.verifyMsg,
                    verifyMsg.includes('success') && styles.successMsg,
                  ]}
                >
                  {verifyMsg}
                </Text>
              ) : null}

              {/* Resend verification */}
              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResendVerification}
                disabled={resending}
                activeOpacity={0.7}
              >
                {resending ? (
                  <ActivityIndicator size="small" color={C.cyan} />
                ) : (
                  <Text style={styles.resendBtnText}>Resend verification email</Text>
                )}
              </TouchableOpacity>
              {resendMsg ? (
                <Text style={styles.verifyMsg}>{resendMsg}</Text>
              ) : null}
            </View>
          )}
        </View>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 2: PLAN & USAGE
            ═══════════════════════════════════════════════════════════ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Plan & Usage</Text>

          {/* Plan badge */}
          <View style={styles.planInfoRow}>
            <Text style={styles.label}>Current Plan</Text>
            <View
              style={[
                styles.planBadge,
                { backgroundColor: planBg, borderColor: planBdr },
              ]}
            >
              <Text style={[styles.planBadgeText, { color: planClr }]}>
                {planLabel}
              </Text>
            </View>
          </View>

          {/* Usage stats — only if present */}
          {user?.usage && user?.limits ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Projects</Text>
                <Text style={styles.value}>
                  {user.usage.projects ?? 0} / {user.limits.projects ?? 0}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Monthly Generations</Text>
                <Text style={styles.value}>
                  {user.usage.monthly_generations ?? 0} /{' '}
                  {user.limits.monthly_generations ?? 0}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Max Chapters</Text>
                <Text style={styles.value}>
                  {user.limits.max_chapters ?? '—'}
                </Text>
              </View>
            </>
          ) : null}

          {/* Upgrade / Manage Billing buttons */}
          <View style={styles.buttonGroup}>
            {planLabel === 'FREE' && (
              <TouchableOpacity
                style={[styles.upgradeBtn, upgrading && styles.buttonDisabled]}
                onPress={handleUpgrade}
                disabled={upgrading}
                activeOpacity={0.7}
              >
                {upgrading ? (
                  <ActivityIndicator size="small" color={C.cyan} />
                ) : (
                  <Text style={styles.upgradeBtnText}>Upgrade Plan</Text>
                )}
              </TouchableOpacity>
            )}
            {upgradeError ? (
              <Text style={styles.billingErrorText}>{upgradeError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.manageBillingBtn, managing && styles.buttonDisabled]}
              onPress={handleManageBilling}
              disabled={managing}
              activeOpacity={0.7}
            >
              {managing ? (
                <ActivityIndicator size="small" color={C.muted} />
              ) : (
                <Text style={styles.manageBillingBtnText}>Manage Billing</Text>
              )}
            </TouchableOpacity>
            {manageError ? (
              <Text style={styles.billingErrorText}>{manageError}</Text>
            ) : null}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 3: BILLING STATUS
            ═══════════════════════════════════════════════════════════ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Billing Status</Text>

          {billingLoading ? (
            <View style={styles.sectionLoading}>
              <ActivityIndicator size="small" color={C.cyan} />
              <Text style={styles.sectionLoadingText}>Loading...</Text>
            </View>
          ) : billingError ? (
            <View style={styles.sectionError}>
              <Text style={styles.sectionErrorText}>{billingError}</Text>
              <TouchableOpacity
                onPress={() => {
                  setBillingLoading(true);
                  fetchBillingStatus();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : billingStatus ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Stripe Enabled</Text>
                <Text
                  style={[
                    styles.value,
                    { color: billingStatus.enabled ? C.green : C.danger },
                  ]}
                >
                  {billingStatus.enabled ? 'Yes' : 'No'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Stripe Configured</Text>
                <Text
                  style={[
                    styles.value,
                    {
                      color: billingStatus.configured ? C.green : C.danger,
                    },
                  ]}
                >
                  {billingStatus.configured ? 'Yes' : 'No'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Current Plan</Text>
                <Text style={styles.value}>
                  {billingStatus.current_plan?.toUpperCase() ?? '—'}
                </Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.label}>Subscription</Text>
                <Text style={styles.value}>
                  {billingStatus.subscription
                    ? billingStatus.subscription.status
                    : 'No active subscription'}
                </Text>
              </View>

              {!billingStatus.configured && (
                <Text style={styles.billingSetupNote}>
                  Billing not set up. Configure Stripe in your web dashboard.
                </Text>
              )}
            </>
          ) : null}
        </View>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 4: SYSTEM STATUS
            ═══════════════════════════════════════════════════════════ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>System Status</Text>

          {systemLoading ? (
            <View style={styles.sectionLoading}>
              <ActivityIndicator size="small" color={C.cyan} />
              <Text style={styles.sectionLoadingText}>Loading...</Text>
            </View>
          ) : systemError ? (
            <View style={styles.sectionError}>
              <Text style={styles.sectionErrorText}>{systemError}</Text>
              <TouchableOpacity
                onPress={() => {
                  setSystemLoading(true);
                  fetchSystemStatus();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : systemStatus ? (
            <>
              {/* AI mode indicator */}
              <View style={styles.statusModeRow}>
                <View
                  style={[
                    styles.statusModeDot,
                    {
                      backgroundColor: systemStatus.live_ai
                        ? C.green
                        : C.orange,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusModeLabel,
                    {
                      color: systemStatus.live_ai ? C.green : C.orange,
                    },
                  ]}
                >
                  {systemStatus.live_ai ? 'LIVE AI' : 'LOCAL DEMO'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Provider</Text>
                <Text style={styles.value}>{systemStatus.provider}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Model</Text>
                <Text style={styles.value}>{systemStatus.model}</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.label}>Queue Depth</Text>
                <Text style={styles.value}>{systemStatus.queue_depth}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 5: AI PROVIDERS
            ═══════════════════════════════════════════════════════════ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI Providers</Text>

          {/* Provider selector */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Provider</Text>
            <TouchableOpacity
              style={styles.providerSelector}
              onPress={() => setShowProviderDropdown(!showProviderDropdown)}
              activeOpacity={0.7}
            >
              <Text style={styles.providerSelectorText}>
                {AI_PROVIDERS.find((p) => p.value === activeProvider)?.label ??
                  'OpenAI'}
              </Text>
              <Text style={styles.providerArrow}>▾</Text>
            </TouchableOpacity>
          </View>

          {/* Dropdown options */}
          {showProviderDropdown && (
            <View style={styles.providerDropdown}>
              {AI_PROVIDERS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.providerOption,
                    activeProvider === p.value && styles.providerOptionActive,
                  ]}
                  onPress={() => handleProviderChange(p.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.providerOptionText,
                      activeProvider === p.value &&
                        styles.providerOptionTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* API Key input */}
          <View style={[styles.infoRow, { marginTop: 14 }]}>
            <Text style={styles.label}>API Key</Text>
            {editingProvider === activeProvider ||
            !savedKeys[activeProvider] ? (
              <View style={styles.keyInputRow}>
                <TextInput
                  style={styles.keyInput}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  placeholder="sk-..."
                  placeholderTextColor={C.muted}
                  secureTextEntry={!showKeys[activeProvider]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.keyToggle}
                  onPress={() => toggleKeyVisibility(activeProvider)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.keyToggleText}>
                    {showKeys[activeProvider] ? '🙈' : '👁'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.valueRow}
                onPress={handleEditKey}
                activeOpacity={0.7}
              >
                <Text style={styles.maskedKey}>
                  {'••••••••' + savedKeys[activeProvider].slice(-8)}
                </Text>
                <Text style={styles.editHint}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[
              styles.saveKeyBtn,
              (savingKey || !apiKeyInput.trim()) && styles.buttonDisabled,
            ]}
            onPress={handleSaveKey}
            disabled={savingKey || !apiKeyInput.trim()}
            activeOpacity={0.7}
          >
            {savingKey ? (
              <ActivityIndicator size="small" color={C.cyan} />
            ) : (
              <Text style={styles.saveKeyBtnText}>
                {savedKeys[activeProvider] ? 'Update Key' : 'Save Key'}
              </Text>
            )}
          </TouchableOpacity>

          {keyError ? (
            <Text style={styles.inlineError}>{keyError}</Text>
          ) : null}

          <Text style={styles.keyNote}>
            Your key is stored locally and sent with each production request.
            The backend will use it if supported.
          </Text>
        </View>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 6: SIGN OUT
            ═══════════════════════════════════════════════════════════ */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.6}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={C.muted} />
          ) : (
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          )}
        </TouchableOpacity>

        {/* bottom spacer */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── BOTTOM NAV ⚙️ active ──────────────────────────────── */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 6 }]}>
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={() => router.replace('/(app)')}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={() => router.push('/(app)/workflows')}
        >
          <Text style={styles.navIcon}>⚡</Text>
          <Text style={styles.navLabel}>Workflows</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={() => router.push('/(app)/marketplace')}
        >
          <Text style={styles.navIcon}>🛒</Text>
          <Text style={styles.navLabel}>Marketplace</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <Text style={styles.navIconActive}>⚙️</Text>
          <Text style={styles.navLabelActive}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: C.text,
  },

  // Scroll
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 8,
  },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  label: {
    fontSize: 14,
    color: C.muted,
    flexShrink: 0,
  },
  value: {
    fontSize: 14,
    color: C.text,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editHint: {
    fontSize: 12,
    color: C.cyan,
    fontWeight: '500',
  },

  // Inline name editing
  editRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  editInput: {
    flex: 1,
    backgroundColor: C.cardAlt,
    color: C.text,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    maxWidth: 140,
  },
  editSaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: C.cyan + '18',
    borderWidth: 1,
    borderColor: C.cyan + '40',
    minWidth: 44,
    alignItems: 'center',
  },
  editSaveBtnText: {
    color: C.cyan,
    fontSize: 12,
    fontWeight: '600',
  },
  editCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  editCancelBtnText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  inlineError: {
    color: C.danger,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },

  // Verification
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedText: {
    color: C.cyan,
    fontSize: 14,
    fontWeight: '500',
  },
  unverifiedText: {
    color: C.orange,
    fontSize: 14,
    fontWeight: '500',
  },
  verifyActions: {
    marginTop: 12,
    gap: 8,
  },
  verifyTokenRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  verifyTokenInput: {
    flex: 1,
    backgroundColor: C.cardAlt,
    color: C.text,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  verifyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.cyan + '40',
    backgroundColor: C.cyan + '12',
    minWidth: 68,
    alignItems: 'center',
  },
  verifyBtnText: {
    color: C.cyan,
    fontSize: 13,
    fontWeight: '600',
  },
  verifyMsg: {
    color: C.muted,
    fontSize: 12,
  },
  successMsg: {
    color: C.green,
  },
  resendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  resendBtnText: {
    color: C.cyan,
    fontSize: 13,
    fontWeight: '500',
  },

  // Plan & Usage
  planInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  planBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  buttonGroup: {
    marginTop: 14,
    gap: 10,
  },
  upgradeBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.cyan + '18',
    borderWidth: 1,
    borderColor: C.cyan + '40',
    alignItems: 'center',
  },
  upgradeBtnText: {
    color: C.cyan,
    fontSize: 14,
    fontWeight: '600',
  },
  manageBillingBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  manageBillingBtnText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  billingErrorText: {
    color: C.danger,
    fontSize: 12,
    textAlign: 'center',
  },

  // Section loading/error
  sectionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  sectionLoadingText: {
    color: C.muted,
    fontSize: 13,
  },
  sectionError: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sectionErrorText: {
    color: C.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryText: {
    color: C.cyan,
    fontSize: 13,
    fontWeight: '600',
  },
  billingSetupNote: {
    color: C.orange,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // System status mode
  statusModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  statusModeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusModeLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Sign out
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.danger + '20',
  },
  logoutBtnText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '500',
  },

  // ── AI Providers ──────────────────────────────────────────────────

  // Provider selector (dropdown trigger)
  providerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  providerSelectorText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '500',
  },
  providerArrow: {
    color: C.muted,
    fontSize: 12,
  },

  // Dropdown
  providerDropdown: {
    backgroundColor: C.cardAlt,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    marginTop: 6,
    overflow: 'hidden',
  },
  providerOption: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  providerOptionActive: {
    backgroundColor: C.cyan + '12',
  },
  providerOptionText: {
    color: C.muted,
    fontSize: 14,
  },
  providerOptionTextActive: {
    color: C.cyan,
    fontWeight: '600',
  },

  // Key input
  keyInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  keyInput: {
    flex: 1,
    backgroundColor: C.cardAlt,
    color: C.text,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    fontFamily: 'monospace',
    maxWidth: 180,
  },
  keyToggle: {
    padding: 6,
    borderRadius: 6,
  },
  keyToggleText: {
    fontSize: 16,
  },

  // Masked key display
  maskedKey: {
    fontSize: 14,
    color: C.text,
    fontWeight: '500',
    fontFamily: 'monospace',
  },

  // Save button
  saveKeyBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.purple + '18',
    borderWidth: 1,
    borderColor: C.purple + '40',
    alignItems: 'center',
  },
  saveKeyBtnText: {
    color: C.purple,
    fontSize: 14,
    fontWeight: '600',
  },

  // Key note
  keyNote: {
    color: C.muted,
    fontSize: 11,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Bottom nav
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
    opacity: 0.4,
  },
  navLabel: {
    fontSize: 10,
    color: C.muted,
  },
  navIconActive: {
    fontSize: 20,
    marginBottom: 2,
  },
  navLabelActive: {
    fontSize: 10,
    color: C.cyan,
    fontWeight: '600',
  },
});
