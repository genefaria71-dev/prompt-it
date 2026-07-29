import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as api from '../../services/api';
import type { MarketplaceWorkflow, InstalledWorkflow } from '../../services/api';

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
  pink: '#ff6f91',
  blue: '#4da6ff',
};

// ── Helpers ──────────────────────────────────────────────────────────

function formatInstalls(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M installs`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k installs`;
  return `${count} install${count !== 1 ? 's' : ''}`;
}

function formatPrice(pence: number): string {
  if (pence === 0) return 'Free';
  return `£${(pence / 100).toFixed(2)}`;
}

function categoryColor(category: string): string {
  const map: Record<string, string> = {
    writing: C.cyan,
    editing: C.purple,
    marketing: C.orange,
    production: C.blue,
    research: C.yellow,
    general: C.muted,
  };
  return map[category?.toLowerCase()] ?? C.muted;
}

// ── Marketplace Screen ───────────────────────────────────────────────

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();

  const [workflows, setWorkflows] = useState<MarketplaceWorkflow[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const [marketplace, installed] = await Promise.all([
        api.getMarketplaceWorkflows(),
        api.getInstalledWorkflows(),
      ]);
      setWorkflows(marketplace);
      setInstalledIds(new Set(installed.map((wf: InstalledWorkflow) => wf.id)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load marketplace.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchData();
  }

  async function handleInstall(workflowId: string) {
    setInstalling(workflowId);
    try {
      await api.installWorkflow(workflowId, null);
      // Refresh both marketplace and installed lists
      await fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Install failed.';
      setError(msg);
    } finally {
      setInstalling(null);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marketplace</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.cyan}
            colors={[C.cyan]}
          />
        }
      >
        {/* ── LOADING ──────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={C.cyan} />
            <Text style={styles.stateText}>Loading marketplace...</Text>
          </View>
        ) : error ? (
          /* ── ERROR ─────────────────────────────────────────── */
          <View style={styles.stateContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={handleRefresh} activeOpacity={0.7}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : workflows.length === 0 ? (
          /* ── EMPTY ──────────────────────────────────────────── */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyText}>No published workflows yet.</Text>
          </View>
        ) : (
          /* ── WORKFLOW CARDS ─────────────────────────────────── */
          workflows.map((wf) => {
            const isInstalled = installedIds.has(wf.id);
            const isThisInstalling = installing === wf.id;

            return (
              <View key={wf.id} style={styles.card}>
                {/* Name */}
                <Text style={styles.cardName} numberOfLines={1}>
                  {wf.name}
                </Text>

                {/* Creator */}
                <Text style={styles.creator} numberOfLines={1}>
                  by {wf.creator_name}
                </Text>

                {/* Meta row: rating, installs, price, category */}
                <View style={styles.metaRow}>
                  {/* Rating */}
                  <View style={styles.metaItem}>
                    <Text style={styles.metaIcon}>⭐</Text>
                    <Text style={styles.metaText}>
                      {wf.average_rating.toFixed(1)} ({wf.rating_count})
                    </Text>
                  </View>

                  {/* Installs */}
                  <View style={styles.metaItem}>
                    <Text style={styles.metaText}>
                      {formatInstalls(wf.install_count)}
                    </Text>
                  </View>

                  {/* Price */}
                  <View style={styles.metaItem}>
                    <Text
                      style={[
                        styles.metaText,
                        wf.price_pence === 0 && styles.freeText,
                      ]}
                    >
                      {formatPrice(wf.price_pence)}
                    </Text>
                  </View>

                  {/* Category badge */}
                  <View
                    style={[
                      styles.categoryBadge,
                      {
                        backgroundColor: categoryColor(wf.category) + '1a',
                        borderColor: categoryColor(wf.category) + '40',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryBadgeText,
                        { color: categoryColor(wf.category) },
                      ]}
                    >
                      {wf.category}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                {wf.description ? (
                  <Text style={styles.description} numberOfLines={3}>
                    {wf.description}
                  </Text>
                ) : null}

                {/* Install / Installed button */}
                {isInstalled ? (
                  <View style={styles.installedBadge}>
                    <Text style={styles.installedText}>✓ Installed</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.installBtn}
                    activeOpacity={0.7}
                    disabled={isThisInstalling}
                    onPress={() => handleInstall(wf.id)}
                  >
                    {isThisInstalling ? (
                      <ActivityIndicator size="small" color={C.cyan} />
                    ) : (
                      <Text style={styles.installBtnText}>Install</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        {/* bottom spacer */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── BOTTOM NAV ──────────────────────────────────────────── */}
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

        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <Text style={styles.navIconActive}>🛒</Text>
          <Text style={styles.navLabelActive}>Marketplace</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={() => router.push('/(app)/settings')}
        >
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={styles.navLabel}>Settings</Text>
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

  // State containers
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  stateText: {
    color: C.muted,
    fontSize: 13,
    marginTop: 14,
  },
  errorText: {
    color: C.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryText: {
    color: C.cyan,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  creator: {
    fontSize: 12,
    color: C.muted,
    marginBottom: 10,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaIcon: {
    fontSize: 13,
  },
  metaText: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '500',
  },
  freeText: {
    color: C.green,
  },

  // Category badge
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Description
  description: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 18,
    marginBottom: 12,
  },

  // Install button
  installBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.cyan + '50',
    backgroundColor: C.cyan + '0d',
    minWidth: 90,
    alignItems: 'center',
  },
  installBtnText: {
    color: C.cyan,
    fontSize: 13,
    fontWeight: '600',
  },

  // Installed badge
  installedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.green + '12',
    borderWidth: 1,
    borderColor: C.green + '30',
  },
  installedText: {
    color: C.green,
    fontSize: 13,
    fontWeight: '600',
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
