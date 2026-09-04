import { useCallback, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Receipt,
  CreditCard,
  Lock,
  Unlock,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import * as db from '@/lib/storage';
import { useSupplier } from '@/hooks/useSupplier';
import { useToast } from '@/components/common/Toast';
import { SupplierSummaryCards } from '@/components/notes/SupplierSummaryCards';
import { Sheet } from '@/components/common/Sheet';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { WEEKDAYS } from '@/types';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DOW_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function NotesPage() {
  const {
    closeCycle,
  } = useSupplier();
  const { notify } = useToast();

  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthlyTotals = useMemo(
    () => db.getMonthlySupplierTotals(year, month),
    [year, month, selectedDay],
  );

  const datesWithActivity = useMemo(
    () => db.getDatesWithActivity(year, month),
    [year, month, selectedDay],
  );
  const closedDates = useMemo(
    () => db.getClosedDates(year, month),
    [year, month, selectedDay],
  );

  const goPrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const goNextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    return cells;
  }, [year, month]);

  if (selectedDay) {
    return (
      <DayDetailPage
        dateStr={selectedDay}
        onBack={() => setSelectedDay(null)}
        onNavigate={(newDate) => setSelectedDay(db.dateKey(newDate))}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-800">Notas</h1>
        <p className="mt-0.5 text-sm text-slate-500">Gestão diária de lançamentos</p>
      </div>

      <SupplierSummaryCards
        totalPurchases={monthlyTotals.totalPurchases}
        totalPaid={monthlyTotals.totalPaid}
        balance={monthlyTotals.balance}
        currentDebit={monthlyTotals.currentDebit}
      />

      {/* Calendar */}
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={goPrevMonth}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-sm font-semibold text-slate-700">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={goNextMonth}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1">
          {DOW_SHORT.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-semibold uppercase text-slate-300">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dateStr = db.dateKey(new Date(year, month, day));
            const hasActivity = datesWithActivity.has(dateStr);
            const isClosed = closedDates.has(dateStr);
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(dateStr)}
                className={`relative flex h-10 items-center justify-center rounded-xl text-sm transition ${
                  isToday
                    ? 'bg-emerald-50 font-bold text-emerald-700'
                    : hasActivity
                      ? 'bg-slate-100 font-medium text-slate-700'
                      : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                {day}
                {isClosed && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
                {hasActivity && !isClosed && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <button
        onClick={() => setConfirmClose(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-medium text-white transition active:scale-[0.99]"
      >
        <Lock size={16} /> Fechar Mês / Congelar Ciclo
      </button>

      <ConfirmDialog
        open={confirmClose}
        title="Fechar mês?"
        message="Isso congela o ciclo atual e inicia um novo. O saldo atual vira o saldo anterior do próximo ciclo. Esta ação não pode ser desfeita."
        confirmLabel="Fechar ciclo"
        onConfirm={() => {
          const err = closeCycle();
          if (err) notify(err, 'error');
          else notify('Ciclo fechado com sucesso', 'success');
          setConfirmClose(false);
        }}
        onCancel={() => setConfirmClose(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Detail Page
// ---------------------------------------------------------------------------

function DayDetailPage({
  dateStr,
  onBack,
  onNavigate,
}: {
  dateStr: string;
  onBack: () => void;
  onNavigate: (date: Date) => void;
}) {
  const { notify } = useToast();

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const dateObj = useMemo(() => new Date(dateStr + 'T00:00:00'), [dateStr]);
  const dayOfWeek = useMemo(() => {
    const jsDay = dateObj.getDay();
    return jsDay === 0 ? WEEKDAYS[5] : WEEKDAYS[jsDay - 1];
  }, [dateObj]);

  const companyNotes = useMemo(() => db.getCompanyNotes(dateStr), [dateStr, refreshKey]);
  const companyPayments = useMemo(() => db.getCompanyPayments(dateStr), [dateStr, refreshKey]);
  const isClosed = useMemo(() => db.isDayClosed(dateStr), [dateStr, refreshKey]);

  const notesTotal = companyNotes.reduce((s, n) => s + n.amount, 0);
  const paymentsTotal = companyPayments.reduce((s, p) => s + p.amount, 0);

  // Sheet state
  const [noteSheet, setNoteSheet] = useState(false);
  const [paymentSheet, setPaymentSheet] = useState(false);
  const [confirmCloseDay, setConfirmCloseDay] = useState(false);

  // Note form
  const [noteAmount, setNoteAmount] = useState('');
  const [noteDesc, setNoteDesc] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payDesc, setPayDesc] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  const goPrevDay = () => {
    const d = new Date(dateObj);
    d.setDate(d.getDate() - 1);
    onNavigate(d);
  };
  const goNextDay = () => {
    const d = new Date(dateObj);
    d.setDate(d.getDate() + 1);
    onNavigate(d);
  };

  const handleAddNote = () => {
    const val = parseFloat(noteAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) { setNoteError('Informe um valor válido'); return; }
    db.addCompanyNote(dateStr, val, noteDesc.trim() || null);
    setNoteSheet(false);
    setNoteAmount(''); setNoteDesc(''); setNoteError(null);
    refresh();
    notify('Nota adicionada', 'success');
  };

  const handleAddPayment = () => {
    const val = parseFloat(payAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) { setPayError('Informe um valor válido'); return; }
    db.addCompanyPayment(dateStr, val, payDesc.trim() || null);
    setPaymentSheet(false);
    setPayAmount(''); setPayDesc(''); setPayError(null);
    refresh();
    notify('Pagamento registrado', 'success');
  };

  const handleCloseDay = () => {
    db.closeDay(dateStr);
    setConfirmCloseDay(false);
    refresh();
    notify('Dia fechado', 'success');
  };

  const handleReopenDay = () => {
    db.reopenDay(dateStr);
    refresh();
    notify('Dia reaberto', 'info');
  };

  const dateLabel = dateObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-5">
      {/* Header with day navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize text-slate-800">{dateLabel}</p>
          <p className="text-[11px] text-slate-400">Rota: {dayOfWeek}</p>
        </div>
        <button
          onClick={goNextDay}
          className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      <button
        onClick={goPrevDay}
        className="hidden"
        aria-hidden
      />

      {/* Day close / reopen */}
      <div className="flex justify-center">
        {isClosed ? (
          <button
            onClick={handleReopenDay}
            className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-4 py-2 text-xs font-medium text-emerald-700 transition active:scale-[0.98]"
          >
            <Unlock size={14} /> Dia fechado — Reabrir
          </button>
        ) : (
          <button
            onClick={() => setConfirmCloseDay(true)}
            className="flex items-center gap-1.5 rounded-full bg-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition active:scale-[0.98]"
          >
            <Lock size={14} /> Fechar dia
          </button>
        )}
      </div>

      {/* Company notes */}
      <DaySection
        title="Notas da Empresa"
        icon={Receipt}
        total={notesTotal}
        onAdd={() => { setNoteError(null); setNoteSheet(true); }}
        addLabel="Nova nota"
      >
        {companyNotes.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-400">Nenhuma nota lançada</p>
        ) : (
          <ul className="space-y-2">
            {companyNotes.map((n) => (
              <DayItem
                key={n.id}
                amount={n.amount}
                subtitle={n.description ?? undefined}
                meta={formatDateTime(n.created_at)}
                onDelete={() => { db.deleteCompanyNote(n.id); refresh(); }}
              />
            ))}
          </ul>
        )}
      </DaySection>

      {/* Company payments */}
      <DaySection
        title="Pagamentos à Empresa"
        icon={CreditCard}
        total={paymentsTotal}
        onAdd={() => { setPayError(null); setPaymentSheet(true); }}
        addLabel="Novo pagamento"
      >
        {companyPayments.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-400">Nenhum pagamento lançado</p>
        ) : (
          <ul className="space-y-2">
            {companyPayments.map((p) => (
              <DayItem
                key={p.id}
                amount={p.amount}
                subtitle={p.description ?? undefined}
                meta={formatDateTime(p.created_at)}
                color="text-sky-600"
                onDelete={() => { db.deleteCompanyPayment(p.id); refresh(); }}
              />
            ))}
          </ul>
        )}
      </DaySection>

      {/* Note sheet */}
      <Sheet open={noteSheet} onClose={() => setNoteSheet(false)} title="Nova nota da empresa">
        <AmountSheet
          error={noteError}
          amount={noteAmount}
          setAmount={setNoteAmount}
          desc={noteDesc}
          setDesc={setNoteDesc}
          descPlaceholder="Ex: NF 12345"
          onSubmit={handleAddNote}
          submitLabel="Confirmar"
          submitColor="bg-green-600"
        />
      </Sheet>

      {/* Payment sheet */}
      <Sheet open={paymentSheet} onClose={() => setPaymentSheet(false)} title="Novo pagamento à empresa">
        <AmountSheet
          error={payError}
          amount={payAmount}
          setAmount={setPayAmount}
          desc={payDesc}
          setDesc={setPayDesc}
          descPlaceholder="Ex: Pix para empresa"
          onSubmit={handleAddPayment}
          submitLabel="Confirmar"
          submitColor="bg-sky-600"
        />
      </Sheet>

      <ConfirmDialog
        open={confirmCloseDay}
        title="Fechar este dia?"
        message="O dia será marcado como fechado. Você pode reabrir a qualquer momento."
        confirmLabel="Fechar dia"
        onConfirm={handleCloseDay}
        onCancel={() => setConfirmCloseDay(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function DaySection({
  title,
  icon: Icon,
  total,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  icon: LucideIcon;
  total?: number;
  onAdd: () => void;
  addLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          {total !== undefined && (
            <span className="text-xs font-semibold text-slate-500">{formatCurrency(total)}</span>
          )}
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition active:scale-[0.98]"
        >
          <Plus size={12} /> {addLabel}
        </button>
      </div>
      {children}
    </section>
  );
}

function DayItem({
  amount,
  subtitle,
  meta,
  color = 'text-slate-800',
  onDelete,
}: {
  amount: number;
  subtitle?: string;
  meta: string;
  color?: string;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3">
      <div className="flex-1">
        <p className={`text-sm font-semibold ${color}`}>{formatCurrency(amount)}</p>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        <p className="text-[11px] text-slate-300">{meta}</p>
      </div>
      <button
        onClick={onDelete}
        className="rounded-full p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}

function AmountSheet({
  error,
  amount,
  setAmount,
  desc,
  setDesc,
  descPlaceholder,
  onSubmit,
  submitLabel,
  submitColor,
}: {
  error: string | null;
  amount: string;
  setAmount: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  descPlaceholder: string;
  onSubmit: () => void;
  submitLabel: string;
  submitColor: string;
}) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</div>
      )}
      <SheetField label="Valor (R$)">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-800 transition focus:border-slate-300 focus:bg-white"
        />
      </SheetField>
      <SheetField label="Descrição (opcional)">
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={descPlaceholder}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 transition focus:border-slate-300 focus:bg-white"
        />
      </SheetField>
      <button
        onClick={onSubmit}
        className={`w-full rounded-xl py-3 text-sm font-medium text-white transition active:scale-[0.99] ${submitColor}`}
      >
        {submitLabel}
      </button>
    </div>
  );
}

function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}
