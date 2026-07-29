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
import { useAuth } from '../../contexts/AuthContext';
import * as api from '../../services/api';
import type { Project } from '../../services/api';

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
};

// ── Helpers ──────────────────────────────────────────────────────────

function stageBadgeColor(stage: string): string {
  const map: Record<string, string> = {
    ideation: C.purple,
    scripting: C.cyan,
    production: C.cyan,
    post: C.orange,
    complete: C.green,
  };
  return map[stage?.toLowerCase()] ?? C.muted;
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    queued: C.muted,
    running: C.cyan,
    complete: C.green,
    failed: C.danger,
  };
  return map[status?.toLowerCase()] ?? C.muted;
}

function statusIcon(status: string): string {
  const map: Record<string, string> = {
    queued: '⏳',
    running: '▶',
    complete: '✓',
    failed: '✕',
  };
  return map[status?.toLowerCase()] ?? '○';
}

// ── Dashboard ────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projectsError, setProjectsError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const fetchProjects = useCallback(async () => {
    try {
      setProjectsError('');
      const data = await api.getProjects();
      setProjects(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load projects.';
      setProjectsError(msg);
    } finally {
      setProjectsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchProjects();
  }

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
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

  const planLabel = (user?.plan ?? 'FREE').toUpperCase();
  const isVerified = user?.email_verified ?? false;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>
            <Text style={styles.brandBold}>PROMPT</Text>
            <Text style={styles.brandAccent}>IT</Text>
          </Text>
          <Text style={styles.greeting}>
            {user?.name ? `Welcome, ${user.name.split(' ')[0]}` : 'Welcome'}
          </Text>
        </View>
        <View style={styles.planPill}>
          <View
            style={[
              styles.planDot,
              {
                backgroundColor:
                  planLabel === 'PRO' ? C.cyan : planLabel === 'ENTERPRISE' ? C.purple : C.muted,
              },
            ]}
          />
          <Text style={styles.planPillText}>{planLabel}</Text>
        </View>
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
        {/* ── USER INFO CARD ─────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email ?? '—'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Plan</Text>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{planLabel}</Text>
            </View>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Verification</Text>
            <View style={styles.verifyRow}>
              {isVerified ? (
                <Text style={styles.verifiedText}>✓ Verified</Text>
              ) : (
                <>
                  <Text style={styles.unverifiedText}>⚠ Unverified</Text>
                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={handleResendVerification}
                    disabled={resending}
                    activeOpacity={0.7}
                  >
                    {resending ? (
                      <ActivityIndicator size="small" color={C.cyan} />
                    ) : (
                      <Text style={styles.resendBtnText}>Resend</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          {resendMsg ? <Text style={styles.resendMsg}>{resendMsg}</Text> : null}
        </View>

        {/* ── PROJECTS SECTION ───────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Projects</Text>
          <TouchableOpacity
            style={styles.newProjectBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/(app)/create-project')}
          >
            <Text style={styles.newProjectBtnText}>+ New Project</Text>
          </TouchableOpacity>
        </View>

        {projectsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={C.cyan} />
            <Text style={styles.loadingText}>Loading projects...</Text>
          </View>
        ) : projectsError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{projectsError}</Text>
            <TouchableOpacity onPress={handleRefresh} activeOpacity={0.7}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : projects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎬</Text>
            <Text style={styles.emptyText}>
              No projects yet. Create your first production project.
            </Text>
          </View>
        ) : (
          projects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={styles.projectCard}
              activeOpacity={0.7}
              onPress={() => router.push(`/(app)/project/${project.id}`)}
            >
              <View style={styles.projectHeader}>
                <Text style={styles.projectTitle} numberOfLines={1}>
                  {project.title}
                </Text>
                <View style={[styles.stageBadge, { backgroundColor: stageBadgeColor(project.stage) + '1a', borderColor: stageBadgeColor(project.stage) + '40' }]}>
                  <Text style={[styles.stageBadgeText, { color: stageBadgeColor(project.stage) }]}>
                    {project.stage}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.max(0, project.progress))}%`,
                      backgroundColor: statusColor(project.status),
                    },
                  ]}
                />
              </View>

              <View style={styles.projectFooter}>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusIcon, { color: statusColor(project.status) }]}>
                    {statusIcon(project.status)}
                  </Text>
                  <Text style={[styles.statusText, { color: statusColor(project.status) }]}>
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                  </Text>
                </View>
                {project.message ? (
                  <Text style={styles.projectMessage} numberOfLines={1}>
                    {project.message}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* ── SIGN OUT ──────────────────────────────────────────── */}
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

        {/* bottom spacer so content doesn't hide behind nav */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── BOTTOM NAV ──────────────────────────────────────────── */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 6 }]}>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navLabelActive}>Home</Text>
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
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerLeft: {},
  brand: {
    fontSize: 26,
    marginBottom: 2,
  },
  brandBold: {
    fontWeight: '800',
    color: C.text,
  },
  brandAccent: {
    fontWeight: '800',
    color: C.cyan,
  },
  greeting: {
    fontSize: 13,
    color: C.muted,
  },
  planPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 2,
  },
  planDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  planPillText: {
    color: C.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
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
  },
  value: {
    fontSize: 14,
    color: C.text,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  planBadge: {
    backgroundColor: C.cyan + '1a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.cyan + '30',
  },
  planBadgeText: {
    color: C.cyan,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
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
  resendBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  resendBtnText: {
    color: C.cyan,
    fontSize: 12,
    fontWeight: '600',
  },
  resendMsg: {
    color: C.muted,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
  },
  newProjectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.cyan + '50',
    backgroundColor: C.cyan + '12',
  },
  newProjectBtnText: {
    color: C.cyan,
    fontSize: 13,
    fontWeight: '600',
  },

  // Loading / Empty / Error
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: C.muted,
    fontSize: 13,
    marginTop: 10,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 32,
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

  // Project card
  projectCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    flex: 1,
    marginRight: 10,
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 5,
    backgroundColor: C.cardAlt,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusIcon: {
    fontSize: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  projectMessage: {
    fontSize: 11,
    color: C.muted,
    flexShrink: 1,
    maxWidth: '50%',
    textAlign: 'right',
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
