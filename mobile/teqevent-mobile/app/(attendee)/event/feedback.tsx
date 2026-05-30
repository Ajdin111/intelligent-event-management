import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi, reviewsApi, Event } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = parseInt(id);
  const submitting = useRef(false);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    eventsApi.detail(eventId)
      .then(res => setEvent(res.data))
      .catch(() => setError('Failed to load event.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleSubmit = async () => {
    if (rating === 0) return;
    if (submitting.current) return;
    submitting.current = true;
    setSubmittingReview(true);
    setError('');

    try {
      await reviewsApi.submit({
        event_id: eventId,
        rating,
        comment: comment.trim() || undefined,
        is_anonymous: isAnonymous,
      });
      setDone(true);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      if (status === 400) {
        setError(typeof detail === 'string' ? detail : 'You may have already reviewed this event.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmittingReview(false);
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

  // ─── Success screen ───────────────────────────────────────
  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.successScreen}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={28} color={Colors.bg} />
          </View>
          <Text style={styles.successTitle}>Thanks for your feedback</Text>
          <Text style={styles.successSub}>
            Your review helps other attendees and the organizer.
          </Text>
          <TouchableOpacity
            style={styles.successBtn}
            onPress={() => router.replace('/(attendee)/home' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.successBtnText}>Done</Text>
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
        <Text style={styles.headerTitle}>Leave a review</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Event card */}
        {event && (
          <View style={styles.eventCard}>
            <Text style={styles.eventCardLabel}>EVENT</Text>
            <Text style={styles.eventCardTitle}>{event.title}</Text>
            <Text style={styles.eventCardDate}>
              {new Date(event.start_datetime).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })} · {event.location_type === 'online' ? 'Online' : event.physical_address ?? 'In-person'}
            </Text>
          </View>
        )}

        {/* Error */}
        {error !== '' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        )}

        {/* Star rating */}
        <Text style={styles.sectionTitle}>How was your experience?</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(i => (
            <TouchableOpacity
              key={i}
              onPress={() => setRating(i)}
              activeOpacity={0.7}
              style={styles.starBtn}
            >
              <Ionicons
                name={i <= rating ? 'star' : 'star-outline'}
                size={38}
                color={Colors.text}
              />
            </TouchableOpacity>
          ))}
        </View>
        {rating > 0 && (
          <Text style={styles.ratingLabel}>
            {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][rating]}
          </Text>
        )}

        {/* Comment */}
        <Text style={styles.sectionTitle}>Tell us more <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={styles.textArea}
          value={comment}
          onChangeText={setComment}
          placeholder="What did you like? What could be improved?"
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {/* Anonymous toggle */}
        <View style={styles.anonymousRow}>
          <View style={styles.anonymousText}>
            <Text style={styles.anonymousLabel}>Submit anonymously</Text>
            <Text style={styles.anonymousSub}>Your name won't be shown with this review</Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: Colors.border, true: Colors.text }}
            thumbColor={Colors.bg}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (rating === 0 || submittingReview) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || submittingReview}
          activeOpacity={0.85}
        >
          {submittingReview
            ? <ActivityIndicator color={Colors.bg} size="small" />
            : <Text style={styles.submitBtnText}>Submit review</Text>
          }
        </TouchableOpacity>

        {rating === 0 && (
          <Text style={styles.ratingRequired}>Please select a star rating to continue</Text>
        )}
      </ScrollView>
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

  scroll: { paddingHorizontal: Spacing.base, paddingTop: 20, paddingBottom: 40 },

  // Event card
  eventCard: {
    padding: 14, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, marginBottom: 24,
  },
  eventCardLabel: {
    fontSize: 10.5, fontFamily: FontFamily.semiBold,
    color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 6,
  },
  eventCardTitle: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text, lineHeight: 21, marginBottom: 4 },
  eventCardDate: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textSub },

  // Error
  errorBox: {
    backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: Colors.error,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.base,
  },
  errorBoxText: { color: Colors.error, fontSize: FontSize.sm, fontFamily: FontFamily.medium },

  // Stars
  sectionTitle: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.text, marginBottom: 14 },
  optional: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textMuted },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 },
  starBtn: { padding: 4 },
  ratingLabel: {
    textAlign: 'center', fontSize: 13, fontFamily: FontFamily.medium,
    color: Colors.textSub, marginBottom: 24,
  },

  // Comment
  textArea: {
    minHeight: 120, padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.text, fontSize: 13.5,
    fontFamily: FontFamily.regular,
    lineHeight: 20, marginBottom: 20,
  },

  // Anonymous
  anonymousRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, marginBottom: 24,
  },
  anonymousText: { flex: 1, marginRight: 12 },
  anonymousLabel: { fontSize: 13.5, fontFamily: FontFamily.medium, color: Colors.text },
  anonymousSub: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 2 },

  // Submit
  submitBtn: {
    height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },
  ratingRequired: {
    textAlign: 'center', fontSize: 12,
    fontFamily: FontFamily.regular, color: Colors.textMuted,
  },

  // Success
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  successTitle: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.text, marginBottom: 8 },
  successSub: {
    fontSize: 13.5, fontFamily: FontFamily.regular, color: Colors.textSub,
    textAlign: 'center', lineHeight: 20, marginBottom: 28,
  },
  successBtn: {
    paddingHorizontal: 32, height: 46,
    borderRadius: Radius.md, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  successBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },
});