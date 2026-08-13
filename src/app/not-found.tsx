import Link from 'next/link';
import { EstadoVazio } from '@/componentes/ui';

export default function NaoEncontrado() {
  return (
    <EstadoVazio
      titulo="Recurso não encontrado"
      descricao="O recurso não existe ou não está disponível para o seu perfil nesta organização. Por segurança, o sistema não distingue os dois casos."
      acao={
        <Link href="/" className="botao-primario">
          Voltar ao portfólio
        </Link>
      }
    />
  );
}
