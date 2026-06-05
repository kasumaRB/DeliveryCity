import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { UserRole, UserProfile, UserAddress } from '../types';
import { DeleteAccountModal } from '../components/DeleteAccountModal';

const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          blob => {
            if (blob) {
              const resizedFile = new File([blob], file.name, { type: 'image/jpeg' });
              resolve(resizedFile);
            } else {
              reject(new Error('Failed to resize image'));
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

import {
  X,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Mail,
  Lock,
  Loader,
  MapPin,
  Eye,
  EyeOff,
  UserPlus,
  Trash2,
  Edit2,
  Plus,
  Truck,
  Store,
  Calendar,
  AlertCircle,
  ShoppingBag,
  Wallet,
  Smartphone,
  Car,
  CheckCircle2,
  ShieldCheck,
  Info,
  Clock,
  AlignLeft,
  Camera,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AddressModal } from '../components/AddressModal';
import Logo from '../assets/Logo.png';
import Nome from '../assets/Nome.png';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 48 48">
    <path
      fill="#FFC107"
      d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
    ></path>
    <path
      fill="#FF3D00"
      d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
    ></path>
    <path
      fill="#4CAF50"
      d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
    ></path>
    <path
      fill="#1976D2"
      d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.012,36.49,44,30.638,44,24C44,22.659,43.862,21.35,43.611,20.083z"
    ></path>
  </svg>
);

interface AuthViewProps {
  onClose: () => void;
}
type AuthMode =
  | 'HUB'
  | 'LOGIN_EMAIL'
  | 'REGISTER_EMAIL'
  | 'REGISTER_PARTNER'
  | 'FORGOT_PASSWORD'
  | 'TERMS'
  | 'COMPLETE_PROFILE'
  | 'SUPPORT'
  | 'EDIT_PROFILE';

const formatCpfCnpj = (value: string) => {
  const cleanValue = value.replace(/\D/g, '');
  if (cleanValue.length <= 11)
    return cleanValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14);
  return cleanValue
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})/, '$1-$2')
    .slice(0, 18);
};

const formatDate = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2')
    .slice(0, 10);
};

export const AuthView: React.FC<AuthViewProps> = ({ onClose }) => {
  const {
    currentUserProfile,
    signOut,
    deleteAccount,
    registerProfile,
    updateUserProfile,
    refreshData,
    requestPasswordReset,
  } = useAppStore();
  const [mode, setMode] = useState<AuthMode>('HUB');
  const [partnerType, setPartnerType] = useState<UserRole>(UserRole.CLIENT);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [vehicleType, setVehicleType] = useState('Moto');
  const [licensePlate, setLicensePlate] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [regAddress, setRegAddress] = useState<Omit<UserAddress, 'id'> | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // UI states
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [supportMessage, setSupportMessage] = useState('');
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [previousMode, setPreviousMode] = useState<AuthMode>('REGISTER_EMAIL');

  // Derivado: verdadeiro quando está completando ou editando perfil existente
  // CRÍTICO: usado tanto em validateFields() quanto no JSX do botão de submit
  const isCompletingOrEditing = mode === 'COMPLETE_PROFILE' || mode === 'EDIT_PROFILE';

  useEffect(() => {
    if (currentUserProfile?.avatarUrl) {
      setAvatarUrl(currentUserProfile.avatarUrl);
    }
  }, [currentUserProfile?.avatarUrl]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserProfile) return;

    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem válido');
      return;
    }

    setLoading(true);
    try {
      console.log('Uploading avatar...');
      const resizedFile = await resizeImage(file, 400, 400);
      const fileExt = 'jpg';
      const fileName = `${currentUserProfile.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, resizedFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message);
      }

      console.log('Upload success:', data);
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      await updateUserProfile(currentUserProfile.id, { avatarUrl: publicUrl });
      setAvatarUrl(publicUrl);
      alert('Foto de perfil atualizada!');
    } catch (error: any) {
      console.error('Full error:', error);
      alert('Erro ao atualizar foto: ' + (error.message || error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserProfile && mode === 'HUB') {
      // Clientes (inclusive Google) NÃO são obrigados a completar o perfil ao logar.
      // Somente parceiros (Lojista/Entregador) sem perfil completo são redirecionados.
      const isPartner =
        currentUserProfile.role === UserRole.RESTAURANT ||
        currentUserProfile.role === UserRole.DRIVER;
      if (!isPartner) return;

      const isComplete =
        currentUserProfile.name &&
        currentUserProfile.phoneNumber &&
        (currentUserProfile.role === UserRole.RESTAURANT
          ? currentUserProfile.cnpj || currentUserProfile.cpf
          : currentUserProfile.cpf) &&
        (currentUserProfile.role !== UserRole.RESTAURANT ? currentUserProfile.birthDate : true);

      if (!isComplete) {
        setMode('COMPLETE_PROFILE');
        setName(currentUserProfile.name || '');
        setPhone(currentUserProfile.phoneNumber || '');
        setCpf(currentUserProfile.cpf || '');
        setCnpj(currentUserProfile.cnpj || '');
        setBirthDate(currentUserProfile.birthDate || '');
        setBusinessName(currentUserProfile.businessName || '');
        setDescription(currentUserProfile.description || '');
        setWorkingHours(currentUserProfile.workingHours || '');
        setPixKey(currentUserProfile.pixKey || '');
        setVehicleType(currentUserProfile.vehicleType || 'Moto');
        setLicensePlate(currentUserProfile.licensePlate || '');
      }
    }
  }, [currentUserProfile, mode]);

  const validateFields = () => {
    const newErrors: Record<string, string> = {};
    if (mode === 'LOGIN_EMAIL') {
      if (!email) newErrors.email = 'E-mail obrigatório';
      if (!password) newErrors.password = 'Senha obrigatória';
    } else if (mode === 'FORGOT_PASSWORD') {
      if (!email) newErrors.email = 'Informe o e-mail';
    } else if (
      mode === 'COMPLETE_PROFILE' ||
      mode === 'EDIT_PROFILE' ||
      mode === 'REGISTER_EMAIL' ||
      mode === 'REGISTER_PARTNER'
    ) {
      if (!name) newErrors.name = 'Nome é obrigatório';
      if (!phone) newErrors.phone = 'WhatsApp é obrigatório';

      if (mode === 'REGISTER_EMAIL' || mode === 'REGISTER_PARTNER') {
        if (!email) newErrors.email = 'E-mail inválido';
        if (!password || password.length < 6) newErrors.password = 'Mínimo 6 caracteres';
        if (password !== confirmPassword) newErrors.confirmPassword = 'As senhas não coincidem';
        if (!acceptedTerms) newErrors.terms = 'Você deve aceitar os termos';
      }

      const role =
        mode === 'REGISTER_PARTNER' ? partnerType : currentUserProfile?.role || UserRole.CLIENT;

      // Para edição do perfil de CLIENTE, CPF e data de nascimento são desejáveis mas não bloqueantes
      const isClientEditing = mode === 'EDIT_PROFILE' && role === UserRole.CLIENT;

      if (role === UserRole.RESTAURANT) {
        if (isCompletingOrEditing && !businessName) {
          newErrors.businessName = 'Nome da loja obrigatório';
        }
        const cleanCpf = cpf.replace(/\D/g, '');
        const cleanCnpj = cnpj.replace(/\D/g, '');

        if (!cleanCpf && !cleanCnpj) {
          newErrors.cnpj = 'É necessário informar CPF ou CNPJ';
        } else {
          if (cleanCnpj && cleanCnpj.length < 14) newErrors.cnpj = 'CNPJ incompleto';
          if (cleanCpf && cleanCpf.length < 11) newErrors.cpf = 'CPF incompleto';
        }
      } else if (!isClientEditing) {
        // Valida CPF e data apenas para cadastro ou completion — não em edição simples de cliente
        if (!cpf || cpf.replace(/\D/g, '').length < 11) newErrors.cpf = 'CPF incompleto';
        if (!birthDate || birthDate.length < 10)
          newErrors.birthDate = 'Data de nascimento inválida';
      } else {
        // Cliente editando: valida CPF só se ele preencheu algo (parcial)
        if (cpf && cpf.replace(/\D/g, '').length > 0 && cpf.replace(/\D/g, '').length < 11) {
          newErrors.cpf = 'CPF incompleto';
        }
      }

      if (role === UserRole.DRIVER || role === UserRole.RESTAURANT) {
        if (!pixKey) newErrors.pixKey = 'Chave PIX obrigatória';
      }

      if (mode === 'REGISTER_PARTNER' && !regAddress) {
        newErrors.address = 'Localização obrigatória';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateFields()) return;
    setLoading(true);
    try {
      const cleanCpf   = cpf.replace(/\D/g, '');
      const cleanPhone = phone.trim();
      const SUPPORT    = import.meta.env.VITE_SUPPORT_PHONE || '(66) 98419-9198';

      // 🔒 VERIFICAÇÃO 1: CPF já vinculado a outra conta?
      if (cleanCpf && cleanCpf.length === 11) {
        const { data: cpfRow } = await supabase
          .from('profiles')
          .select('id')
          .eq('cpf', cleanCpf)
          .maybeSingle();
        if (cpfRow) {
          throw new Error(
            `CPF já cadastrado em outra conta.\n` +
            `Se perdeu o acesso, fale com o suporte: ${SUPPORT}`
          );
        }
      }

      // 🔒 VERIFICAÇÃO 2: Telefone já vinculado a outra conta?
      if (cleanPhone) {
        const { data: phoneRow } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone_number', cleanPhone)
          .maybeSingle();
        if (phoneRow) {
          throw new Error(
            `WhatsApp já cadastrado em outra conta.\n` +
            `Se perdeu o acesso, fale com o suporte: ${SUPPORT}`
          );
        }
      }

      // Criar conta no Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;

      // `data.user` pode existir mas sem identities se o email ainda não foi confirmado (usuário já existe)
      const userId = data.user?.id;
      if (!userId)
        throw new Error(
          data.user?.identities?.length === 0
            ? 'Este e-mail já está cadastrado. Tente fazer login ou recuperar a senha.'
            : 'Não foi possível criar a conta.'
        );

      const roleToSet = mode === 'REGISTER_PARTNER' ? partnerType : UserRole.CLIENT;
      await registerProfile({
        id: userId,
        email: email.toLowerCase(),
        name,
        businessName,
        role: roleToSet,
        cpf: cleanCpf,
        cnpj: cnpj.replace(/\D/g, ''),
        birthDate,
        vehicleType: partnerType === UserRole.DRIVER ? vehicleType : undefined,
        licensePlate: partnerType === UserRole.DRIVER ? licensePlate : undefined,
        phoneNumber: cleanPhone,
        pixKey,
        status: mode === 'REGISTER_PARTNER' ? 'PENDING' : 'APPROVED',
        description,
        workingHours,
        savedAddresses: regAddress
          ? [{ ...regAddress, id: `addr-${Date.now()}`, label: 'Principal' }]
          : [],
        createdAt: Date.now(),
      });

      if (mode === 'REGISTER_PARTNER' && partnerType === UserRole.RESTAURANT) {
        // Usa upsert para garantir que sobrescreve o registro criado pelo upsert_profile RPC
        // e salva as coords do endereço cadastrado pelo lojista
        await supabase.from('restaurants').upsert({
          id: `rest-${userId}`,
          owner_id: userId,
          name: businessName || name,
          address: regAddress ? `${regAddress.street}, ${regAddress.number} - ${regAddress.city}` : '',
          description: description || '',
          working_hours: workingHours || '',
          coords: regAddress?.coords ?? null,
          menu: [],
          is_active: true,
        }, { onConflict: 'id' });
      }

      // Garante que o perfil foi carregado no store antes de fechar o modal.
      // Sem isso, pode haver race condition: onAuthStateChange(SIGNED_IN) dispara
      // fetchData() concorrentemente e o app fecha sem currentUserProfile definido.
      await refreshData();

      const msg =
        mode === 'REGISTER_PARTNER'
          ? 'Cadastro enviado! Aguarde a aprovação da equipe.'
          : 'Conta criada com sucesso!';
      alert(msg);
      onClose();
    } catch (e: any) {
      setErrors({ auth: e.message });
    } finally {
      setLoading(false);
    }
  };


  const handleUpdateProfile = async () => {
    if (!validateFields() || !currentUserProfile) return;
    setLoading(true);
    try {
      await updateUserProfile(currentUserProfile.id, {
        name,
        phoneNumber: phone,
        cpf: cpf.replace(/\D/g, ''),
        cnpj: cnpj.replace(/\D/g, ''),
        birthDate,
        businessName,
        pixKey,
        vehicleType,
        licensePlate,
        description,
        workingHours,
      });
      // Em ambos os casos fecha o modal — updateUserProfile já chama fetchData internamente,
      // então o store já está atualizado. setMode('HUB') causava uma "tela de confirmação
      // estranha" que confundia o usuário após salvar.
      if (mode === 'COMPLETE_PROFILE') {
        alert('Perfil completado com sucesso!');
      } else {
        alert('Perfil atualizado com sucesso!');
      }
      onClose();
    } catch (e: any) {
      setErrors({ auth: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSendSupport = async () => {
    if (!supportMessage.trim() || !currentUserProfile) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: currentUserProfile.id,
        user_name: currentUserProfile.name,
        user_role: currentUserProfile.role,
        message: supportMessage,
        status: 'OPEN',
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      alert('Mensagem enviada! Retornaremos em breve.');
      setSupportMessage('');
      setMode('HUB');
    } catch (e: any) {
      alert('Erro ao enviar mensagem.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrors({ email: 'Digite seu e-mail para recuperar a senha.' });
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      alert('Instruções de recuperação enviadas para o seu e-mail!');
      setMode('LOGIN_EMAIL');
    } catch (e: any) {
      setErrors({ auth: e.message || 'Erro ao tentar redefinir a senha.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!validateFields()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refreshData();
      onClose();
    } catch (e: any) {
      setErrors({ auth: 'Credenciais inválidas ou e-mail não confirmado.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // Detecta se está rodando como app nativo (Capacitor) ou no browser web
      const isNativePlatform =
        typeof (window as any).Capacitor !== 'undefined' &&
        (window as any).Capacitor?.isNativePlatform?.();

      if (isNativePlatform) {
        // Fluxo nativo com plugin Capacitor
        const googleUser = await GoogleAuth.signIn();
        if (!googleUser.authentication?.idToken) throw new Error('Token ausente.');
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: googleUser.authentication.idToken,
        });
        if (error) throw error;

        if (data.user) {
          const { data: profileExists } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .single();
          if (!profileExists) {
            await registerProfile({
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata.full_name || data.user.email?.split('@')[0],
              role: UserRole.CLIENT,
              status: 'APPROVED',
              createdAt: Date.now(),
              savedAddresses: [],
            });
          }
        }
        await refreshData();
      } else {
        // Fluxo web: OAuth redirect via Supabase (abre popup de conta Google)
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
            queryParams: { prompt: 'select_account' },
          },
        });
        if (error) throw error;
        // O redirect acontece automaticamente — o Supabase vai redirecionar de volta
      }
    } catch (e: any) {
      if (e.code !== 'SIGN_IN_CANCELLED')
        setErrors({ auth: e.message || 'Erro no login com Google.' });
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'FORGOT_PASSWORD') {
    return (
      <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-300 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
          <button
            onClick={() => setMode('LOGIN_EMAIL')}
            className="p-2.5 bg-gray-50 text-gray-900 rounded-xl active:scale-90 transition-all"
          >
            <ChevronLeft size={22} />
          </button>
          <h2 className="text-lg font-black tracking-tighter">Recuperar Senha</h2>
          <button onClick={onClose} className="p-2 text-gray-400">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-6">
          <p className="text-gray-500 text-sm font-bold leading-relaxed">
            Digite seu endereço de e-mail abaixo. Enviaremos um link seguro para que você possa
            redefinir sua senha.
          </p>
          {errors.auth && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-black text-center border border-red-100">
              {errors.auth}
            </div>
          )}
          <div className="relative">
            <input
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                setErrors(prev => ({ ...prev, email: '' }));
              }}
              type="email"
              placeholder="Seu e-mail"
              className={`w-full p-5 bg-gray-50 rounded-[1.5rem] font-bold outline-none border-2 transition-all ${errors.email ? 'border-red-200 bg-red-50' : 'border-transparent focus:border-orange-200 focus:bg-white focus:shadow-lg'}`}
            />
            <Mail className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            {errors.email && (
              <p className="text-red-500 text-xs font-bold mt-2 ml-2 tracking-wide">
                {errors.email}
              </p>
            )}
          </div>

          <button
            onClick={handleForgotPassword}
            disabled={loading}
            className="w-full py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 bg-orange-600 text-white shadow-orange-200"
          >
            {loading ? (
              <Loader className="animate-spin" size={22} />
            ) : (
              <>
                <Mail size={18} /> Enviar Link
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'TERMS') {
    return (
      <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b flex items-center gap-4">
          <button onClick={() => setMode(previousMode)} className="p-2 bg-gray-50 rounded-xl">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-black tracking-tighter">Termos & Privacidade</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-gray-600 text-sm leading-relaxed">
          <section>
            <h3 className="font-black text-gray-900 uppercase text-[10px] tracking-widest mb-2">
              1. Coleta de Dados
            </h3>
            <p>
              Coletamos seu nome, e-mail e localização para processar entregas e garantir a
              segurança das transações.
            </p>
          </section>
          <section>
            <h3 className="font-black text-gray-900 uppercase text-[10px] tracking-widest mb-2">
              2. Repasses Financeiros
            </h3>
            <p>
              Parceiros concordam com as taxas de serviço da plataforma, que são descontadas
              automaticamente via split de pagamento.
            </p>
          </section>
          <section>
            <h3 className="font-black text-gray-900 uppercase text-[10px] tracking-widest mb-2">
              3. Exclusão de Conta
            </h3>
            <p>
              Você pode solicitar a exclusão definitiva de todos os seus dados a qualquer momento
              através das configurações de perfil.
            </p>
          </section>
        </div>
        <div className="p-8 border-t">
          <button
            onClick={() => {
              setAcceptedTerms(true);
              setMode(previousMode);
            }}
            className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest"
          >
            Aceito os Termos
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'SUPPORT') {
    return (
      <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b flex items-center gap-4">
          <button onClick={() => setMode('HUB')} className="p-2 bg-gray-50 rounded-xl">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-black tracking-tighter">Ajuda e Suporte</h2>
        </div>
        <div className="flex-1 p-8 space-y-6">
          <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100">
            <p className="text-sm text-orange-800 font-medium">
              Como podemos ajudar? Descreva seu problema ou dúvida abaixo e nossa equipe entrará em
              contato.
            </p>
          </div>
          <textarea
            value={supportMessage}
            onChange={e => setSupportMessage(e.target.value)}
            placeholder="Escreva sua mensagem aqui..."
            className="w-full h-48 p-6 bg-gray-50 rounded-3xl font-medium outline-none focus:ring-2 focus:ring-orange-100 resize-none"
          />
        </div>
        <div className="p-8 border-t">
          <button
            onClick={handleSendSupport}
            disabled={loading || !supportMessage.trim()}
            className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-50"
          >
            {loading ? <Loader className="animate-spin mx-auto" /> : 'Enviar Mensagem'}
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'HUB') {
    const profile = currentUserProfile;
    return (
      <div className="flex flex-col h-full bg-white overflow-y-auto no-scrollbar animate-in fade-in duration-500">
        <div className="flex justify-end p-6 shrink-0">
          <button
            onClick={onClose}
            className="p-2 bg-gray-50 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-8 pb-12 flex flex-col items-center flex-1 justify-center">
          {profile ? (
            <div className="text-center w-full max-w-sm">
              <div className="relative group mb-6">
                <div className="w-24 h-24 bg-orange-50 rounded-[2.5rem] flex items-center justify-center mx-auto text-orange-600 shadow-inner overflow-hidden border-4 border-white">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-full h-full object-cover" />
                  ) : (
                    <User size={40} />
                  )}
                </div>
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-1/2 translate-x-12 bg-gray-950 text-white p-2 rounded-xl shadow-lg border-2 border-white hover:scale-110 transition-all"
                >
                  <Camera size={14} />
                </button>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-1">{profile.name}</h2>
              <p className="text-xs font-bold text-gray-400 mb-8 uppercase tracking-widest">
                {profile.email}
              </p>
              <div className="space-y-4">
                <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 text-left">
                  <div className="flex justify-between items-center text-xs font-bold mb-3">
                    <span className="text-gray-400 uppercase text-[9px]">Status da Conta</span>
                    <span
                      className={`px-3 py-1 rounded-full shadow-sm text-[9px] font-black ${profile.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}
                    >
                      {profile.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-gray-400 uppercase text-[9px]">Tipo</span>
                    <span className="text-gray-900 font-black">{profile.role}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setName(profile.name);
                      setPhone(profile.phoneNumber || '');
                      setCpf(profile.cpf || '');
                      setCnpj(profile.cnpj || '');
                      setBirthDate(profile.birthDate || '');
                      setBusinessName(profile.businessName || '');
                      setPixKey(profile.pixKey || '');
                      setVehicleType(profile.vehicleType || 'Moto');
                      setLicensePlate(profile.licensePlate || '');
                      setDescription(profile.description || '');
                      setWorkingHours(profile.workingHours || '');
                      setMode('EDIT_PROFILE');
                    }}
                    className="py-4 bg-white border-2 border-gray-100 text-gray-700 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit2 size={14} /> Perfil
                  </button>
                  <button
                    onClick={() => setMode('SUPPORT')}
                    className="py-4 bg-white border-2 border-gray-100 text-gray-700 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Info size={14} /> Suporte
                  </button>
                </div>
                <button
                  onClick={signOut}
                  className="w-full py-5 bg-white border-2 border-gray-100 text-gray-400 rounded-[2rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                >
                  Sair da Conta
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full py-2 text-red-300 hover:text-red-500 font-bold text-[9px] uppercase tracking-widest transition-colors"
                >
                  Excluir minha conta
                </button>
                {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-xs text-center">
              <div className="w-28 h-28 mb-10 mx-auto drop-shadow-xl">
                <img src={Logo} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <img src={Nome} alt="DeliveryCity" className="h-7 mb-2 mx-auto opacity-90" />
              <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.3em] mb-12">
                Sua cidade, seu delivery
              </p>
              <div className="space-y-3">
                {/* Botão Google */}
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 py-[18px] rounded-2xl font-bold text-[13px] text-gray-700 shadow-sm active:scale-95 transition-all"
                >
                  {loading ? (
                    <Loader size={18} className="animate-spin text-gray-400" />
                  ) : (
                    <GoogleIcon />
                  )}
                  <span>Continuar com Google</span>
                </button>

                {/* Divisor */}
                <div className="flex items-center gap-4 py-1">
                  <div className="h-px bg-gray-100 flex-1" />
                  <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">
                    ou
                  </span>
                  <div className="h-px bg-gray-100 flex-1" />
                </div>

                {/* Botão E-mail */}
                <button
                  onClick={() => setMode('LOGIN_EMAIL')}
                  className="w-full relative overflow-hidden bg-gradient-to-r from-orange-500 to-orange-600 text-white py-[18px] rounded-2xl font-black text-[12px] uppercase tracking-[0.18em] shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <Mail size={16} className="opacity-80" />
                  E-mail e Senha
                </button>

                {/* Botão Criar Conta */}
                <button
                  onClick={() => {
                    setPartnerType(UserRole.CLIENT);
                    setMode('REGISTER_EMAIL');
                  }}
                  className="w-full bg-gray-900 text-white py-[18px] rounded-2xl font-black text-[12px] uppercase tracking-[0.18em] active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-gray-800"
                >
                  <UserPlus size={16} className="opacity-70" />
                  Criar Conta Grátis
                </button>
              </div>
              <div className="mt-10 pt-8 border-t flex flex-col items-center">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-6">
                  Trabalhe conosco
                </p>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button
                    onClick={() => {
                      setPartnerType(UserRole.DRIVER);
                      setMode('REGISTER_PARTNER');
                    }}
                    className="flex flex-col items-center gap-2 p-5 bg-gray-50 rounded-2xl hover:bg-orange-50 group transition-all"
                  >
                    <Truck className="text-gray-400 group-hover:text-orange-600" />
                    <span className="text-[9px] font-black uppercase">Entregador</span>
                    <span className="text-[7px] text-gray-400 font-bold uppercase">
                      Ganhe dinheiro
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setPartnerType(UserRole.RESTAURANT);
                      setMode('REGISTER_PARTNER');
                    }}
                    className="flex flex-col items-center gap-2 p-5 bg-gray-50 rounded-2xl hover:bg-orange-50 group transition-all"
                  >
                    <Store className="text-gray-400 group-hover:text-orange-600" />
                    <span className="text-[9px] font-black uppercase">Lojista</span>
                    <span className="text-[7px] text-gray-400 font-bold uppercase">Venda mais</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentRoleType =
    mode === 'REGISTER_PARTNER' ? partnerType : currentUserProfile?.role || UserRole.CLIENT;

  // Tela de login por e-mail dedicada e simplificada
  if (mode === 'LOGIN_EMAIL') {
    return (
      <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-300 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
          <button
            onClick={() => setMode('HUB')}
            className="p-2.5 bg-gray-50 text-gray-900 rounded-xl active:scale-90 transition-all"
          >
            <ChevronLeft size={22} />
          </button>
          <h2 className="text-lg font-black tracking-tighter">Entrar na Conta</h2>
          <button onClick={onClose} className="p-2 text-gray-400">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-6">
          {errors.auth && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-black text-center border border-red-100">
              {errors.auth}
            </div>
          )}
          <div className="space-y-4">
            <div className="relative">
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                placeholder="Seu e-mail"
                autoComplete="email"
                className={`w-full p-5 bg-gray-50 rounded-[1.5rem] font-bold outline-none border-2 transition-all ${errors.email ? 'border-red-200 bg-red-50' : 'border-transparent focus:border-orange-200 focus:bg-white focus:shadow-lg'}`}
              />
              <Mail className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            </div>
            <div className="relative">
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type={showPasswordLogin ? 'text' : 'password'}
                placeholder="Sua senha"
                autoComplete="current-password"
                className={`w-full p-5 bg-gray-50 rounded-[1.5rem] font-bold outline-none border-2 transition-all ${errors.password ? 'border-red-200 bg-red-50' : 'border-transparent focus:border-orange-200 focus:bg-white focus:shadow-lg'}`}
              />
              <button
                type="button"
                onClick={() => setShowPasswordLogin(v => !v)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              >
                {showPasswordLogin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button
            onClick={() => setMode('FORGOT_PASSWORD')}
            className="text-left text-[10px] font-bold text-orange-600 uppercase tracking-widest -mt-2 px-2"
          >
            Esqueci minha senha
          </button>

          <button
            onClick={handleEmailLogin}
            disabled={loading}
            className="w-full py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 bg-orange-600 text-white shadow-orange-200 mt-2"
          >
            {loading ? (
              <Loader className="animate-spin" size={22} />
            ) : (
              <>
                <Lock size={18} /> Entrar no App
              </>
            )}
          </button>

          <div className="flex items-center gap-4 py-2">
            <div className="h-px bg-gray-100 flex-1" />
            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">
              ou
            </span>
            <div className="h-px bg-gray-100 flex-1" />
          </div>

          <button
            onClick={() => {
              setPartnerType(UserRole.CLIENT);
              setMode('REGISTER_EMAIL');
            }}
            className="w-full py-[18px] rounded-2xl border-2 border-gray-100 text-gray-600 font-black text-[12px] uppercase tracking-[0.18em] active:scale-95 transition-all flex items-center justify-center gap-3 hover:border-orange-100 hover:text-orange-600 hover:bg-orange-50"
          >
            <UserPlus size={16} /> Criar nova conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
        <button
          onClick={() => setMode('HUB')}
          className="p-2.5 bg-gray-50 text-gray-900 rounded-xl active:scale-90 transition-all"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-lg font-black tracking-tighter">
          {mode === 'COMPLETE_PROFILE'
            ? 'Completar Perfil'
            : mode === 'EDIT_PROFILE'
              ? 'Editar Perfil'
              : mode === 'REGISTER_PARTNER'
                ? partnerType === UserRole.DRIVER
                  ? 'Cadastro Entregador'
                  : 'Cadastro Lojista'
                : 'Cadastro'}
        </h2>
        <button onClick={onClose} className="p-2 text-gray-400">
          <X size={24} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 no-scrollbar pb-40">
        {mode === 'COMPLETE_PROFILE' && (
          <div className="p-5 bg-orange-50 border border-orange-100 rounded-3xl flex items-center gap-4">
            <AlertCircle className="text-orange-600 shrink-0" size={24} />
            <p className="text-[11px] font-bold text-orange-900 uppercase leading-relaxed">
              Precisamos de alguns dados adicionais para garantir a sua segurança na plataforma.
            </p>
          </div>
        )}
        {errors.auth && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-black text-center border border-red-100">
            {errors.auth}
          </div>
        )}

        <div className="space-y-8">
          {/* SEÇÃO 1: DADOS PESSOAIS */}
          <div className="space-y-5">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <User size={18} />
              </div>
              <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
                Dados Pessoais
              </h4>
            </div>
            <div className="space-y-4">
              <div className="relative group">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nome Completo"
                  className={`w-full p-5 bg-gray-50 rounded-[1.5rem] font-bold outline-none border-2 transition-all ${errors.name ? 'border-red-100 bg-red-50/30' : 'border-transparent focus:border-blue-100 focus:bg-white focus:shadow-lg focus:shadow-blue-900/5'}`}
                />
                {errors.name && (
                  <p className="text-red-500 text-[10px] font-black mt-2 pl-4">{errors.name}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="WhatsApp"
                    className={`w-full p-5 bg-gray-50 rounded-[1.5rem] font-bold outline-none border-2 transition-all ${errors.phone ? 'border-red-100 bg-red-50/30' : 'border-transparent focus:border-blue-100 focus:bg-white'}`}
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-[9px] font-black mt-1 pl-2">{errors.phone}</p>
                  )}
                </div>
                <div>
                  <input
                    value={cpf}
                    onChange={e => setCpf(formatCpfCnpj(e.target.value))}
                    placeholder="CPF"
                    className={`w-full p-5 bg-gray-50 rounded-[1.5rem] font-bold outline-none border-2 transition-all ${errors.cpf ? 'border-red-100 bg-red-50/30' : 'border-transparent focus:border-blue-100 focus:bg-white'}`}
                  />
                  {errors.cpf && (
                    <p className="text-red-500 text-[9px] font-black mt-1 pl-2">{errors.cpf}</p>
                  )}
                </div>
              </div>
              {currentRoleType !== UserRole.RESTAURANT && (
                <div>
                  <div className="relative">
                    <input
                      value={birthDate}
                      onChange={e => setBirthDate(formatDate(e.target.value))}
                      placeholder="Nascimento (DD/MM/AAAA)"
                      className={`w-full p-5 bg-gray-50 rounded-[1.5rem] font-bold outline-none border-2 transition-all ${errors.birthDate ? 'border-red-100 bg-red-50/30' : 'border-transparent focus:border-blue-100 focus:bg-white'}`}
                    />
                    <Calendar
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300"
                      size={18}
                    />
                  </div>
                  {errors.birthDate && (
                    <p className="text-red-500 text-[10px] font-black mt-2 pl-4">
                      {errors.birthDate}
                    </p>
                  )}
                </div>
              )}
              {!isCompletingOrEditing && (
                <div className="space-y-4 pt-2">
                  <div>
                    <div className="relative">
                      <input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        type="email"
                        placeholder="Seu E-mail"
                        className={`w-full p-5 bg-gray-50 rounded-[1.5rem] font-bold outline-none border-2 transition-all ${errors.email ? 'border-red-100 bg-red-50/30' : 'border-transparent focus:border-blue-100 focus:bg-white'}`}
                      />
                      <Mail
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300"
                        size={18}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-500 text-[10px] font-black mt-2 pl-4">
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="relative">
                      <input
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        type={showPasswordLogin ? 'text' : 'password'}
                        placeholder="Senha de Acesso"
                        className={`w-full p-5 bg-gray-50 rounded-[1.5rem] font-bold outline-none border-2 transition-all ${errors.password ? 'border-red-100 bg-red-50/30' : 'border-transparent focus:border-blue-100 focus:bg-white'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordLogin(v => !v)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                      >
                        {showPasswordLogin ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-red-500 text-[10px] font-black mt-2 pl-4">
                        {errors.password}
                      </p>
                    )}
                  </div>
                  {(mode as AuthMode) !== 'LOGIN_EMAIL' && (
                    <div>
                      <div className="relative">
                        <input
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirmar Senha"
                          className={`w-full p-5 bg-gray-50 rounded-[1.5rem] font-bold outline-none border-2 transition-all ${errors.confirmPassword ? 'border-red-100 bg-red-50/30' : 'border-transparent focus:border-blue-100 focus:bg-white'}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(v => !v)}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-red-500 text-[10px] font-black mt-2 pl-4">
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO 2: DADOS DA LOJA (SOMENTE LOJISTA) */}
          {currentRoleType === UserRole.RESTAURANT && (
            <div className="space-y-5 pt-6 border-t border-gray-100">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Store size={18} />
                </div>
                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Dados da Sua Loja
                </h4>
              </div>
              <div className="space-y-4">
                {isCompletingOrEditing && (
                  <input
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="Nome Fantasia da Loja"
                    className="w-full p-5 bg-orange-50/30 rounded-[1.5rem] font-black border-2 border-transparent focus:border-orange-100 focus:bg-white"
                  />
                )}
                <input
                  value={cnpj}
                  onChange={e => setCnpj(formatCpfCnpj(e.target.value))}
                  placeholder="CNPJ da Empresa (Opcional)"
                  className={`w-full p-5 bg-orange-50/30 rounded-[1.5rem] font-bold border-2 transition-all ${errors.cnpj ? 'border-red-100 bg-red-50/30' : 'border-transparent focus:border-orange-100 focus:bg-white'}`}
                />

                {isCompletingOrEditing && (
                  <>
                    <div className="flex gap-3">
                      <div className="w-full relative">
                        <input
                          value={workingHours}
                          onChange={e => setWorkingHours(e.target.value)}
                          placeholder="Horário (ex: 08h às 22h)"
                          className="w-full p-5 bg-orange-50/30 rounded-[1.5rem] font-bold outline-none border-2 border-transparent focus:border-orange-100 focus:bg-white"
                        />
                        <Clock
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-orange-200"
                          size={18}
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Breve descrição da loja e especialidades..."
                        className="w-full p-5 bg-orange-50/30 rounded-[1.5rem] font-bold outline-none border-2 border-transparent focus:border-orange-100 focus:bg-white h-28 resize-none shadow-inner"
                      />
                      <AlignLeft className="absolute right-5 top-5 text-orange-200" size={18} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO 3: REPASSES E PROFISSIONAL (ENTREGADOR / LOJISTA) */}
          {(currentRoleType === UserRole.DRIVER || currentRoleType === UserRole.RESTAURANT) && (
            <div className="p-8 bg-gradient-to-br from-purple-50 to-white rounded-[2.5rem] border-2 border-purple-100 space-y-6 shadow-xl shadow-purple-900/5 animate-in slide-in-from-top-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                  <Wallet size={16} />
                </div>
                <h4 className="text-[11px] font-black text-purple-900 uppercase tracking-widest">
                  {currentRoleType === UserRole.DRIVER ? 'Financeiro & Veículo' : 'Financeiro'}
                </h4>
              </div>

              <div className="space-y-4">
                {currentRoleType === UserRole.DRIVER && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <select
                        value={vehicleType}
                        onChange={e => setVehicleType(e.target.value)}
                        className="w-full p-5 bg-white rounded-2xl font-black border-2 border-purple-100 appearance-none outline-none focus:ring-4 focus:ring-purple-100 transition-all text-sm"
                      >
                        <option>Moto</option>
                        <option>Bicicleta</option>
                        <option>Carro</option>
                      </select>
                      <ChevronRight
                        className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-purple-300"
                        size={16}
                      />
                    </div>
                    <input
                      value={licensePlate}
                      onChange={e => setLicensePlate(e.target.value.toUpperCase())}
                      placeholder="Placa (Opcional)"
                      className="w-full p-5 bg-white rounded-2xl font-bold border-2 border-purple-100 outline-none focus:ring-4 focus:ring-purple-100 uppercase"
                    />
                  </div>
                )}

                <div className="relative">
                  <input
                    value={pixKey}
                    onChange={e => setPixKey(e.target.value)}
                    placeholder="Chave PIX para Recebimento"
                    className="w-full p-5 bg-white rounded-2xl font-black border-2 border-purple-100 outline-none focus:ring-4 focus:ring-purple-100"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-purple-200 flex items-center gap-1 font-black text-[8px] uppercase tracking-widest">
                    Pix
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SEÇÃO 4: LOCALIZAÇÃO */}
          {mode === 'REGISTER_PARTNER' && (
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3 px-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                  <MapPin size={18} />
                </div>
                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  {currentRoleType === UserRole.RESTAURANT
                    ? 'Endereço da Loja'
                    : 'Ponto de Partida'}
                </h4>
              </div>

              <button
                onClick={() => setShowAddressModal(true)}
                className={`w-full p-6 rounded-[2.5rem] font-black text-[11px] uppercase tracking-[0.2em] border-2 border-dashed transition-all active:scale-95 flex items-center justify-center gap-3 ${regAddress ? 'bg-green-600 text-white border-transparent shadow-xl shadow-green-900/20' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100/50'}`}
              >
                {regAddress ? (
                  <>
                    <CheckCircle2 size={20} className="animate-in zoom-in" /> Localização
                    Cadastrada!
                  </>
                ) : (
                  <>
                    <MapPin size={20} />{' '}
                    {currentRoleType === UserRole.RESTAURANT
                      ? 'Toque para definir o endereço'
                      : 'Toque para definir sua área'}
                  </>
                )}
              </button>
            </div>
          )}

          {!isCompletingOrEditing && (mode as AuthMode) !== 'LOGIN_EMAIL' && (
            <div>
              <div
                className={`flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-[1.5rem] border ${errors.terms ? 'border-red-200' : 'border-gray-100'}`}
              >
                <input
                  type="checkbox"
                  id="terms-check"
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  className="w-5 h-5 accent-orange-600 rounded-lg cursor-pointer"
                />
                <label
                  htmlFor="terms-check"
                  className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed"
                >
                  Li e concordo plenamente com os{' '}
                  <button
                    onClick={() => {
                      setPreviousMode(mode);
                      setMode('TERMS');
                    }}
                    className="text-orange-600 underline font-black"
                  >
                    Termos de Uso
                  </button>
                </label>
              </div>
              {errors.terms && (
                <p className="text-red-500 text-[10px] font-black mt-2 text-center">
                  {errors.terms}
                </p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={
            (mode as AuthMode) === 'LOGIN_EMAIL'
              ? handleEmailLogin
              : isCompletingOrEditing
                ? handleUpdateProfile
                : handleRegister
          }
          disabled={loading}
          className={`w-full py-7 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all disabled:opacity-50 ${(mode as AuthMode) === 'LOGIN_EMAIL' || mode === 'REGISTER_EMAIL' || mode === 'COMPLETE_PROFILE' || mode === 'EDIT_PROFILE' ? 'bg-orange-600 text-white shadow-orange-900/20' : partnerType === UserRole.DRIVER ? 'bg-green-600 text-white shadow-green-900/20' : 'bg-gray-950 text-white shadow-black/20'}`}
        >
          {loading ? (
            <Loader className="animate-spin" size={24} />
          ) : (mode as AuthMode) === 'LOGIN_EMAIL' ? (
            'Entrar no App'
          ) : isCompletingOrEditing ? (
            'Atualizar meu Perfil'
          ) : mode === 'REGISTER_PARTNER' ? (
            'Finalizar meu Cadastro'
          ) : (
            'Criar minha Conta'
          )}
          <ChevronRight size={20} />
        </button>
      </div>
      {showAddressModal && (
        <AddressModal
          onSave={addr => {
            setRegAddress(addr);
            setShowAddressModal(false);
          }}
          onClose={() => setShowAddressModal(false)}
        />
      )}
    </div>
  );
};
