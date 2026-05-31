import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi } from '@/services/api';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TicketTierForm {
  name: string;
  price: string;
  quantity: string;
  description: string;
}

interface PromoCodeForm {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  max_uses: string;
}

interface FormData {
  title: string;
  description: string;
  category_id: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  location_type: 'physical' | 'online' | 'hybrid';
  physical_address: string;
  online_link: string;
  capacity: string;
  registration_type: 'automatic' | 'manual' | 'invite_only';
  is_free: boolean;
  requires_registration: boolean;
  tiers: TicketTierForm[];
  codes: PromoCodeForm[];
}

const DEFAULT_FORM: FormData = {
  title: '',
  description: '',
  category_id: '',
  start_date: '',
  start_time: '09:00',
  end_date: '',
  end_time: '18:00',
  location_type: 'physical',
  physical_address: '',
  online_link: '',
  capacity: '',
  registration_type: 'automatic',
  is_free: true,
  requires_registration: true,
  tiers: [],
  codes: [],
};

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, onBlur, placeholder, multiline, keyboardType, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
  hint?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="sentences"
        autoCorrect={false}
      />
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

// ─── Chip selector ────────────────────────────────────────────────────────────
function ChipSelector<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map(o => (
          <TouchableOpacity
            key={o.key}
            style={[styles.chip, value === o.key && styles.chipActive]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, value === o.key && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.progressBar}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.progressSegment, i < step && styles.progressSegmentActive]} />
      ))}
    </View>
  );
}

// ─── Date / Time picker constants ─────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

// ─── Date Picker ──────────────────────────────────────────────────────────────
function DatePickerField({
  label, value, onChange, minDate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const minD = minDate
    ? new Date(minDate + 'T00:00:00')
    : new Date(today.getFullYear(), today.getMonth(), today.getDate());

  useEffect(() => {
    if (open && parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isDisabled = (d: number) => new Date(viewYear, viewMonth, d) < minD;
  const isSelected = (d: number) =>
    !!parsed && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth && parsed.getDate() === d;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const pick = (d: number) => {
    onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setOpen(false);
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.pickerBtnText, !value && styles.pickerBtnPlaceholder]}>
          {value || 'Select date'}
        </Text>
        <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.calCard}>
            <View style={styles.calNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.calNavArrow} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={18} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.calMonthText}>{MONTHS[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.calNavArrow} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.calWeekRow}>
              {DAYS_SHORT.map(d => <Text key={d} style={styles.calWeekDay}>{d}</Text>)}
            </View>

            <View style={styles.calGrid}>
              {cells.map((day, i) => {
                if (day === null) return <View key={`e${i}`} style={styles.calCell} />;
                const dis = isDisabled(day);
                const sel = isSelected(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.calCell, sel && styles.calCellSel]}
                    onPress={() => !dis && pick(day)}
                    activeOpacity={dis ? 1 : 0.7}
                    disabled={dis}
                  >
                    <Text style={[styles.calDayNum, dis && styles.calDayDis, sel && styles.calDaySelNum]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={() => setOpen(false)} style={styles.pickerCancelBtn} activeOpacity={0.7}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Time Picker ──────────────────────────────────────────────────────────────
function TimePickerField({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selH, setSelH] = useState(value.split(':')[0] || '09');
  const [selM, setSelM] = useState(value.split(':')[1] || '00');

  const openPicker = () => {
    const parts = value.split(':');
    setSelH(parts[0] || '09');
    setSelM(parts[1] || '00');
    setOpen(true);
  };

  const confirm = () => {
    onChange(`${selH}:${selM}`);
    setOpen(false);
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.pickerBtn} onPress={openPicker} activeOpacity={0.7}>
        <Text style={[styles.pickerBtnText, !value && styles.pickerBtnPlaceholder]}>
          {value || 'Select time'}
        </Text>
        <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.timeCard}>
            <Text style={styles.timeCardTitle}>Select time</Text>

            <View style={styles.timeColumns}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeColLabel}>HOUR</Text>
                <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                  {HOURS.map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.timeItem, selH === h && styles.timeItemSel]}
                      onPress={() => setSelH(h)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.timeItemText, selH === h && styles.timeItemTextSel]}>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.timeColon}>:</Text>

              <View style={styles.timeColumn}>
                <Text style={styles.timeColLabel}>MIN</Text>
                <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                  {MINUTES.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.timeItem, selM === m && styles.timeItemSel]}
                      onPress={() => setSelM(m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.timeItemText, selM === m && styles.timeItemTextSel]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity onPress={confirm} style={styles.timeConfirmBtn} activeOpacity={0.85}>
              <Text style={styles.timeConfirmText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.pickerCancelBtn} activeOpacity={0.7}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CreateEventScreen() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setStep(1);
      setForm(DEFAULT_FORM);
      setError('');
      submittingRef.current = false;
    }, [])
  );

  const STEPS = ['Basics', 'Schedule', 'Tickets', 'Review'];
  const TOTAL = STEPS.length;

  useEffect(() => {
    eventsApi.categories()
      .then(res => setCategories(res.data ?? []))
      .catch(() => {});
  }, []);

  const update = (key: keyof FormData, value: any) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!form.title.trim()) return 'Event name is required.';
      if (!form.description.trim()) return 'Description is required.';
    }
    if (step === 2) {
      if (!form.start_date) return 'Start date is required.';
      if (!form.end_date) return 'End date is required.';
      const startDt = `${form.start_date}T${form.start_time}`;
      const endDt = `${form.end_date}T${form.end_time}`;
      if (endDt <= startDt) return 'End date and time must be after the start.';
      if ((form.location_type === 'physical' || form.location_type === 'hybrid') && !form.physical_address.trim()) return 'Address is required for in-person events.';
      if ((form.location_type === 'online' || form.location_type === 'hybrid') && !form.online_link.trim()) return 'Online link is required for online events.';
    }
    if (step === 3) {
      if (!form.is_free) {
        if (form.tiers.length === 0) return 'Add at least one ticket tier for paid events.';
        for (let i = 0; i < form.tiers.length; i++) {
          const t = form.tiers[i];
          if (!t.name.trim()) return `Tier ${i + 1}: name is required.`;
          if (!t.quantity.trim() || parseInt(t.quantity) <= 0) return `Tier ${i + 1}: quantity must be greater than 0.`;
        }
      }
      for (let i = 0; i < form.codes.length; i++) {
        const c = form.codes[i];
        const n = i + 1;
        if (!c.code.trim()) return `Promo code ${n}: code is required.`;
        const dv = parseFloat(c.discount_value);
        if (!c.discount_value || isNaN(dv) || dv <= 0) return `Promo code ${n}: discount value must be greater than 0.`;
        if (c.discount_type === 'percentage' && dv > 100) return `Promo code ${n}: percentage discount cannot exceed 100%.`;
        if (!c.max_uses || parseInt(c.max_uses) < 1) return `Promo code ${n}: max uses must be at least 1.`;
      }
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  };

  const handleSubmit = async (publish: boolean) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');

    try {
      const startDt = `${form.start_date}T${form.start_time}:00`;
      const endDt = `${form.end_date}T${form.end_time}:00`;

      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim(),
        start_datetime: startDt,
        end_datetime: endDt,
        location_type: form.location_type,
        registration_type: form.registration_type,
        is_free: form.is_free,
        requires_registration: form.requires_registration,
        has_ticketing: !form.is_free,
        feedback_visibility: 'public',
        status: 'draft',
      };

      if (form.physical_address.trim()) payload.physical_address = form.physical_address.trim();
      if (form.online_link.trim()) payload.online_link = form.online_link.trim();
      if (form.capacity.trim()) payload.capacity = parseInt(form.capacity);
      if (form.category_id) payload.category_ids = [parseInt(form.category_id)];

      const res = await eventsApi.create(payload);
      const eventId = res.data.id;

      // Create ticket tiers
      if (form.tiers.length > 0) {
        const todayStr = new Date().toISOString().slice(0, 10);
        await Promise.all(form.tiers.map(tier =>
          eventsApi.createTier(eventId, {
            name: tier.name,
            price: parseFloat(tier.price) || 0,
            quantity: parseInt(tier.quantity) || 100,
            description: tier.description || undefined,
            sale_start: `${todayStr}T00:00:00`,
            sale_end: `${form.end_date}T${form.end_time}:00`,
            is_active: true,
          })
        ));
      }

      // Create promo codes — sale window mirrors ticket tier window
      if (form.codes.length > 0) {
        const todayStr = new Date().toISOString().slice(0, 10);
        await Promise.all(form.codes.map(c =>
          eventsApi.createPromoCode(eventId, {
            code: c.code.trim().toUpperCase(),
            discount_type: c.discount_type,
            discount_value: parseFloat(c.discount_value) || 10,
            max_uses: parseInt(c.max_uses) || 100,
            valid_from: `${todayStr}T00:00:00`,
            valid_until: `${form.end_date}T${form.end_time}:00`,
          })
        ));
      }

      // Publish if requested
      if (publish) {
        await eventsApi.publish(eventId);
      }

      Alert.alert(
        publish ? 'Event published!' : 'Event saved!',
        publish ? 'Your event is now live.' : 'Your event has been saved as a draft.',
        [{ text: 'OK', onPress: () => router.replace('/(organizer)/events' as any) }]
      );
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg ?? JSON.stringify(d)).join(' · '));
      } else {
        setError('Failed to create event. Please try again.');
      }
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const addTier = () => {
    setForm(f => ({
      ...f,
      tiers: [...f.tiers, { name: '', price: '0.00', quantity: '100', description: '' }],
    }));
  };

  const updateTier = (index: number, key: keyof TicketTierForm, value: string) => {
    setForm(f => {
      const tiers = [...f.tiers];
      tiers[index] = { ...tiers[index], [key]: value };
      return { ...f, tiers };
    });
  };

  const removeTier = (index: number) => {
    setForm(f => ({ ...f, tiers: f.tiers.filter((_, i) => i !== index) }));
  };

  const addCode = () => {
    setForm(f => ({
      ...f,
      codes: [...f.codes, {
        code: '',
        discount_type: 'percentage',
        discount_value: '10.00',
        max_uses: '100',
      }],
    }));
  };

  const updateCode = (index: number, key: keyof PromoCodeForm, value: string) => {
    setForm(f => {
      const codes = [...f.codes];
      codes[index] = { ...codes[index], [key]: value };
      return { ...f, codes };
    });
  };

  const removeCode = (index: number) => {
    setForm(f => ({ ...f, codes: f.codes.filter((_, i) => i !== index) }));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create event</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      <ProgressBar step={step} total={TOTAL} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepLabel}>STEP {step} OF {TOTAL}</Text>
        <Text style={styles.stepTitle}>{STEPS[step - 1]}</Text>

        {error !== '' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ─── Step 1: Basics ─── */}
        {step === 1 && (
          <>
            <Field
              label="EVENT NAME"
              value={form.title}
              onChange={v => update('title', v)}
              placeholder="e.g. Vector Summit 2026"
            />
            <Field
              label="DESCRIPTION"
              value={form.description}
              onChange={v => update('description', v)}
              placeholder="What attendees should know…"
              multiline
            />

            {/* Category */}
            {categories.length > 0 && (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {categories.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chip, form.category_id === String(c.id) && styles.chipActive]}
                      onPress={() => update('category_id', String(c.id))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, form.category_id === String(c.id) && styles.chipTextActive]}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Field
              label="CAPACITY (OPTIONAL)"
              value={form.capacity}
              onChange={v => update('capacity', v)}
              placeholder="e.g. 500"
              keyboardType="number-pad"
            />

            <ChipSelector
              label="REGISTRATION TYPE"
              options={[
                { key: 'automatic', label: 'Automatic' },
                { key: 'manual', label: 'Manual' },
                { key: 'invite_only', label: 'Invite only' },
              ]}
              value={form.registration_type}
              onChange={v => update('registration_type', v)}
            />
          </>
        )}

        {/* ─── Step 2: Schedule ─── */}
        {step === 2 && (
          <>
            <DatePickerField
              label="START DATE"
              value={form.start_date}
              onChange={v => update('start_date', v)}
            />
            <TimePickerField
              label="START TIME"
              value={form.start_time}
              onChange={v => update('start_time', v)}
            />
            <DatePickerField
              label="END DATE"
              value={form.end_date}
              onChange={v => update('end_date', v)}
              minDate={form.start_date || undefined}
            />
            <TimePickerField
              label="END TIME"
              value={form.end_time}
              onChange={v => update('end_time', v)}
            />

            <ChipSelector
              label="FORMAT"
              options={[
                { key: 'physical', label: 'In-person' },
                { key: 'online', label: 'Online' },
                { key: 'hybrid', label: 'Hybrid' },
              ]}
              value={form.location_type}
              onChange={v => update('location_type', v)}
            />

            {(form.location_type === 'physical' || form.location_type === 'hybrid') && (
              <Field
                label="ADDRESS"
                value={form.physical_address}
                onChange={v => update('physical_address', v)}
                placeholder="e.g. Sarajevo, Bosnia"
              />
            )}
            {(form.location_type === 'online' || form.location_type === 'hybrid') && (
              <Field
                label="ONLINE LINK"
                value={form.online_link}
                onChange={v => update('online_link', v)}
                placeholder="https://meet.google.com/..."
              />
            )}
          </>
        )}

        {/* ─── Step 3: Tickets ─── */}
        {step === 3 && (
          <>
            {/* Free/Paid toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Free event</Text>
                <Text style={styles.toggleSub}>No ticket tiers needed</Text>
              </View>
              <Switch
                value={form.is_free}
                onValueChange={v => update('is_free', v)}
                trackColor={{ false: Colors.border, true: Colors.text }}
                thumbColor={Colors.bg}
              />
            </View>

            {!form.is_free && (
              <>
                {form.tiers.map((tier, i) => (
                  <View key={i} style={styles.tierCard}>
                    <View style={styles.tierCardHeader}>
                      <Text style={styles.tierCardTitle}>Tier {i + 1}</Text>
                      <TouchableOpacity onPress={() => removeTier(i)} activeOpacity={0.7}>
                        <Ionicons name="trash-outline" size={16} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                    <Field label="TIER NAME" value={tier.name} onChange={v => updateTier(i, 'name', v)} placeholder="e.g. Standard" />
                    <Field
                      label="PRICE ($)"
                      value={tier.price}
                      onChange={v => updateTier(i, 'price', v)}
                      onBlur={() => updateTier(i, 'price', (parseFloat(tier.price) || 0).toFixed(2))}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                    />
                    <Field label="QUANTITY" value={tier.quantity} onChange={v => updateTier(i, 'quantity', v)} placeholder="100" keyboardType="number-pad" />
                    <Field label="DESCRIPTION (OPTIONAL)" value={tier.description} onChange={v => updateTier(i, 'description', v)} placeholder="What's included" />
                  </View>
                ))}

                <TouchableOpacity style={styles.addTierBtn} onPress={addTier} activeOpacity={0.7}>
                  <Ionicons name="add" size={16} color={Colors.textSub} />
                  <Text style={styles.addTierBtnText}>Add ticket tier</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Promo codes section */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionHeading}>PROMO CODES</Text>
            <Text style={styles.sectionSub}>Optional — codes attendees can use to get a discount.</Text>

            {form.codes.map((c, i) => (
              <View key={i} style={styles.tierCard}>
                <View style={styles.tierCardHeader}>
                  <Text style={styles.tierCardTitle}>Code {i + 1}</Text>
                  <TouchableOpacity onPress={() => removeCode(i)} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>

                <Field
                  label="CODE"
                  value={c.code}
                  onChange={v => updateCode(i, 'code', v.toUpperCase())}
                  placeholder="e.g. SUMMER20"
                />

                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>DISCOUNT TYPE</Text>
                  <View style={styles.chipRow}>
                    {([
                      { key: 'percentage', label: '% Percentage' },
                      { key: 'fixed', label: '$ Fixed amount' },
                    ] as const).map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.chip, c.discount_type === opt.key && styles.chipActive]}
                        onPress={() => updateCode(i, 'discount_type', opt.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, c.discount_type === opt.key && styles.chipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Field
                  label={c.discount_type === 'percentage' ? 'DISCOUNT (%)' : 'DISCOUNT ($)'}
                  value={c.discount_value}
                  onChange={v => updateCode(i, 'discount_value', v)}
                  onBlur={() => updateCode(i, 'discount_value', (parseFloat(c.discount_value) || 0).toFixed(2))}
                  placeholder={c.discount_type === 'percentage' ? 'e.g. 10.00' : 'e.g. 5.00'}
                  keyboardType="decimal-pad"
                />

                <Field
                  label="MAX USES"
                  value={c.max_uses}
                  onChange={v => updateCode(i, 'max_uses', v)}
                  placeholder="100"
                  keyboardType="number-pad"
                />
              </View>
            ))}

            <TouchableOpacity style={styles.addTierBtn} onPress={addCode} activeOpacity={0.7}>
              <Ionicons name="add" size={16} color={Colors.textSub} />
              <Text style={styles.addTierBtnText}>Add promo code</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ─── Step 4: Review ─── */}
        {step === 4 && (
          <>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewCardLabel}>EVENT</Text>
              <Text style={styles.reviewCardValue}>{form.title}</Text>
            </View>

            <View style={styles.reviewGrid}>
              <View style={styles.reviewGridItem}>
                <Text style={styles.reviewGridLabel}>START</Text>
                <Text style={styles.reviewGridValue}>{form.start_date} {form.start_time}</Text>
              </View>
              <View style={styles.reviewGridItem}>
                <Text style={styles.reviewGridLabel}>END</Text>
                <Text style={styles.reviewGridValue}>{form.end_date} {form.end_time}</Text>
              </View>
              <View style={styles.reviewGridItem}>
                <Text style={styles.reviewGridLabel}>FORMAT</Text>
                <Text style={styles.reviewGridValue}>{form.location_type}</Text>
              </View>
              <View style={styles.reviewGridItem}>
                <Text style={styles.reviewGridLabel}>CAPACITY</Text>
                <Text style={styles.reviewGridValue}>{form.capacity || 'Unlimited'}</Text>
              </View>
              <View style={styles.reviewGridItem}>
                <Text style={styles.reviewGridLabel}>PRICING</Text>
                <Text style={styles.reviewGridValue}>{form.is_free ? 'Free' : `${form.tiers.length} tier${form.tiers.length !== 1 ? 's' : ''}`}</Text>
              </View>
              <View style={styles.reviewGridItem}>
                <Text style={styles.reviewGridLabel}>REGISTRATION</Text>
                <Text style={styles.reviewGridValue}>{form.registration_type}</Text>
              </View>
              <View style={styles.reviewGridItem}>
                <Text style={styles.reviewGridLabel}>PROMO CODES</Text>
                <Text style={styles.reviewGridValue}>{form.codes.length > 0 ? `${form.codes.length} code${form.codes.length !== 1 ? 's' : ''}` : 'None'}</Text>
              </View>
            </View>

            {error !== '' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Publish or save as draft */}
            <TouchableOpacity
              style={[styles.publishBtn, submitting && styles.btnDisabled]}
              onPress={() => handleSubmit(true)}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={Colors.bg} size="small" />
                : <Text style={styles.publishBtnText}>Publish event</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.draftBtn, submitting && styles.btnDisabled]}
              onPress={() => handleSubmit(false)}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.draftBtnText}>Save as draft</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Bottom navigation */}
      {step < TOTAL && (
        <View style={styles.bottomBar}>
          {step > 1 && (
            <TouchableOpacity style={styles.backStepBtn} onPress={() => { setError(''); setStep(s => s - 1); }} activeOpacity={0.7}>
              <Text style={styles.backStepBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
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
  backBtn: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text },

  progressBar: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.base, paddingVertical: 14 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressSegmentActive: { backgroundColor: Colors.text },

  scroll: { paddingHorizontal: Spacing.base, paddingBottom: 120 },
  stepLabel: { fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  stepTitle: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.text, letterSpacing: -0.4, marginBottom: 20 },

  errorBox: {
    backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: Colors.error,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.base,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, fontFamily: FontFamily.medium },

  // Fields
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 11.5, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 7 },
  fieldHint: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 5 },
  input: {
    height: 44, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.text, fontSize: 14, fontFamily: FontFamily.regular,
  },
  inputMulti: { height: 100, paddingTop: 12, lineHeight: 20 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.borderMed,
  },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textSub },
  chipTextActive: { color: Colors.bg },

  // Toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, marginBottom: 16,
  },
  toggleText: { flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 13.5, fontFamily: FontFamily.medium, color: Colors.text },
  toggleSub: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 2 },

  // Tier
  tierCard: {
    padding: 14, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, marginBottom: 12,
  },
  tierCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tierCardTitle: { fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.text },
  addTierBtn: {
    height: 44, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.borderMed,
    borderStyle: 'dashed',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginBottom: 16,
  },
  addTierBtnText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textSub },

  sectionDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 16 },
  sectionHeading: { fontSize: 11.5, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  sectionSub: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted, marginBottom: 14 },

  // Review
  reviewCard: {
    padding: 14, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, marginBottom: 12,
  },
  reviewCardLabel: { fontSize: 10.5, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  reviewCardValue: { fontSize: 16, fontFamily: FontFamily.bold, color: Colors.text },
  reviewGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginBottom: 20,
  },
  reviewGridItem: {
    width: '47.5%', padding: 12,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  reviewGridLabel: { fontSize: 10, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.5 },
  reviewGridValue: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.text, marginTop: 4, textTransform: 'capitalize' },

  // Buttons
  publishBtn: {
    height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  publishBtnText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },
  draftBtn: {
    height: 46, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderMed,
    alignItems: 'center', justifyContent: 'center',
  },
  draftBtnText: { fontSize: 13.5, fontFamily: FontFamily.semiBold, color: Colors.text },
  btnDisabled: { opacity: 0.6 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10,
    padding: Spacing.base, paddingBottom: 28,
    backgroundColor: Colors.bg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  backStepBtn: {
    flex: 1, height: 46, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderMed,
    alignItems: 'center', justifyContent: 'center',
  },
  backStepBtnText: { fontSize: 13.5, fontFamily: FontFamily.semiBold, color: Colors.text },
  nextBtn: {
    flex: 2, height: 46, borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  nextBtnText: { fontSize: 13.5, fontFamily: FontFamily.semiBold, color: Colors.bg },

  // Picker trigger button (shared by date + time)
  pickerBtn: {
    height: 44, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pickerBtnText: { fontSize: 14, fontFamily: FontFamily.regular, color: Colors.text },
  pickerBtnPlaceholder: { color: Colors.textMuted },

  // Modal overlay
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Calendar
  calCard: {
    width: '90%', maxWidth: 360,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: 16,
  },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  calNavArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  calMonthText: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text },
  calWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calWeekDay: { width: '14.28%', textAlign: 'center', fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.textMuted, letterSpacing: 0.3 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  calCellSel: { backgroundColor: Colors.text },
  calDayNum: { fontSize: 13.5, fontFamily: FontFamily.medium, color: Colors.text },
  calDayDis: { color: 'rgba(255,255,255,0.2)' },
  calDaySelNum: { color: Colors.bg },
  pickerCancelBtn: { marginTop: 10, height: 38, alignItems: 'center', justifyContent: 'center' },
  pickerCancelText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textMuted },

  // Time picker
  timeCard: {
    width: '82%', maxWidth: 300,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: 16,
  },
  timeCardTitle: { fontSize: 15, fontFamily: FontFamily.semiBold, color: Colors.text, textAlign: 'center', marginBottom: 14 },
  timeColumns: { flexDirection: 'row', alignItems: 'center' },
  timeColumn: { flex: 1 },
  timeColLabel: { fontSize: 11, fontFamily: FontFamily.semiBold, color: Colors.textMuted, textAlign: 'center', marginBottom: 6, letterSpacing: 0.5 },
  timeScroll: { height: 220 },
  timeItem: { height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  timeItemSel: { backgroundColor: 'rgba(255,255,255,0.1)' },
  timeItemText: { fontSize: 20, fontFamily: FontFamily.regular, color: Colors.textSub },
  timeItemTextSel: { fontSize: 20, fontFamily: FontFamily.semiBold, color: Colors.text },
  timeColon: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.text, marginHorizontal: 6, marginTop: 18 },
  timeConfirmBtn: {
    marginTop: 14, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  timeConfirmText: { fontSize: 14, fontFamily: FontFamily.semiBold, color: Colors.bg },
});