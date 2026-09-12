import { useRef, useState } from 'react';
import { X, Plus, Store as StoreIcon, Check, Trash2, Camera } from 'lucide-react';
import { useActiveStore } from '@/lib/StoreContext';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

function resizeImageFile(file: File, maxSize = 300, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo'));
    reader.onloadend = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao carregar a imagem'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas indisponível');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function StorePage({ onClose }: { onClose: () => void }) {
  const { stores, loading, activeStoreId, setActiveStoreId, createStore, updateImage, deleteStore } = useActiveStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSegment, setNewSegment] = useState('');
  const [newImage, setNewImage] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [storeToDelete, setStoreToDelete] = useState<{ id: string; name: string } | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input escondido único, reaproveitado pra trocar a foto de qualquer loja
  // já existente na lista — guardamos qual loja está sendo editada aqui.
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const [editingImageForStoreId, setEditingImageForStoreId] = useState<string | null>(null);

  const handleNewImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      setNewImage(dataUrl);
    } catch (err) {
      console.error('Erro ao processar imagem da loja:', err);
    }
  };

  const handleEditImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const storeId = editingImageForStoreId;
    e.target.value = '';
    if (!file || !storeId) return;

    try {
      const dataUrl = await resizeImageFile(file);
      const err = await updateImage(storeId, dataUrl);
      if (err) setListError(err);
      else setListError(null);
    } catch (err) {
      console.error('Erro ao processar imagem da loja:', err);
      setListError('Não foi possível carregar essa foto.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const { error } = await createStore({ name: newName.trim(), segment: newSegment.trim(), image: newImage });
    if (error) {
      setFormError(error);
      return;
    }

    setNewName('');
    setNewSegment('');
    setNewImage(undefined);
    setFormError(null);
    setIsAdding(false);
  };

  const handleDelete = async () => {
    if (storeToDelete) {
      await deleteStore(storeToDelete.id);
      setStoreToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-4 mb-2 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-800">Loja</h2>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Input escondido reaproveitado para trocar a foto de qualquer loja da lista */}
      <input
        type="file"
        ref={editImageInputRef}
        onChange={handleEditImageChange}
        accept="image/*"
        className="hidden"
      />

      {listError && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{listError}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 text-center py-6">Carregando lojas...</p>
      ) : stores.length === 0 && !isAdding ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-400">
          <p className="text-sm">Nenhuma loja cadastrada ainda.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {stores.map((store) => (
            <li
              key={store.id}
              onClick={() => setActiveStoreId(store.id)}
              className={`flex items-center justify-between rounded-2xl border p-3.5 cursor-pointer transition ${
                store.id === activeStoreId
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {store.image ? (
                    <img src={store.image} alt={store.name} className="h-9 w-9 rounded-xl object-cover border border-slate-200" />
                  ) : (
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${store.id === activeStoreId ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <StoreIcon size={16} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingImageForStoreId(store.id);
                      editImageInputRef.current?.click();
                    }}
                    className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm border border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition"
                    title="Trocar foto da loja"
                  >
                    <Camera size={11} />
                  </button>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{store.name}</p>
                  {store.segment && <p className="text-xs text-slate-500">{store.segment}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {store.id === activeStoreId && <Check size={18} className="text-emerald-600" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setStoreToDelete({ id: store.id, name: store.name });
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  title="Excluir loja"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
        <form onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          {formError && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{formError}</div>
          )}

          <div className="flex justify-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleNewImageChange}
              accept="image/*"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-emerald-500 hover:bg-emerald-50/20"
            >
              {newImage ? (
                <img src={newImage} alt="Preview" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <>
                  <Camera size={20} className="text-slate-400 group-hover:text-emerald-500 transition" />
                  <span className="mt-1 text-[9px] font-medium text-slate-500 group-hover:text-emerald-600">Foto</span>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nome da loja</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: PanStore"
              required
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Segmento (opcional)</label>
            <input
              type="text"
              value={newSegment}
              onChange={(e) => setNewSegment(e.target.value)}
              placeholder="Ex: Padaria, Distribuidora..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setFormError(null); setNewImage(undefined); }}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600"
            >
              Criar loja
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <Plus size={16} /> Adicionar loja
        </button>
      )}

      <ConfirmDialog
        open={!!storeToDelete}
        title="Excluir loja"
        message={`Deseja realmente excluir a loja "${storeToDelete?.name}"? Os produtos, clientes e vendas dela não aparecerão mais, mas não são apagados permanentemente.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setStoreToDelete(null)}
      />
    </div>
  );
}
