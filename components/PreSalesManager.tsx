import React, { useState } from 'react';
import { Camera, Upload, ShoppingBag, Sparkles, Image as ImageIcon, Loader2, Tag, FileText, DollarSign, AlertCircle, Download, CheckCircle2 } from 'lucide-react';
import { analyzeProductForSales, generateAmbientImage, ProductAnalysis } from '../services/geminiService';
import { toast } from 'sonner';

interface PreSalesManagerProps {
  onPublish: (initialData: { name: string; description: string; price: number; ml_title: string; imageBase64: string }) => void;
}

const PreSalesManager: React.FC<PreSalesManagerProps> = ({ onPublish }) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [ambientImages, setAmbientImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setAnalysis(null);
        setAmbientImages([]);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const processProduct = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);

    try {
      const base64Data = image.split(',')[1];
      
      toast.info('Analizando producto con IA...');
      const data = await analyzeProductForSales(base64Data);
      
      if (!data) {
        throw new Error('No se pudo analizar el producto.');
      }
      
      setAnalysis(data);
      toast.success('Análisis completado. Generando ambientaciones...');

      // Generar 1-2 variantes como máximo pero de forma SECUENCIAL para no exceder timeouts/cuota
      const successfulImages: string[] = [];
      for (const scene of data.scenarios.slice(0, 2)) {
        toast.info(`Generando ambiente: ${scene.slice(0, 30)}...`);
        const img = await generateAmbientImage(base64Data, scene);
        if (img) successfulImages.push(img);
        // Small delay to help with rate limits
        await new Promise(r => setTimeout(r, 2000));
      }
      
      setAmbientImages(successfulImages);
      
      if (successfulImages.length > 0) {
        toast.success('¡Imágenes generadas con éxito!');
      } else {
        toast.warning('Imágenes no generadas, pero el análisis de marketing está listo.');
      }

    } catch (err: any) {
      console.error("Process Error:", err);
      setError("Fallo al procesar. Intenta con una toma más clara o revisa la consola.");
      toast.error('Ocurrió un error en el Gestor de Preventas.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishClick = (selectedImageIndex: number = -1) => {
    if (!analysis) return;
    
    // Choose ambient image or original
    const finalImage = selectedImageIndex >= 0 && ambientImages[selectedImageIndex] 
      ? ambientImages[selectedImageIndex] 
      : image;

    if (!finalImage) return;

    onPublish({
      name: analysis.product_name,
      description: analysis.descriptions[0] || '', // Pick the first or best
      price: analysis.prices.recommended.amount || 0,
      ml_title: analysis.titles[0] || '',
      imageBase64: finalImage
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-indigo-600 flex items-center gap-3">
            <Sparkles className="w-6 h-6 fill-indigo-600" /> Gestor de Preventas
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Sube la foto cruda. La IA creará la publicación perfecta.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Izquierda: Input */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
              <Camera className="w-5 h-5 text-indigo-500" /> 1. Foto Base
            </h3>
            
            <div 
              onClick={() => document.getElementById('presales-file')?.click()}
              className={`relative border-2 border-dashed rounded-3xl p-4 transition-all duration-300 flex flex-col items-center justify-center min-h-[300px] cursor-pointer
              ${image ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
            >
              {image ? (
                <img src={image} alt="Original" className="max-h-64 rounded-2xl shadow-md object-contain" />
              ) : (
                <div className="text-center p-8">
                  <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                    <Upload className="w-8 h-8 text-indigo-400" />
                  </div>
                  <p className="font-bold text-slate-600">Subir Producto</p>
                  <p className="text-xs text-slate-400 mt-2">Fondo claro recomendado</p>
                </div>
              )}
              <input id="presales-file" type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
            </div>

            {image && !analysis && (
              <button
                onClick={processProduct}
                disabled={loading}
                className="w-full mt-6 bg-linear-to-r from-indigo-500 to-purple-600 text-white py-3 px-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Procesando Magia...</> : <><Sparkles className="w-5 h-5" /> Analizar y Crear Marketing</>}
              </button>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Variantes IA */}
          {ambientImages.length > 0 && (
             <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
               <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-600">
                 <ImageIcon className="w-5 h-5" /> 2. Elige la Portada
               </h3>
               <div className="grid grid-cols-2 gap-4">
                 {/* Original */}
                 <div className="relative group rounded-xl overflow-hidden border-2 border-transparent hover:border-indigo-400 cursor-pointer shadow-sm" onClick={() => handlePublishClick(-1)}>
                    <img src={image!} alt="Original" className="w-full h-auto object-cover aspect-square" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <span className="bg-white text-indigo-600 font-bold px-3 py-1 text-xs rounded-full">Usar Original</span>
                    </div>
                 </div>
                 {/* Generadas */}
                 {ambientImages.map((v, i) => (
                   <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-transparent hover:border-indigo-400 cursor-pointer shadow-sm" onClick={() => handlePublishClick(i)}>
                     <img src={v} alt={`Variant ${i}`} className="w-full h-auto object-cover aspect-square" />
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-col gap-2">
                         <span className="bg-white text-indigo-600 font-bold px-3 py-1 text-xs rounded-full">Usar IA {i+1}</span>
                     </div>
                   </div>
                 ))}
               </div>
               <p className="text-xs text-center text-slate-400 mt-4">Haz clic en la imagen que quieres usar para publicar.</p>
             </div>
          )}
        </div>

        {/* Derecha: Resultados */}
        <div className="lg:col-span-7">
          {analysis ? (
            <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-700">
              
              <div className="bg-linear-to-br from-indigo-600 to-purple-700 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute topRight -mr-10 -mt-10 opacity-10">
                   <ShoppingBag size={150} />
                </div>
                <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Producto Identificado</p>
                <h3 className="text-3xl font-black capitalize mb-3 drop-shadow-md">{analysis.product_name}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold shadow-sm border border-white/10">
                    Ideal para: <span className="underline">{analysis.usage_type}</span>
                  </span>
                  <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold shadow-sm border border-white/10">
                    {analysis.is_3d_or_laser ? 'Impresión 3D / Láser' : 'No parece impreso/láser'}
                  </span>
                </div>
                
                {analysis.confidence_warning && (
                  <div className="mt-4 bg-orange-500/80 backdrop-blur-md p-4 rounded-xl border border-orange-400 text-sm flex gap-3 text-orange-50 font-medium">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p><strong>Aviso de la IA:</strong> {analysis.confidence_warning}</p>
                  </div>
                )}
              </div>

              {/* Títulos Estratégicos */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><Tag className="w-5 h-5" /></div>
                  <h3 className="text-lg font-bold text-slate-800">Títulos sugeridos (MercadoLibre)</h3>
                </div>
                <div className="space-y-2">
                  {analysis.titles.map((t, i) => (
                    <div key={i} className="group p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-300 transition-colors flex justify-between items-center">
                      <p className="text-slate-700 font-medium text-sm">{t}</p>
                      <button onClick={() => navigator.clipboard.writeText(t)} className="opacity-0 group-hover:opacity-100 text-xs text-indigo-500 hover:text-indigo-700 font-bold px-2 py-1 bg-indigo-50 rounded">Copiar</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Precios */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><DollarSign className="w-5 h-5" /></div>
                    <h3 className="text-lg font-bold text-slate-800">Precios de Venta</h3>
                  </div>
                  <div className="flex flex-col gap-4">
                    {/* Recomendado */}
                    <div className="p-4 rounded-xl flex flex-col gap-2 border bg-emerald-50 border-emerald-200 text-emerald-800">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase">Recomendado</span>
                        <span className="font-black text-xl">${analysis.prices.recommended.amount.toLocaleString('es-AR')}</span>
                      </div>
                      <p className="text-xs font-medium text-emerald-700 leading-tight bg-emerald-100/50 p-2 rounded">{analysis.prices.recommended.reason}</p>
                    </div>

                    {/* Mínimo */}
                    <div className="p-4 rounded-xl flex flex-col gap-2 border bg-slate-50 border-slate-100 text-slate-700">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase">Mínimo (Costo / Liquidación)</span>
                        <span className="font-bold text-lg text-slate-900">${analysis.prices.minimum.amount.toLocaleString('es-AR')}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-500 leading-tight bg-slate-100 p-2 rounded">{analysis.prices.minimum.reason}</p>
                    </div>

                    {/* Premium */}
                    <div className="p-4 rounded-xl flex flex-col gap-2 border bg-purple-50 border-purple-200 text-purple-800">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase">Premium (Alta Gama)</span>
                        <span className="font-bold text-lg text-purple-900">${analysis.prices.premium.amount.toLocaleString('es-AR')}</span>
                      </div>
                      <p className="text-xs font-medium text-purple-700 leading-tight bg-purple-100 p-2 rounded">{analysis.prices.premium.reason}</p>
                    </div>
                  </div>
                </div>

                {/* Descripciones */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><FileText className="w-5 h-5" /></div>
                    <h3 className="text-lg font-bold text-slate-800">Descripciones</h3>
                  </div>
                  <div className="space-y-3">
                    {analysis.descriptions.slice(0, 2).map((d, i) => (
                       <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 relative group text-sm text-slate-600 h-28 overflow-y-auto">
                         {d}
                         <button onClick={() => navigator.clipboard.writeText(d)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[10px] text-white bg-indigo-500 px-2 py-1 rounded shadow">Copiar</button>
                       </div>
                    ))}
                  </div>
                </div>
              </div>

              {!ambientImages.length && !loading && (
                 <button 
                  onClick={() => handlePublishClick(-1)}
                  className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-emerald-200 transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                   <CheckCircle2 className="w-6 h-6" /> Publicar Producto Ahora
                 </button>
              )}

            </div>
          ) : (
            <div className="bg-white h-[400px] lg:h-full rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-center shadow-inner">
              <div className="bg-indigo-50 p-8 rounded-full mb-6">
                <Sparkles className="w-16 h-16 text-indigo-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-400">Esperando Producto...</h3>
              <p className="text-slate-400 mt-2 text-sm max-w-xs mx-auto">
                Sube la foto de tu pieza 3D o de corte láser y déjanos el trabajo duro a nosotros.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreSalesManager;
