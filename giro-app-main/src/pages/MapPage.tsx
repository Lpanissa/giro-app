import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Edit2, Search, MapPin, Phone, X, Navigation, Tag as TagIcon } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SwipeToDelete } from '@/components/common/SwipeToDelete';
import { useToast } from '@/components/common/Toast';
import { useClients } from '@/hooks/useClients';
import { useModalBackButton } from '@/hooks/useModalBackButton';
import type { Client } from '@/types';

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

export function MapPage() {
  const { clients, loading, createClient, editClient, deleteClient } = useClients();
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

  // Controla qual campo está em foco, pra mostrar o "x" de limpar só nele
  const [focusedField, setFocusedField] = useState<
    'search' | 'name' | 'phone' | 'address' | 'tag' | null
  >(null);

  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Client | null>(null);

  // Botão de voltar do celular fecha o modal em vez de sair do app
  useModalBackButton(isModalOpen, () => setIsModalOpen(false));

  // Referências pra controlar foco/cursor dos campos
  const nameInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Controla qual cliente está com o menu de navegação (Maps/Waze/Apple Maps) aberto
  const [openNavMenuId, setOpenNavMenuId] = useState<string | null>(null);

  const uniqueStreets = Array.from(
    new Set(
      clients
        .map((c) => c.address?.trim())
        .filter(Boolean)
        .map((addr) => addr!.replace(/,\s*\d+.*$/, '').trim())
    )
  ) as string[];

  const uniqueTags = Array.from(
    new Set(
      clients
        .map((c) => (c as any).tag?.trim())
        .filter(Boolean)
    )
  ) as string[];

  const daysOfWeek = ['Todos', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Autofoca o campo Nome assim que o modal abre
  useEffect(() => {
    if (isModalOpen) {
      const t = setTimeout(() => nameInputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isModalOpen]);

  // ---- Helpers de navegação / contato ----
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
    // Se um filtro de dia específico estiver ativo, já pré-seleciona esse dia
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

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      day_of_week: routeDay || '',
      tag: tag.trim() || '',
    };

    // Bloqueia cadastro duplicado SÓ se TODOS os campos forem iguais
    // (nome, telefone, endereço, dia e tag) — qualquer diferença já cadastra normalmente.
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

  // Botão "x" reutilizável, só aparece quando o campo está em foco e tem texto
  const ClearButton = ({ onClear }: { onClear: () => void }) => (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault(); // evita perder o foco antes do clique registrar
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
        {focusedField === 'search' && searchTerm && <ClearButton onClear={() => setSearchTerm('')} />}
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

            return (
              <SwipeToDelete key={customer.id} onDelete={() => setCustomerToDelete(customer)}>
                <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{customer.name}</h3>
                      {customerTag && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                          {customerTag}
                        </span>
                      )}
                      {customerDay && (
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
                          {customerDay}
                        </span>
                      )}
                      {/* Bolinha de pendência: ativa quando integrarmos com Cobranças (CollectionsPage) */}
                    </div>

                    {customer.address && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenNavMenuId(openNavMenuId === customer.id ? null : customer.id)
                          }
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 hover:underline text-left dark:text-slate-400 dark:hover:text-blue-400"
                        >
                          <MapPin size={14} className="text-slate-400 shrink-0" />
                          <span className="truncate">{customer.address}</span>
                        </button>

                        {openNavMenuId === customer.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenNavMenuId(null)} />
                            <div className="absolute left-0 top-full mt-1 z-20 min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                              <button
                                type="button"
                                onClick={() => {
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
                                onClick={() => {
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
                                  onClick={() => {
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
                        onClick={() => openWhatsApp(customer.phone!)}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-green-600 hover:underline text-left dark:text-slate-400 dark:hover:text-green-400"
                        title="Abrir no WhatsApp"
                      >
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <span>{customer.phone}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditModal(customer)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                </div>
              </SwipeToDelete>
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
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setTimeout(() => setFocusedField((f) => (f === 'name' ? null : f)), 120)}
                  placeholder="Ex: Nome do cliente"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-9 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:placeholder-slate-500"
                />
                {focusedField === 'name' && name && <ClearButton onClear={() => setName('')} />}
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
                {focusedField === 'tag' && tag && <ClearButton onClear={() => setTag('')} />}

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
                {focusedField === 'phone' && phone && <ClearButton onClear={() => setPhone('')} />}
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Endereço</label>
                <input
                  ref={addressInputRef}
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setShowAddressSuggestions(e.target.value.trim().length > 0);
                  }}
                  onFocus={() => {
                    setFocusedField('address');
                    if (address.trim().length > 0) setShowAddressSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setFocusedField((f) => (f === 'address' ? null : f));
                    }, 150);
                  }}
                  placeholder="Rua, número, Bairro"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-9 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:placeholder-slate-500"
                />
                {focusedField === 'address' && address && (
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
                    // Sai do foco automaticamente assim que escolhe o dia
                    e.target.blur();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Nenhum (Sem dia fixo)</option>
                  <option value="Seg">Segunda</option>
                  <option value="Ter">Terça</option>
                  <option value="Qua">Quarta</option>
                  <option value="Qui">Quinta</option>
                  <option value="Sex">Sexta</option>
                  <option value="Sáb">Sábado</option>
                  <option value="Dom">Domingo</option>
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
