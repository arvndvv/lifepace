export function useRegisterSW() {
  return {
    needRefresh: { value: false },
    offlineReady: { value: false },
    updateServiceWorker: async () => undefined
  };
}
