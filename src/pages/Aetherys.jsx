import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Sparkles, Plus, X, ArrowLeft, Check,
  Ghost, Moon, Waves, Link2, Dices, BrainCircuit, Feather, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import { hasAuthority } from "@/utils/auth";

const FontImports = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap');
    .font-display { font-family: 'Cinzel', serif; }
    .font-body { font-family: 'Cormorant Garamond', serif; }
    .font-mono-ieji { font-family: 'JetBrains Mono', monospace; }
  `}</style>
);

// Ícones sugeridos por nome, só para dar identidade visual às entradas do Codex
const iconFor = (nome = "") => {
  const n = nome.toLowerCase();
  if (n.includes("eco")) return Ghost;
  if (n.includes("voz")) return Waves;
  if (n.includes("sussurro") || n.includes("sombra")) return Moon;
  if (n.includes("corda") || n.includes("destino")) return Link2;
  if (n.includes("caos") || n.includes("fio")) return Dices;
  if (n.includes("labirinto") || n.includes("mente")) return BrainCircuit;
  return Sparkles;
};

const Aetherys = () => {
  const [lista, setLista] = useState([]);
  const [selecionadoId, setSelecionadoId] = useState(() => localStorage.getItem("aetherysSelecionado"));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const podeDeletar = hasAuthority("admin::write");

  const handleDelete = async (id) => {
    if (!window.confirm("Remover este Aetherys do Codex? Essa ação não pode ser desfeita.")) return;
    try {
      await api.delete(`/aetherys/${id}`);
      setLista((prev) => prev.filter((a) => a.id !== id));
      if (selecionadoId === String(id)) {
        setSelecionadoId(null);
        localStorage.removeItem("aetherysSelecionado");
      }
    } catch (error) {
      console.error("Erro ao deletar Aetherys:", error);
      alert("Não foi possível remover este Aetherys.");
    }
  };

  const fetchAetherys = async () => {
    try {
      const response = await api.get("/aetherys");
      setLista(response.data);
    } catch (error) {
      console.error("Erro ao buscar Aetherys:", error);
    }
  };

  useEffect(() => { fetchAetherys(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const form = e.target;
    const nome = form.elements.namedItem("nome").value;
    const funcao = form.elements.namedItem("funcao").value;
    const testeExigido = form.elements.namedItem("testeExigido").value;

    setIsSaving(true);
    try {
      const response = await api.post("/aetherys", { nome, funcao, testeExigido });
      setLista((prev) => [...prev, response.data]);
      setIsModalOpen(false);
      form.reset();
    } catch (error) {
      console.error("Erro ao criar Aetherys:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelect = (id) => {
    const value = String(id);
    setSelecionadoId(value);
    localStorage.setItem("aetherysSelecionado", value);
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0A0D] font-body relative">
      <FontImports />
      <div className="fixed inset-0 pointer-events-none opacity-[0.12] z-0"
           style={{ backgroundImage: 'radial-gradient(#3F8574 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

      <header className="sticky top-0 z-30 bg-[#15121A] border-b-2 border-[#3F8574]/40 px-4 md:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/personagem" className="w-9 h-9 rounded-full bg-[#3F8574] border-2 border-[#B99A4B] flex items-center justify-center shrink-0 hover:bg-[#7A1230] transition-colors">
            <ArrowLeft className="w-4 h-4 text-[#EAE0C4]" />
          </Link>
          <div>
            <h1 className="font-display font-bold text-lg text-[#EAE0C4] leading-none">AETHERYS</h1>
            <span className="font-mono-ieji text-[10px] text-[#3F8574] tracking-widest">O CODEX DO OUTRO LADO</span>
          </div>
        </div>
       {hasAuthority("manager::write") || hasAuthority("admin::write") ? (
  <Button onClick={() => setIsModalOpen(true)} className="bg-[#3F8574] text-[#EAE0C4] hover:bg-[#EAE0C4] hover:text-[#201A1E] border-2 border-[#0B0A0D] font-display font-bold gap-2 shadow-[3px_3px_0px_0px_#B99A4B]">
    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Novo Aetherys</span>
  </Button>
) : (
  <div /> // mantém o layout do header (justify-between) sem quebrar o espaçamento
)}
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10 relative z-10">
        <div className="mb-10 bg-[#15121A] border border-[#3F8574]/40 rounded-sm p-5 flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-[#B99A4B] shrink-0 mt-0.5" />
          <p className="font-body text-[#B4AC9A] text-base leading-snug">
            Seu Aetherys é a fonte do seu poder especial ligado ao paranormal. Escolher uma aetherys é um ato de responsabilidade, e um contrato irreversível.
          </p>
        </div>

        {lista.length === 0 ? (
          <div className="bg-[#EAE0C4] border-4 border-dashed border-[#3F8574] rounded-sm p-16 text-center">
            <Ghost className="w-10 h-10 text-[#3F8574] mx-auto mb-4" strokeWidth={1.3} />
            <p className="font-display font-bold text-xl text-[#201A1E]">O Codex está em branco</p>
            <p className="font-body text-[#5b5346] mt-1">Nenhum Aetherys foi registrado ainda. Seja o primeiro a escrever uma página.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {lista.map((a) => {
              const Icon = iconFor(a.nome);
              const isSelected = selecionadoId === String(a.id);
              return (
                <motion.div
                  key={a.id}
                  whileHover={{ y: -4 }}
                  className={`relative bg-[#EAE0C4] border-4 rounded-sm overflow-hidden shadow-[6px_6px_0px_0px_#0B0A0D] flex flex-col transition-all ${
                    isSelected ? "border-[#3F8574]" : "border-[#0B0A0D]"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 bg-[#3F8574] text-[#EAE0C4] rounded-full p-1 z-10">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className="bg-[#201A1E] px-5 py-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#3F8574]/20 border border-[#3F8574] flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-[#3F8574]" />
                        </div>
                        <h3 className="font-display font-bold text-lg text-[#EAE0C4] leading-tight truncate">{a.nome}</h3>
                      </div>
                      {podeDeletar && (
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="shrink-0 w-7 h-7 rounded-sm border border-[#7A1230] text-[#7A1230] hover:bg-[#7A1230] hover:text-[#EAE0C4] flex items-center justify-center transition-colors"
                          title="Remover Aetherys"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <p className="font-mono-ieji text-[10px] uppercase tracking-widest text-[#5b5346] mb-1">Função</p>
                    <p className="font-body text-[#201A1E] text-base leading-snug mb-4 flex-1">{a.funcao}</p>

                    <div className="flex items-center justify-between pt-3 border-t border-dashed border-[#B99A4B]">
                      <div>
                        <p className="font-mono-ieji text-[9px] uppercase text-[#5b5346]">Teste exigido</p>
                        <p className="font-mono-ieji text-sm font-semibold text-[#7A1230] flex items-center gap-1">
                          <Dices className="w-3.5 h-3.5" /> {a.testeExigido}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleSelect(a.id)}
                        disabled={isSelected}
                        className={`font-mono-ieji text-[10px] uppercase border-2 border-[#0B0A0D] rounded-sm ${
                          isSelected
                            ? "bg-[#3F8574] text-[#EAE0C4] cursor-default"
                            : "bg-transparent text-[#201A1E] hover:bg-[#0B0A0D] hover:text-[#EAE0C4]"
                        }`}
                      >
                        {isSelected ? "Vinculado" : "Vincular"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL: NOVO AETHERYS */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm p-6 shadow-[8px_8px_0px_0px_#3F8574] w-full max-w-md relative z-10">
              <div className="flex justify-between items-center mb-5 border-b-2 border-[#0B0A0D] pb-2">
                <h3 className="font-display font-bold text-2xl text-[#201A1E] flex items-center gap-2">
                  <Feather className="w-5 h-5" /> NOVA PÁGINA
                </h3>
                <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 hover:text-[#7A1230]" /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Nome do Aetherys</Label>
                  <input name="nome" required className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-body text-sm" placeholder="Ex: Eco da Eternidade" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Função</Label>
                  <textarea name="funcao" rows={3} required className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-body text-sm resize-none" placeholder="O que esse poder permite fazer, dentro e fora de combate..." />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Teste exigido</Label>
                  <input name="testeExigido" required className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-mono-ieji text-sm" placeholder="Ex: Presença + 1d20" />
                </div>
                <div className="pt-3 flex justify-end gap-2">
                  <Button type="button" onClick={() => setIsModalOpen(false)} className="bg-transparent border-2 border-[#0B0A0D] font-mono-ieji text-xs">CANCELAR</Button>
                  <Button type="submit" disabled={isSaving} className="bg-[#3F8574] text-[#EAE0C4] border-2 border-[#0B0A0D] font-display font-bold">
                    {isSaving ? "SALVANDO..." : "REGISTRAR NO CODEX"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Aetherys;
