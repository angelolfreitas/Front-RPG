import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Skull, Users, X } from "lucide-react";
import ChatSessao from "@/components/ChatSessao.jsx";
import UsuariosSessao from "@/components/UsuariosSessao";

const FontImports = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap');
    .font-display { font-family: 'Cinzel', serif; }
    .font-body { font-family: 'Cormorant Garamond', serif; }
    .font-mono-ieji { font-family: 'JetBrains Mono', monospace; }
  `}</style>
);

const SessaoRPG = () => {
  const { id } = useParams();
  const [usuariosAbertos, setUsuariosAbertos] = useState(false);

  if (!id || id === "undefined") {
    return <div className="text-[#EAE0C4] flex items-center justify-center h-screen font-display">Sincronizando dossiê...</div>;
  }

  return (
    <div className="min-h-screen w-full bg-[#0B0A0D] font-body relative">
      <FontImports />
      <div className="fixed inset-0 pointer-events-none opacity-[0.12] z-0"
           style={{ backgroundImage: 'radial-gradient(#3F8574 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

      <header className="sticky top-0 z-30 bg-[#15121A] border-b-2 border-[#3F8574]/40 px-4 md:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/personagem" className="w-9 h-9 rounded-full bg-[#201A1E] border-2 border-[#3F8574] flex items-center justify-center shrink-0 hover:bg-[#3F8574] transition-colors">
            <ArrowLeft className="w-4 h-4 text-[#EAE0C4]" />
          </Link>
          <div>
            <h1 className="font-display font-bold text-lg text-[#EAE0C4] leading-none">MESA DE INVESTIGAÇÃO</h1>
            <span className="font-mono-ieji text-[10px] text-[#3F8574] tracking-widest">CASO ABERTO #{id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUsuariosAbertos(true)}
            className="sm:hidden w-9 h-9 rounded-full bg-[#201A1E] border-2 border-[#3F8574] flex items-center justify-center text-[#EAE0C4]"
            aria-label="Ver participantes"
          >
            <Users className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 rounded-full bg-[#7A1230] border-2 border-[#0B0A0D] flex items-center justify-center">
            <Skull className="w-4 h-4 text-[#EAE0C4]" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 relative z-10 flex flex-col sm:flex-row gap-6">
        {/* Desktop: sidebar fixa ao lado do chat */}
        <div className="hidden sm:block sm:w-64 shrink-0">
          <UsuariosSessao idCaso={id} />
        </div>

        {/* Mobile: gaveta lateral, só monta quando aberta */}
        {usuariosAbertos && (
          <div className="fixed inset-0 z-40 sm:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setUsuariosAbertos(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-xs bg-[#15121A] border-l-2 border-[#3F8574]/40 p-4 overflow-y-auto">
              <button onClick={() => setUsuariosAbertos(false)} className="mb-3 text-[#EAE0C4]">
                <X className="w-5 h-5" />
              </button>
              <UsuariosSessao idCaso={id} />
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <ChatSessao idCaso={id} />
        </div>
      </main>
    </div>
  );
};

export default SessaoRPG;