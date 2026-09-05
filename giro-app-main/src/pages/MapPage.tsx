import { useState } from 'react';
import { Plus, Trash2, Edit2, Search, MapPin, Phone, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useClients } from '@/hooks/useClients';
import type { Client } from '@/types';

export function MapPage() {
  const { clients, loading, createClient, editClient, deleteClient } = useClients();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('Todos');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Client | null>(null);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [routeDay, setRouteDay] = useState(''); 
  
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Client | null>(null);

  // Sugestões de endereço baseadas na lista global de clientes (removendo números para sugerir apenas a rua/avenida)
  const uniqueStreets = Array.from(
    new Set(
      clients
        .map(c => c.address?.trim())
        .filter(Boolean)
        .map(addr => addr.replace(/,\s*\d+.*$/, '').trim())
    )
  ) as string[];

  const daysOfWeek = ['Todos', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setAddress('');
    setRouteDay('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (customer: Client) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone || '');
    setAddress(customer.address || '');
    setRouteDay(customer.day_of_week || (customer as any).routeDay || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      day_of_week: routeDay || undefined,
    };

    if (editingCustomer) {
      editClient(editingCustomer.id, payload);
    } else {
      createClient(payload);
    }

    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (customerToDelete) {
      deleteClient(customerToDelete.id);
      setCustomerToDelete(null);
    }
  };

  const filteredCustomers = clients.filter((customer) => {
    const customerDay = customer.day_of_week || (customer as any).routeDay;

    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.address && customer.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.phone && customer.phone.includes(searchTerm));
    
    const matchesDay = 
      selectedDayFilter === 'Todos' || 
      (selectedDayFilter === 'Nenhum' ? !customerDay : customerDay === selectedDayFilter);

    return matchesSearch && matchesDay;
  });

  if (loading) {
    return <div className="p-4 text-center text-slate-500">Carregando clientes...</div>;
  }
// TELA
  return (
    <div className="space-y-4 pb-20 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clientes & Rotas</h1>
          <p className="text-sm text-slate-500">Cadastre e organize seus clientes por dia</p>
        </div>
      </div>

      {/* Filtros de Dias da Rota */}
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {daysOfWeek.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDayFilter(day)}
            className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
              selectedDayFilter === day
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Barra de Pesquisa */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Pesquisar clientes, endereços ou telefones..."
          className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Lista de Clientes */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-slate-500 px-1">
          Clientes ({filteredCustomers.length})
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
            <p className="text-sm">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const customerDay = customer.day_of_week || (customer as any).routeDay;
            return (
              <div key={customer.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{customer.name}</h3>
                    {customerDay ? (
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
                        {customerDay}
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        Sem dia fixo
                      </span>
                    )}
                  </div>
                  {customer.address && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin size={14} className="text-slate-400 shrink-0" />
                      <span>{customer.address}</span>
                    </p>
                  )}
                  {customer.phone && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone size={14} className="text-slate-400 shrink-0" />
                      <span>{customer.phone}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleOpenEditModal(customer)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => setCustomerToDelete(customer)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Botão Flutuante (FAB) */}
      <button 
        onClick={handleOpenAddModal}
        className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/40 transition hover:bg-blue-700 active:scale-95"
        title="Novo Cliente"
      >
        <Plus size={26} />
      </button>

      {/* Modal de Cadastro / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 text-slate-800 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingCustomer ? 'Editar Cliente' : 'Novo cliente'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Nome do cliente"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Telefone</label>
                <input 
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Endereço com autocomplete */}
              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 mb-1">Endereço</label>
                <input 
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setShowAddressSuggestions(true);
                  }}
                  onFocus={() => setShowAddressSuggestions(true)}
                  placeholder="Rua, número, Bairro"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                />

                {showAddressSuggestions && uniqueStreets.length > 0 && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowAddressSuggestions(false)} 
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {uniqueStreets
                        .filter(street => street.toLowerCase().includes(address.toLowerCase()))
                        .map(street => (
                          <button
                            key={street}
                            type="button"
                            onClick={() => {
                              setAddress(street);
                              setShowAddressSuggestions(false);
                            }}
                            className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 transition flex items-center gap-2"
                          >
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">{street}</span>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>

              {/* Dia da rota */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dia da rota</label>
                <select 
                  value={routeDay}
                  onChange={(e) => setRouteDay(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
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
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
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
