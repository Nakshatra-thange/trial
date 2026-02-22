import process from 'process';
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SolanaWalletProvider from "./providers/WalletProvider";
import { Buffer } from 'buffer';
window.Buffer = Buffer;
window.process = process;
globalThis.Buffer = Buffer;

import { BrowserRouter } from 'react-router-dom'


createRoot(document.getElementById('root')!).render(
  
    <BrowserRouter>
  <SolanaWalletProvider>
    
       < App />
  
</SolanaWalletProvider>
</BrowserRouter>
  
  
)
