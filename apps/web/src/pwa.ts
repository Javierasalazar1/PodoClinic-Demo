import { registerSW } from 'virtual:pwa-register'

export const setupPWA = () => {
  const updateSW = registerSW({
    onNeedRefresh() {
      // In a real app we might show a toast to ask the user to reload
      if (confirm('Nueva versión disponible. ¿Recargar para actualizar?')) {
        updateSW(true)
      }
    },
    onOfflineReady() {
      console.log('App ready to work offline')
    },
  })
}
