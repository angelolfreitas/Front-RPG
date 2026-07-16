import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wind, Dumbbell, BrainCircuit, Eye, HeartPulse, Sparkles,
  Save, Edit3, ScrollText, Skull, Shield, Zap, Ghost,
  Backpack, BookOpen, LogOut, X, Check, Search, Menu
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import { useStompClient } from "@/hooks/useStompClient";
// Certo — import default
import ImagemUploader, { RetratoElegante } from "@/components/ImagemUploader";
import { hasAuthority } from "@/utils/auth";
import { ShieldPlus } from "lucide-react";
import { resetIOSZoom } from "@/utils/resetZoom";


const FontImports = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap');
    .font-display { font-family: 'Cinzel', serif; }
    .font-body { font-family: 'Cormorant Garamond', serif; }
    .font-mono-ieji { font-family: 'JetBrains Mono', monospace; }
  `}</style>
);

const ATTRS = [
  { key: "agilidade", label: "Agilidade", short: "AGI", icon: Wind },
  { key: "forca", label: "Força", short: "FOR", icon: Dumbbell },
  { key: "intelecto", label: "Intelecto", short: "INT", icon: BrainCircuit },
  { key: "presenca", label: "Presença", short: "PRE", icon: Eye },
  { key: "vigor", label: "Vigor", short: "VIG", icon: HeartPulse },
];

const EMPTY = {
  id: null,
  usuarioId: null,
  nome: "",
  imagemUrl: "",
  aparencia: "",
  personalidade: "",
  historico: "",
  objetivo: "",
  agilidade: 1,
  forca: 1,
  intelecto: 1,
  presenca: 1,
  vigor: 1,
  nex: 5,
  pvAtual: 11,
  pvMaximo: 11,
  sanAtual: 11,
  sanMaxima: 11,
  peAtual: 11,
  peMaximo: 11,
  defesa: 11,
};

const StatBar = ({ label, atual, maximo, color, icon: Icon }) => {
  const pct = maximo > 0 ? Math.max(0, Math.min(100, (atual / maximo) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="font-mono-ieji text-[10px] uppercase tracking-widest text-[#201A1E] flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" /> {label}
        </span>
        <span className="font-mono-ieji text-xs font-semibold text-[#201A1E]">{atual} / {maximo}</span>
      </div>
      <div className="h-3 w-full bg-[#0B0A0D]/10 rounded-sm border border-[#0B0A0D] overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

const FichaPersonagem = () => {
  const [personagens, setPersonagens] = useState([]);
  const [personagemAtivoId, setPersonagemAtivoId] = useState(null);
  const [personagem, setPersonagem] = useState(EMPTY);
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avisoBatalha, setAvisoBatalha] = useState(null);

  const idCasoAtivo = localStorage.getItem("idCasoAtivo");
  const stompClient = useStompClient(idCasoAtivo);
  const [isDeletando, setIsDeletando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
  resetIOSZoom();
  }, []);


const handleDeletarPersonagem = async () => {
  if (!personagemAtivoId) return;


  setIsDeletando(true);
  try {
    await api.delete(`/personagem/${personagemAtivoId}`);
    const restantes = personagens.filter((p) => p.id !== personagemAtivoId);
    setPersonagens(restantes);

    if (restantes.length > 0) {
      setPersonagem(restantes[0]);
      setPersonagemAtivoId(restantes[0].id);
      localStorage.setItem("personagemSelecionadoId", String(restantes[0].id));
      setEditMode(false);
    } else {
      setPersonagem(EMPTY);
      setPersonagemAtivoId(null);
      localStorage.removeItem("personagemSelecionadoId");
      setEditMode(true);
    }
  } catch (error) {
    console.error("Erro ao deletar personagem:", error);
  } finally {
    setIsDeletando(false);
  }
};

  useEffect(() => {
    if (!stompClient?.connected || !idCasoAtivo) return undefined;
    const subscription = stompClient.subscribe(`/topic/caso/${idCasoAtivo}/batalha`, (message) => {
      const monstro = JSON.parse(message.body);
      setAvisoBatalha(monstro.nome);
    });
    return () => subscription.unsubscribe();
  }, [stompClient, idCasoAtivo]);

  const fetchPersonagens = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/personagem/meu");
      const lista = Array.isArray(response.data) ? response.data : [];
      setPersonagens(lista);
      if (lista.length > 0) {
          // tenta restaurar a última seleção salva; senão cai no primeiro da lista
          const salvoId = localStorage.getItem("personagemSelecionadoId");
          const alvo = lista.find((p) => String(p.id) === salvoId) || lista[0];
          setPersonagem(alvo);
          setPersonagemAtivoId(alvo.id);
          localStorage.setItem("personagemSelecionadoId", String(alvo.id));
          setEditMode(false);
        } else {
        setPersonagem(EMPTY);
        setPersonagemAtivoId(null);
        setEditMode(true);
      }
    } catch (error) {
      console.error("Erro ao buscar personagens:", error);
      setEditMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPersonagens(); }, []);

  const selecionarPersonagem = (id) => {
  const alvo = personagens.find((p) => p.id === id);
  if (alvo) {
    setPersonagem(alvo);
    setPersonagemAtivoId(id);
    localStorage.setItem("personagemSelecionadoId", String(id));
    setEditMode(false);
  }
};

  const iniciarNovoPersonagem = () => {
    setPersonagem(EMPTY);
    setPersonagemAtivoId(null);
    setEditMode(true);
  };

  // Pontos de atributo: começa tudo em 1, 4 pontos para distribuir, máximo inicial 3 (regra da Parte 1)
  const pointsSpent = useMemo(
    () => ATTRS.reduce((sum, a) => sum + (personagem[a.key] - 1), 0),
    [personagem]
  );

  const handleAttrChange = (key, delta) => {
    setPersonagem((prev) => {
      const next = Math.max(0, Math.min(5, prev[key] + delta));
      return { ...prev, [key]: next };
    });
  };

  const handleFieldChange = (key, value) => {
    setPersonagem((prev) => ({ ...prev, [key]: value }));
  };

  const recalcSuggested = () => ({
    pvMaximo: 10 + Number(personagem.vigor || 0),
    sanMaxima: 10 + Number(personagem.intelecto || 0),
    peMaximo: 10 + Number(personagem.presenca || 0),
    defesa: 10 + Number(personagem.agilidade || 0),
  });

  const applySuggested = () => {
    const s = recalcSuggested();
    setPersonagem((prev) => ({
      ...prev,
      pvMaximo: s.pvMaximo,
      pvAtual: s.pvMaximo,
      sanMaxima: s.sanMaxima,
      sanAtual: s.sanMaxima,
      peMaximo: s.peMaximo,
      peAtual: s.peMaximo,
      defesa: s.defesa,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const storedId = localStorage.getItem("usuarioId");
      const usuarioIdAtual = storedId ? Number(storedId) : null;

      if (!usuarioIdAtual) {
        console.error("usuarioId ausente — faça login novamente.");
        setIsSaving(false);
        return;
      }

      const isEdicaoExistente = Boolean(personagemAtivoId);
      const usuarioId = isEdicaoExistente ? personagem.usuarioId : usuarioIdAtual;
      const payload = { ...personagem, usuarioId };

      let response;
      if (isEdicaoExistente) {
        response = await api.put("/personagem", payload);
      } else {
        response = await api.post("/personagem", payload);
      }

      const salvo = response.data;
      setPersonagens((prev) => {
        const existe = prev.some((p) => p.id === salvo.id);
        return existe ? prev.map((p) => (p.id === salvo.id ? salvo : p)) : [...prev, salvo];
      });
      setPersonagem(salvo);
      setPersonagemAtivoId(salvo.id);
      localStorage.setItem("personagemSelecionadoId", String(salvo.id));
      setEditMode(false);
    } catch (error) {
      console.error("Erro ao salvar personagem:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0A0D] flex items-center justify-center">
        <FontImports />
        <span className="font-mono-ieji text-[#B99A4B] text-sm tracking-widest animate-pulse">CARREGANDO DOSSIÊ...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0B0A0D] font-body relative">
      <FontImports />
      <div className="fixed inset-0 pointer-events-none opacity-[0.12] z-0"
           style={{ backgroundImage: 'radial-gradient(#B99A4B 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

      {/* TOPBAR */}
      <header className="sticky top-0 z-30 bg-[#15121A] border-b-2 border-[#B99A4B]/40 px-4 md:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#7A1230] border-2 border-[#B99A4B] flex items-center justify-center shrink-0">
            <Skull className="w-4 h-4 text-[#EAE0C4]" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-[#EAE0C4] leading-none">FICHA DE AGENTE</h1>
            <span className="font-mono-ieji text-[10px] text-[#B99A4B] tracking-widest">INSTITUTO ELEONORA</span>
          </div>
        </div>
        <nav className="flex items-center gap-2">
  {hasAuthority("admin::write") && (
    <Link to="/admin/criar-usuario">
      <Button className="bg-transparent border border-[#7A1230]/50 text-[#EAE0C4] hover:bg-[#7A1230]/10 font-mono-ieji text-xs gap-2 hidden sm:flex">
        <ShieldPlus className="w-4 h-4" /> Novo Membro
      </Button>
    </Link>
  )}
  <Link to="/casos">
    <Button className="bg-[#7A1230]/20 border border-[#7A1230]/50 text-[#EAE0C4] hover:bg-[#7A1230] font-mono-ieji text-xs gap-2 hidden sm:flex transition-colors">
      <Search className="w-4 h-4" /> Investigar Caso
    </Button>
  </Link>
  <Link to="/inventario">
    <Button className="bg-transparent border border-[#B99A4B]/50 text-[#EAE0C4] hover:bg-[#B99A4B]/10 font-mono-ieji text-xs gap-2 hidden sm:flex">
      <Backpack className="w-4 h-4" /> Inventário
    </Button>
  </Link>
  <Link to="/bestiario">
    <Button className="bg-transparent border border-[#7A1230]/50 text-[#EAE0C4] hover:bg-[#7A1230]/10 font-mono-ieji text-xs gap-2 hidden sm:flex">
      <Skull className="w-4 h-4" /> Bestiário
    </Button>
  </Link>
  <Link to="/aetherys">
    <Button className="bg-transparent border border-[#3F8574]/50 text-[#EAE0C4] hover:bg-[#3F8574]/10 font-mono-ieji text-xs gap-2 hidden sm:flex">
      <BookOpen className="w-4 h-4" /> Aetherys
    </Button>
  </Link>
  <Link to="/login">
    <Button className="bg-transparent text-[#7A1230] hover:bg-[#7A1230]/10 font-mono-ieji text-xs gap-2 hidden sm:flex">
      <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sair</span>
    </Button>
  </Link>

  {/* Botão hambúrguer — só existe abaixo do breakpoint sm */}
  <button
    onClick={() => setMenuAberto((v) => !v)}
    className="sm:hidden w-9 h-9 rounded-full border-2 border-[#B99A4B]/50 flex items-center justify-center text-[#EAE0C4] hover:bg-[#B99A4B]/10"
    aria-label="Abrir menu"
  >
    {menuAberto ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
  </button>
</nav>
      </header>
      <AnimatePresence>
  {menuAberto && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="sm:hidden overflow-hidden bg-[#15121A] border-b-2 border-[#B99A4B]/40 relative z-30"
    >
      <div className="flex flex-col gap-2 px-4 py-3">
        {hasAuthority("admin::write") && (
          <Link to="/admin/criar-usuario" onClick={() => setMenuAberto(false)}>
            <Button className="w-full justify-start bg-transparent border border-[#7A1230]/50 text-[#EAE0C4] hover:bg-[#7A1230]/10 font-mono-ieji text-xs gap-2">
              <ShieldPlus className="w-4 h-4" /> Novo Membro
            </Button>
          </Link>
        )}
        <Link to="/casos" onClick={() => setMenuAberto(false)}>
          <Button className="w-full justify-start bg-[#7A1230]/20 border border-[#7A1230]/50 text-[#EAE0C4] hover:bg-[#7A1230] font-mono-ieji text-xs gap-2">
            <Search className="w-4 h-4" /> Investigar Caso
          </Button>
        </Link>
        <Link to="/inventario" onClick={() => setMenuAberto(false)}>
          <Button className="w-full justify-start bg-transparent border border-[#B99A4B]/50 text-[#EAE0C4] hover:bg-[#B99A4B]/10 font-mono-ieji text-xs gap-2">
            <Backpack className="w-4 h-4" /> Inventário
          </Button>
        </Link>
        <Link to="/bestiario" onClick={() => setMenuAberto(false)}>
          <Button className="w-full justify-start bg-transparent border border-[#7A1230]/50 text-[#EAE0C4] hover:bg-[#7A1230]/10 font-mono-ieji text-xs gap-2">
            <Skull className="w-4 h-4" /> Bestiário
          </Button>
        </Link>
        <Link to="/aetherys" onClick={() => setMenuAberto(false)}>
          <Button className="w-full justify-start bg-transparent border border-[#3F8574]/50 text-[#EAE0C4] hover:bg-[#3F8574]/10 font-mono-ieji text-xs gap-2">
            <BookOpen className="w-4 h-4" /> Aetherys
          </Button>
        </Link>
        <Link to="/login" onClick={() => setMenuAberto(false)}>
          <Button className="w-full justify-start bg-transparent text-[#7A1230] hover:bg-[#7A1230]/10 font-mono-ieji text-xs gap-2">
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </Link>
      </div>
    </motion.div>
  )}
</AnimatePresence>

      {/* SELETOR DE PERSONAGENS — carrossel horizontal, pensado para toque/mobile */}
      {personagens.length > 0 && (
        <div className="sticky top-[65px] z-20 bg-[#0B0A0D] border-b border-[#B99A4B]/20 px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 w-max min-w-full">
            {personagens.map((p) => (
              <button
                key={p.id}
                onClick={() => selecionarPersonagem(p.id)}
                className={`shrink-0 font-mono-ieji text-xs px-3 py-2 rounded-sm border-2 whitespace-nowrap transition-colors ${
                  personagemAtivoId === p.id
                    ? "bg-[#B99A4B] text-[#0B0A0D] border-[#0B0A0D]"
                    : "bg-transparent text-[#EAE0C4] border-[#EAE0C4]/30 hover:border-[#B99A4B]"
                }`}
              >
                {p.nome || "Sem nome"}
              </button>
            ))}
            <button
              onClick={iniciarNovoPersonagem}
              className="shrink-0 font-mono-ieji text-xs px-3 py-2 rounded-sm border-2 border-dashed border-[#3F8574] text-[#3F8574] hover:bg-[#3F8574]/10 whitespace-nowrap"
            >
              + Novo Agente
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10 relative z-10">

        {/* AVISO DE BATALHA */}
        <AnimatePresence>
          {avisoBatalha && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-[#7A1230] border-2 border-[#0B0A0D] rounded-sm px-4 py-3 flex items-center justify-between gap-3 shadow-[4px_4px_0px_0px_#0B0A0D]"
            >
              <span className="font-display font-bold text-sm sm:text-base text-[#EAE0C4] flex items-center gap-2">
                <Zap className="w-4 h-4 shrink-0" /> Seu grupo entrou em batalha com {avisoBatalha}!
              </span>
              <button onClick={() => setAvisoBatalha(null)} className="text-[#EAE0C4]/70 hover:text-[#EAE0C4] shrink-0">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HERO / IDENTIDADE */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div className="flex items-end gap-4 min-w-0 flex-1">
            {editMode ? (
              personagem.id ? (
                <ImagemUploader
                  tipo="personagem"
                  entidadeId={personagem.id}
                  imagemAtual={personagem.imagemUrl}
                  tamanho="lg"
                  onSucesso={(novaUrl) =>
                    setPersonagem((prev) => ({ ...prev, imagemUrl: novaUrl }))
                  }
                />
              ) : (
                <div className="w-20 h-24 sm:w-24 sm:h-28 shrink-0 flex flex-col items-center justify-center border-2 border-dashed border-[#B99A4B]/50 rounded-full text-center px-2">
                  <span className="font-mono-ieji text-[9px] text-[#B99A4B]/70 leading-tight">
                    Salve a ficha antes de enviar a foto
                  </span>
                </div>
              )
            ) : personagem.imagemUrl ? (
              <div className="w-20 h-24 sm:w-24 sm:h-28 shrink-0 rounded-full overflow-hidden border-4 border-[#B99A4B]">
                <img src={personagem.imagemUrl} alt={personagem.nome} className="w-full h-full object-cover object-top" />
              </div>
            ) : (
              <div className="w-20 h-24 sm:w-24 sm:h-28 shrink-0 rounded-full border-2 border-dashed border-[#B99A4B]/40 flex items-center justify-center">
                <Skull className="w-6 h-6 text-[#B99A4B]/40" />
              </div>
            )}

            {/* NOME DO PERSONAGEM */}
            <div className="min-w-0 flex-1">
              {editMode ? (
                <div className="space-y-1.5 max-w-xs">
                  <Label className="font-mono-ieji text-[10px] uppercase tracking-widest text-[#B99A4B]">
                    Nome do Estudante
                  </Label>
                  <input
                    type="text"
                    value={personagem.nome}
                    onChange={(e) => handleFieldChange("nome", e.target.value)}
                    placeholder="Digite seu nome..."
                    className="w-full bg-[#15121A] border-2 border-[#B99A4B] rounded-sm p-2.5 font-display font-bold text-lg text-[#EAE0C4] focus:outline-none focus:border-[#EAE0C4]"
                  />
                </div>
              ) : (
                <div className="flex flex-col">
                  {personagem.id && (
                    <span className="font-mono-ieji text-[10px] text-[#B99A4B] tracking-[0.2em] uppercase mb-1">
                      Dossiê N° {personagem.id}
                    </span>
                  )}
                  <h2 className="font-display font-bold text-4xl sm:text-5xl text-[#EAE0C4] uppercase tracking-widest drop-shadow-md truncate">
                    {personagem.nome || <span className="italic text-[#EAE0C4]/40">Agente sem nome</span>}
                  </h2>
                </div>
              )}
            </div>
          </div>
          {!editMode ? (
            <Button onClick={() => setEditMode(true)} className="bg-[#B99A4B] text-[#0B0A0D] hover:bg-[#EAE0C4] font-display font-bold gap-2 border-2 border-[#0B0A0D] shadow-[3px_3px_0px_0px_#7A1230]">
              <Edit3 className="w-4 h-4" /> EDITAR FICHA
            </Button>
            
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} className="bg-[#3F8574] text-[#EAE0C4] hover:bg-[#EAE0C4] hover:text-[#201A1E] font-display font-bold gap-2 border-2 border-[#0B0A0D] shadow-[3px_3px_0px_0px_#0B0A0D]">
                <Save className="w-4 h-4" /> {isSaving ? "SALVANDO..." : "SALVAR FICHA"}
              </Button>
              {personagemAtivoId && (
                <>
                  
                  <Button onClick={handleDeletarPersonagem} disabled={isDeletando} className="bg-transparent border-2 border-[#7A1230] text-[#7A1230] hover:bg-[#7A1230] hover:text-[#EAE0C4] font-mono-ieji text-xs gap-2">
                    <X className="w-4 h-4" /> {isDeletando ? "EXCLUINDO..." : "EXCLUIR"}
                  </Button>
                  <Button onClick={() => setEditMode(false)} className="bg-transparent text-[#EAE0C4] border-2 border-[#EAE0C4]/40 hover:bg-[#EAE0C4]/10 font-mono-ieji text-xs">
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COLUNA ESQUERDA: ATRIBUTOS */}
          <div className="lg:col-span-1 bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm p-6 shadow-[8px_8px_0px_0px_#7A1230] h-fit">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-display font-bold text-xl text-[#201A1E]">ATRIBUTOS</h3>
              <div className="bg-[#0B0A0D] text-[#B99A4B] font-mono-ieji text-[10px] px-2 py-1 rounded-sm">
                NEX {personagem.nex}%
              </div>
            </div>
            {editMode && (
              <p className={`font-mono-ieji text-[10px] mb-4 ${pointsSpent === 4 ? "text-[#3F8574]" : "text-[#7A1230]"}`}>
                {pointsSpent}/4 pontos distribuídos (base 1, máx. inicial 3)
              </p>
            )}

            <div className="space-y-3 mt-4">
              {ATTRS.map((a) => (
                <div key={a.key} className="flex items-center justify-between bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm px-3 py-2">
                  <div className="flex items-center gap-2">
                    <a.icon className="w-4 h-4 text-[#7A1230]" />
                    <div>
                      <div className="font-display font-bold text-sm text-[#201A1E] leading-none">{a.short}</div>
                      <div className="font-mono-ieji text-[9px] text-[#5b5346]">{a.label}</div>
                    </div>
                  </div>
                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleAttrChange(a.key, -1)} className="w-6 h-6 rounded-sm border border-[#0B0A0D] font-mono-ieji text-sm hover:bg-[#0B0A0D] hover:text-[#EAE0C4]">−</button>
                      <span className="font-mono-ieji font-bold w-5 text-center">{personagem[a.key]}</span>
                      <button onClick={() => handleAttrChange(a.key, 1)} className="w-6 h-6 rounded-sm border border-[#0B0A0D] font-mono-ieji text-sm hover:bg-[#0B0A0D] hover:text-[#EAE0C4]">+</button>
                    </div>
                  ) : (
                    <span className="font-mono-ieji font-bold text-lg text-[#201A1E]">{personagem[a.key]}<span className="text-xs text-[#5b5346]">({personagem[a.key]}d20)</span></span>
                  )}
                </div>
              ))}
            </div>

            {editMode && (
              <button onClick={applySuggested} className="mt-4 w-full font-mono-ieji text-[10px] uppercase tracking-wider text-[#7A1230] border border-dashed border-[#7A1230] rounded-sm py-2 hover:bg-[#7A1230]/10 flex items-center justify-center gap-2">
                <Zap className="w-3.5 h-3.5" /> Recalcular PV/SAN/PE/Defesa pelos atributos
              </button>
            )}
          </div>

          {/* COLUNA DIREITA: PONTOS DA FICHA + DESCRIÇÃO */}
          <div className="lg:col-span-2 space-y-6">

            <div className="bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm p-6 shadow-[8px_8px_0px_0px_#3F8574]">
              <h3 className="font-display font-bold text-xl text-[#201A1E] mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#7A1230]" /> PONTOS DA FICHA
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                <StatBar label="Pontos de Vida" atual={personagem.pvAtual} maximo={personagem.pvMaximo} color="#7A1230" icon={HeartPulse} />
                <StatBar label="Sanidade" atual={personagem.sanAtual} maximo={personagem.sanMaxima} color="#3F8574" icon={Ghost} />
                <StatBar label="Pontos de Esforço" atual={personagem.peAtual} maximo={personagem.peMaximo} color="#B99A4B" icon={Sparkles} />
                <div>
                  <span className="font-mono-ieji text-[10px] uppercase tracking-widest text-[#201A1E] flex items-center gap-1.5 mb-1">
                    <Shield className="w-3.5 h-3.5" /> Defesa
                  </span>
                  <div className="font-mono-ieji text-2xl font-bold text-[#201A1E]">{personagem.defesa}</div>
                </div>
              </div>

              {editMode && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-dashed border-[#B99A4B]">
                  {[
                    ["nex", "NEX %"], ["pvAtual", "PV atual"], ["pvMaximo", "PV máx"],
                    ["sanAtual", "SAN atual"], ["sanMaxima", "SAN máx"], ["peAtual", "PE atual"],
                    ["peMaximo", "PE máx"], ["defesa", "Defesa"],
                  ].map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <Label className="font-mono-ieji text-[9px] uppercase text-[#5b5346]">{label}</Label>
                      <input
                        type="number"
                        value={personagem[key]}
                        onChange={(e) => handleFieldChange(key, Number(e.target.value))}
                        className="w-full bg-[#F5EFDD] border border-[#0B0A0D] rounded-sm p-1.5 font-mono-ieji text-sm text-center focus:outline-none focus:border-[#7A1230]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm p-6 shadow-[8px_8px_0px_0px_#B99A4B]">
              <h3 className="font-display font-bold text-xl text-[#201A1E] mb-4 flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-[#7A1230]" /> DESCRIÇÃO
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  ["aparencia", "Aparência"], ["personalidade", "Personalidade"],
                  ["historico", "Histórico"], ["objetivo", "Objetivo"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="font-mono-ieji text-[10px] uppercase tracking-widest text-[#201A1E]">{label}</Label>
                    {editMode ? (
                      <textarea
                        value={personagem[key] || ""}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        rows={4}
                        className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-3 font-body text-[#201A1E] text-base focus:outline-none focus:border-[#7A1230] resize-none"
                        placeholder={`Descreva a ${label.toLowerCase()} do estudante...`}
                      />
                    ) : (
                      <p className="font-body text-[#201A1E] text-base leading-snug bg-[#F5EFDD] border border-[#0B0A0D]/30 rounded-sm p-3 min-h-[6rem]">
                        {personagem[key] || <span className="italic text-[#a89f8a]">Não preenchido.</span>}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FichaPersonagem;
