import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { X, Check } from 'lucide-react';

interface ImageCropModalProps {
  imageSrc: string;
  aspect?: number;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar a imagem'));
    img.src = src;
  });
}

async function getCroppedDataUrl(
  imageSrc: string,
  cropPixels: Area,
  maxSize = 400,
  quality = 0.7,
): Promise<string> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxSize / Math.max(cropPixels.width, cropPixels.height));
  canvas.width = Math.round(cropPixels.width * scale);
  canvas.height = Math.round(cropPixels.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas.toDataURL('image/jpeg', quality);
}

export function ImageCropModal({ imageSrc, aspect = 1, onCancel, onConfirm }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    setError(null);
    try {
      const dataUrl = await getCroppedDataUrl(imageSrc, croppedAreaPixels);
      onConfirm(dataUrl);
    } catch (err) {
      console.error('Erro ao recortar imagem:', err);
      setError('Não foi possível recortar essa foto. Tente novamente.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 transition"
        >
          <X size={20} />
        </button>
        <span className="text-sm font-medium">Ajustar foto</span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={processing || !croppedAreaPixels}
          className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-400 hover:bg-white/10 transition disabled:opacity-40"
        >
          <Check size={20} />
        </button>
      </div>

      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape="rect"
          showGrid
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {error && (
        <div className="px-4 pb-2 text-center text-xs font-medium text-red-400">{error}</div>
      )}

      <div className="px-6 py-4">
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </div>
    </div>
  );
}
