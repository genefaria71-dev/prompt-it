import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as api from '../../services/api';
import type { Workflow, InstalledWorkflow } from '../../services/api';

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

// ── Helpers ──────────────────────────────────────────────────────────

function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: C.muted,
    published: C.green,
    installed: C.cyan,
    active: C.cyan,
    inactive: C.muted,
    error: C.danger,
    pending: C.orange,
  };
  return map[status?.toLowerCase()] ?? C.muted;
}

function visibilityBadge(visibility: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    public: { label: 'Public', color: C.green },
    private: { label: 'Private', color: C.muted },
    unlisted: { label: 'Unlisted', color: C.orange },
    marketplace: { label: 'Marketplace', color: C.cyan },
  };
  return map[visibility?.toLowerCase()] ?? { label: visibility, color: C.muted };
}

// ── Bottom Nav ───────────────────────────────────────────────────────

function BottomNav({ active }: { active: 'home' | 'workflows' }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 6 }]}>
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.7}
        onPress={() => router.replace('/(app)')}
      >
        <Text style={active === 'home' ? styles.navIconActive : styles.navIcon}>
          🏠
        </Text>
        <Text
          style={active === 'home' ? styles.navLabelActive : styles.navLabel}
        >
          Home
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
        <Text
          style={
            active === 'workflows' ? styles.navIconActive : styles.navIcon
          }
        >
          ⚡
        </Text>
        <Text
          style={
            active === 'workflows' ? styles.navLabelActive : styles.navLabel
          }
        >
          Workflows
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.7}
        onPress={() => router.push('/(app)/marketplace')}
      >
        <Text style={styles.navIcon}>🛒</Text>
        <Text style={styles.navLabel}>Marketplace</Text>
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
  );
}

// ── My Workflows Tab ─────────────────────────────────────────────────

function MyWorkflowsTab() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setError('');
      const data = await api.getMyWorkflows();
      setWorkflows(data);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Failed to load workflows.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  async function handlePublish(workflowId: string) {
    setPublishing(workflowId);
    try {
      await api.publishWorkflow(workflowId);
      await fetch();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Failed to publish workflow.',
      );
    } finally {
      setPublishing(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color={C.cyan} />
        <Text style={styles.stateText}>Loading workflows...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetch} activeOpacity={0.7}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (workflows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>⚡</Text>
        <Text style={styles.emptyText}>No workflows created yet.</Text>
      </View>
    );
  }

  return (
    <View>
      {workflows.map((wf) => {
        const vis = visibilityBadge(wf.visibility);
        const showPublish =
          wf.status !== 'published' && wf.visibility !== 'private';
        return (
          <View key={wf.id} style={styles.workflowCard}>
            <Text style={styles.workflowName} numberOfLines={1}>
              {wf.name}
            </Text>

            {/* Meta row */}
            <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>{wf.category}</Text>
              </View>

              <View
                style={[
                  styles.visBadge,
                  { borderColor: vis.color, backgroundColor: vis.color + '14' },
                ]}
              >
                <Text style={[styles.visBadgeText, { color: vis.color }]}>
                  {vis.label}
                </Text>
              </View>

              <View style={styles.metaDotRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: statusColor(wf.status) },
                  ]}
                />
                <Text style={styles.statusLabel}>{wf.status}</Text>
              </View>

              <Text style={styles.versionLabel}>v{wf.version}</Text>
            </View>

            {/* Description */}
            {wf.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {wf.description}
              </Text>
            ) : null}

            {/* Publish button */}
            {showPublish ? (
              <TouchableOpacity
                style={styles.publishBtn}
                activeOpacity={0.7}
                disabled={publishing === wf.id}
                onPress={() => handlePublish(wf.id)}
              >
                {publishing === wf.id ? (
                  <ActivityIndicator size="small" color={C.cyan} />
                ) : (
                  <Text style={styles.publishBtnText}>Publish</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ── Installed Tab ────────────────────────────────────────────────────

function InstalledTab() {
  const [installed, setInstalled] = useState<InstalledWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetch = useCallback(async () => {
    try {
      setError('');
      const data = await api.getInstalledWorkflows();
      setInstalled(data);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Failed to load installed workflows.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color={C.cyan} />
        <Text style={styles.stateText}>Loading installed workflows...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetch} activeOpacity={0.7}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (installed.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.emptyText}>
          No workflows installed yet. Browse the Marketplace to find
          workflows.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {installed.map((wf) => (
        <View key={wf.id} style={styles.workflowCard}>
          <Text style={styles.workflowName} numberOfLines={1}>
            {wf.name}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>{wf.category}</Text>
            </View>

            <View style={styles.metaDotRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusColor(wf.status) },
                ]}
              />
              <Text style={styles.statusLabel}>{wf.status}</Text>
            </View>
          </View>

          {wf.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {wf.description}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ── Workflows Screen ─────────────────────────────────────────────────

export default function WorkflowsScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'my' | 'installed'>('my');

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workflows</Text>
      </View>

      {/* Segmented control */}
      <View style={styles.segmentedContainer}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segment,
              tab === 'my' && styles.segmentActive,
            ]}
            activeOpacity={0.7}
            onPress={() => setTab('my')}
          >
            <Text
              style={[
                styles.segmentText,
                tab === 'my' && styles.segmentTextActive,
              ]}
            >
              My Workflows
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segment,
              tab === 'installed' && styles.segmentActive,
            ]}
            activeOpacity={0.7}
            onPress={() => setTab('installed')}
          >
            <Text
              style={[
                styles.segmentText,
                tab === 'installed' && styles.segmentTextActive,
              ]}
            >
              Installed
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'my' ? <MyWorkflowsTab /> : <InstalledTab />}

        {/* bottom spacer */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bottom Nav */}
      <BottomNav active="workflows" />
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

  // Segmented control
  segmentedContainer: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: C.cyan + '18',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.muted,
  },
  segmentTextActive: {
    color: C.cyan,
    fontWeight: '700',
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
    paddingVertical: 40,
  },
  stateText: {
    color: C.muted,
    fontSize: 13,
    marginTop: 10,
  },
  errorText: {
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

  // Workflow card
  workflowCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  workflowName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    marginBottom: 10,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaBadge: {
    backgroundColor: C.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  metaBadgeText: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  visBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  visBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  versionLabel: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '500',
  },

  // Description
  description: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 18,
    marginBottom: 8,
  },

  // Publish button
  publishBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.cyan + '50',
    backgroundColor: C.cyan + '0d',
    marginTop: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  publishBtnText: {
    color: C.cyan,
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
