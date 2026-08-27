import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSign: (signatureData: string) => void;
  contractTitle: string;
}

export default function SignatureModal({ isOpen, onClose, onSign, contractTitle }: SignatureModalProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [fontFamily, setFontFamily] = useState('font-serif');

  const handleClear = () => {
    sigCanvas.current?.clear();
  };

  const handleSave = () => {
    let signatureData = '';
    
    if (activeTab === 'draw' && !sigCanvas.current?.isEmpty()) {
      signatureData = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') || '';
    } else if (activeTab === 'type' && typedSignature.trim() !== '') {
      // In a real app, we might render this to a canvas to get an image,
      // or save the text and font. For now, we'll prefix text sign.
      signatureData = `TEXT:${typedSignature}:${fontFamily}`;
    } else if (activeTab === 'upload') {
      // Handle file upload processing here
      signatureData = "UPLOADED_IMAGE_DATA_URL";
    }

    if (signatureData) {
      onSign(signatureData);
      onClose();
    } else {
        alert("Please provide a signature.");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Sign Contract</h2>
              <p className="text-sm text-slate-500">{contractTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 flex gap-2 border-b border-slate-100">
             <button
                onClick={() => setActiveTab('draw')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'draw' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                Draw
             </button>
             <button
                onClick={() => setActiveTab('type')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'type' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                Type
             </button>
             <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'upload' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                Upload
             </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {activeTab === 'draw' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 relative h-[200px]">
                  <SignatureCanvas
                    ref={sigCanvas}
                    canvasProps={{
                      className: 'signature-canvas w-full h-full rounded-xl',
                    }}
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      onClick={handleClear}
                      className="px-3 py-1 bg-white text-xs font-medium text-slate-600 border border-slate-200 rounded shadow-sm hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 text-center">Draw your signature clearly inside the box.</p>
              </div>
            )}

            {activeTab === 'type' && (
              <div className="space-y-6">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Type your name</label>
                    <input
                        type="text"
                        value={typedSignature}
                        onChange={(e) => setTypedSignature(e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                 </div>
                 <div>
                     <label className="block text-sm font-medium text-slate-700 mb-2">Choose font style</label>
                     <div className="grid grid-cols-2 gap-3">
                         {['font-serif', 'font-sans', 'font-mono'].map(font => (
                             <div 
                                key={font}
                                onClick={() => setFontFamily(font)}
                                className={`border rounded-lg p-4 cursor-pointer text-center ${font} ${fontFamily === font ? 'border-indigo-600 ring-1 ring-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                             >
                                 <span className="text-lg">{typedSignature || 'Signature'}</span>
                             </div>
                         ))}
                     </div>
                 </div>
              </div>
            )}

            {activeTab === 'upload' && (
               <div className="h-[200px] border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex items-center justify-center flex-col text-center p-6">
                  <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-slate-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-900">Click to upload or drag & drop</p>
                  <p className="text-xs text-slate-500 mt-1">SVG, PNG, JPG or GIF (max. 800x400px)</p>
                  <input type="file" className="hidden" />
               </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <Check size={16} />
              Sign & Accept
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
