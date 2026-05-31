import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Intercepta o botão físico de voltar no Android.
 * O handler recebe o estado atual via ref — sem problema de closure estale.
 * Retorne `true` para indicar que o evento foi tratado (não propaga).
 * Retorne `false` ou `void` para deixar o comportamento padrão (fechar o app).
 */
export function useAndroidBack(handler: () => boolean | void) {
  const handlerRef = useRef(handler);

  // Mantém a ref sempre atualizada com o handler mais recente
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let pluginHandle: { remove: () => void } | null = null;

    App.addListener('backButton', () => {
      const handled = handlerRef.current();
      // Se o handler retornar false explicitamente, minimiza o app
      if (handled === false) App.minimizeApp();
    }).then(h => { pluginHandle = h; });

    return () => { pluginHandle?.remove(); };
  }, []); // registra uma vez — a ref cuida das atualizações
}
