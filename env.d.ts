// eslint-disable-next-line spaced-comment
/// <reference types="vite/client" />

declare module 'vatex' {
  import type { App } from 'vue'
  const VueLatex: {
    install: (app: App) => void
  }
  export default VueLatex
}
