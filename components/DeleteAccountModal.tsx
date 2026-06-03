import React, { useState } from 'react';
import { X, Trash2, Mail, Loader, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store';

type Step = 'warning' | 'sending' | 'confirm' | 'deleting';

export const DeleteAccountModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { currentUserProfile, deleteAccount } = useAppStore();
  const [step, setStep] = useState<Step>('warning');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const email = currentUserProfile?.email ?? '';

  const sendCode = async () => {
    setStep('sending');
    setError('');
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (otpErr) {
      setError('Não foi possível enviar o código. Tente novamente.');
      setStep('warning');
      return;
    }
    setStep('confirm');
  };

  const confirmDelete = async () => {
    if (otp.length < 6) { setError('Digite o código de 6 dígitos.'); return; }
    setStep('deleting');
    setError('');
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });
    if (verifyErr) {
      setError('Código inválido ou expirado. Tente novamente.');
      setStep('confirm');
      return;
    }
    try {
      await deleteAccount();
    } catch (e: any) {
      setError('Erro ao excluir conta: ' + e.message);
      setStep('confirm');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-red-500" />
            <h3 className="font-black text-gray-900">Excluir conta</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-all">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {(step === 'warning' || step === 'sending') && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-sm font-black text-red-700 mb-2">Atenção — ação irreversível</p>
              <ul className="text-xs text-red-500 font-medium space-y-1">
                <li>• Seus dados pessoais serão apagados</li>
                <li>• Seu histórico de pedidos será removido</li>
                <li>• Você poderá criar uma nova conta com o mesmo e-mail</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500 text-center font-medium">
              Enviaremos um código de confirmação para<br />
              <span className="font-black text-gray-700">{email}</span>
            </p>
            {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}
            <button
              onClick={sendCode}
              disabled={step === 'sending'}
              className="w-full py-3.5 bg-red-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
            >
              {step === 'sending'
                ? <><Loader size={15} className="animate-spin" /> Enviando código...</>
                : <><Mail size={15} /> Enviar código de confirmação</>
              }
            </button>
            <button onClick={onClose} className="w-full py-3 text-gray-400 font-black text-xs uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-all">
              Cancelar
            </button>
          </div>
        )}

        {(step === 'confirm' || step === 'deleting') && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 font-medium text-center">
              Digite o código enviado para<br />
              <span className="font-black text-gray-900">{email}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="000000"
              className="w-full text-center text-3xl font-black tracking-[0.4em] border-2 border-gray-200 focus:border-red-400 rounded-2xl py-4 outline-none transition-all"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}
            <button
              onClick={confirmDelete}
              disabled={otp.length < 6 || step === 'deleting'}
              className="w-full py-3.5 bg-red-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {step === 'deleting'
                ? <><Loader size={15} className="animate-spin" /> Excluindo conta...</>
                : <><Trash2 size={15} /> Confirmar exclusão</>
              }
            </button>
            <button
              onClick={() => { setStep('warning'); setOtp(''); setError(''); }}
              className="w-full py-3 text-gray-400 font-black text-xs uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-all"
            >
              Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
