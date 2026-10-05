/**
 * Ponto de entrada da versão de arquivo único.
 *
 * Instala o desvio das rotas ANTES de montar a tela: se a tela subir primeiro,
 * uma chamada inicial pode escapar para a rede e falhar sem explicação.
 */
import { createRoot } from 'react-dom/client';
import PaginaColeta from '@/app/page';
import { instalarRotasLocais } from './rotasLocais';

instalarRotasLocais();

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado no documento.');

createRoot(raiz).render(<PaginaColeta />);
