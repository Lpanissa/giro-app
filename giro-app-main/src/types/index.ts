export type WeekDay =
  | 'Segunda'
  | 'Terça'
  | 'Quarta'
  | 'Quinta'
  | 'Sexta'
  | 'Sábado';

export const WEEKDAYS: WeekDay[] = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

export interface Product {
  id: string;
  name: string;
  cost: number;
  price: number;
  quantity: number;
  min_alert_quantity: number;
  image_url: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  day_of_week: WeekDay;
  created_at: string;
}

export type OrderStatus = 'Pago' | 'Pendente';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  custom_name: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  product?: Pick<Product, 'id' | 'name'> | null;
}

export interface Order {
  id: string;
  client_id: string | null;
  day_of_week: WeekDay;
  status: OrderStatus;
  created_at: string;
  client?: Pick<Client, 'id' | 'name'> | null;
  items: OrderItem[];
}

export type SaleStatus = 'Pago' | 'Pendente';

export interface DirectSale {
  id: string;
  transaction_id: string;
  product_id: string | null;
  client_id: string | null;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  profit: number;
  status: SaleStatus;
  created_at: string;
  due_date: string | null;
  paid_at: string | null;
  product?: Pick<Product, 'id' | 'name'> | null;
  client?: Pick<Client, 'id' | 'name'> | null;
}

export type SupplierTransactionType = 'nota' | 'pagamento';

export interface SupplierTransaction {
  id: string;
  type: SupplierTransactionType;
  amount: number;
  description: string | null;
  created_at: string;
}

export interface WeekSummary {
  label: string;
  totalPurchases: number;
  totalPaid: number;
}

export interface SupplierCycle {
  id: string;
  previous_balance: number;
  total_purchases: number;
  total_paid: number;
  balance: number;
  week_summary: WeekSummary[];
  closed_at: string;
}

// --- Day management (Notas hub) ---

export interface CompanyNote {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export interface CompanyPayment {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export interface ClientReceipt {
  id: string;
  date: string;
  client_id: string;
  client_name: string;
  amount: number;
  status: SaleStatus;
  created_at: string;
}

export interface DayClose {
  date: string;
  closed_at: string;
}
