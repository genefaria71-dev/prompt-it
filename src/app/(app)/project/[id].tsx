import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as api from '../../../services/api';
import type { Project, ProcessingTask, AgentRun } from '../../../services/api';

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

// ── Helpers (same as dashboard) ─────────────────────────────────────

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

function taskStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: C.muted,
    running: C.cyan,
    complete: C.green,
    completed: C.green,
    failed: C.danger,
    error: C.danger,
  };
  return map[status?.toLowerCase()] ?? C.muted;
}

// ── Project Detail Screen ───────────────────────────────────────────

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  // ── State ─────────────────────────────────────────────────────────

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tasks, setTasks] = useState<ProcessingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState('');

  const [agents, setAgents] = useState<AgentRun[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState('');

  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch project ─────────────────────────────────────────────────

  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      setError('');
      const data = await api.getProject(id);
      setProject(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load project.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTasks = useCallback(async () => {
    if (!id) return;
    try {
      setTasksError('');
      const data = await api.getProcessingTasks(id);
      setTasks(data);
    } catch (e: unknown) {
      setTasksError(
        e instanceof Error ? e.message : 'Failed to load processing tasks.',
      );
    } finally {
      setTasksLoading(false);
    }
  }, [id]);

  const fetchAgents = useCallback(async () => {
    if (!id) return;
    try {
      setAgentsError('');
      const data = await api.getAgentRuns(id);
      setAgents(data);
    } catch (e: unknown) {
      setAgentsError(
        e instanceof Error ? e.message : 'Failed to load agent runs.',
      );
    } finally {
      setAgentsLoading(false);
    }
  }, [id]);

  // ── Initial load ──────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setTasksLoading(true);
    setAgentsLoading(true);
    fetchProject();
    fetchTasks();
    fetchAgents();
  }, [id, fetchProject, fetchTasks, fetchAgents]);

  // ── Cleanup polling on unmount ────────────────────────────────────

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // ── Start polling project status ──────────────────────────────────

  function startPolling() {
    if (pollingRef.current) return; // already polling
    setPolling(true);

    pollingRef.current = setInterval(async () => {
      try {
        const data = await api.getProject(id!);
        setProject(data);

        // Stop polling when terminal state reached
        if (data.status === 'complete' || data.status === 'failed') {
          stopPolling();
          // Refresh tasks and agents after completion
          setTasksLoading(true);
          setAgentsLoading(true);
          fetchTasks();
          fetchAgents();
        }
      } catch {
        // keep polling on transient errors
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setPolling(false);
  }

  // ── Start production ──────────────────────────────────────────────

  async function handleStartProduction() {
    if (!id || !project) return;
    setStarting(true);
    try {
      await api.startProject(id);
      // Start polling after queuing
      startPolling();
      // Refresh tasks
      setTasksLoading(true);
      fetchTasks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start production.');
    } finally {
      setStarting(false);
    }
  }

  // ── Pull-to-refresh ───────────────────────────────────────────────

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchProject(), fetchTasks(), fetchAgents()]);
    setRefreshing(false);
  }

  // ── Export handlers ───────────────────────────────────────────────

  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState('');

  async function handleExportDocx() {
    setExportError('');
    setExportingDocx(true);
    try {
      const token = await api.getToken();
      const url = `https://prompt-it-web.onrender.com/api/projects/${id}/export/docx?token=${encodeURIComponent(token ?? '')}`;
      await Linking.openURL(url);
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : 'Failed to export DOCX.');
    } finally {
      setExportingDocx(false);
    }
  }

  async function handleExportPdf() {
    setExportError('');
    setExportingPdf(true);
    try {
      const token = await api.getToken();
      const url = `https://prompt-it-web.onrender.com/api/projects/${id}/export/pdf?token=${encodeURIComponent(token ?? '')}`;
      await Linking.openURL(url);
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : 'Failed to export PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  // ── Derived values ────────────────────────────────────────────────

  const isRunning =
    project?.status === 'queued' || project?.status === 'running';
  const isComplete = project?.status === 'complete';
  const isDisabled = isRunning || isComplete || starting;

  function startButtonText(): string {
    if (starting) return 'Queueing…';
    if (project?.status === 'queued') return 'Waiting in queue…';
    if (project?.status === 'running') return 'Production running…';
    if (project?.status === 'complete') return 'Production complete';
    return 'Queue Production';
  }

  // ── Loading state ─────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.cyan} />
        <Text style={styles.loadingText}>Loading project…</Text>
      </View>
    );
  }

  // ── Error state ───────────────────────────────────────────────────

  if (error && !project) {
    return (
      <View style={[styles.centered, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButtonTop}
          onPress={() => router.back()}
          activeOpacity={0.6}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              fetchProject();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!project) return null;

  const progressPct = Math.min(100, Math.max(0, project.progress));

  // ── Render ────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.6}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {project.title}
        </Text>
        <View style={styles.headerRight}>
          {polling ? (
            <View style={styles.pollingIndicator}>
              <View style={styles.pollingDot} />
              <Text style={styles.pollingText}>Live</Text>
            </View>
          ) : null}
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
        {/* ── PROJECT HEADER CARD ──────────────────────────────────── */}
        <View style={styles.card}>
          {/* Title */}
          <Text style={styles.projectTitle}>{project.title}</Text>

          {/* Stage badge */}
          <View style={styles.badgesRow}>
            <View
              style={[
                styles.stageBadge,
                {
                  backgroundColor: stageBadgeColor(project.stage) + '1a',
                  borderColor: stageBadgeColor(project.stage) + '40',
                },
              ]}
            >
              <Text
                style={[
                  styles.stageBadgeText,
                  { color: stageBadgeColor(project.stage) },
                ]}
              >
                {project.stage}
              </Text>
            </View>

            {/* Status with icon */}
            <View style={styles.statusRow}>
              <Text
                style={[styles.statusIcon, { color: statusColor(project.status) }]}
              >
                {statusIcon(project.status)}
              </Text>
              <Text
                style={[styles.statusText, { color: statusColor(project.status) }]}
              >
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPct}%`,
                  backgroundColor: statusColor(project.status),
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>{progressPct}%</Text>

          {/* Message */}
          {project.message ? (
            <Text style={styles.messageText}>{project.message}</Text>
          ) : null}
        </View>

        {/* ── PRODUCTION CONTROLS ──────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Production</Text>

          <TouchableOpacity
            style={[
              styles.startButton,
              isDisabled && styles.startButtonDisabled,
            ]}
            onPress={handleStartProduction}
            disabled={isDisabled}
            activeOpacity={0.7}
          >
            {starting ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : (
              <Text
                style={[
                  styles.startButtonText,
                  isDisabled && styles.startButtonTextDisabled,
                ]}
              >
                {startButtonText()}
              </Text>
            )}
          </TouchableOpacity>

          {polling && (
            <View style={styles.pollingBanner}>
              <View style={styles.pollingDotSmall} />
              <Text style={styles.pollingBannerText}>
                Polling for updates every 2s…
              </Text>
            </View>
          )}
        </View>

        {/* ── PROCESSING TASKS ─────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Processing Tasks</Text>

          {tasksLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={C.cyan} />
              <Text style={styles.inlineLoadingText}>Loading tasks…</Text>
            </View>
          ) : tasksError ? (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{tasksError}</Text>
              <TouchableOpacity
                onPress={() => {
                  setTasksLoading(true);
                  fetchTasks();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.retryLink}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : tasks.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>No processing tasks yet.</Text>
            </View>
          ) : (
            tasks.map((task, index) => (
              <View key={`task-${index}`} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{task.task_type}</Text>
                  <View style={styles.itemStatusRow}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: taskStatusColor(task.status) },
                      ]}
                    />
                    <Text
                      style={[
                        styles.itemStatusText,
                        { color: taskStatusColor(task.status) },
                      ]}
                    >
                      {task.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.itemSubtitle}>
                  Executor: {task.executor}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ── AGENT RUNS ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Agent Runs</Text>

          {agentsLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={C.cyan} />
              <Text style={styles.inlineLoadingText}>Loading agents…</Text>
            </View>
          ) : agentsError ? (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{agentsError}</Text>
              <TouchableOpacity
                onPress={() => {
                  setAgentsLoading(true);
                  fetchAgents();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.retryLink}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : agents.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>No agent runs yet.</Text>
            </View>
          ) : (
            agents.map((agent) => (
              <View key={agent.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{agent.name}</Text>
                  <View style={styles.itemStatusRow}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: taskStatusColor(agent.status) },
                      ]}
                    />
                    <Text
                      style={[
                        styles.itemStatusText,
                        { color: taskStatusColor(agent.status) },
                      ]}
                    >
                      {agent.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── EXPORTS ───────────────────────────────────────────────── */}
        {isComplete && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Exports</Text>

            <TouchableOpacity
              style={[styles.exportButton, exportingDocx && styles.exportButtonDisabled]}
              onPress={handleExportDocx}
              activeOpacity={0.7}
              disabled={exportingDocx}
            >
              {exportingDocx ? (
                <ActivityIndicator size="small" color={C.cyan} />
              ) : (
                <Text style={styles.exportIcon}>📄</Text>
              )}
              <Text style={styles.exportText}>
                {exportingDocx ? 'Downloading…' : 'Download DOCX'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportButton, exportingPdf && styles.exportButtonDisabled]}
              onPress={handleExportPdf}
              activeOpacity={0.7}
              disabled={exportingPdf}
            >
              {exportingPdf ? (
                <ActivityIndicator size="small" color={C.cyan} />
              ) : (
                <Text style={styles.exportIcon}>📑</Text>
              )}
              <Text style={styles.exportText}>
                {exportingPdf ? 'Downloading…' : 'Download PDF'}
              </Text>
            </TouchableOpacity>

            {exportError ? (
              <Text style={styles.exportErrorText}>{exportError}</Text>
            ) : null}
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: C.muted,
    fontSize: 14,
    marginTop: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonTop: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backArrow: {
    color: C.text,
    fontSize: 20,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  pollingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pollingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.cyan,
  },
  pollingText: {
    color: C.cyan,
    fontSize: 11,
    fontWeight: '600',
  },

  // Scroll
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 8,
  },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },

  // Project header
  projectTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    marginBottom: 14,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  stageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
  },
  stageBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusIcon: {
    fontSize: 13,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Progress
  progressTrack: {
    height: 6,
    backgroundColor: C.cardAlt,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 13,
    color: C.muted,
    marginTop: 6,
    lineHeight: 19,
  },

  // Section title
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
  },

  // Start button
  startButton: {
    backgroundColor: C.cyan,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonDisabled: {
    backgroundColor: C.cardAlt,
    borderWidth: 1,
    borderColor: C.border,
  },
  startButtonText: {
    color: C.bg,
    fontSize: 16,
    fontWeight: '700',
  },
  startButtonTextDisabled: {
    color: C.muted,
  },

  // Polling banner
  pollingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  pollingDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.cyan,
  },
  pollingBannerText: {
    color: C.cyan,
    fontSize: 12,
    fontWeight: '500',
  },

  // Inline loading
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  inlineLoadingText: {
    color: C.muted,
    fontSize: 13,
  },

  // Error
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  errorText: {
    color: C.danger,
    fontSize: 13,
    flex: 1,
  },
  retryLink: {
    color: C.cyan,
    fontSize: 13,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 14,
  },

  // Retry button (full-screen error)
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.cyan,
  },
  retryButtonText: {
    color: C.bg,
    fontSize: 14,
    fontWeight: '700',
  },

  // Empty state
  emptyBlock: {
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
    borderRadius: 10,
  },
  emptyText: {
    color: C.muted,
    fontSize: 13,
  },

  // Item card (tasks & agents)
  itemCard: {
    backgroundColor: C.cardAlt,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    flex: 1,
    marginRight: 10,
  },
  itemSubtitle: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  itemStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  itemStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Export buttons
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  exportText: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
  },
  exportErrorText: {
    color: C.danger,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
});
