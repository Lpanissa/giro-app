import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, MapPin, Phone, X, Navigation, Tag as TagIcon, Plus, ShoppingBag } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SwipeableRow } from '@/components/common/SwipeableRow';
import { useToast } from '@/components/common/Toast';
import { useClients } from '@/hooks/useClients';
import { useDirectSales } from '@/hooks/useDirectSales';
import { useModalBackButton } from '@/hooks/useModalBackButton';
import { formatCurrency, formatDate } from '@/utils/format';
import type { Client, DirectSale } from '@/types';

// Normaliza texto pra comparação (ignora maiúsculas, acentos e espaços nas pontas)
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Máscara de telefone brasileiro: (XX) XXXXX-XXXX (celular) ou (XX) XXXX-XXXX (fixo)
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);

const LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

function toTitleCase(input: string): string {
  return input
    .split(' ')
    .map((word, index) => {
      if (!word) return word;
      const lower = word.toLowerCase();
      if (index !== 0 && LOWERCASE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

interface PendingGroup {
  transactionId: string;
  total: number;
  paidAmount: number;
  dueDate: string | null;
}

export function MapPage() {
  const { clients, loading, createClient, editClient, deleteClient } = useClients();
  const { sales, updateTransaction } = useDirectSales();
  const { notify } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('Todos');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Client | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [routeDay, setRouteDay] = useState('');
  const [tag, setTag] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [focusedField, setFocusedField] = useState<
    'search' | 'name' | 'phone' | 'address' | 'tag' | null
  >(null);

  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Client | null>(null);

  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [showPendingList, setShowPendingList] = useState(false);

  const [selectedPendingGroup, setSelectedPendingGroup] = useState<PendingGroup | null>(null);
  const [paymentType, setPaymentType] = useState<'total' | 'partial'>('total');
  const [partialValue, setPartialValue] = useState('');

  useModalBackButton(isModalOpen, () => setIsModalOpen(false));
  useModalBackButton(!!detailClient, () => setDetailClient(null));
  useModalBackButton(!!selectedPendingGroup, () => setSelectedPendingGroup(null));

  const nameInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  const [openNavMenuId, setOpenNavMenuId] = useState<string | null>(null);

  const uniqueStreets = Array.from(
    clients.reduce((map, c) => {
      const rawAddr = c.address?.trim();
      if (rawAddr) {
        const cleanedAddr = rawAddr
          .replace(/\s\d+.*/, '')
          .replace(/[,.\s]+$/, '')
          .trim();

        if (cleanedAddr) {
          const normalizedKey = cleanedAddr
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

          if (!map.has(normalizedKey)) {
            map.set(normalizedKey, cleanedAddr);
          }
        }
      }
      return map;
    }, new Map<string, string>()).values()
  );

  const uniqueTags = Array.from(
    clients.reduce((map, c) => {
      const rawTag = (c as any).tag?.trim();
      if (rawTag) {
        const lowerKey = rawTag.toLowerCase();
        if (!map.has(lowerKey)) {
          map.set(lowerKey, rawTag);
        }
      }
      return map;
    }, new Map<string, string>()).values()
  );

  const daysOfWeek = ['Todos', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo', 'Nenhum'];

  const clientInfoMap = useMemo(() => {
    const map = new Map<
      string,
      { lastPurchase: { productName: string; date: string } | null; pendingGroups: PendingGroup[]; pendingTotal: number }
    >();

    const latestByClient = new Map<string, DirectSale>();
    for (const sale of sales) {
      if (!sale.client_id) continue;
      const current = latestByClient.get(sale.client_id);
      if (!current || sale.created_at > current.created_at) {
        latestByClient.set(sale.client_id, sale);
      }
    }

    const pendingGroupsByClient = new Map<string, Map<string, PendingGroup>>();
    for (const sale of sales) {
      if (!sale.client_id || sale.status !== 'Pendente') continue;
      if (!pendingGroupsByClient.has(sale.client_id)) {
        pendingGroupsByClient.set(sale.client_id, new Map());
      }
      const groups = pendingGroupsByClient.get(sale.client_id)!;
      if (!groups.has(sale.transaction_id)) {
        groups.set(sale.transaction_id, {
          transactionId: sale.transaction_id,
          total: 0,
          paidAmount: (sale as any).paid_amount ?? 0,
          dueDate: sale.due_date,
        });
      }
      groups.get(sale.transaction_id)!.total += sale.unit_price * sale.quantity;
    }

    const allClientIds = new Set<string>([...latestByClient.keys(), ...pendingGroupsByClient.keys()]);
    allClientIds.forEach((clientId) => {
      const lastSale = latestByClient.get(clientId);
      const groups = pendingGroupsByClient.get(clientId);
      const pendingGroups = groups
        ? Array.from(groups.values()).filter((g) => g.total - g.paidAmount > 0.001)
        : [];

      map.set(clientId, {
        lastPurchase: lastSale
          ? { productName: lastSale.product?.name ?? 'Produto', date: lastSale.created_at }
          : null,
        pendingGroups,
        pendingTotal: pendingGroups.reduce((sum, g) => sum + (g.total - g.paidAmount), 0),
      });
    });

    return map;
  }, [sales]);

  useEffect(() => {
    if (isModalOpen) {
      const t = setTimeout(() => nameInputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isModalOpen]);

  const handleAddressClick = (customerId: string, addr: string) => {
    if (isAndroid) {
      window.location.href = `geo:0,0?q=${encodeURIComponent(addr)}`;
    } else {
      setOpenNavMenuId(openNavMenuId === customerId ? null : customerId);
    }
  };

  const openGoogleMaps = (addr: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
  };

  const openWaze = (addr: string) => {
    window.open(`https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`, '_blank');
  };

  const openAppleMaps = (addr: string) => {
    window.open(`https://maps.apple.com/?q=${encodeURIComponent(addr)}`, '_blank');
  };

  const openWhatsApp = (rawPhone: string) => {
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone) return;
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${fullPhone}`, '_blank');
  };

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setAddress('');
    setRouteDay(selectedDayFilter !== 'Todos' ? selectedDayFilter : '');
    setTag('');
    setFormError(null);
    setShowAddressSuggestions(false);
    setShowTagSuggestions(false);
    setFocusedField(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (customer: Client) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone || '');
    setAddress(customer.address || '');
    setRouteDay(customer.day_of_week || (customer as any).routeDay || '');
    setTag((customer as any).tag || '');
    setFormError(null);
    setShowAddressSuggestions(false);
    setShowTagSuggestions(false);
    setFocusedField(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setShowAddressSuggestions(false);
    setShowTagSuggestions(false);

    const existingTagMatch = clients.find(
      (c: any) => c.tag && c.tag.trim().toLowerCase() === tag.trim().toLowerCase()
    );
    const finalTag = existingTagMatch ? existingTagMatch.tag.trim() : tag.trim();

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      day_of_week: routeDay || '',
      tag: finalTag || '',
    };

    const duplicate = clients.find((c) => {
      if (editingCustomer && c.id === editingCustomer.id) return false;
      const cDay = c.day_of_week || (c as any).routeDay || '';
      const cTag = (c as any).tag || '';
      return (
        normalize(c.name) === normalize(payload.name) &&
        (c.phone || '').replace(/\D/g, '') === payload.phone.replace(/\D/g, '') &&
        normalize(c.address || '') === normalize(payload.address) &&
        cDay === payload.day_of_week &&
        normalize(cTag) === normalize(payload.tag)
      );
    });

    if (duplicate) {
      setFormError('Cliente já cadastrado.');
      return;
    }

    const err = editingCustomer
      ? await editClient(editingCustomer.id, payload)
      : (await createClient(payload)).error;

    if (err) {
      setFormError(err);
      return;
    }

    notify(editingCustomer ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!', 'success');
    setIsModalOpen(false);
  };

  const handleDelete = async () => {
    if (customerToDelete) {
      await deleteClient(customerToDelete.id);
      setCustomerToDelete(null);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedPendingGroup) return;

    const currentDate = new Date().toISOString();
    const currentPaid = selectedPendingGroup.paidAmount || 0;
    let newPaidAmount = currentPaid;
    let isFullyPaid = false;

    if (paymentType === 'total') {
      newPaidAmount = selectedPendingGroup.total;
      isFullyPaid = true;
    } else {
      const parsedPartial = parseFloat(partialValue.replace(',', '.')) || 0;
      if (parsedPartial <= 0) {
        notify('Digite um valor válido para o pagamento parcial.', 'error');
        return;
      }
      newPaidAmount = currentPaid + parsedPartial;
      if (newPaidAmount >= selectedPendingGroup.total) {
        newPaidAmount = selectedPendingGroup.total;
        isFullyPaid = true;
      }
    }

    const err = await updateTransaction(selectedPendingGroup.transactionId, {
      status: isFullyPaid ? 'Pago' : 'Pendente',
      paid_at: isFullyPaid ? currentDate : null,
      paid_amount: newPaidAmount,
    } as any);

    if (err) {
      notify(err, 'error');
    } else {
      notify(
        isFullyPaid
          ? 'Cobrança recebida com sucesso!'
          : `Pagamento parcial de ${formatCurrency(newPaidAmount - currentPaid)} registrado!`,
        'success'
      );
      setDetailClient(null);
    }

    setSelectedPendingGroup(null);
    setShowPendingList(false);
    setPaymentType('total');
    setPartialValue('');
  };

  const filteredCustomers = clients.filter((customer) => {
    const customerDay = customer.day_of_week || (customer as any).routeDay;

    const matchesSearch =
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.address && customer.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.phone && customer.phone.includes(searchTerm)) ||
      ((customer as any).tag && (customer as any).tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDay =
      selectedDayFilter === 'Todos' ||
      (selectedDayFilter === 'Nenhum' ? !customerDay : customerDay === selectedDayFilter);

    return matchesSearch && matchesDay;
  });

  const ClearButton = ({ onClear }: { onClear: () => void }) => (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault();
        onClear();
      }}
      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition"
    >
      <X size={13} />
    </button>
  );

  if (loading) {
    return <div className="p-4 text-center text-slate-500 dark:text-slate-400">Carregando clientes...</div>;
  }

  return (
    <div className="space-y-4 pb-20 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Clientes & Rotas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cadastre e organize seus clientes por dia</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {daysOfWeek.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDayFilter(day)}
            className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
              selectedDayFilter === day
                ? 'bg-slate-900 text-white shadow-sm dark:bg-emerald-500 dark:text-slate-950'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setFocusedField('search')}
          onBlur={() => setTimeout(() => setFocusedField((f) => (f === 'search' ? null : f)), 120)}
          placeholder="Pesquisar clientes, tags, endereços ou telefones..."
          className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-9 py-2.5 text-sm text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
        />
        {searchTerm && <ClearButton onClear={() => setSearchTerm('')} />}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-1">
          Clientes ({filteredCustomers.length})
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-500">
            <p className="text-sm">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const customerDay = customer.day_of_week || (customer as any).routeDay;
            const customerTag = (customer as any).tag as string | undefined;
            const info = clientInfoMap.get(customer.id);
            const hasPending = !!info && info.pendingTotal > 0;

            return (
              <SwipeableRow
                key={customer.id}
                onDelete={() => setCustomerToDelete(customer)}
                onEdit={() => handleOpenEditModal(customer)}
                onClick={() => {
                  setDetailClient(customer);
                  setShowPendingList(false);
                }}
              >
                <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{customer.name}</h3>
                      {customerTag && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200 dark:border-slate-800 dark:text-slate-400">
                          {customerTag}
                        </span>
                      )}
                      {customerDay && (
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100 dark:border-blue-500/10 dark:text-blue-400">
                          {customerDay}
                        </span>
                      )}
                      {hasPending && (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                          Pendente
                        </span>
                      )}
                    </div>

                    {customer.address && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddressClick(customer.id, customer.address!);
                          }}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 hover:underline text-left dark:text-slate-400 dark:hover:text-blue-400"
                        >
                          <MapPin size={14} className="text-slate-400 shrink-0" />
                          <span className="truncate">{customer.address}</span>
                        </button>

                        {openNavMenuId === customer.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenNavMenuId(null);
                              }}
                            />
                            <div className="absolute left-0 top-full mt-1 z-20 min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openGoogleMaps(customer.address!);
                                  setOpenNavMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                <Navigation size={14} className="text-blue-500 shrink-0" />
                                Abrir no Google Maps
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openWaze(customer.address!);
                                  setOpenNavMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition border-t border-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 dark:border-slate-700"
                              >
                                <Navigation size={14} className="text-sky-500 shrink-0" />
                                Abrir no Waze
                              </button>
                              {isIOS && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAppleMaps(customer.address!);
                                    setOpenNavMenuId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition border-t border-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 dark:border-slate-700"
                                >
                                  <Navigation size={14} className="text-slate-500 shrink-0" />
                                  Abrir no Apple Maps
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {customer.phone && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhatsApp(customer.phone!);
                        }}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-green-600 hover:underline text-left dark:text-slate-400 dark:hover:text-green-400"
                        title="Abrir no WhatsApp"
                      >
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <span>{customer.phone}</span>
                      </button>
                    )}
                  </div>
                </div>
              </SwipeableRow>
            );
          })
        )}
      </div>

      <button
        onClick={handleOpenAddModal}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/40 transition hover:bg-blue-700 active:scale-95"
        title="Novo Cliente"
      >
        <Plus size={26} />
      </button>

      {detailClient && (() => {
        const info = clientInfoMap.get(detailClient.id);
        const hasPending = !!info && info.pendingTotal > 0;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setDetailClient(null)}
          >
            <div
              className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 text-slate-800 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{detailClient.name}</h2>
                <div className="flex items-center gap-2">
                  {hasPending && (
                    <button
                      onClick={() => setShowPendingList((v) => !v)}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
                    >
                      Pendente
                    </button>
                  )}
                  <button
                    onClick={() => setDetailClient(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                {info?.lastPurchase ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <ShoppingBag size={16} className="text-slate-400 shrink-0" />
                    <span>
                      Última compra: <strong>{info.lastPurchase.productName}</strong> em {formatDate(info.lastPurchase.date)}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Nenhuma compra registrada ainda.</p>
                )}

                {hasPending && (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Total pendente: <strong>{formatCurrency(info!.pendingTotal)}</strong>
                  </p>
                )}

                {showPendingList && info && info.pendingGroups.length > 0 && (
                  <ul className="space-y-2 pt-1">
                    {info.pendingGroups.map((g) => (
                      <li key={g.transactionId}>
                        <button
                          onClick={() => {
                            setSelectedPendingGroup(g);
                            setPaymentType('total');
                            setPartialValue('');
                          }}
                          className="w-full flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-left text-xs transition hover:bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10"
                        >
                          <span className="text-slate-600 dark:text-slate-300">
                            {g.dueDate ? `Vence dia ${formatDate(g.dueDate)}` : 'Sem data de vencimento'}
                          </span>
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            {formatCurrency(g.total - g.paidAmount)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {selectedPendingGroup && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedPendingGroup(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Registrar Recebimento</h3>
              <button
                onClick={() => setSelectedPendingGroup(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-300">
              Cliente: <strong className="text-slate-800 dark:text-slate-100">{detailClient?.name}</strong>
              <div className="mt-1">
                Restante a pagar:{' '}
                <strong className="text-amber-600">
                  {formatCurrency(selectedPendingGroup.total - (selectedPendingGroup.paidAmount || 0))}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPaymentType('total')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition border ${
                  paymentType === 'total'
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Valor Total
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('partial')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition border ${
                  paymentType === 'partial'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Valor Parcial
              </button>
            </div>

            {paymentType === 'partial' && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Quanto foi pago?</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={partialValue}
                    onChange={(e) => setPartialValue(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  O valor será abatido e a cobrança continuará pendente até quitar tudo.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPendingGroup(null)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-600 shadow-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 text-slate-800 shadow-xl max-h-[90vh] overflow-y-auto dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingCustomer ? 'Editar Cliente' : 'Novo cliente'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 pt-4">
              {formError && (
                <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  {formError}
                </div>
              )}

              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nome</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const input = e.target;
                    const start = input.selectionStart;
                    const end = input.selectionEnd;

                    setName(toTitleCase(input.value));

                    requestAnimationFrame(() => {
                      input.setSelectionRange(start, end);
                    });
                  }}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setTimeout(() => setFocusedField((f) => (f === 'name' ? null : f)), 120)}
                  placeholder="Ex: Nome do cliente"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-9 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:placeholder-slate-500"
                />
                {name && <ClearButton onClear={() => setName('')} />}
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Tag <span className="font-normal text-slate-400">(opcional — ex: Brechó, Amiga, Fornecedor)</span>
                </label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => {
                    setTag(e.target.value);
                    setShowTagSuggestions(true);
                  }}
                  onFocus={() => {
                    setFocusedField('tag');
                    if (tag.trim().length > 0) setShowTagSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setFocusedField((f) => (f === 'tag' ? null : f));
                      setShowTagSuggestions(false);
                    }, 150);
                  }}
                  placeholder="Ex: Brechó"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-9 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:placeholder-slate-500"
                />
                {tag && <ClearButton onClear={() => setTag('')} />}

                {showTagSuggestions && tag.trim().length > 0 && uniqueTags.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    {uniqueTags
                      .filter((t) => t.toLowerCase().includes(tag.toLowerCase()))
                      .map((t) => (
                        <button
                          key={t}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setTag(t);
                            setShowTagSuggestions(false);
                          }}
                          className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 transition flex items-center gap-2 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <TagIcon size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{t}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Telefone</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setTimeout(() => setFocusedField((f) => (f === 'phone' ? null : f)), 120)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-9 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:placeholder-slate-500"
                />
                {phone && <ClearButton onClear={() => setPhone('')} />}
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Endereço</label>
                <input
                  ref={addressInputRef}
                  type="text"
                  value={address}
                  onChange={(e) => {
                    const input = e.target;
                    const start = input.selectionStart;
                    const end = input.selectionEnd;

                    setAddress(input.value);
                    setShowAddressSuggestions(input.value.trim().length > 0);

                    requestAnimationFrame(() => {
                      input.setSelectionRange(start, end);
                    });
                  }}
                  onFocus={() => {
                    setFocusedField('address');
                    if (address.trim().length > 0) setShowAddressSuggestions(true);
                  }}
                  onBlur={() => {
                    setAddress(toTitleCase(address));
                    setTimeout(() => {
                      setFocusedField((f) => (f === 'address' ? null : f));
                    }, 150);
                  }}
                  placeholder="Rua, número, Bairro"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-9 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:placeholder-slate-500"
                />
                {address && (
                  <ClearButton
                    onClear={() => {
                      setAddress('');
                      setShowAddressSuggestions(false);
                    }}
                  />
                )}

                {showAddressSuggestions && address.trim().length > 0 && uniqueStreets.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAddressSuggestions(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                      {uniqueStreets
                        .filter((street) => street.toLowerCase().includes(address.toLowerCase()))
                        .map((street) => (
                          <button
                            key={street}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const filled = `${street}, `;
                              setAddress(filled);
                              setShowAddressSuggestions(false);
                              requestAnimationFrame(() => {
                                const el = addressInputRef.current;
                                if (el) {
                                  el.focus();
                                  el.setSelectionRange(filled.length, filled.length);
                                }
                              });
                            }}
                            className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 transition flex items-center gap-2 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">{street}</span>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Dia da rota</label>
                <select
                  value={routeDay}
                  onChange={(e) => {
                    setRouteDay(e.target.value);
                    e.target.blur();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Nenhum (Sem dia fixo)</option>
                  <option value="Segunda">Segunda</option>
                  <option value="Terça">Terça</option>
                  <option value="Quarta">Quarta</option>
                  <option value="Quinta">Quinta</option>
                  <option value="Sexta">Sexta</option>
                  <option value="Sábado">Sábado</option>
                  <option value="Domingo">Domingo</option>
                </select>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700"
                >
                  {editingCustomer ? 'Salvar Alterações' : 'Adicionar cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!customerToDelete}
        title="Excluir Cliente"
        message={`Deseja realmente excluir o cliente "${customerToDelete?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setCustomerToDelete(null)}
      />
    </div>
  );
}
