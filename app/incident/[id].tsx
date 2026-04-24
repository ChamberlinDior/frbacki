/**
 * app/incident/[id].tsx — Détail d'un incident
 * Statut, description, timeline, commentaires, mise à jour du statut
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { incidentsApi } from '../../lib/api';
import type { IncidentResponse, IncidentStatus } from '../../lib/types';
import { UI, toneColor, toneBg } from '../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────────────────────

function fmt(v?: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

function toDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN:        'Ouvert',
  IN_PROGRESS: 'En cours',
  RESOLVED:    'Résolu',
  CLOSED:      'Clôturé',
};

const STATUS_TONES: Record<IncidentStatus, 'bad' | 'warn' | 'ok' | 'info'> = {
  OPEN:        'bad',
  IN_PROGRESS: 'warn',
  RESOLVED:    'ok',
  CLOSED:      'info',
};

const STATUS_ORDER: IncidentStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

// ─────────────────────────────────────────────────────────────────────────────
// Composants
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <BlurView intensity={14} tint="dark" style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </BlurView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Écran
// ─────────────────────────────────────────────────────────────────────────────

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [incident, setIncident]     = useState<IncidentResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [comment, setComment]       = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await incidentsApi.getById(Number(id));
        setIncident(data);
      } catch (e: any) {
        setError(e.message ?? 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function changeStatus(status: IncidentStatus) {
    if (!incident) return;
    Alert.alert(
      'Changer le statut',
      `Passer l'incident à "${STATUS_LABELS[status]}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setSaving(true);
            try {
              const updated = await incidentsApi.update(incident.id, { status });
              setIncident(updated);
            } catch (e: any) {
              Alert.alert('Erreur', e.message ?? 'Impossible de mettre à jour');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  async function addComment() {
    if (!incident || !comment.trim()) return;
    setSaving(true);
    try {
      const updated = await incidentsApi.update(incident.id, { comment: comment.trim() });
      setIncident(updated);
      setComment('');
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible d\'ajouter le commentaire');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <LinearGradient colors={[UI.bgTop, UI.bgMid, UI.bgBot]} style={s.flex}>
        <View style={s.center}><ActivityIndicator color={UI.ok} size="large" /></View>
      </LinearGradient>
    );
  }

  if (error || !incident) {
    return (
      <LinearGradient colors={[UI.bgTop, UI.bgMid, UI.bgBot]} style={s.flex}>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color={UI.bad} />
          <Text style={s.errorText}>{error ?? 'Incident introuvable'}</Text>
        </View>
      </LinearGradient>
    );
  }

  const tone = STATUS_TONES[incident.status];

  return (
    <LinearGradient colors={[UI.bgTop, UI.bgMid, UI.bgBot]} style={s.flex}>
      <SafeAreaView style={s.flex} edges={['bottom']}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── En-tête ─────────────────────────────────────────────────── */}
          <View style={s.header}>
            <View style={[s.statusBadge, { backgroundColor: toneBg(tone) }]}>
              <Text style={[s.statusText, { color: toneColor(tone) }]}>
                {STATUS_LABELS[incident.status]}
              </Text>
            </View>
            <Text style={s.title}>{incident.titre}</Text>
            {incident.description ? (
              <Text style={s.description}>{incident.description}</Text>
            ) : null}
          </View>

          {/* ── Informations générales ───────────────────────────────────── */}
          <Section title="Informations">
            <InfoRow label="ID"          value={`#${incident.id}`} />
            <InfoRow label="Terminal"    value={incident.terminalId ? `#${incident.terminalId}` : '—'} />
            <InfoRow label="Assigné à"   value={fmt(incident.assignedTo)} />
            <InfoRow label="Créé par"    value={fmt(incident.createdBy)} />
            <InfoRow label="Créé le"     value={toDate(incident.createdAt)} />
            <InfoRow label="Mis à jour"  value={toDate(incident.updatedAt)} />
            {incident.slaDeadline ? (
              <InfoRow label="SLA deadline" value={toDate(incident.slaDeadline)} />
            ) : null}
          </Section>

          {/* ── Changer le statut ────────────────────────────────────────── */}
          <Section title="Changer le statut">
            <View style={s.statusGrid}>
              {STATUS_ORDER.map(st => {
                const active = incident.status === st;
                const t = STATUS_TONES[st];
                return (
                  <Pressable
                    key={st}
                    style={[
                      s.statusBtn,
                      active
                        ? { backgroundColor: toneBg(t), borderColor: toneColor(t) }
                        : { backgroundColor: UI.card2, borderColor: UI.stroke2 },
                    ]}
                    onPress={() => !active && changeStatus(st)}
                    disabled={active || saving}
                  >
                    <Text style={[
                      s.statusBtnText,
                      { color: active ? toneColor(t) : UI.muted2 },
                    ]}>
                      {STATUS_LABELS[st]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* ── Timeline ─────────────────────────────────────────────────── */}
          {incident.timelineJson ? (
            <Section title="Historique">
              <Text style={s.jsonBlock}>{incident.timelineJson}</Text>
            </Section>
          ) : null}

          {/* ── Commentaires existants ───────────────────────────────────── */}
          {incident.commentsJson ? (
            <Section title="Commentaires">
              <Text style={s.jsonBlock}>{incident.commentsJson}</Text>
            </Section>
          ) : null}

          {/* ── Ajouter un commentaire ───────────────────────────────────── */}
          <Section title="Ajouter un commentaire">
            <TextInput
              style={s.commentInput}
              placeholder="Saisir votre commentaire…"
              placeholderTextColor={UI.faint}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
            />
            <Pressable
              style={[s.commentBtn, (saving || !comment.trim()) && s.commentBtnDisabled]}
              onPress={addComment}
              disabled={saving || !comment.trim()}
            >
              <Ionicons name="send-outline" size={15} color={UI.black} />
              <Text style={s.commentBtnText}>
                {saving ? 'Envoi…' : 'Envoyer'}
              </Text>
            </Pressable>
          </Section>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex:   { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  header:       { marginBottom: 16 },
  statusBadge:  { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
  statusText:   { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  title:        { fontSize: 20, fontWeight: '800', color: UI.ink, marginBottom: 8 },
  description:  { fontSize: 14, color: UI.muted, lineHeight: 20 },

  section: {
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: UI.card, borderWidth: 1, borderColor: UI.stroke,
    paddingHorizontal: 16, paddingBottom: 12, marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: UI.muted2,
    textTransform: 'uppercase', letterSpacing: 1,
    paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: UI.stroke2, marginBottom: 4,
  },

  row:       { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 12 },
  rowLabel:  { width: 100, fontSize: 13, color: UI.muted2 },
  rowValue:  { flex: 1, fontSize: 13, color: UI.ink, fontWeight: '500', textAlign: 'right' },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  statusBtn:  {
    borderRadius: 10, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  statusBtnText: { fontSize: 12, fontWeight: '700' },

  jsonBlock: {
    fontSize: 12, color: UI.muted, fontFamily: 'monospace',
    backgroundColor: UI.card2, borderRadius: 8, padding: 10,
    marginTop: 4, lineHeight: 18,
  },

  commentInput: {
    backgroundColor: UI.card2, borderRadius: 12, borderWidth: 1,
    borderColor: UI.stroke2, color: UI.ink, fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 4, marginBottom: 10, minHeight: 80,
    textAlignVertical: 'top',
  },
  commentBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: UI.ok, borderRadius: 12, paddingVertical: 12,
  },
  commentBtnDisabled: { opacity: 0.45 },
  commentBtnText: { color: UI.black, fontWeight: '800', fontSize: 14 },

  errorText: { color: UI.bad, fontSize: 14, textAlign: 'center' },
});
