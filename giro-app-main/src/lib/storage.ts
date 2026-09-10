import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  increment,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './firebase';
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
  orders: 'cr_orders_v1',
  orderItems: 'cr_order_items_v1',
  supplierTx: 'cr_supplier_transactions_v1',
  supplierCycles: 'cr_supplier_cycles_v1',
  companyNotes: 'cr_company_notes_v1',
  companyPayments: 'cr_company_payments_v1',
  clientReceipts: 'cr_client_receipts_v1',
  dayCloses: 'cr_day_closes_v1',
} as const;

export interface Store {
  id: string;
  name: string;
  segment?: string;
  createdAt: string;
}

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
// Firestore: base por usuário logado
// ---------------------------------------------------------------------------

function requireUid(): string {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Nenhum usuário logado. Faça login para continuar.');
  }
  return currentUid;
}

// ---------------------------------------------------------------------------
// Lojas (users/{uid}/stores/{storeId})
// ---------------------------------------------------------------------------

function userStoresCollection() {
  return collection(db, 'users', requireUid(), 'stores');
}

function userStoreDoc(storeId: string) {
  return doc(db, 'users', requireUid(), 'stores', storeId);
}

export function subscribeStores(callback: (stores: Store[]) => void): Unsubscribe {
  const q = query(userStoresCollection(), orderBy('createdAt'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Store)));
  });
}

export async function createStore(input: { name: string; segment?: string }): Promise<string> {
  const docRef = await addDoc(userStoresCollection(), {
    name: input.name,
    segment: input.segment ?? '',
    createdAt: nowISO(),
  });
  return docRef.id;
}

export async function renameStore(storeId: string, name: string): Promise<void> {
  await updateDoc(userStoreDoc(storeId), { name });
}

export async function deleteStore(storeId: string): Promise<void> {
  // Remove o registro da loja. Os produtos/clientes/vendas dentro dela ficam
  // órfãos no Firestore (não são apagados automaticamente) — limpeza futura.
  await deleteDoc(userStoreDoc(storeId));
}

// ---------------------------------------------------------------------------
// Base para dados DENTRO de uma loja (users/{uid}/stores/{storeId}/<coleção>)
// ---------------------------------------------------------------------------

function storeCollection(storeId: string, name: string) {
  return collection(db, 'users', requireUid(), 'stores', storeId, name);
}

function storeDoc(storeId: string, name: string, id: string) {
  return doc(db, 'users', requireUid(), 'stores', storeId, name, id);
}

// ---------------------------------------------------------------------------
// Produtos (Firestore, escopado por usuário + loja)
// ---------------------------------------------------------------------------

export function subscribeProducts(storeId: string, callback: (products: Product[]) => void): Unsubscribe {
  const q = query(storeCollection(storeId, 'products'), orderBy('name'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
  });
}

export async function getProductsOnce(storeId: string): Promise<Product[]> {
  const snap = await getDocs(storeCollection(storeId, 'products'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
}

export async function saveProduct(storeId: string, input: Omit<Product, 'id' | 'created_at'>): Promise<string> {
  const docRef = await addDoc(storeCollection(storeId, 'products'), {
    ...input,
    created_at: nowISO(),
  });
  return docRef.id;
}

export async function updateProduct(storeId: string, id: string, input: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<void> {
  await updateDoc(storeDoc(storeId, 'products', id), input as Record<string, unknown>);
}

export async function deleteProduct(storeId: string, id: string): Promise<void> {
  await deleteDoc(storeDoc(storeId, 'products', id));
}

export async function adjustProductQuantity(storeId: string, id: string, delta: number): Promise<void> {
  await updateDoc(storeDoc(storeId, 'products', id), { quantity: increment(delta) });
}

async function deductStock(storeId: string, productId: string, quantity: number): Promise<void> {
  const productRef = storeDoc(storeId, 'products', productId);
  const snap = await getDoc(productRef);

  // Produto não encontrado no estoque (ex: item removido, ou venda de serviço
  // sem vínculo com produto cadastrado) — nada a descontar.
  if (!snap.exists()) return;

  const currentQuantity = Number(snap.data().quantity) || 0;

  // Nunca deixa a quantidade ficar negativa: desconta no máximo o que existe em estoque.
  const amountToDeduct = Math.min(quantity, currentQuantity);
  if (amountToDeduct <= 0) return;

  await updateDoc(productRef, { quantity: increment(-amountToDeduct) });
}

async function restoreStock(storeId: string, productId: string, quantity: number): Promise<void> {
  await adjustProductQuantity(storeId, productId, quantity);
}

// ---------------------------------------------------------------------------
// Clientes (Firestore, escopado por usuário + loja)
// ---------------------------------------------------------------------------

export function subscribeClients(storeId: string, callback: (clients: Client[]) => void): Unsubscribe {
  const q = query(storeCollection(storeId, 'clients'), orderBy('name'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client)));
  });
}

export async function getClientsOnce(storeId: string): Promise<Client[]> {
  const snap = await getDocs(storeCollection(storeId, 'clients'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client));
}

export async function saveClient(storeId: string, input: Omit<Client, 'id' | 'created_at'>): Promise<string> {
  const docRef = await addDoc(storeCollection(storeId, 'clients'), {
    ...input,
    created_at: nowISO(),
  });
  return docRef.id;
}

export async function updateClient(storeId: string, id: string, input: Partial<Omit<Client, 'id' | 'created_at'>>): Promise<void> {
  await updateDoc(storeDoc(storeId, 'clients', id), input as Record<string, unknown>);
}

export async function deleteClient(storeId: string, id: string): Promise<void> {
  await deleteDoc(storeDoc(storeId, 'clients', id));
}

// ---------------------------------------------------------------------------
// Vendas Diretas (Firestore, escopado por usuário + loja)
// ---------------------------------------------------------------------------

export function subscribeDirectSales(storeId: string, callback: (sales: DirectSale[]) => void): Unsubscribe {
  const q = query(storeCollection(storeId, 'directSales'), orderBy('created_at', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DirectSale)));
  });
}

export async function saveMultiDirectSale(
  storeId: string,
  clientId: string | null,
  status: DirectSale['status'],
  items: { product_id: string; quantity: number; unit_cost: number; unit_price: number }[],
  dueDate?: string | null,
  saleDate?: string | null,
): Promise<string> {
  const txId = uid();
  const createdAt = saleDate
    ? `${saleDate}T${new Date().toTimeString().split(' ')[0]}`
    : nowISO();

  for (const item of items) {
    const profit = (item.unit_price - item.unit_cost) * item.quantity;
    await addDoc(storeCollection(storeId, 'directSales'), {
      transaction_id: txId,
      product_id: item.product_id,
      client_id: clientId,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      unit_price: item.unit_price,
      profit,
      status,
      created_at: createdAt,
      due_date: dueDate ?? null,
      paid_at: null,
    });
    await deductStock(storeId, item.product_id, item.quantity);
  }

  return txId;
}

export async function updateDirectSale(storeId: string, id: string, input: {
  product_id?: string;
  client_id?: string | null;
  quantity?: number;
  unit_cost?: number;
  unit_price?: number;
  status?: DirectSale['status'];
}): Promise<void> {
  await updateDoc(storeDoc(storeId, 'directSales', id), input as Record<string, unknown>);
}

export async function updateDirectSaleTransaction(
  storeId: string,
  transactionId: string,
  updates: { client_id?: string | null; status?: DirectSale['status']; due_date?: string | null },
): Promise<void> {
  const snap = await getDocs(storeCollection(storeId, 'directSales'));
  const matching = snap.docs.filter((d) => d.data().transaction_id === transactionId);
  await Promise.all(matching.map((d) => updateDoc(d.ref, updates as Record<string, unknown>)));
}

export async function settleDirectSaleTransaction(storeId: string, transactionId: string): Promise<void> {
  const paidAt = nowISO();
  const snap = await getDocs(storeCollection(storeId, 'directSales'));
  const matching = snap.docs.filter((d) => d.data().transaction_id === transactionId);
  await Promise.all(matching.map((d) => updateDoc(d.ref, { status: 'Pago', paid_at: paidAt })));
}

export async function deleteDirectSaleTransaction(storeId: string, transactionId: string): Promise<void> {
  const snap = await getDocs(storeCollection(storeId, 'directSales'));
  const matching = snap.docs.filter((d) => d.data().transaction_id === transactionId);
  for (const d of matching) {
    const sale = d.data() as DirectSale;
    if (sale.product_id) {
      await restoreStock(storeId, sale.product_id, sale.quantity);
    }
    await deleteDoc(d.ref);
  }
}

export async function deleteDirectSale(storeId: string, id: string): Promise<void> {
  const snap = await getDocs(storeCollection(storeId, 'directSales'));
  const target = snap.docs.find((d) => d.id === id);
  if (target) {
    const sale = target.data() as DirectSale;
    if (sale.product_id) {
      await restoreStock(storeId, sale.product_id, sale.quantity);
    }
    await deleteDoc(target.ref);
  }
}

// ---------------------------------------------------------------------------
// Pedidos + Itens (ainda em localStorage — migração pendente, sem escopo de loja ainda)
// ---------------------------------------------------------------------------

export function getOrders(): Order[] {
  const rawOrders = getLocal<Order[]>(KEYS.orders, []);
  const rawItems = getLocal<OrderItem[]>(KEYS.orderItems, []);
  const sortedOrders = sortBy(rawOrders, 'created_at', 'desc');

  return sortedOrders.map((order) => ({
    ...order,
    client: null,
    items: rawItems
      .filter((item) => item.order_id === order.id)
      .map((item) => ({ ...item, product: null })),
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
    rawItems.push({
      id: uid(),
      order_id: orderId,
      product_id: item.product_id,
      custom_name: item.custom_name ?? null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit_cost: item.unit_cost,
    });
  }

  setLocal(KEYS.orders, orders);
  setLocal(KEYS.orderItems, rawItems);
}

export function deleteOrder(id: string): void {
  const orders = getLocal<Order[]>(KEYS.orders, []).filter((o) => o.id !== id);
  const rawItems = getLocal<OrderItem[]>(KEYS.orderItems, []).filter((item) => item.order_id !== id);
  setLocal(KEYS.orders, orders);
  setLocal(KEYS.orderItems, rawItems);
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
  rawItems[idx] = { ...rawItems[idx], ...updates };
  setLocal(KEYS.orderItems, rawItems);
}

export function addOrderItem(orderId: string, item: { product_id: string | null; custom_name?: string | null; quantity: number; unit_price: number; unit_cost: number }): void {
  const rawItems = getLocal<OrderItem[]>(KEYS.orderItems, []);
  rawItems.push({
    id: uid(),
    order_id: orderId,
    product_id: item.product_id,
    custom_name: item.custom_name ?? null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    unit_cost: item.unit_cost,
  });
  setLocal(KEYS.orderItems, rawItems);
}

export function deleteOrderItem(itemId: string): void {
  const remaining = getLocal<OrderItem[]>(KEYS.orderItems, []).filter((i) => i.id !== itemId);
  setLocal(KEYS.orderItems, remaining);
}

// ---------------------------------------------------------------------------
// Fornecedores e Notas (ainda em localStorage — migração pendente)
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

export function addSupplierTransaction(type: SupplierTransaction['type'], amount: number, description: string | null): void {
  const list = getSupplierTransactions();
  list.push({ id: uid(), type, amount, description, created_at: nowISO() });
  setLocal(KEYS.supplierTx, list);
}

export function deleteSupplierTransaction(id: string): void {
  const list = getSupplierTransactions().filter((t) => t.id !== id);
  setLocal(KEYS.supplierTx, list);
}

export function closeSupplierCycle(cycle: Omit<SupplierCycle, 'id'>): void {
  const list = getSupplierCycles();
  list.push({ ...cycle, id: uid() });
  setLocal(KEYS.supplierCycles, list);
}

export function getCompanyNotes(date: string): CompanyNote[] {
  return getLocal<CompanyNote[]>(KEYS.companyNotes, [])
    .filter((n) => n.date === date)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addCompanyNote(date: string, amount: number, description: string | null): void {
  const list = getLocal<CompanyNote[]>(KEYS.companyNotes, []);
  list.push({ id: uid(), date, amount, description, created_at: nowISO() });
  setLocal(KEYS.companyNotes, list);
}

export function deleteCompanyNote(id: string): void {
  setLocal(KEYS.companyNotes, getLocal<CompanyNote[]>(KEYS.companyNotes, []).filter((n) => n.id !== id));
}

export function getCompanyPayments(date: string): CompanyPayment[] {
  return getLocal<CompanyPayment[]>(KEYS.companyPayments, [])
    .filter((p) => p.date === date)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addCompanyPayment(date: string, amount: number, description: string | null): void {
  const list = getLocal<CompanyPayment[]>(KEYS.companyPayments, []);
  list.push({ id: uid(), date, amount, description, created_at: nowISO() });
  setLocal(KEYS.companyPayments, list);
}

export function deleteCompanyPayment(id: string): void {
  setLocal(KEYS.companyPayments, getLocal<CompanyPayment[]>(KEYS.companyPayments, []).filter((p) => p.id !== id));
}

export function getClientReceipts(date: string): ClientReceipt[] {
  return getLocal<ClientReceipt[]>(KEYS.clientReceipts, [])
    .filter((r) => r.date === date)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addClientReceipt(date: string, clientId: string, clientName: string, amount: number, status: ClientReceipt['status']): void {
  const list = getLocal<ClientReceipt[]>(KEYS.clientReceipts, []);
  list.push({ id: uid(), date, client_id: clientId, client_name: clientName, amount, status, created_at: nowISO() });
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
  setLocal(KEYS.clientReceipts, getLocal<ClientReceipt[]>(KEYS.clientReceipts, []).filter((r) => r.id !== id));
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
  setLocal(KEYS.dayCloses, getDayCloses().filter((d) => d.date !== date));
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
  return new Set(
    getDayCloses()
      .filter((d) => d.date.startsWith(prefix))
      .map((d) => d.date),
  );
}
