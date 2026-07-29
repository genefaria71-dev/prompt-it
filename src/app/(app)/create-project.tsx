import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as api from '../../services/api';
import type { Workspace } from '../../services/api';

// ── Color constants (same palette as dashboard) ──────────────────────

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

// ── Create Project Screen ────────────────────────────────────────────

export default function CreateProjectScreen() {
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState('');
  const [purpose, setPurpose] = useState('');
  const [chapterCount, setChapterCount] = useState('3');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspacesError, setWorkspacesError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [titleError, setTitleError] = useState('');
  const [chapterError, setChapterError] = useState('');

  // ── Fetch workspaces on mount ────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        setWorkspacesError('');
        const data = await api.getWorkspaces();
        setWorkspaces(data);
      } catch (e: unknown) {
        setWorkspacesError(
          e instanceof Error ? e.message : 'Failed to load workspaces.',
        );
      } finally {
        setWorkspacesLoading(false);
      }
    })();
  }, []);

  // ── Validation ───────────────────────────────────────────────────

  function validate(): boolean {
    let valid = true;

    if (!title.trim()) {
      setTitleError('Title is required.');
      valid = false;
    } else {
      setTitleError('');
    }

    const count = parseInt(chapterCount, 10);
    if (isNaN(count) || count < 3) {
      setChapterError('Chapter count must be at least 3.');
      valid = false;
    } else {
      setChapterError('');
    }

    return valid;
  }

  // ── Submit ───────────────────────────────────────────────────────

  async function handleCreate() {
    setError('');

    if (!validate()) return;

    setSubmitting(true);
    try {
      await api.createProject({
        title: title.trim(),
        audience: audience.trim(),
        purpose: purpose.trim(),
        chapter_count: parseInt(chapterCount, 10),
        workspace_id: selectedWorkspaceId,
      });
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          activeOpacity={0.6}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Project</Text>
        <View style={styles.closeBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── TITLE ────────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Project Title</Text>
            <TextInput
              style={[styles.input, titleError ? styles.inputError : null]}
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                if (titleError) setTitleError('');
              }}
              placeholder="e.g. My AI Production"
              placeholderTextColor={C.muted + '80'}
              autoCapitalize="sentences"
              autoCorrect={false}
              editable={!submitting}
            />
            {titleError ? <Text style={styles.fieldError}>{titleError}</Text> : null}
          </View>

          {/* ── AUDIENCE ─────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Target Audience</Text>
            <TextInput
              style={styles.input}
              value={audience}
              onChangeText={setAudience}
              placeholder="e.g. Developers, Marketers, General"
              placeholderTextColor={C.muted + '80'}
              autoCapitalize="sentences"
              editable={!submitting}
            />
          </View>

          {/* ── PURPOSE ──────────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Purpose</Text>
            <TextInput
              style={styles.input}
              value={purpose}
              onChangeText={setPurpose}
              placeholder="e.g. Generate blog posts, documentation"
              placeholderTextColor={C.muted + '80'}
              autoCapitalize="sentences"
              editable={!submitting}
            />
          </View>

          {/* ── CHAPTER COUNT ───────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Chapter Count</Text>
            <TextInput
              style={[styles.input, chapterError ? styles.inputError : null]}
              value={chapterCount}
              onChangeText={(t) => {
                setChapterCount(t);
                if (chapterError) setChapterError('');
              }}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={C.muted + '80'}
              editable={!submitting}
            />
            {chapterError ? (
              <Text style={styles.fieldError}>{chapterError}</Text>
            ) : null}
          </View>

          {/* ── WORKSPACE PICKER ────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Workspace</Text>

            {workspacesLoading ? (
              <View style={styles.workspaceLoading}>
                <ActivityIndicator size="small" color={C.cyan} />
                <Text style={styles.workspaceLoadingText}>Loading workspaces...</Text>
              </View>
            ) : workspacesError ? (
              <View style={styles.workspaceErrorRow}>
                <Text style={styles.fieldError}>{workspacesError}</Text>
              </View>
            ) : (
              <>
                {/* "None" option */}
                <TouchableOpacity
                  style={[
                    styles.workspaceOption,
                    selectedWorkspaceId === null && styles.workspaceOptionSelected,
                  ]}
                  onPress={() => setSelectedWorkspaceId(null)}
                  activeOpacity={0.7}
                  disabled={submitting}
                >
                  <View style={styles.radioOuter}>
                    {selectedWorkspaceId === null && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.workspaceOptionText,
                      selectedWorkspaceId === null && styles.workspaceOptionTextSelected,
                    ]}
                  >
                    None
                  </Text>
                </TouchableOpacity>

                {workspaces.map((ws) => (
                  <TouchableOpacity
                    key={ws.id}
                    style={[
                      styles.workspaceOption,
                      selectedWorkspaceId === ws.id && styles.workspaceOptionSelected,
                    ]}
                    onPress={() => setSelectedWorkspaceId(ws.id)}
                    activeOpacity={0.7}
                    disabled={submitting}
                  >
                    <View style={styles.radioOuter}>
                      {selectedWorkspaceId === ws.id && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.workspaceOptionText,
                        selectedWorkspaceId === ws.id &&
                          styles.workspaceOptionTextSelected,
                      ]}
                    >
                      {ws.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>

          {/* ── ERROR ────────────────────────────────────────────── */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{error}</Text>
            </View>
          ) : null}

          {/* ── CREATE BUTTON ────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.createBtn, submitting && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={submitting}
            activeOpacity={0.7}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : (
              <Text style={styles.createBtnText}>Create Project</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: C.muted,
    fontSize: 16,
    fontWeight: '600',
  },

  // Fields
  fieldGroup: {
    marginBottom: 22,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: C.text,
  },
  inputError: {
    borderColor: C.danger,
  },
  fieldError: {
    color: C.danger,
    fontSize: 12,
    marginTop: 6,
  },

  // Workspace picker
  workspaceLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 16,
    gap: 10,
  },
  workspaceLoadingText: {
    color: C.muted,
    fontSize: 13,
  },
  workspaceErrorRow: {
    paddingVertical: 4,
  },
  workspaceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  workspaceOptionSelected: {
    borderColor: C.cyan + '60',
    backgroundColor: C.cyan + '0d',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.cyan,
  },
  workspaceOptionText: {
    fontSize: 15,
    color: C.text,
  },
  workspaceOptionTextSelected: {
    color: C.cyan,
    fontWeight: '600',
  },

  // Error box
  errorBox: {
    backgroundColor: C.danger + '14',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.danger + '30',
    marginBottom: 18,
  },
  errorBoxText: {
    color: C.danger,
    fontSize: 13,
    textAlign: 'center',
  },

  // Create button
  createBtn: {
    backgroundColor: C.cyan,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    color: C.bg,
    fontSize: 16,
    fontWeight: '700',
  },
});
