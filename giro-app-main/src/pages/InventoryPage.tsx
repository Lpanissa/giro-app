import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Edit2, AlertTriangle, Camera, X, Search, Image as ImageIcon, ZoomIn } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { getProducts, saveProduct, updateProduct, deleteProduct, adjustProductQuantity } from '@/lib/storage';

interface Product {
  id: string;
  name: string;
  category?: string;
  quantity: number;
  minQuantity: number;
  cost: number;
  price: number;
  image?: string;
}

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  const loadProducts = () => {
    const loaded = getProducts() as unknown as Product[];
    setProducts(loaded);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minQuantity, setMinQuantity] = useState('0');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<string | undefined>(undefined);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  // Estados para controlar o menu de seleção de foto (Câmera ou Galeria)
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  // Estado para controlar a ampliação da imagem do produto
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productToAddStock, setProductToAddStock] = useState<Product | null>(null);
  const [addQuantityValue, setAddQuantityValue] = useState('');

  const fileInputGalleryRef = useRef<HTMLInputElement>(null);
  const fileInputCameraRef = useRef<HTMLInputElement>(null);

  const categories = ['Todas', ...Array.from(new Set(products.map(p => p.category?.trim() || 'Geral')))];
  const uniqueCategories = Array.from(new Set(products.map(p => p.category?.trim()).filter(Boolean))) as string[];

  // Produtos que têm alerta de estoque (Apenas os com estoque mínimo estipulado > 0)
  const lowStockProducts = products.filter(
    (p) => (p.minQuantity ?? 0) > 0 && p.quantity <= (p.minQuantity ?? 0)
  );

  const formatCurrencyInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const number = Number(digits) / 100;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrencyToNumber = (formattedValue: string) => {
    if (!formattedValue) return 0;
    const clean = formattedValue.replace(/\./g, '').replace(',', '.');
    return Number(clean) || 0;
  };

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCost(formatCurrencyInput(e.target.value));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrice(formatCurrencyInput(e.target.value));
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setName('');
    setCategory('');
    setQuantity('');
    setMinQuantity('0');
    setCost('');
    setPrice('');
    setImage(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category || '');
    setQuantity(product.quantity.toString());
    setMinQuantity((product.minQuantity ?? 0).toString());
    setCost(product.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setPrice(product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setImage(product.image);
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            const MAX_WIDTH = 300;
            const MAX_HEIGHT = 300;
            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            setImage(canvas.toDataURL('image/jpeg', 0.5));
          } catch (err) {
            console.error('Erro ao processar imagem:', err);
          } finally {
            setShowPhotoOptions(false);
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name,
      category: category.trim() || 'Geral',
      quantity: Number(quantity) || 0,
      minQuantity: Number(minQuantity) || 0,
      cost: parseCurrencyToNumber(cost),
      price: parseCurrencyToNumber(price),
      image,
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, payload);
    } else {
      saveProduct(payload);
    }

    loadProducts();
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (productToDelete) {
      deleteProduct(productToDelete.id);
      loadProducts();
      setProductToDelete(null);
    }
  };

  const handleConfirmAddStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToAddStock) return;
    const amount = Number(addQuantityValue);
    if (!amount || amount <= 0) return;

    adjustProductQuantity(productToAddStock.id, amount);
    loadProducts();

    setProductToAddStock(null);
    setAddQuantityValue('');
  };

  // Cálculo do lucro real e da porcentagem baseados no custo e venda
  const currentCostNum = parseCurrencyToNumber(cost);
  const currentPriceNum = parseCurrencyToNumber(price);
  const profitValue = currentPriceNum - currentCostNum;
  const profitPercentage = currentCostNum > 0 ? (profitValue / currentCostNum) * 100 : 0;

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const productCat = product.category?.trim() || 'Geral';
    const matchesCategory = selectedCategory === 'Todas' || productCat === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 pt-2">Estoque</h1>
          <p className="text-sm text-slate-500">{products.length} produtos cadastrados</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar produtos no estoque..."
            className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 shadow-xs focus:border-rose-500 focus:outline-none"
          />
        </div>

        {categories.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {lowStockProducts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-center gap-2 font-semibold text-amber-800">
            <AlertTriangle size={18} className="text-amber-600" />
            <span>Atenção</span>
          </div>
          <p className="mt-1 text-xs text-amber-700">Produtos abaixo atingiram o estoque mínimo e precisam de reposição:</p>
          {lowStockProducts.map(p => (
            <div key={p.id} className="mt-3 flex items-center justify-between rounded-xl bg-white/80 p-3 border border-amber-200 text-sm">
              <div>
                <span className="font-medium text-slate-800">{p.name}</span>
                <span className="ml-2 text-xs font-semibold text-amber-700">Qtd: {p.quantity} (Mín. {p.minQuantity ?? 0})</span>
              </div>
              <button
                onClick={() => {
                  setProductToAddStock(p);
                  setAddQuantityValue('');
                }}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs transition hover:bg-amber-700"
              >
                <Plus size={14} /> Repor
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
            <p className="text-sm">Nenhum produto encontrado.</p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
              <div className="flex items-center gap-3">
                {product.image ? (
                  <div 
                    onClick={() => setZoomedImage(product.image || null)}
                    className="relative h-12 w-12 cursor-pointer group"
                  >
                    <img src={product.image} alt={product.name} className="h-12 w-12 rounded-xl object-cover border border-slate-200" />
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 opacity-0 group-hover:opacity-100 transition">
                      <ZoomIn size={16} className="text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 border border-slate-200">
                    <Camera size={20} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{product.name}</h3>
                    {product.category && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {product.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Venda: R$ {(product.price || 0).toFixed(2)}
                  </p>
                  <span className="inline-block mt-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-100">
                    Qtd: {product.quantity}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setProductToAddStock(product);
                    setAddQuantityValue('');
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-emerald-600 hover:bg-emerald-50 transition"
                  title="Adicionar quantidade"
                >
                  <Plus size={20} />
                </button>

                <div className="flex flex-col gap-1">
                  <button 
                    onClick={() => handleOpenEditModal(product)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => setProductToDelete(product)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Botão Flutuante (FAB) fixo no canto inferior direito para adicionar produtos */}
      <button 
        onClick={handleOpenAddModal}
        className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-xl shadow-rose-500/40 transition hover:bg-rose-600 active:scale-95"
        title="Adicionar Produto"
      >
        <Plus size={26} />
      </button>

      {/* Modal para ampliar a imagem */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setZoomedImage(null)}
              className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition"
            >
              <X size={20} />
            </button>
            <img src={zoomedImage} alt="Imagem Ampliada" className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl border border-white/10" />
          </div>
        </div>
      )}

      {productToAddStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 text-slate-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Adicionar ao Estoque</h2>
              <button 
                onClick={() => setProductToAddStock(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmAddStock} className="space-y-4 pt-4">
              <div>
                <p className="text-xs text-slate-500 mb-2">Produto: <span className="font-semibold text-slate-800">{productToAddStock.name}</span></p>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantidade a somar</label>
                <input 
                  type="number"
                  autoFocus
                  value={addQuantityValue}
                  onChange={(e) => setAddQuantityValue(e.target.value)}
                  placeholder="Ex: 10"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProductToAddStock(null)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 text-slate-800 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 pt-4">
              <div className="flex items-center justify-center gap-4">
                <input 
                  type="file" 
                  ref={fileInputGalleryRef} 
                  onChange={handleImageChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                <input 
                  type="file" 
                  ref={fileInputCameraRef} 
                  onChange={handleImageChange} 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                />

                <div 
                  onClick={() => setShowPhotoOptions(true)}
                  className="group relative flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-rose-500 hover:bg-rose-50/20 shrink-0"
                >
                  {image ? (
                    <img src={image} alt="Preview" className="h-full w-full rounded-2xl object-cover" />
                  ) : (
                    <>
                      <Camera size={24} className="text-slate-400 group-hover:text-rose-500 transition" />
                      <span className="mt-1 text-[10px] font-medium text-slate-500 group-hover:text-rose-600">Adicionar foto</span>
                    </>
                  )}
                </div>

                {/* Exibição do Lucro Real e da Porcentagem ao lado da foto */}
                {currentCostNum > 0 && currentPriceNum > 0 && (
                  <div className="flex flex-col justify-center">
                    <span className="text-[11px] font-medium text-slate-500">Lucro estimado:</span>
                    <span className="text-sm font-bold text-emerald-600">
                      R$ {profitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600">
                      +{profitPercentage.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {showPhotoOptions && (
                <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
                  <div className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-2xl space-y-2">
                    <p className="text-xs font-semibold text-slate-700 text-center mb-3">Escolha a origem da foto:</p>
                    <button
                      type="button"
                      onClick={() => fileInputCameraRef.current?.click()}
                      className="w-full flex items-center gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-100 transition"
                    >
                      <Camera size={18} /> Tirar Foto com a Câmera
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputGalleryRef.current?.click()}
                      className="w-full flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-200 transition"
                    >
                      <ImageIcon size={18} /> Escolher da Galeria
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPhotoOptions(false)}
                      className="w-full rounded-xl py-2 text-xs text-slate-400 hover:text-slate-600 transition mt-1"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome do produto</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Produto Genérico"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div 
                className="relative"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setShowCategorySuggestions(false);
                  }
                }}
              >
                <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
                <input 
                  type="text"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setShowCategorySuggestions(true);
                  }}
                  onFocus={() => setShowCategorySuggestions(true)}
                  placeholder="Ex: Comida, Acessórios, Serviços"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none"
                />

                {showCategorySuggestions && category.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    {uniqueCategories.filter(cat => cat.toLowerCase().includes(category.toLowerCase())).length > 0 ? (
                      uniqueCategories
                        .filter(cat => cat.toLowerCase().includes(category.toLowerCase()))
                        .map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setCategory(cat);
                              setShowCategorySuggestions(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                          >
                            {cat}
                          </button>
                        ))
                    ) : (
                      <div className="px-4 py-2.5 text-xs text-slate-400">
                        Nenhuma categoria encontrada (será criada uma nova)
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Custo (R$)</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={cost}
                    onChange={handleCostChange}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Preço de venda (R$)</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={price}
                    onChange={handlePriceChange}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Quantidade atual</label>
                  <input 
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    className="w-fullorskou"
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Qtd. mínima de alerta</label>
                  <input 
                    type="number"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none"
                  />
                </div>
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
                  className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-medium text-white shadow-md shadow-rose-500/20 transition hover:bg-rose-600"
                >
                  {editingProduct ? 'Salvar Alterações' : 'Adicionar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!productToDelete}
        title="Excluir Produto"
        message={`Deseja realmente excluir o produto "${productToDelete?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
}
