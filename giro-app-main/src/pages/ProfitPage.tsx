import { useMemo, useState } from 'react';
import { Plus, CircleDollarSign, ShoppingBag, X, Pencil, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check, TrendingUp, Search } from 'lucide-react';
import { useDirectSales, type NewDirectSaleItem } from '@/hooks/useDirectSales';
import { useProducts } from '@/hooks/useProducts';
import { useClients } from '@/hooks/useClients';
import * as db from '@/lib/storage';
import { useToast } from '@/components/common/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Sheet } from '@/components/common/Sheet';
import { SwipeToDelete } from '@/components/common/SwipeToDelete';
import { formatCurrency, formatDateTime } from '@/utils/format';
import type { DirectSale, SaleStatus } from '@/types';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shortDateLabel(d: Date): string {
  return `${d.getDate()}/${MONTHS_SHORT[d.getMonth()]}`;
}

function formatPaidAtShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()}/${MONTHS_SHORT[d.getMonth()]}`;
}

interface SaleFormItem {
  product_id: string;
  productSearch?: string;
  showDropdown?: boolean;
  quantity: string;
  // Preço e custo manuais usados apenas quando o produto selecionado tem valor R$ 0,00 no estoque
  // (preço "flexível"). Nunca são salvos no cadastro do produto, só usados nesta venda.
  manualPrice?: string;
  manualCost?: string;
}

interface GroupedSale {
  transactionId: string;
  clientId: string | null;
  clientName: string;
  status: SaleStatus;
  sales: DirectSale[];
  total: number;
  profit: number;
  createdAt: string;
  paidAt: string | null;
  dueDate: string | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

export function ProfitPage() {
  const { sales, registerMultiSale, updateTransaction, deleteTransaction, deleteSale } = useDirectSales();
  const { products } = useProducts();
  const { clients, createClient } = useClients();
  const { notify } = useToast();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [dueDate, setDueDate] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const [status, setStatus] = useState<SaleStatus>('Pago');
  const [items, setItems] = useState<SaleFormItem[]>([{ product_id: '', productSearch: '', showDropdown: false, quantity: '1', manualPrice: '', manualCost: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);
  const [deleteSaleId, setDeleteSaleId] = useState<string | null>(null);

  const selectedDateKey = dayKey(selectedDate);
  const currentMonthYearPrefix = selectedDateKey.slice(0, 7);
  const currentMonthName = MONTHS_FULL[selectedDate.getMonth()];

  const goPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };
  const goNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const [editingSale, setEditingSale] = useState<GroupedSale | null>(null);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return [];
    return clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clients, clientSearch]);

  const totalDayProfit = useMemo(() => {
    return sales
      .filter((sale) => sale.created_at.slice(0, 10) === selectedDateKey)
      .reduce((s, sale) => s + sale.profit, 0);
  }, [sales, selectedDateKey]);

  const daySalesList = useMemo(() => {
    return sales.filter((sale) => sale.created_at.slice(0, 10) === selectedDateKey);
  }, [sales, selectedDateKey]);

  const totalSales = useMemo(
    () => daySalesList.reduce((sum, s) => sum + s.unit_price * s.quantity, 0),
    [daySalesList],
  );

  // Calcula o total pendente de TODAS as vendas do sistema (não zera ao virar o mês, fica pendente até dar baixa)
  const pendingTotal = useMemo(
    () => sales.filter((s) => s.status === 'Pendente').reduce((sum, s) => sum + s.unit_price * s.quantity, 0),
    [sales],
  );

  const monthlySummary = useMemo(() => {
    const monthSales = sales.filter((s) => s.created_at.slice(0, 7) === currentMonthYearPrefix);
    const totalRevenue = monthSales.reduce((sum, s) => sum + s.unit_price * s.quantity, 0);
    const totalProfit = monthSales.reduce((sum, s) => sum + s.profit, 0);
    return { totalRevenue, totalProfit };
  }, [sales, currentMonthYearPrefix]);

  const groupedSales = useMemo(() => {
    const map = new Map<string, GroupedSale>();
    for (const sale of daySalesList) {
      const txId = sale.transaction_id;
      if (!map.has(txId)) {
        map.set(txId, {
          transactionId: txId,
          clientId: sale.client_id,
          clientName: sale.client?.name ?? 'Venda direta',
          status: sale.status,
          sales: [],
          total: 0,
          profit: 0,
          createdAt: sale.created_at,
          paidAt: sale.paid_at,
          dueDate: sale.due_date,
        });
      }
      const group = map.get(txId)!;
      group.sales.push(sale);
      group.total += sale.unit_price * sale.quantity;
      group.profit += sale.profit;
    }
    return Array.from(map.values());
  }, [daySalesList]);

  const finalFilteredSales = useMemo(() => {
    if (!searchQuery.trim()) return groupedSales;
    const q = searchQuery.toLowerCase();
    return groupedSales.filter((group) => {
      const matchClient = group.clientName.toLowerCase().includes(q);
      const matchProducts = group.sales.some((s) => s.product?.name?.toLowerCase().includes(q));
      return matchClient || matchProducts;
    });
  }, [groupedSales, searchQuery]);

  const saleItemsTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) return sum;
      // Se o produto tem preço R$ 0,00 no estoque (preço flexível), usa o valor digitado manualmente para esta venda
      const unitPrice = product.price === 0 ? parseFloat(item.manualPrice ?? '') || 0 : product.price;
      return sum + unitPrice * (parseInt(item.quantity, 10) || 0);
    }, 0);
  }, [items, products]);

  const handleAddItem = () => setItems([...items, { product_id: '', productSearch: '', showDropdown: false, quantity: '1', manualPrice: '', manualCost: '' }]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleItemFieldChange = (index: number, field: keyof SaleFormItem, value: any) => {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleRegister = () => {
    const validItems = items.filter((i) => i.product_id);
    if (validItems.length === 0) { setError('Adicione ao menos um produto válido'); return; }
    for (const item of validItems) {
      if ((parseInt(item.quantity, 10) || 0) <= 0) { setError('Quantidade inválida'); return; }
      const product = products.find((p) => p.id === item.product_id);
      if (product && product.price === 0) {
        if (!(parseFloat(item.manualPrice ?? '') > 0)) {
          setError(`Informe o valor de venda para "${product.name}"`);
          return;
        }
        if (item.manualCost !== '' && isNaN(parseFloat(item.manualCost ?? ''))) {
          setError(`Custo inválido para "${product.name}"`);
          return;
        }
      }
    }

    let finalClientId = clientId;
    const trimmedSearch = clientSearch.trim();

    if (trimmedSearch && !finalClientId) {
      const existing = clients.find((c) => c.name.toLowerCase() === trimmedSearch.toLowerCase());
      if (existing) {
        finalClientId = existing.id;
      } else {
        const errCreate = createClient({
          name: trimmedSearch,
          day_of_week: '', 
          phone: '',
          address: '',
          observations: '',
        });

        if (!errCreate) {
          try {
            const allClients = db.getClients();
            const newlyCreated = allClients.find(c => c.name === trimmedSearch);
            if (newlyCreated) {
              finalClientId = newlyCreated.id;
            }
          } catch (e) {
            console.error('Erro ao resgatar ID do novo cliente', e);
          }
        }
      }
    }

    const saleItems: NewDirectSaleItem[] = validItems.map((item) => {
      const product = products.find((p) => p.id === item.product_id)!;
      // Produto com preço R$ 0,00 no estoque usa o valor e custo digitados manualmente apenas nesta venda,
      // sem alterar o cadastro original do produto
      const unitPrice = product.price === 0 ? (parseFloat(item.manualPrice ?? '') || 0) : product.price;
      const unitCost = product.price === 0 ? (parseFloat(item.manualCost ?? '') || 0) : product.cost;
      return { product_id: product.id, quantity: parseInt(item.quantity, 10), unit_cost: unitCost, unit_price: unitPrice };
    });

    const err = registerMultiSale(
      finalClientId || null, 
      status, 
      saleItems, 
      status === 'Pendente' && dueDate ? dueDate : null,
      selectedDateKey
    );
    if (err) { setError(err); notify(err, 'error'); return; }

    setSheetOpen(false);
    setClientId(''); setClientSearch(''); setStatus('Pago'); setDueDate(''); setItems([{ product_id: '', productSearch: '', showDropdown: false, quantity: '1', manualPrice: '', manualCost: '' }]); setError(null);
    notify('Venda registrada com sucesso', 'success');
  };
// título da página 
  return (
    <div className="space-y-5 overflow-y-auto pt-8 pb-16 pr-1">
<div>
  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vendas</h1>
  <p className="text-sm text-slate-500">Acompanhe suas vendas e lucros do dia</p>
</div>
      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
        <button onClick={goPrevDay} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
          <ChevronLeft size={20} />
        </button>

        <label className="relative flex cursor-pointer items-center gap-2 rounded-xl px-3 py-1 transition hover:bg-slate-50">
          <CalendarIcon size={16} className="text-emerald-500" />
          <span className="text-base font-semibold text-slate-800">{shortDateLabel(selectedDate)}</span>
          <input
            type="date"
            value={selectedDateKey}
            onChange={(e) => {
              if (e.target.value) {
                const [y, m, d] = e.target.value.split('-').map(Number);
                setSelectedDate(new Date(y, m - 1, d));
              }
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            style={{ colorScheme: 'light' }}
          />
        </label>

        <button onClick={goNextDay} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="rounded-3xl bg-emerald-500 px-5 py-6 shadow-lg shadow-emerald-500/20">
        <div className="flex items-center gap-1.5 text-emerald-50">
          <CircleDollarSign size={14} />
          <span className="text-[11px] font-semibold uppercase tracking-wide">Lucro do dia</span>
        </div>
        <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(totalDayProfit)}</p>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Vendas diretas</h2>
        </div>

        <div className="relative mb-3">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            autoComplete="off"
            name="search_vendas_diretas"
            placeholder="Pesquisar vendas ou clientes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          )}
        </div>

        {finalFilteredSales.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="Nenhuma venda encontrada" message="Tente buscar por outro termo ou registre uma nova venda" />
        ) : (
          <ul className="space-y-2.5">
            {finalFilteredSales.map((group) => (
              <SwipeToDelete key={group.transactionId} onDelete={() => setDeleteTxId(group.transactionId)}>
                <div className="px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{group.clientName}</p>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${group.status === 'Pago' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-100 text-amber-700'}`}>
                        {group.status === 'Pago' && group.sales.some((s) => s.paid_at)
                          ? `Pago em ${formatPaidAtShort(group.sales.find((s) => s.paid_at)?.paid_at)}`
                          : group.status}
                      </span>
                      <button onClick={() => setEditingSale(group)} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Editar venda">
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {group.sales.map((sale) => (
                      <span key={sale.id} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                        <ShoppingBag size={11} />
                        {sale.product?.name ?? 'Produto'} x{sale.quantity}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{formatDateTime(group.createdAt)}</span>
                    <div className="flex gap-3">
                      <span className="text-xs font-semibold text-slate-700">{formatCurrency(group.total)}</span>
                      <span className="text-xs font-semibold text-emerald-600">+{formatCurrency(group.profit)}</span>
                    </div>
                  </div>
                </div>
              </SwipeToDelete>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vendas (Do Dia)</span>
          <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(totalSales)}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Pendentes (Geral)</span>
          <p className="mt-2 text-lg font-semibold text-amber-700">{formatCurrency(pendingTotal)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">Resumo de {currentMonthName}</span>
          </div>
          <span className="text-[10px] font-medium text-slate-400">{selectedDate.getFullYear()}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-xl bg-slate-50 p-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Faturado</span>
            <p className="mt-1 text-base font-semibold text-slate-800">{formatCurrency(monthlySummary.totalRevenue)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50/60 p-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Lucro do Mês</span>
            <p className="mt-1 text-base font-semibold text-emerald-700">{formatCurrency(monthlySummary.totalProfit)}</p>
          </div>
        </div>
      </div>

      {/* Botão Flutuante (FAB) fixo padrão no canto inferior direito */}
      <button 
        onClick={() => { setError(null); setClientId(''); setClientSearch(''); setSheetOpen(true); }}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/40 transition hover:bg-emerald-600 active:scale-95"
        title="Registrar Venda"
      >
        <Plus size={26} />
      </button>

      {/* Sheet com altura dinâmica ajustada perfeitamente ao teclado */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Nova venda">
        <div className="space-y-4 overflow-y-auto px-1 pb-6 max-h-[calc(100vh-220px)]">
          {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</div>}

          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente (Busque ou digite um novo)</label>
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoComplete="off"
                name="client_search_input"
                placeholder="Ex: Lucas Panissa..."
                value={clientSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setClientSearch(val);
                  setShowClientDropdown(val.trim().length > 0);
                  if (!val.trim()) setClientId('');
                }}
                onFocus={() => {
                  if (clientSearch.trim().length > 0) {
                    setShowClientDropdown(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowClientDropdown(false);
                  }, 200);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-3 text-sm text-slate-800 transition focus:border-slate-300 focus:bg-white"
              />
              {(clientId || clientSearch) && (
                <button
                  type="button"
                  onClick={() => { setClientId(''); setClientSearch(''); setShowClientDropdown(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {showClientDropdown && filteredClients.length > 0 && (
              <div 
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                onMouseDown={(e) => e.preventDefault()}
              >
                {filteredClients.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setClientId(c.id);
                      setClientSearch(c.name);
                      setShowClientDropdown(false);
                    }}
                    className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs text-slate-800 hover:bg-slate-50"
                  >
                    <span>{c.name}</span>
                    {clientId === c.id && <Check size={14} className="text-emerald-500" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Produtos</label>
            <div className="space-y-3">
              {items.map((item, index) => {
                const filteredProducts = products.filter((p) =>
                  p.name.toLowerCase().includes((item.productSearch ?? '').toLowerCase())
                );
                const selectedProduct = products.find((p) => p.id === item.product_id);
                const needsManualPrice = !!selectedProduct && selectedProduct.price === 0;

                return (
                  <div key={index} className="space-y-2">
                    <div className="flex gap-2 items-start">
                      <div className="relative flex-1">
                        <div className="relative">
                          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            autoComplete="off"
                            name={`product_search_${index}`}
                            placeholder="Buscar produto..."
                            value={item.productSearch ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updatedItems = [...items];
                              updatedItems[index].productSearch = val;
                              updatedItems[index].showDropdown = val.trim().length > 0;
                              if (!val.trim()) updatedItems[index].product_id = '';
                              setItems(updatedItems);
                            }}
                            onFocus={() => {
                              const updatedItems = [...items];
                              if ((updatedItems[index].productSearch ?? '').trim().length > 0) {
                                updatedItems[index].showDropdown = true;
                                setItems(updatedItems);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                const updatedItems = [...items];
                                updatedItems[index].showDropdown = false;
                                setItems(updatedItems);
                              }, 200);
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-8 py-3 text-sm text-slate-800 transition focus:border-slate-300 focus:bg-white"
                          />
                          {(item.product_id || item.productSearch) && (
                            <button
                              type="button"
                              onClick={() => {  
                                const updatedItems = [...items];
                                updatedItems[index].product_id = '';
                                updatedItems[index].productSearch = '';
                                updatedItems[index].showDropdown = false;
                                updatedItems[index].manualPrice = '';
                                updatedItems[index].manualCost = '';
                                setItems(updatedItems);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        {item.showDropdown && filteredProducts.length > 0 && (
                          <div 
                            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {filteredProducts.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  const updatedItems = [...items];
                                  updatedItems[index].product_id = p.id;
                                  updatedItems[index].productSearch = `${p.name} — ${formatCurrency(p.price)}`;
                                  updatedItems[index].showDropdown = false;
                                  updatedItems[index].manualPrice = '';
                                  updatedItems[index].manualCost = '';
                                  setItems(updatedItems);
                                }}
                                className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs text-slate-800 hover:bg-slate-50"
                              >
                                <span>{p.name} — {formatCurrency(p.price)}</span>
                                {item.product_id === p.id && <Check size={14} className="text-emerald-500" />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <input
                        type="number"
                        autoComplete="off"
                        inputMode="numeric"
                        value={item.quantity}
                        min="1"
                        onChange={(e) => handleItemFieldChange(index, 'quantity', e.target.value)}
                        className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 transition focus:border-slate-300 focus:bg-white"
                      />

                      {items.length > 1 && (
                        <button onClick={() => handleRemoveItem(index)} className="rounded-xl bg-slate-100 px-3 py-3 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {needsManualPrice && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                          <input
                            type="number"
                            autoComplete="off"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            placeholder="Custo do produto"
                            value={item.manualCost ?? ''}
                            onChange={(e) => handleItemFieldChange(index, 'manualCost', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-800 transition focus:border-slate-300 focus:bg-white"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                          <input
                            type="number"
                            autoComplete="off"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            placeholder="Valor da venda"
                            value={item.manualPrice ?? ''}
                            onChange={(e) => handleItemFieldChange(index, 'manualPrice', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-800 transition focus:border-slate-300 focus:bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={handleAddItem} className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600 transition active:scale-[0.98]">
              <Plus size={14} /> Adicionar produto
            </button>
          </div>

          {saleItemsTotal > 0 && (
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <span className="text-xs text-slate-500">Total: </span>
              <span className="text-lg font-semibold text-slate-800">{formatCurrency(saleItemsTotal)}</span>
            </div>
          )}

          <Field label="Status">
            <div className="flex gap-2">
              {(['Pago', 'Pendente'] as SaleStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 rounded-xl py-3 text-sm font-medium transition ${
                    status === s ? (s === 'Pago' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white') : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>

          {status === 'Pendente' && (
            <Field label="Data de Vencimento">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 transition focus:border-slate-300 focus:bg-white"
              />
            </Field>
          )}

          <button onClick={handleRegister} className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-medium text-white transition active:scale-[0.99]">
            Registrar venda
          </button>
        </div>
      </Sheet>

      {editingSale && (
        <EditSaleSheet
          group={editingSale}
          clients={clients}
          products={products}
          onClose={() => setEditingSale(null)}
          onUpdate={(txId, updates) => {
            const err = updateTransaction(txId, updates);
            if (err) notify(err, 'error');
            else notify('Venda atualizada', 'success');
            setEditingSale(null);
          }}
          onRequestDeleteSale={(saleId) => setDeleteSaleId(saleId)}
        />
      )}

      <ConfirmDialog
        open={deleteSaleId !== null}
        title="Excluir este produto?"
        message="O item será removido da venda e voltará ao estoque."
        confirmLabel="Excluir"
        onConfirm={() => {
          const saleId = deleteSaleId;
          setDeleteSaleId(null);
          setEditingSale(null);
          if (!saleId) return;
          const err = deleteSale(saleId);
          if (err) notify(err, 'error');
          else notify('Item excluído', 'success');
        }}
        onCancel={() => setDeleteSaleId(null)}
      />

      <ConfirmDialog
        open={deleteTxId !== null}
        title="Excluir venda?"
        message="A venda será removida e os itens voltarão ao estoque."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (deleteTxId) {
            const err = deleteTransaction(deleteTxId);
            if (err) notify(err, 'error');
            else notify('Venda excluída', 'success');
          }
          setDeleteTxId(null);
        }}
        onCancel={() => setDeleteTxId(null)}
      />
    </div>
  );
}

function EditSaleSheet({
  group,
  clients,
  products,
  onClose,
  onUpdate,
  onRequestDeleteSale,
}: {
  group: GroupedSale;
  clients: { id: string; name: string }[];
  products: { id: string; name: string; price: number; cost: number }[];
  onClose: () => void;
  onUpdate: (txId: string, updates: { client_id?: string | null; status?: SaleStatus; due_date?: string | null }) => void;
  onRequestDeleteSale: (saleId: string) => void;
}) {
  const { createClient } = useClients();
  const [clientId, setClientId] = useState(group.clientId ?? '');
  const initialClientName = clients.find((c) => c.id === group.clientId)?.name ?? '';
  const [clientSearch, setClientSearch] = useState(initialClientName);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [status, setStatus] = useState<SaleStatus>(group.status);
  const [dueDate, setDueDate] = useState(group.dueDate ?? '');
  const localSales = group.sales;

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return [];
    return clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clients, clientSearch]);

  return (
    <Sheet open onClose={onClose} title="Editar venda">
      <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto px-1 pb-6">
        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoComplete="off"
              name="edit_client_search"
              placeholder="Digite o nome do cliente..."
              value={clientSearch}
              onChange={(e) => {
                const val = e.target.value;
                setClientSearch(val);
                setShowClientDropdown(val.trim().length > 0);
                if (!val.trim()) setClientId('');
              }}
              onFocus={() => {
                if (clientSearch.trim().length > 0) {
                  setShowClientDropdown(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowClientDropdown(false);
                }, 200);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-800 transition focus:border-slate-300 focus:bg-white"
            />
          </div>

          {showClientDropdown && filteredClients.length > 0 && (
            <div 
              className="app-dropdown absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
              onMouseDown={(e) => e.preventDefault()}
            >
              {filteredClients.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setClientId(c.id);
                    setClientSearch(c.name);
                    setShowClientDropdown(false);
                  }}
                  className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs text-slate-800 hover:bg-slate-50"
                >
                  <span>{c.name}</span>
                  {clientId === c.id && <Check size={14} className="text-emerald-500" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Produtos (arraste para excluir)</label>
          <ul className="space-y-2">
            {localSales.map((sale) => (
              <SwipeToDelete key={sale.id} onDelete={() => onRequestDeleteSale(sale.id)}>
                <div className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span className="text-slate-700">{sale.product?.name ?? 'Produto'} x{sale.quantity}</span>
                  <span className="font-semibold text-slate-600">{formatCurrency(sale.unit_price * sale.quantity)}</span>
                </div>
              </SwipeToDelete>
            ))}
          </ul>
        </div>

        <Field label="Status">
          <div className="flex gap-2">
            {(['Pago', 'Pendente'] as SaleStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 rounded-xl py-3 text-sm font-medium transition ${
                  status === s ? (s === 'Pago' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white') : 'bg-slate-100 text-slate-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        {status === 'Pendente' && (
          <Field label="Data de Vencimento">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 transition focus:border-slate-300 focus:bg-white"
            />
          </Field>
        )}

        <button
          onClick={() => {
            let finalClientId = clientId;
            const trimmedSearch = clientSearch.trim();

            if (trimmedSearch && !finalClientId) {
              const existing = clients.find((c) => c.name.toLowerCase() === trimmedSearch.toLowerCase());
              if (existing) {
                finalClientId = existing.id;
              } else {
                const errCreate = createClient({
                  name: trimmedSearch,
                  day_of_week: '',
                  phone: '',
                  address: '',
                  observations: '',
                });

                if (!errCreate) {
                  try {
                    const allClients = db.getClients();
                    const newlyCreated = allClients.find((c) => c.name === trimmedSearch);
                    if (newlyCreated) {
                      finalClientId = newlyCreated.id;
                    }
                  } catch (e) {
                    console.error('Erro ao resgatar ID do novo cliente', e);
                  }
                }
              }
            }

            onUpdate(group.transactionId, {
              client_id: finalClientId || null,
              status,
              due_date: status === 'Pendente' && dueDate ? dueDate : null,
            });
          }}
          className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-medium text-white transition active:scale-[0.99]"
        >
          Salvar alterações
        </button>
      </div>
    </Sheet>
  );
}
