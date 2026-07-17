import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Skull, Minus, Plus, ShieldAlert, X, Feather, Trash2, Swords, Save, SkullIcon, Droplet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { hasAuthority } from "@/utils/auth";
import { useStompClient } from "@/hooks/useStompClient";
import ImagemUploader, { RetratoElegante } from "@/components/ImagemUploader";
import { api } from "@/services/api";

const EMPTY_EDIT = {
  id: null,
  nome: "",
  pv: 0,
  pvMaximo: 10,
  san: "",
  ataquesEspeciais: "",
  comportamento: "",
  fraquezas: "",
  imagemUrl: "",
  material: "CARNE",
  emBatalha: false,
  conhecido: false,
};

const MATERIAL_OPTIONS = ["CARNE", "ESPECTRAL"];

/**
 * Paleta/forma do efeito de impacto por material.
 * Adicione novas entradas aqui quando quiser mais materiais (ex.: METAL, PLANTA).
 */
const MATERIAL_CONFIG = {
  CARNE: { label: "Carne", corBase: ["#7A1230", "#4A0A1D", "#5b0f26"], corPoça: "#3D0812" },
  ESPECTRAL: { label: "Espectral", corBase: ["#3F8574", "#274E45", "#6fb3a0"], corPoça: null },
};

function classificarSeveridade(percentualPerdido, vidaChegouAZero) {
  if (vidaChegouAZero) return "abate";
  if (percentualPerdido >= 0.3) return "critico";
  return "normal";
}

const INTENSIDADE = {
  normal: { particulas: 10, shake: 3, flash: 0.15, duracao: 0.5 },
  critico: { particulas: 22, shake: 7, flash: 0.32, duracao: 0.7 },
  abate: { particulas: 38, shake: 11, flash: 0.5, duracao: 1.1 },
};

function gerarParticulas(qtd) {
  return Array.from({ length: qtd }, (_, i) => {
    const angulo = Math.random() * Math.PI * 2;
    const distancia = 30 + Math.random() * 90;
    return {
      id: i,
      x: Math.cos(angulo) * distancia,
      y: Math.sin(angulo) * distancia * 0.6 + Math.random() * 40,
      escala: 0.4 + Math.random() * 1.4,
      rotacao: Math.random() * 360,
      atraso: Math.random() * 0.15,
    };
  });
}

function EfeitoImpacto({ material, severidade, onFim }) {
  const cfg = MATERIAL_CONFIG[material] || MATERIAL_CONFIG.CARNE;
  const intensidade = INTENSIDADE[severidade];
  const particulas = useRef(gerarParticulas(intensidade.particulas)).current;
  const espectral = material === "ESPECTRAL";

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none overflow-visible z-30"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={onFim}
    >
      <motion.div
        className="fixed inset-0 pointer-events-none z-40"
        style={{ backgroundColor: espectral ? "#3F857440" : "#7A123055" }}
        initial={{ opacity: intensidade.flash }}
        animate={{ opacity: 0 }}
        transition={{ duration: intensidade.duracao * 0.6 }}
      />

      {particulas.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2"
          style={{
            width: espectral ? 18 : 10 + p.escala * 6,
            height: espectral ? 18 : 8 + p.escala * 5,
            backgroundColor: cfg.corBase[p.id % cfg.corBase.length],
            borderRadius: espectral ? "50%" : "40% 60% 55% 45% / 50% 45% 55% 50%",
            filter: espectral ? "blur(6px)" : "none",
          }}
          initial={{ x: 0, y: 0, opacity: espectral ? 0.7 : 1, scale: 0.3, rotate: 0 }}
          animate={
            espectral
              ? { x: p.x * 0.5, y: p.y - 60, opacity: 0, scale: p.escala * 1.8 }
              : { x: p.x, y: p.y, opacity: [1, 1, 0.9, 0], scale: p.escala, rotate: p.rotacao }
          }
          transition={{ duration: intensidade.duracao, delay: p.atraso, ease: [0.19, 1, 0.22, 1] }}
        />
      ))}

      {!espectral &&
        particulas.slice(0, Math.ceil(intensidade.particulas / 3)).map((p) => (
          <motion.div
            key={`fio-${p.id}`}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{ width: 3 + Math.random() * 3, backgroundColor: cfg.corBase[0] }}
            initial={{ x: p.x * 0.6, y: p.y * 0.5, height: 0, opacity: 0.9 }}
            animate={{ height: 40 + Math.random() * 50, opacity: [0.9, 0.9, 0] }}
            transition={{ duration: intensidade.duracao * 1.4, delay: p.atraso + 0.1, ease: "easeIn" }}
          />
        ))}
    </motion.div>
  );
}

export default function MonstroSessao({ idCaso }) {
  const stompClient = useStompClient(idCaso);
  const [monstros, setMonstros] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [detalheAberto, setDetalheAberto] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [isSalvandoDetalhe, setIsSalvandoDetalhe] = useState(false);
  const [isDeletando, setIsDeletando] = useState(false);
  const [isIniciandoBatalha, setIsIniciandoBatalha] = useState(false);

  const [avisoBatalha, setAvisoBatalha] = useState(null);

  const [danoInputs, setDanoInputs] = useState({});
  const [efeitosAtivos, setEfeitosAtivos] = useState({});
  const [poças, setPoças] = useState({});
  const [tremores, setTremores] = useState({});

  const podeGerenciar = hasAuthority("admin::write");

  const fetchMonstros = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/monstro");
      setMonstros(response.data);
    } catch (error) {
      console.error("Erro ao buscar monstros:", error);
    } finally {
      setIsLoading(false);
    }
  };
  const monstrosOrdenados = [...monstros].sort((a, b) =>
    a.emBatalha === b.emBatalha ? 0 : a.emBatalha ? -1 : 1
  );

  useEffect(() => {
    fetchMonstros();
  }, []);

  useEffect(() => {
    if (stompClient?.connected) {
      const subPv = stompClient.subscribe(`/topic/caso/${idCaso}/monstros`, (message) => {
        const monstroAtualizado = JSON.parse(message.body);
        setMonstros((prev) => {
          const existe = prev.some((m) => m.id === monstroAtualizado.id);
          return existe
            ? prev.map((m) => (m.id === monstroAtualizado.id ? monstroAtualizado : m))
            : [...prev, monstroAtualizado];
        });
      });

      const subBatalha = stompClient.subscribe(`/topic/caso/${idCaso}/batalha`, (message) => {
        const monstro = JSON.parse(message.body);
        setMonstros((prev) => {
          const existe = prev.some((m) => m.id === monstro.id);
          return existe
            ? prev.map((m) => (m.id === monstro.id ? { ...m, ...monstro, conhecido: true } : m))
            : [...prev, { ...monstro, conhecido: true }];
        });
        setAvisoBatalha(monstro.nome);
      });

      return () => {
        subPv.unsubscribe();
        subBatalha.unsubscribe();
      };
    }
  }, [idCaso, stompClient]);

  const atualizarPv = async (monstro, novoPv) => {
    setMonstros((prev) => prev.map((m) => (m.id === monstro.id ? { ...m, pv: novoPv } : m)));

    if (stompClient?.connected) {
      stompClient.publish({
        destination: `/app/caso/${idCaso}/monstro/update`,
        body: JSON.stringify({ id: monstro.id, pv: novoPv }),
      });
    } else {
      try {
        await api.patch(`/monstro/${monstro.id}`, { pv: novoPv });
      } catch (error) {
        console.error("Erro ao ajustar PV:", error);
      }
    }
  };

  const alterarVida = (monstro, delta) => {
    const novoPv = Math.min(monstro.pvMaximo, Math.max(0, monstro.pv + delta));
    if (novoPv === monstro.pv) return;
    atualizarPv(monstro, novoPv);
  };

  const dispararTremor = useCallback((id) => {
    setTremores((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => setTremores((prev) => ({ ...prev, [id]: false })), 350);
  }, []);

  const aplicarDanoEmMassa = (monstro) => {
    const dano = parseInt(danoInputs[monstro.id], 10);
    if (!dano || dano <= 0) return;

    const novoPv = Math.max(0, monstro.pv - dano);
    const percentualPerdido = dano / (monstro.pvMaximo || monstro.pv || 1);
    const severidade = classificarSeveridade(percentualPerdido, novoPv === 0);
    const cfgMaterial = MATERIAL_CONFIG[monstro.material] || MATERIAL_CONFIG.CARNE;

    atualizarPv(monstro, novoPv);
    dispararTremor(monstro.id);

    setEfeitosAtivos((prev) => ({ ...prev, [monstro.id]: { severidade, key: Date.now() } }));

    if (cfgMaterial.corPoça) {
      const incremento = severidade === "abate" ? 0.6 : severidade === "critico" ? 0.35 : 0.15;
      setPoças((prev) => ({ ...prev, [monstro.id]: Math.min(1, (prev[monstro.id] || 0) + incremento) }));
    }

    setDanoInputs((prev) => ({ ...prev, [monstro.id]: "" }));
  };

  const handleCreateMonstro = async (e) => {
    e.preventDefault();
    const form = e.target;
    const nome = form.elements.namedItem("nome").value;
    const pvMaximo = Number(form.elements.namedItem("pvMaximo").value);
    const material = form.elements.namedItem("material").value;

    setIsSaving(true);
    try {
      const response = await api.post("/monstro", { nome, pv: pvMaximo, pvMaximo, material });
      setMonstros((prev) => [...prev, response.data]);
      setIsCreateOpen(false);
      form.reset();
    } catch (error) {
      console.error("Erro ao registrar monstro:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const abrirDetalhe = (monstro) => {
    setEditForm({
      id: monstro.id,
      nome: monstro.nome || "",
      pv: monstro.pv ?? 0,
      pvMaximo: monstro.pvMaximo ?? 10,
      san: monstro.san || "",
      ataquesEspeciais: monstro.ataquesEspeciais || "",
      comportamento: monstro.comportamento || "",
      fraquezas: monstro.fraquezas || "",
      imagemUrl: monstro.imagemUrl || "",
      material: monstro.material || "CARNE",
      emBatalha: monstro.emBatalha ?? false,
      conhecido: monstro.conhecido ?? false,
    });
    setDetalheAberto(monstro);
  };

  const fecharDetalhe = () => {
    setDetalheAberto(null);
    setEditForm(EMPTY_EDIT);
  };

  const [isEncerrandoBatalha, setIsEncerrandoBatalha] = useState(false);

  const handleEncerrarBatalha = () => {
    if (!detalheAberto || !stompClient?.connected) return;
    setIsEncerrandoBatalha(true);
    stompClient.publish({
      destination: `/app/caso/${idCaso}/monstro/${detalheAberto.id}/encerrar-batalha`,
      body: JSON.stringify({}),
    });
    setEditForm((f) => ({ ...f, emBatalha: false }));
    setTimeout(() => setIsEncerrandoBatalha(false), 800);
  };

  const handleSalvarDetalhe = async (e) => {
    e.preventDefault();
    setIsSalvandoDetalhe(true);
    try {
      const response = await api.put("/monstro", {
        ...editForm,
        pv: Number(editForm.pv),
        pvMaximo: Number(editForm.pvMaximo),
      });
      const atualizado = response.data;
      setMonstros((prev) => prev.map((m) => (m.id === atualizado.id ? atualizado : m)));
      fecharDetalhe();
    } catch (error) {
      console.error("Erro ao salvar monstro:", error);
    } finally {
      setIsSalvandoDetalhe(false);
    }
  };

  const handleDeletar = async () => {
    if (!detalheAberto) return;

    setIsDeletando(true);
    try {
      await api.delete(`/monstro/${detalheAberto.id}`);
      setMonstros((prev) => prev.filter((m) => m.id !== detalheAberto.id));
      fecharDetalhe();
    } catch (error) {
      console.error("Erro ao deletar monstro:", error);
    } finally {
      setIsDeletando(false);
    }
  };

  const handleIniciarBatalha = () => {
    if (!detalheAberto || !stompClient?.connected) return;
    setIsIniciandoBatalha(true);
    stompClient.publish({
      destination: `/app/caso/${idCaso}/monstro/${detalheAberto.id}/batalha`,
      body: JSON.stringify({}),
    });
    setEditForm((f) => ({ ...f, emBatalha: true }));
    setTimeout(() => setIsIniciandoBatalha(false), 800);
  };
  const handleDeletarRapido = async (e, monstro) => {
    e.stopPropagation();
    if (!window.confirm(`Deletar "${monstro.nome}" do bestiário? Essa ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/monstro/${monstro.id}`);
      setMonstros((prev) => prev.filter((m) => m.id !== monstro.id));
    } catch (error) {
      console.error("Erro ao deletar monstro:", error);
      alert("Não foi possível deletar o monstro.");
    }
  };

  const iniciarBatalhaCard = (monstro) => {
    if (!stompClient?.connected) return;
    stompClient.publish({
      destination: `/app/caso/${idCaso}/monstro/${monstro.id}/batalha`,
      body: JSON.stringify({}),
    });
    setMonstros((prev) => prev.map((m) => (m.id === monstro.id ? { ...m, emBatalha: true } : m)));
  };

  const encerrarBatalhaCard = (monstro) => {
    if (!stompClient?.connected) return;
    stompClient.publish({
      destination: `/app/caso/${idCaso}/monstro/${monstro.id}/encerrar-batalha`,
      body: JSON.stringify({}),
    });
    setMonstros((prev) => prev.map((m) => (m.id === monstro.id ? { ...m, emBatalha: false } : m)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="font-mono-ieji text-[#7A1230] text-sm tracking-widest animate-pulse">
          CARREGANDO AMEAÇAS...
        </span>
      </div>
    );
  }

  return (
    <div>
      <AnimatePresence>
        {avisoBatalha && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-5 sm:mb-6 bg-[#7A1230] border-2 border-[#0B0A0D] rounded-sm px-4 py-3 flex items-center justify-between gap-3 shadow-[4px_4px_0px_0px_#0B0A0D]"
          >
            <span className="font-display font-bold text-sm sm:text-base text-[#EAE0C4] flex items-center gap-2">
              <Swords className="w-4 h-4 shrink-0" /> Vocês entraram em batalha com {avisoBatalha}!
            </span>
            <button onClick={() => setAvisoBatalha(null)} className="text-[#EAE0C4]/70 hover:text-[#EAE0C4] shrink-0">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {podeGerenciar && (
        <div className="flex justify-end mb-5 sm:mb-6">
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="w-full sm:w-auto bg-[#7A1230] text-[#EAE0C4] hover:bg-[#EAE0C4] hover:text-[#201A1E] border-2 border-[#0B0A0D] font-display font-bold gap-2 shadow-[3px_3px_0px_0px_#B99A4B]"
          >
            <Plus className="w-4 h-4" /> Registrar monstro
          </Button>
        </div>
      )}

      {monstros.length === 0 ? (
        <div className="bg-[#EAE0C4] border-4 border-dashed border-[#7A1230] rounded-sm p-10 sm:p-16 text-center">
          <Skull className="w-10 h-10 text-[#7A1230] mx-auto mb-4" strokeWidth={1.3} />
          <p className="font-display font-bold text-lg sm:text-xl text-[#201A1E]">Nenhuma ameaça catalogada</p>
          <p className="font-body text-[#5b5346] mt-1 text-sm sm:text-base">
            {podeGerenciar
              ? "Este bestiário ainda está vazio. Use o botão acima para abrir o primeiro dossiê."
              : "Este bestiário ainda está vazio."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          <AnimatePresence>
            {monstrosOrdenados.map((m) => {
              if (!podeGerenciar && !m.conhecido) {
                return (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative bg-[#15121A] border-4 border-[#0B0A0D] rounded-sm overflow-hidden shadow-[6px_6px_0px_0px_#7A1230] flex flex-col items-center justify-center h-64 gap-3"
                  >
                    <motion.div
                      animate={{ opacity: [0.35, 0.7, 0.35] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                      className="w-16 h-16 rounded-full bg-[#7A1230]/15 border-2 border-[#7A1230]/40 flex items-center justify-center"
                    >
                      <Skull className="w-7 h-7 text-[#7A1230]/50" />
                    </motion.div>
                    <span className="font-mono-ieji text-[10px] uppercase tracking-widest text-[#5b5346]">Ameaça não identificada</span>
                    <span className="font-body italic text-xs text-[#5b5346]/60 px-4 text-center">
                      Os agentes ainda não enfrentaram esta criatura
                    </span>
                  </motion.div>
                );
              }

              const pct = m.pvMaximo > 0 ? Math.min(100, Math.max(0, (m.pv / m.pvMaximo) * 100)) : 0;
              const morto = m.pv <= 0;
              const critico = !morto && pct <= 25;
              const emBatalha = m.emBatalha;
              const cfgMaterial = MATERIAL_CONFIG[m.material] || MATERIAL_CONFIG.CARNE;
              const poçaIntensidade = poças[m.id] || 0;

              const statusLabel = morto ? "Abatido" : critico ? "Crítico" : pct <= 60 ? "Ferido" : "Saudável";
              const statusColor = morto ? "#5b5346" : critico ? "#7A1230" : pct <= 60 ? "#B99A4B" : "#3F8574";

              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => podeGerenciar && abrirDetalhe(m)}
                  className={`relative bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm shadow-[6px_6px_0px_0px_#7A1230] flex flex-col transition-all ${
                    podeGerenciar ? "cursor-pointer hover:-translate-y-0.5" : ""
                  } ${morto ? "grayscale" : ""}`}
                >
                  <motion.div
                    animate={
                      tremores[m.id]
                        ? { x: [0, -6, 6, -4, 4, -2, 0], y: [0, 3, -3, 2, -2, 0] }
                        : { x: 0, y: 0 }
                    }
                    transition={{ duration: 0.35 }}
                    className="relative flex flex-col flex-1"
                  >
                    {cfgMaterial.corPoça && poçaIntensidade > 0 && (
                      <motion.div
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-[50%] pointer-events-none z-0"
                        style={{ backgroundColor: cfgMaterial.corPoça, filter: "blur(2px)" }}
                        animate={{
                          width: 60 + poçaIntensidade * 160,
                          height: 14 + poçaIntensidade * 30,
                          opacity: 0.55 + poçaIntensidade * 0.35,
                        }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    )}

                    <AnimatePresence>
                      {efeitosAtivos[m.id] && (
                        <EfeitoImpacto
                          key={efeitosAtivos[m.id].key}
                          material={m.material}
                          severidade={efeitosAtivos[m.id].severidade}
                          onFim={() =>
                            setEfeitosAtivos((prev) => {
                              const novo = { ...prev };
                              delete novo[m.id];
                              return novo;
                            })
                          }
                        />
                      )}
                    </AnimatePresence>

                    {emBatalha && !morto && (
                      <div className="absolute top-0 right-0 bg-[#7A1230] text-[#EAE0C4] font-mono-ieji text-[9px] uppercase tracking-widest px-2 py-1 flex items-center gap-1 z-10">
                        <Swords className="w-3 h-3" /> Em batalha
                      </div>
                    )}

                    {podeGerenciar && (
                      <button
                        type="button"
                        onClick={(e) => handleDeletarRapido(e, m)}
                        className="absolute top-2 left-2 z-10 w-7 h-7 rounded-sm bg-[#0B0A0D]/70 border border-[#7A1230] text-[#7A1230] hover:bg-[#7A1230] hover:text-[#EAE0C4] flex items-center justify-center transition-colors"
                        title="Deletar monstro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div className="bg-[#201A1E] relative rounded-t-sm overflow-hidden">
                      {m.imagemUrl && (
                        <div className="h-28 sm:h-32 flex items-end justify-center overflow-hidden pt-2">
                          <RetratoElegante imagemUrl={m.imagemUrl} className="h-32 sm:h-36 w-auto max-w-[85%]" />
                        </div>
                      )}
                      <div className="px-4 py-3 flex items-center justify-between gap-2 relative">
                        <h3 className="font-display font-bold text-base sm:text-lg text-[#EAE0C4] leading-tight truncate">
                          {m.nome}
                        </h3>
                        {!m.imagemUrl && (
                          <div className="w-8 h-8 rounded-full bg-[#7A1230]/20 border border-[#7A1230] flex items-center justify-center shrink-0">
                            <Skull className="w-4 h-4 text-[#7A1230]" />
                          </div>
                        )}
                      </div>
                      {podeGerenciar && (
                        <span className="absolute bottom-1.5 right-3 font-mono-ieji text-[8px] uppercase tracking-widest text-[#EAE0C4]/50 flex items-center gap-1">
                          <Droplet className="w-2.5 h-2.5" /> {cfgMaterial.label}
                        </span>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-mono-ieji text-[10px] uppercase tracking-widest text-[#201A1E] flex items-center gap-1.5">
                            {critico && <ShieldAlert className="w-3.5 h-3.5 text-[#7A1230]" />}
                            {podeGerenciar ? "Pontos de vida" : "Condição"}
                          </span>
                          {podeGerenciar ? (
                            <span className="font-mono-ieji text-xs font-semibold text-[#201A1E]">
                              {m.pv} / {m.pvMaximo}
                            </span>
                          ) : (
                            <span
                              className="font-mono-ieji text-[10px] font-semibold uppercase"
                              style={{ color: statusColor }}
                            >
                              {statusLabel}
                            </span>
                          )}
                        </div>
                        <div className="h-3 w-full bg-[#0B0A0D]/10 rounded-sm border border-[#0B0A0D] overflow-hidden">
                          <div
                            className="h-full transition-all duration-500 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: statusColor }}
                          />
                        </div>
                      </div>

                      {podeGerenciar && (
                        <div
                          className="mt-auto flex items-center justify-between pt-3 border-t border-dashed border-[#B99A4B]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="font-mono-ieji text-[10px] uppercase text-[#5b5346]">Ajustar</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => alterarVida(m, -1)}
                              className="w-10 h-10 sm:w-8 sm:h-8 border-2 border-[#0B0A0D] rounded-sm hover:bg-[#7A1230] hover:text-[#EAE0C4] hover:border-[#7A1230] flex items-center justify-center transition-colors"
                              title="Diminuir 1 PV"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-display font-bold text-xl w-6 text-center text-[#7A1230]">
                              {m.pv}
                            </span>
                            <button
                              type="button"
                              onClick={() => alterarVida(m, 1)}
                              className="w-10 h-10 sm:w-8 sm:h-8 border-2 border-[#0B0A0D] rounded-sm hover:bg-[#3F8574] hover:text-[#EAE0C4] hover:border-[#3F8574] flex items-center justify-center transition-colors"
                              title="Aumentar 1 PV"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {podeGerenciar && !morto && (
                        <div
                          className="mt-3 flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            min="1"
                            value={danoInputs[m.id] || ""}
                            onChange={(e) =>
                              setDanoInputs((prev) => ({ ...prev, [m.id]: e.target.value }))
                            }
                            onKeyDown={(e) => e.key === "Enter" && aplicarDanoEmMassa(m)}
                            placeholder="Dano"
                            className="w-20 bg-[#F5EFDD] text-[#201A1E] font-mono-ieji text-xs px-2 py-1.5 rounded-sm border-2 border-[#0B0A0D] focus:outline-none focus:border-[#7A1230]"
                          />
                          <button
                            type="button"
                            onClick={() => aplicarDanoEmMassa(m)}
                            disabled={!danoInputs[m.id]}
                            className="flex-1 bg-[#7A1230] text-[#EAE0C4] font-mono-ieji text-[10px] uppercase tracking-wider py-1.5 rounded-sm border-2 border-[#0B0A0D] hover:bg-[#5b0f26] transition-colors disabled:opacity-50"
                          >
                            Aplicar dano
                          </button>
                        </div>
                      )}

                      {podeGerenciar && (
                        <div onClick={(e) => e.stopPropagation()} className="mt-3">
                          <Button
                            type="button"
                            onClick={() => (emBatalha ? encerrarBatalhaCard(m) : iniciarBatalhaCard(m))}
                            disabled={!stompClient?.connected}
                            className={`w-full font-mono-ieji text-xs gap-2 border-2 border-[#0B0A0D] ${
                              emBatalha
                                ? "bg-[#3F8574] text-[#EAE0C4] hover:bg-[#EAE0C4] hover:text-[#201A1E]"
                                : "bg-[#7A1230] text-[#EAE0C4] hover:bg-[#EAE0C4] hover:text-[#201A1E]"
                            }`}
                          >
                            <Swords className="w-4 h-4" /> {emBatalha ? "ENCERRAR BATALHA" : "INICIAR BATALHA"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsCreateOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm p-6 shadow-[8px_8px_0px_0px_#7A1230] w-full max-w-md relative z-10"
            >
              <div className="flex justify-between items-center mb-5 border-b-2 border-[#0B0A0D] pb-2">
                <h3 className="font-display font-bold text-2xl text-[#201A1E] flex items-center gap-2">
                  <Feather className="w-5 h-5" /> NOVA AMEAÇA
                </h3>
                <button onClick={() => setIsCreateOpen(false)}>
                  <X className="w-5 h-5 hover:text-[#7A1230]" />
                </button>
              </div>
              <form onSubmit={handleCreateMonstro} className="space-y-4">
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Nome do monstro</Label>
                  <input
                    name="nome"
                    required
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-body text-sm"
                    placeholder="Ex: Sombra Faminta"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Pontos de vida máximos</Label>
                  <input
                    name="pvMaximo"
                    type="number"
                    min={1}
                    defaultValue={10}
                    required
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-mono-ieji text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Material</Label>
                  <select
                    name="material"
                    defaultValue="CARNE"
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-mono-ieji text-sm"
                  >
                    {MATERIAL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {MATERIAL_CONFIG[opt].label}
                      </option>
                    ))}
                  </select>
                  <p className="font-mono-ieji text-[9px] text-[#5b5346]">
                    Define o efeito visual quando o monstro leva dano.
                  </p>
                </div>
                <p className="font-mono-ieji text-[10px] text-[#5b5346]">
                  Sanidade, ataques, comportamento e fraquezas podem ser preenchidos depois, na ficha completa.
                </p>
                <div className="pt-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="bg-transparent border-2 border-[#0B0A0D] font-mono-ieji text-xs"
                  >
                    CANCELAR
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#7A1230] text-[#EAE0C4] border-2 border-[#0B0A0D] font-display font-bold"
                  >
                    {isSaving ? "REGISTRANDO..." : "REGISTRAR NO BESTIÁRIO"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detalheAberto && podeGerenciar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              onClick={fecharDetalhe}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm p-6 shadow-[8px_8px_0px_0px_#7A1230] w-full max-w-lg z-10 max-h-[90vh] overflow-y-auto"
            >
              <AnimatePresence>
                {Number(editForm.pv) <= 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 flex items-center justify-center bg-[#0B0A0D]/85 rounded-sm"
                  >
                    <motion.div
                      initial={{ scale: 0.4, rotate: -25, opacity: 0 }}
                      animate={{ scale: 1, rotate: -8, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <motion.div
                        animate={{ rotate: [-8, 8, -8] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <SkullIcon className="w-16 h-16 text-[#7A1230]" strokeWidth={1.5} />
                      </motion.div>
                      <span className="font-display font-black text-3xl text-[#EAE0C4] border-4 border-[#7A1230] px-4 py-1 -rotate-3">
                        ABATIDO
                      </span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between items-center mb-5 border-b-2 border-[#0B0A0D] pb-2">
                <h3 className="font-display font-bold text-2xl text-[#201A1E] flex items-center gap-2 min-w-0">
                  <Skull className="w-5 h-5 shrink-0 text-[#7A1230]" />
                  <span className="truncate">FICHA — {editForm.nome || "Monstro"}</span>
                </h3>
                <button onClick={fecharDetalhe} className="shrink-0">
                  <X className="w-5 h-5 hover:text-[#7A1230]" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mb-5">
                {editForm.emBatalha ? (
                  <Button
                    type="button"
                    onClick={handleEncerrarBatalha}
                    disabled={isEncerrandoBatalha || !stompClient?.connected}
                    className="flex-1 bg-[#3F8574] text-[#EAE0C4] hover:bg-[#EAE0C4] hover:text-[#201A1E] border-2 border-[#0B0A0D] font-display font-bold gap-2"
                    title={!stompClient?.connected ? "Conecte ao WebSocket da sessão pra avisar os jogadores" : ""}
                  >
                    <Swords className="w-4 h-4" /> {isEncerrandoBatalha ? "ENCERRANDO..." : "ENCERRAR BATALHA"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleIniciarBatalha}
                    disabled={isIniciandoBatalha || !stompClient?.connected}
                    className="flex-1 bg-[#7A1230] text-[#EAE0C4] hover:bg-[#EAE0C4] hover:text-[#201A1E] border-2 border-[#0B0A0D] font-display font-bold gap-2"
                    title={!stompClient?.connected ? "Conecte ao WebSocket da sessão pra avisar os jogadores" : ""}
                  >
                    <Swords className="w-4 h-4" /> {isIniciandoBatalha ? "AVISANDO..." : "ENTRAR EM BATALHA"}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleDeletar}
                  disabled={isDeletando}
                  className="bg-transparent border-2 border-[#7A1230] text-[#7A1230] hover:bg-[#7A1230] hover:text-[#EAE0C4] font-mono-ieji text-xs gap-2"
                >
                  <Trash2 className="w-4 h-4" /> {isDeletando ? "REMOVENDO..." : "DELETAR"}
                </Button>
              </div>
              <form onSubmit={handleSalvarDetalhe} className="space-y-4">
                <div className="flex items-center gap-4">
                  <ImagemUploader
                    tipo="monstro"
                    entidadeId={editForm.id}
                    imagemAtual={editForm.imagemUrl}
                    tamanho="md"
                    onSucesso={(novaUrl) => {
                      setEditForm((f) => ({ ...f, imagemUrl: novaUrl }));
                      setMonstros((prev) =>
                        prev.map((m) => (m.id === editForm.id ? { ...m, imagemUrl: novaUrl } : m))
                      );
                    }}
                  />
                  <p className="font-mono-ieji text-[10px] text-[#5b5346] leading-relaxed">
                    Toque na imagem pra trocar. Arte com fundo transparente (PNG recortado)
                    fica melhor — ela se dissolve no topo do card automaticamente.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Nome</Label>
                  <input
                    value={editForm.nome}
                    onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                    required
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-body text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="font-mono-ieji text-[10px] uppercase">PV atual</Label>
                    <input
                      type="number"
                      value={editForm.pv}
                      onChange={(e) => setEditForm((f) => ({ ...f, pv: e.target.value }))}
                      className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-mono-ieji text-sm text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-mono-ieji text-[10px] uppercase">PV máximo</Label>
                    <input
                      type="number"
                      min={1}
                      value={editForm.pvMaximo}
                      onChange={(e) => setEditForm((f) => ({ ...f, pvMaximo: e.target.value }))}
                      className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-mono-ieji text-sm text-center"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Material</Label>
                  <select
                    value={editForm.material}
                    onChange={(e) => setEditForm((f) => ({ ...f, material: e.target.value }))}
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-mono-ieji text-sm"
                  >
                    {MATERIAL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {MATERIAL_CONFIG[opt].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Sanidade (SAN)</Label>
                  <input
                    value={editForm.san}
                    onChange={(e) => setEditForm((f) => ({ ...f, san: e.target.value }))}
                    placeholder="Ex: 1d6 ou Instável"
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-mono-ieji text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Ataques especiais</Label>
                  <textarea
                    value={editForm.ataquesEspeciais}
                    onChange={(e) => setEditForm((f) => ({ ...f, ataquesEspeciais: e.target.value }))}
                    rows={3}
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-body text-sm resize-none"
                    placeholder="O que essa criatura faz em combate..."
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Comportamento</Label>
                  <textarea
                    value={editForm.comportamento}
                    onChange={(e) => setEditForm((f) => ({ ...f, comportamento: e.target.value }))}
                    rows={2}
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-body text-sm resize-none"
                    placeholder="Como ela reage, ataca, foge..."
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Fraquezas</Label>
                  <textarea
                    value={editForm.fraquezas}
                    onChange={(e) => setEditForm((f) => ({ ...f, fraquezas: e.target.value }))}
                    rows={2}
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-body text-sm resize-none"
                    placeholder="O que a prejudica ou anula..."
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-dashed border-[#B99A4B]">
                  <Button
                    type="button"
                    onClick={fecharDetalhe}
                    className="bg-transparent border-2 border-[#0B0A0D] font-mono-ieji text-xs"
                  >
                    CANCELAR
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSalvandoDetalhe}
                    className="bg-[#3F8574] text-[#EAE0C4] border-2 border-[#0B0A0D] font-display font-bold gap-2"
                  >
                    <Save className="w-4 h-4" /> {isSalvandoDetalhe ? "SALVANDO..." : "SALVAR FICHA"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
