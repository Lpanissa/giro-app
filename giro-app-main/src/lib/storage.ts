import type {
  Client,
  CompanyNote,
  CompanyPayment,
  ClientReceipt,
  DayClose,
  DirectSale,
  Order,
  OrderItem,
  Product,
  SupplierCycle,
  SupplierTransaction,
} from '@/types';

const KEYS = {
  products: 'cr_products_v1',
  clients: 'cr_clients_v1',
  orders: 'cr_orders_v1',
  orderItems: 'cr_order_items_v1',
  directSales: 'cr_direct_sales_v1',
  supplierTx: 'cr_supplier_transactions_v1',
  supplierCycles: 'cr_supplier_cycles_v1',
  companyNotes: 'cr_company_notes_v1',
  companyPayments: 'cr_company_payments_v1',
  clientReceipts: 'cr_client_receipts_v1',
  dayCloses: 'cr_day_closes_v1',
} as const;

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function nowISO(): string {
  return new Date().toISOString();
}

function getLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    // Dispara evento para sincronizar entre abas do mesmo navegador
    window.dispatchEvent(new StorageEvent('storage', { key }));
  } catch (e) {
    console.error('Erro ao salvar no localStorage:', e);
  }
}

function sortBy<T>(arr: T[], key: keyof T, dir: 'asc' | 'desc' = 'desc'): T[] {
  return [...arr].sort((a, b) => {
    const av = String(a[key]);
    const bv = String(b[key]);
    return dir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
  });
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

export function getProducts(): Product[] {
  const list = getLocal<Product[]>(KEYS.products, []);
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function saveProduct(input: Omit<Product, 'id' | 'created_at'>): Product {
  const list = getProducts();
  const newItem: Product = {
    ...input,
    id: uid(),
    created_at: nowISO(),
  };
  list.push(newItem);
  setLocal(KEYS.products, list);
  return newItem;
}

export function updateProduct(id: string, input: Partial<Omit<Product, 'id' | 'created_at'>>): void {
  const list = getProducts();
  const idx = list.findIndex((p) => p.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...input };
    setLocal(KEYS.products, list);
  }
}

export function deleteProduct(id: string): void {
  const list = getProducts().filter((p) => p.id !== id);
  setLocal(KEYS.products, list);
}

export function adjustProductQuantity(id: string, delta: number): void {
  const list = getProducts();
  const p = list.find((item) => item.id === id);
  if (p) {
    p.quantity = Math.max(0, p.quantity + delta);
    setLocal(KEYS.products, list);
  }
}

function deductStock(productId: string, quantity: number): void {
  adjustProductQuantity(productId, -quantity);
}

function restoreStock(productId: string, quantity: number): void {
  adjustProductQuantity(productId, quantity);
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export function getClients(): Client[] {
  const list = getLocal<Client[]>(KEYS.clients, []);
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function saveClient(input: Omit<Client, 'id' | 'created_at'>): Client {
  const list = getClients();
  const newItem: Client = {
    ...input,
    id: uid(),
    created_at: nowISO(),
  };
  list.push(newItem);
  setLocal(KEYS.clients, list);
  return newItem;
}

export function updateClient(id: string, input: Partial<Omit<Client, 'id' | 'created_at'>>): void {
  const list = getClients();
  const idx = list.findIndex((c) => c.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...input };
    setLocal(KEYS.clients, list);
  }
}

export function deleteClient(id: string): void {
  const list = getClients().filter((c) => c.id !== id);
  setLocal(KEYS.clients, list);
}

// ---------------------------------------------------------------------------
// Pedidos + Itens
// ---------------------------------------------------------------------------

export function getOrders(): Order[] {
  const rawOrders = getLocal<Order[]>(KEYS.orders, []);
  const rawItems = getLocal<OrderItem[]>(KEYS.orderItems, []);
  const clients = getClients();
  const products = getProducts();

  const sortedOrders = sortBy(rawOrders, 'created_at', 'desc');

  return sortedOrders.map((order) => ({
    ...order,
    client: clients.find((c) => c.id === order.client_id) ?? null,
    items: rawItems
      .filter((item) => item.order_id === order.id)
      .map((item) => ({
        ...item,
        product: (() => {
          const p = products.find((prod) => prod.id === item.product_id);
          return p ? { id: p.id, name: p.name } : null;
        })(),
      })),
  }));
}

export function createOrder(
  clientId: string,
  dayOfWeek: Order['day_of_week'],
  status: Order['status'],
  items: { product_id: string | null; custom_name?: string | null; quantity: number; unit_price: number; unit_cost: number }[],
): void {
  const orders = getLocal<Order[]>(KEYS.orders, []);
  const rawItems = getLocal<OrderItem[]>(KEYS.orderItems, []);
  const orderId = uid();

  const newOrder: Order = {
    id: orderId,
    client_id: clientId,
    day_of_week: dayOfWeek,
    status,
    created_at: nowISO(),
  };

  orders.push(newOrder);

  for (const item of items) {
    const newItem: OrderItem = {
      id: uid(),
      order_id: orderId,
      product_id: item.product_id,
      custom_name: item.custom_name ?? null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit_cost: item.unit_cost,
    };
    rawItems.push(newItem);
    if (item.product_id) {
      deductStock(item.product_id, item.quantity);
    }
  }

  setLocal(KEYS.orders, orders);
  setLocal(KEYS.orderItems, rawItems);
}

export function deleteOrder(id: string): void {
  const orders = getLocal<Order[]>(KEYS.orders, []).filter((o) => o.id !== id);
  const rawItems = getLocal<OrderItem[]>(KEYS.orderItems, []);
  const itemsOfOrder = rawItems.filter((item) => item.order_id === id);

  for (const item of itemsOfOrder) {
    if (item.product_id) {
      restoreStock(item.product_id, item.quantity);
    }
  }

  const remainingItems = rawItems.filter((item) => item.order_id !== id);

  setLocal(KEYS.orders, orders);
  setLocal(KEYS.orderItems, remainingItems);
}

export function updateOrder(id: string, updates: { client_id?: string; day_of_week?: Order['day_of_week']; status?: Order['status'] }): void {
  const orders = getLocal<Order[]>(KEYS.orders, []);
  const idx = orders.findIndex((o) => o.id === id);
  if (idx !== -1) {
    orders[idx] = { ...orders[idx], ...updates };
    setLocal(KEYS.orders, orders);
  }
}

export function updateOrderItem(itemId: string, updates: { product_id?: string | null; custom_name?: string | null; quantity?: number; unit_price?: number; unit_cost?: number }): void {
  const rawItems = getLocal<OrderItem[]>(KEYS.orderItems, []);
  const idx = rawItems.findIndex((i) => i.id === itemId);
  if (idx === -1) return;

  const old = rawItems[idx];
  const newPid = updates.product_id !== undefined ? updates.product_id : old.product_id;
  const oldPid = old.product_id;

  if (newPid !== oldPid) {
    if (oldPid) restoreStock(oldPid, old.quantity);
    if (newPid) deductStock(newPid, updates.quantity ?? old.quantity);
  } else if (updates.quantity !== undefined && updates.quantity !== old.quantity && newPid) {
    const diff = updates.quantity - old.quantity;
    if (diff > 0) deductStock(newPid, diff);
    else restoreStock(newPid, -diff);
  }

  rawItems[idx] = { ...old, ...updates };
  setLocal(KEYS.orderItems, rawItems);
}

export function addOrderItem(orderId: string, item: { product_id: string | null; custom_name?: string | null; quantity: number; unit_price: number; unit_cost: number }): void {
  const rawItems = getLocal<OrderItem[]>(KEYS.orderItems, []);
  const newItem: OrderItem = {
    id: uid(),
    order_id: orderId,
    product_id: item.product_id,
    custom_name: item.custom_name ?? null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    unit_cost: item.unit_cost,
  };
  rawItems.push(newItem);
  if (item.product_id) {
    deductStock(item.product_id, item.quantity);
  }
  setLocal(KEYS.orderItems, rawItems);
}

export function deleteOrderItem(itemId: string): void {
  const rawItems = getLocal<OrderItem[]>(KEYS.orderItems, []);
  const item = rawItems.find((i) => i.id === itemId);
  if (item && item.product_id) {
    restoreStock(item.product_id, item.quantity);
  }
  const remaining = rawItems.filter((i) => i.id !== itemId);
  setLocal(KEYS.orderItems, remaining);
}

// ---------------------------------------------------------------------------
// Vendas Diretas
// ---------------------------------------------------------------------------

export function getDirectSales(): DirectSale[] {
  const raw = getLocal<DirectSale[]>(KEYS.directSales, []);
  const products = getProducts();
  const clients = getClients();

  const sorted = sortBy(raw, 'created_at', 'desc');

  return sorted.map((sale) => ({
    ...sale,
    product: products.find((p) => p.id === sale.product_id) ?? null,
    client: clients.find((c) => c.id === sale.client_id) ?? null,
  }));
}

export function saveDirectSale(input: {
  transaction_id: string;
  product_id: string;
  client_id: string | null;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  status: DirectSale['status'];
  due_date?: string | null;
  sale_date?: string | null;
}): void {
  const list = getLocal<DirectSale[]>(KEYS.directSales, []);
  const profit = (input.unit_price - input.unit_cost) * input.quantity;

  const createdAt = input.sale_date
    ? `${input.sale_date}T${new Date().toTimeString().split(' ')[0]}`
    : nowISO();

  const newItem: DirectSale = {
    id: uid(),
    transaction_id: input.transaction_id,
    product_id: input.product_id,
    client_id: input.client_id,
    quantity: input.quantity,
    unit_cost: input.unit_cost,
    unit_price: input.unit_price,
    profit,
    status: input.status,
    created_at: createdAt,
    due_date: input.due_date ?? null,
    paid_at: null,
  };

  list.push(newItem);
  setLocal(KEYS.directSales, list);
  if (input.product_id) {
    deductStock(input.product_id, input.quantity);
  }
}

export function saveMultiDirectSale(
  clientId: string | null,
  status: DirectSale['status'],
  items: { product_id: string; quantity: number; unit_cost: number; unit_price: number }[],
  dueDate?: string | null,
  saleDate?: string | null,
): string {
  const txId = uid();
  for (const item of items) {
    saveDirectSale({
      transaction_id: txId,
      product_id: item.product_id,
      client_id: clientId,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      unit_price: item.unit_price,
      status,
      due_date: dueDate ?? null,
      sale_date: saleDate ?? null,
    });
  }
  return txId;
}

export function updateDirectSale(id: string, input: {
  product_id?: string;
  client_id?: string | null;
  quantity?: number;
  unit_cost?: number;
  unit_price?: number;
  status?: DirectSale['status'];
}): void {
  const list = getLocal<DirectSale[]>(KEYS.directSales, []);
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return;

  const old = list[idx];
  if (input.product_id !== undefined && input.product_id !== old.product_id) {
    if (old.product_id) restoreStock(old.product_id, old.quantity);
    if (input.product_id) deductStock(input.product_id, old.quantity);
  } else if (input.quantity !== undefined && input.quantity !== old.quantity) {
    if (old.product_id) {
      const diff = input.quantity - old.quantity;
      if (diff > 0) deductStock(old.product_id, diff);
      else restoreStock(old.product_id, -diff);
    }
  }

  const newUnitPrice = input.unit_price !== undefined ? input.unit_price : old.unit_price;
  const newUnitCost = input.unit_cost !== undefined ? input.unit_cost : old.unit_cost;
  const newQuantity = input.quantity !== undefined ? input.quantity : old.quantity;
  const profit = (newUnitPrice - newUnitCost) * newQuantity;

  list[idx] = {
    ...old,
    ...input,
    profit,
  };
  setLocal(KEYS.directSales, list);
}

export function updateDirectSaleTransaction(
  transactionId: string,
  updates: { client_id?: string | null; status?: DirectSale['status']; due_date?: string | null },
): void {
  const list = getLocal<DirectSale[]>(KEYS.directSales, []);
  let changed = false;
  const updated = list.map((s) => {
    if (s.transaction_id === transactionId) {
      changed = true;
      return { ...s, ...updates };
    }
    return s;
  });
  if (changed) {
    setLocal(KEYS.directSales, updated);
  }
}

export function settleDirectSaleTransaction(transactionId: string): void {
  const list = getLocal<DirectSale[]>(KEYS.directSales, []);
  const paidAt = nowISO();
  let changed = false;
  const updated = list.map((s) => {
    if (s.transaction_id === transactionId) {
      changed = true;
      return { ...s, status: 'Pago' as const, paid_at: paidAt };
    }
    return s;
  });
  if (changed) {
    setLocal(KEYS.directSales, updated);
  }
}

export function deleteDirectSaleTransaction(transactionId: string): void {
  const list = getLocal<DirectSale[]>(KEYS.directSales, []);
  const targetSales = list.filter((s) => s.transaction_id === transactionId);
  for (const sale of targetSales) {
    if (sale.product_id) {
      restoreStock(sale.product_id, sale.quantity);
    }
  }
  const remaining = list.filter((s) => s.transaction_id !== transactionId);
  setLocal(KEYS.directSales, remaining);
}

export function deleteDirectSale(id: string): void {
  const list = getLocal<DirectSale[]>(KEYS.directSales, []);
  const sale = list.find((s) => s.id === id);
  if (sale && sale.product_id) {
    restoreStock(sale.product_id, sale.quantity);
  }
  const remaining = list.filter((s) => s.id !== id);
  setLocal(KEYS.directSales, remaining);
}

// ---------------------------------------------------------------------------
// Fornecedores e Notas
// ---------------------------------------------------------------------------

export function getSupplierTransactions(sinceISO?: string): SupplierTransaction[] {
  const list = getLocal<SupplierTransaction[]>(KEYS.supplierTx, []);
  let sorted = sortBy(list, 'created_at', 'asc');
  if (sinceISO) {
    sorted = sorted.filter((t) => t.created_at > sinceISO);
  }
  return sorted;
}

export function getSupplierCycles(): SupplierCycle[] {
  const list = getLocal<SupplierCycle[]>(KEYS.supplierCycles, []);
  return sortBy(list, 'closed_at', 'desc');
}

export function addSupplierTransaction(
  type: SupplierTransaction['type'],
  amount: number,
  description: string | null,
): void {
  const list = getSupplierTransactions();
  const newItem: SupplierTransaction = {
    id: uid(),
    type,
    amount,
    description,
    created_at: nowISO(),
  };
  list.push(newItem);
  setLocal(KEYS.supplierTx, list);
}

export function deleteSupplierTransaction(id: string): void {
  const list = getSupplierTransactions().filter((t) => t.id !== id);
  setLocal(KEYS.supplierTx, list);
}

export function closeSupplierCycle(cycle: Omit<SupplierCycle, 'id'>): void {
  const list = getSupplierCycles();
  const newItem: SupplierCycle = {
    ...cycle,
    id: uid(),
  };
  list.push(newItem);
  setLocal(KEYS.supplierCycles, list);
}

export function getCompanyNotes(date: string): CompanyNote[] {
  const list = getLocal<CompanyNote[]>(KEYS.companyNotes, []);
  return list
    .filter((n) => n.date === date)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addCompanyNote(date: string, amount: number, description: string | null): void {
  const list = getLocal<CompanyNote[]>(KEYS.companyNotes, []);
  list.push({
    id: uid(),
    date,
    amount,
    description,
    created_at: nowISO(),
  });
  setLocal(KEYS.companyNotes, list);
}

export function deleteCompanyNote(id: string): void {
  const list = getLocal<CompanyNote[]>(KEYS.companyNotes, []).filter((n) => n.id !== id);
  setLocal(KEYS.companyNotes, list);
}

export function getCompanyPayments(date: string): CompanyPayment[] {
  const list = getLocal<CompanyPayment[]>(KEYS.companyPayments, []);
  return list
    .filter((p) => p.date === date)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addCompanyPayment(date: string, amount: number, description: string | null): void {
  const list = getLocal<CompanyPayment[]>(KEYS.companyPayments, []);
  list.push({
    id: uid(),
    date,
    amount,
    description,
    created_at: nowISO(),
  });
  setLocal(KEYS.companyPayments, list);
}

export function deleteCompanyPayment(id: string): void {
  const list = getLocal<CompanyPayment[]>(KEYS.companyPayments, []).filter((p) => p.id !== id);
  setLocal(KEYS.companyPayments, list);
}

export function getClientReceipts(date: string): ClientReceipt[] {
  const list = getLocal<ClientReceipt[]>(KEYS.clientReceipts, []);
  return list
    .filter((r) => r.date === date)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addClientReceipt(date: string, clientId: string, clientName: string, amount: number, status: ClientReceipt['status']): void {
  const list = getLocal<ClientReceipt[]>(KEYS.clientReceipts, []);
  list.push({
    id: uid(),
    date,
    client_id: clientId,
    client_name: clientName,
    amount,
    status,
    created_at: nowISO(),
  });
  setLocal(KEYS.clientReceipts, list);
}

export function updateClientReceiptStatus(id: string, status: ClientReceipt['status']): void {
  const list = getLocal<ClientReceipt[]>(KEYS.clientReceipts, []);
  const idx = list.findIndex((r) => r.id === id);
  if (idx !== -1) {
    list[idx].status = status;
    setLocal(KEYS.clientReceipts, list);
  }
}

export function deleteClientReceipt(id: string): void {
  const list = getLocal<ClientReceipt[]>(KEYS.clientReceipts, []).filter((r) => r.id !== id);
  setLocal(KEYS.clientReceipts, list);
}

export function getDayCloses(): DayClose[] {
  return getLocal<DayClose[]>(KEYS.dayCloses, []);
}

export function isDayClosed(date: string): boolean {
  return getDayCloses().some((d) => d.date === date);
}

export function closeDay(date: string): void {
  const closes = getDayCloses();
  if (!closes.some((d) => d.date === date)) {
    closes.push({ date, closed_at: nowISO() });
    setLocal(KEYS.dayCloses, closes);
  }
}

export function reopenDay(date: string): void {
  const closes = getDayCloses().filter((d) => d.date !== date);
  setLocal(KEYS.dayCloses, closes);
}

export function getMonthlySupplierTotals(year: number, month: number): { totalPurchases: number; totalPaid: number; balance: number; currentDebit: number } {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const notes = getLocal<CompanyNote[]>(KEYS.companyNotes, []).filter((n) => n.date.startsWith(prefix));
  const payments = getLocal<CompanyPayment[]>(KEYS.companyPayments, []).filter((p) => p.date.startsWith(prefix));

  const totalPurchases = notes.reduce((s, n) => s + n.amount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = totalPaid - totalPurchases;
  const currentDebit = Math.max(0, totalPurchases - totalPaid);
  return { totalPurchases, totalPaid, balance, currentDebit };
}

export function getDatesWithActivity(year: number, month: number): Set<string> {
  const dates = new Set<string>();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  getLocal<CompanyNote[]>(KEYS.companyNotes, []).forEach((n) => {
    if (n.date.startsWith(prefix)) dates.add(n.date);
  });
  getLocal<CompanyPayment[]>(KEYS.companyPayments, []).forEach((p) => {
    if (p.date.startsWith(prefix)) dates.add(p.date);
  });
  getLocal<ClientReceipt[]>(KEYS.clientReceipts, []).forEach((r) => {
    if (r.date.startsWith(prefix)) dates.add(r.date);
  });

  return dates;
}

export function getClosedDates(year: number, month: number): Set<string> {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const closes = getDayCloses();
  return new Set(
    closes
      .filter((d) => d.date.startsWith(prefix))
      .map((d) => d.date),
  );
}
