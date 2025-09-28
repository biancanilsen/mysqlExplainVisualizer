declare global {
  interface Window {
    __onMermaidNodeClick: (id: string) => void;
  }
}


export {};