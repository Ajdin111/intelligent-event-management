import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi, registrationsApi, Event } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TicketTier {
  id: number;
  name: string;
  price: string;
  description?: string;
  quantity_available: number;
  is_sold_out: boolean;
  is_active: boolean;
  sale_start: string;
  sale_end: string;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.progressBar}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.progressSegment, i < step && styles.progressSegmentActive]}
        />
      ))}
    </View>
  );
}

// ─── Summary Row ─────────────────────────────────────────────────────────────
function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryLabelBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryValueBold]}>{value}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RegisterEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = parseInt(id);
  const submitting = useRef(false);

  const [event, setEvent] = useState<Event | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [registering, setRegistering] = useState(false);
  const [done, setDone] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<string>('confirmed');
  const [error, setError] = useState('');

  useEffect(() => {
    setStep(1);
    setSelectedTierId(null);
    setPromoCode('');
    setError('');
    setDone(false);
    setLoading(true);

    Promise.all([
      eventsApi.detail(eventId),
      eventsApi.ticketTiers(eventId),
    ]).then(([evRes, tiersRes]) => {
      setEvent(evRes.data);
      const now = new Date();
      const activeTiers = tiersRes.data.filter((t: TicketTier) => {
        if (!t.is_active || t.is_sold_out) return false;
        if (t.sale_start && new Date(t.sale_start) > now) return false;
        if (t.sale_end && new Date(t.sale_end) < now) return false;
        return true;
      });
      setTiers(activeTiers);
      if (activeTiers.length > 0) setSelectedTierId(activeTiers[0].id);
    }).catch(() => {
      setError('Failed to load event details.');
    }).finally(() => setLoading(false));
  }, [eventId]);

  const selectedTier = tiers.find(t => t.id === selectedTierId);
  const isFree = event?.is_free ?? false;
  const totalSteps = isFree ? 1 : 3;
  const isLastStep = step === totalSteps;

  const getStepTitle = () => {
    if (step === totalSteps) return 'Review & confirm';
    if (step === 1) return 'Choose a ticket';
    return 'Promo code';
  };

  const getPrice = (tier: TicketTier) => {
    const p = parseFloat(tier.price);
    return p === 0 ? 'Free' : `$${p.toFixed(2)}`;
  };

  const getTotalPrice = () => {
    if (!selectedTier) return 'Free';
    const p = parseFloat(selectedTier.price);
    return p === 0 ? 'Free' : `$${p.toFixed(2)}`;
  };

  const handleConfirm = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setRegistering(true);
    setError('');

    try {
      const res = await registrationsApi.register({
        event_id: eventId,
        ticket_tier_id: selectedTierId ?? undefined,
        promo_code: promoCode.trim() || undefined,
      });
      setRegistrationStatus(res.data.status ?? 'confirmed');
      setDone(true);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      const detailStr = typeof detail === 'string' ? detail : '';
      if (e?.code === 'ECONNABORTED') {
        setError("Request timed out. Check 'My Tickets' — you may already be registered.");
      } else if ((status === 400 || status === 409) && detailStr.toLowerCase().includes('already')) {
        setError('You are already registered for this event.');
      } else if (status === 400 || status === 409) {
        setError(detailStr || 'Registration failed. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setRegistering(false);
      submitting.current = false;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.text} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (error && !event) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: Colors.textSub, fontFamily: FontFamily.medium }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Success screen ───────────────────────────────────────
  if (done) {
    const isPending = registrationStatus === 'pending';
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.successScreen}>
          <View style={[styles.successIcon, isPending && styles.successIconPending]}>
            <Ionicons name={isPending ? 'time-outline' : 'checkmark'} size={32} color={Colors.bg} />
          </View>
          <Text style={styles.successTitle}>
            {isPending ? 'Request submitted!' : "You're registered!"}
          </Text>
          <Text style={styles.successSub}>
            {isPending
              ? `Your registration for ${event?.title} is awaiting organizer approval. You'll be notified once it's confirmed.`
              : `Your ticket for ${event?.title} is in My Tickets. We'll send a confirmation email shortly.`}
          </Text>
          <TouchableOpacity
            style={styles.successBtn}
            onPress={() => router.replace('/(attendee)/tickets' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.successBtnText}>
              {isPending ? 'View registration' : 'View ticket'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ marginTop: 12 }}
            onPress={() => router.replace('/(attendee)/home' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.successSecondary}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      {totalSteps > 1 && <ProgressBar step={step} total={totalSteps} />}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step label */}
        {totalSteps > 1 && (
          <Text style={styles.stepLabel}>STEP {step} OF {totalSteps}</Text>
        )}
        <Text style={styles.stepTitle}>{getStepTitle()}</Text>

        {/* Error */}
        {error !== '' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        )}

        {/* Step 1 — Ticket tiers (only for paid events) */}
        {step === 1 && !isFree && (
          <View style={styles.tiersList}>
            {tiers.length === 0 ? (
              <View style={styles.noTiers}>
                <Text style={styles.noTiersText}>No ticket tiers available for this event.</Text>
              </View>
            ) : (
              tiers.map(tier => {
                const selected = selectedTierId === tier.id;
                return (
                  <TouchableOpacity
                    key={tier.id}
                    style={[styles.tierCard, selected && styles.tierCardSelected]}
                    onPress={() => setSelectedTierId(tier.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.tierCardInner}>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                      <View style={styles.tierInfo}>
                        <View style={styles.tierNameRow}>
                          <Text style={styles.tierName}>{tier.name}</Text>
                          <Text style={styles.tierPrice}>{getPrice(tier)}</Text>
                        </View>
                        {tier.description && (
                          <Text style={styles.tierDesc}>{tier.description}</Text>
                        )}
                        <Text style={styles.tierAvailable}>{tier.quantity_available} spots left</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Step 2 — Promo code (only for paid events) */}
        {step === 2 && !isFree && (
          <View>
            <Text style={styles.fieldLabel}>PROMO CODE (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={promoCode}
              onChangeText={setPromoCode}
              placeholder="Enter promo code"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.promoHint}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.promoHintText}>
                Have a partner code? Enter it above to apply a discount before reviewing your order.
              </Text>
            </View>
          </View>
        )}

        {/* Review step — last step for both free and paid */}
        {isLastStep && (
          <View style={styles.summary}>
            <SummaryRow label="Event" value={event?.title ?? ''} />
            {!isFree && selectedTier && (
              <SummaryRow label="Ticket" value={selectedTier.name} />
            )}
            <SummaryRow label="Subtotal" value={getTotalPrice()} />
            {!isFree && promoCode.trim() !== '' && (
              <SummaryRow label={`Promo (${promoCode.trim()})`} value="Applied" />
            )}
            <View style={styles.summaryDivider} />
            <SummaryRow label="Total" value={getTotalPrice()} bold />
          </View>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.bottomBar}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backStepBtn}
            onPress={() => setStep(s => s - 1)}
            activeOpacity={0.7}
          >
            <Text style={styles.backStepBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.continueBtn, registering && styles.continueBtnDisabled]}
          onPress={() => {
            if (!isLastStep) {
              setStep(s => s + 1);
            } else {
              handleConfirm();
            }
          }}
          disabled={registering}
          activeOpacity={0.85}
        >
          {registering
            ? <ActivityIndicator color={Colors.bg} size="small" />
            : <Text style={styles.continueBtnText}>
                {isLastStep ? 'Confirm registration' : 'Continue'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text },

  progressBar: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.base, paddingVertical: 14 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressSegmentActive: { backgroundColor: Colors.text },

  scroll: { paddingHorizontal: Spacing.base, paddingBottom: 32 },
  stepLabel: { fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  stepTitle: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.4, marginBottom: 20 },

  errorBox: {
    backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: Colors.error,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.base,
  },
  errorBoxText: { color: Colors.error, fontSize: FontSize.sm, fontFamily: FontFamily.medium },

  tiersList: { gap: 10 },
  tierCard: {
    backgroundColor: Colors.card, borderWidth: 1,
    borderColor: Colors.border, borderRadius: Radius.md, padding: 14,
  },
  tierCardSelected: { borderColor: Colors.text },
  tierCardInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5, borderColor: Colors.borderMed,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioSelected: { borderColor: Colors.text },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.text },
  tierInfo: { flex: 1 },
  tierNameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tierName: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text },
  tierPrice: { fontSize: 14, fontFamily: FontFamily.bold, color: Colors.text },
  tierDesc: { fontSize: 12.5, fontFamily: FontFamily.regular, color: Colors.textSub, marginBottom: 4 },
  tierAvailable: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted },

  noTiers: {
    padding: 16, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
  },
  noTiersText: { fontSize: 13.5, fontFamily: FontFamily.regular, color: Colors.textSub },

  fieldLabel: { fontSize: 11.5, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 7 },
  input: {
    height: 44, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    color: Colors.text, fontSize: 14, fontFamily: FontFamily.regular, marginBottom: 12,
  },
  promoHint: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    padding: 12, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
  },
  promoHintText: { flex: 1, fontSize: 12.5, fontFamily: FontFamily.regular, color: Colors.textSub, lineHeight: 18 },

  summary: { gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13.5, fontFamily: FontFamily.medium, color: Colors.textSub },
  summaryLabelBold: { fontSize: 16, fontFamily: FontFamily.bold, color: Colors.text },
  summaryValue: { fontSize: 13.5, fontFamily: FontFamily.medium, color: Colors.text },
  summaryValueBold: { fontSize: 16, fontFamily: FontFamily.bold, color: Colors.text },
  summaryDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },

  bottomBar: {
    flexDirection: 'row', gap: 10,
    padding: Spacing.base, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  backStepBtn: {
    flex: 1, height: 46, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderMed,
    alignItems: 'center', justifyContent: 'center',
  },
  backStepBtnText: { fontSize: 13.5, fontFamily: FontFamily.semiBold, color: Colors.text },
  continueBtn: {
    flex: 2, height: 46, borderRadius: Radius.md,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { fontSize: 13.5, fontFamily: FontFamily.semiBold, color: Colors.bg },

  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 22,
  },
  successIconPending: { backgroundColor: Colors.warning },
  successTitle: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.text, marginBottom: 10 },
  successSub: {
    fontSize: 13.5, fontFamily: FontFamily.regular, color: Colors.textSub,
    textAlign: 'center', lineHeight: 20, marginBottom: 28, maxWidth: 280,
  },
  successBtn: {
    width: '100%', maxWidth: 280, height: 48,
    borderRadius: Radius.md, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  successBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },
  successSecondary: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textSub },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: FontSize.base, fontFamily: FontFamily.regular, color: Colors.textMuted },
});