import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

export interface TutorialSlide {
  emoji: string;
  title: string;
  description: string;
}

interface Props {
  slides: TutorialSlide[];
  onClose: () => void;
  accentColor?: string; // ex: 'orange' | 'blue' | 'green'
}

export function TutorialModal({ slides, onClose, accentColor = 'orange' }: Props) {
  const [current, setCurrent] = useState(0);
  const isLast = current === slides.length - 1;

  const accent = {
    orange: { dot: 'bg-orange-500', btn: 'bg-orange-600 active:bg-orange-700', skip: 'text-orange-400' },
    blue:   { dot: 'bg-blue-500',   btn: 'bg-blue-600 active:bg-blue-700',     skip: 'text-blue-400' },
    green:  { dot: 'bg-green-500',  btn: 'bg-green-600 active:bg-green-700',   skip: 'text-green-400' },
  }[accentColor] ?? { dot: 'bg-orange-500', btn: 'bg-orange-600 active:bg-orange-700', skip: 'text-orange-400' };

  const slide = slides[current];

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-end md:items-center justify-center backdrop-blur-sm">
      <div className="bg-white w-full md:max-w-sm md:rounded-[2.5rem] rounded-t-[3rem] p-8 animate-in slide-in-from-bottom duration-300 shadow-2xl">

        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-300 hover:text-gray-500 transition-colors"
          aria-label="Fechar tutorial"
        >
          <X size={22} />
        </button>

        {/* Slide */}
        <div className="flex flex-col items-center text-center mb-8 min-h-[180px] justify-center">
          <div className="text-7xl mb-5 select-none">{slide.emoji}</div>
          <h3 className="text-xl font-black text-gray-900 mb-3 leading-tight">{slide.title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{slide.description}</p>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${i === current ? `${accent.dot} w-6` : 'bg-gray-200 w-2'}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Navegação */}
        <div className="flex gap-3">
          {current > 0 && (
            <button
              onClick={() => setCurrent(c => c - 1)}
              className="flex items-center justify-center w-12 h-12 rounded-2xl border-2 border-gray-100 text-gray-400 active:scale-95 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <button
            onClick={isLast ? onClose : () => setCurrent(c => c + 1)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all ${accent.btn}`}
          >
            {isLast ? 'Entendido!' : (
              <>
                Próximo
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>

        {/* Pular (só nos primeiros slides) */}
        {!isLast && (
          <button
            onClick={onClose}
            className={`w-full mt-3 text-xs font-bold uppercase tracking-widest py-2 ${accent.skip} active:opacity-70 transition-opacity`}
          >
            Pular tutorial
          </button>
        )}
      </div>
    </div>
  );
}

// ── Chave de localStorage por papel ─────────────────────────────────
export const TUTORIAL_KEY: Record<string, string> = {
  CLIENT:     'dc_tutorial_client_v1',
  RESTAURANT: 'dc_tutorial_restaurant_v1',
  DRIVER:     'dc_tutorial_driver_v1',
};

export function hasSeen(role: string): boolean {
  return localStorage.getItem(TUTORIAL_KEY[role] ?? '') === '1';
}

export function markSeen(role: string): void {
  localStorage.setItem(TUTORIAL_KEY[role] ?? '', '1');
}
