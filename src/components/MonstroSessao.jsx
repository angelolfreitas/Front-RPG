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
 *
 * corParticula -> tons usados nas gotas/fragmentos que voam do impacto
 * corGlow      -> brilho/realce sutil sobre a partícula (dá volume/"molhado")
 * corMancha    -> tons usados na marca de ferimento que fica no retrato (null = não marca)
 * corFlash     -> cor do flash de tela no instante do impacto
 * corSlash     -> cor do rasgão/golpe visível em ataques fortes (null = sem rasgão)
 * modoMistura  -> mix-blend-mode usado nas partículas (dá integração com o fundo)
 */
const MATERIAL_CONFIG = {
  CARNE: {
    label: "Carne",
    tipo: "sangue",
    corParticula: ["#8a1220", "#5c0f1a", "#3d0810", "#a3283f", "#2a0508"],
    corGlow: "rgba(200, 60, 70, 0.55)",
    corMancha: ["#4a0d14", "#2a0508", "#5c0f1a"],
    corFlash: "rgba(150, 20, 30, 0.5)",
    corSlash: "rgba(255, 235, 225, 0.85)",
    modoMistura: "multiply",
  },
  ESPECTRAL: {
    label: "Espectral",
    tipo: "sombra",
    corParticula: ["#0d0912", "#150f1e", "#1c1526", "#090610"],
    corGlow: "rgba(120, 80, 160, 0.45)",
    corMancha: ["rgba(30,20,45,0.55)", "rgba(15,10,25,0.6)"],
    corFlash: "rgba(90, 60, 130, 0.45)",
    corSlash: null,
    modoMistura: "normal",
  },
};

function classificarSeveridade(percentualPerdido, vidaChegouAZero) {
  if (vidaChegouAZero) return "abate";
  if (percentualPerdido >= 0.3) return "critico";
  return "normal";
}

const INTENSIDADE = {
  normal: { particulas: 5, respingos: 2, shake: 3, flash: 0.55, duracao: 0.6 },
  critico: { particulas: 8, respingos: 4, shake: 6, flash: 0.75, duracao: 0.8 },
  abate: { particulas: 12, respingos: 6, shake: 9, flash: 0.9, duracao: 1.05 },
};

/**
 * Gera gotas com trajetória em arco (gravidade real), mas contidas numa área pequena
 * (a moldura do retrato), pra não vazarem pra fora do card. Cada gota guarda o ângulo
 * de voo, usado depois pra alinhar a "ponta" da lágrima com a direção do movimento.
 */
function gerarParticulasSangue(qtd) {
  return Array.from({ length: qtd }, (_, i) => {
    const angulo = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
    const forca = 22 + Math.random() * 46;
    const peso = 0.6 + Math.random() * 0.8;
    const xFinal = Math.cos(angulo) * forca;
    const yFinal = Math.sin(angulo) * forca * 0.4 + 26 + peso * 18;
    const anguloVisual = (Math.atan2(yFinal, xFinal) * 180) / Math.PI + 90;
    return {
      id: i,
      xFinal,
      yPico: -10 - Math.random() * 14,
      yFinal,
      largura: 3 + Math.random() * 4,
      altura: 5 + Math.random() * 7,
      rotacaoVoo: anguloVisual,
      atraso: Math.random() * 0.1,
      cor: i,
    };
  });
}

/** Respingos finos: linhas de sangue que esguicham, contidas na mesma área pequena. */
function gerarRespingos(qtd) {
  return Array.from({ length: qtd }, (_, i) => {
    const angulo = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
    const dist = 20 + Math.random() * 46;
    return {
      id: i,
      x: Math.cos(angulo) * dist,
      y: Math.sin(angulo) * dist * 0.45 + 18,
      comprimento: 10 + Math.random() * 20,
      espessura: 1 + Math.random() * 1.6,
      rotacao: (angulo * 180) / Math.PI + 90,
      atraso: Math.random() * 0.08,
    };
  });
}

/** Fumaça espectral: névoa curta que sobe e se dissipa dentro da moldura do retrato. */
function gerarFumaca(qtd) {
  return Array.from({ length: qtd }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 50,
    yFinal: -40 - Math.random() * 40,
    escala: 0.8 + Math.random() * 1.3,
    rotacaoFinal: (Math.random() - 0.5) * 50,
    atraso: Math.random() * 0.2,
    duracaoExtra: Math.random() * 0.4,
    blur: 4 + Math.random() * 6,
  }));
}

/** Gera 2-3 blobs orgânicos sobrepostos (bordas irregulares) pra formar uma mancha crível. */
function gerarSubBlobs() {
  return Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
    dx: (Math.random() - 0.5) * 10,
    dy: (Math.random() - 0.5) * 6,
    escalaX: 0.7 + Math.random() * 0.5,
    escalaY: 0.55 + Math.random() * 0.4,
    raio: `${40 + Math.random() * 25}% ${60 - Math.random() * 20}% ${50 + Math.random() * 20}% ${
      50 - Math.random() * 20
    }% / ${55 + Math.random() * 15}% ${50 + Math.random() * 10}% ${45 - Math.random() * 10}% ${
      60 - Math.random() * 15
    }%`,
  }));
}

/** Cria uma marca de ferimento fixa, posicionada dentro da moldura do retrato (nunca fora dela). */
function criarMancha(severidade) {
  const tamanhoBase = severidade === "abate" ? 30 : severidade === "critico" ? 20 : 12;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    xPct: 28 + Math.random() * 44,
    yPct: 42 + Math.random() * 42,
    tamanho: tamanhoBase,
    blobs: gerarSubBlobs(),
  };
}

function EfeitoImpacto({ material, severidade, onFim }) {
  const cfg = MATERIAL_CONFIG[material] || MATERIAL_CONFIG.CARNE;
  const intensidade = INTENSIDADE[severidade];
  const espectral = material === "ESPECTRAL";
  const golpeForte = !espectral && (severidade === "critico" || severidade === "abate") && cfg.corSlash;

  const gotas = useRef(!espectral ? gerarParticulasSangue(intensidade.particulas) : []).current;
  const respingos = useRef(!espectral ? gerarRespingos(intensidade.respingos) : []).current;
  const fumaca = useRef(espectral ? gerarFumaca(intensidade.particulas) : []).current;
  const anguloSlash = useRef(-28 + Math.random() * 56).current;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none overflow-hidden z-30"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={onFim}
    >
      {/* Micro-flash branco: o "soco" do impacto, bem curto */}
      <motion.div
        className="absolute inset-0 pointer-events-none mix-blend-overlay"
        style={{ background: "rgba(255,255,255,0.9)" }}
        initial={{ opacity: 0.55 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.1, ease: "easeOut" }}
      />

      {/* Flash colorido, mais curto e mais integrado (overlay em vez de lavagem plana) */}
      <motion.div
        className="absolute inset-0 pointer-events-none mix-blend-overlay"
        style={{
          background: `radial-gradient(circle at 50% 55%, ${cfg.corFlash}, transparent 68%)`,
        }}
        initial={{ opacity: intensidade.flash }}
        animate={{ opacity: 0 }}
        transition={{ duration: intensidade.duracao * (espectral ? 0.8 : 0.35), ease: "easeOut" }}
      />

      {/* Golpe/rasgão: reforça a leitura de "ataque" em vez de só respingo */}
      {golpeForte && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <motion.line
            x1={50 - Math.cos((anguloSlash * Math.PI) / 180) * 46}
            y1={50 - Math.sin((anguloSlash * Math.PI) / 180) * 30}
            x2={50 + Math.cos((anguloSlash * Math.PI) / 180) * 46}
            y2={50 + Math.sin((anguloSlash * Math.PI) / 180) * 30}
            stroke={cfg.corSlash}
            strokeWidth={severidade === "abate" ? 2.6 : 1.8}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.95 }}
            animate={{ pathLength: 1, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </svg>
      )}

      {!espectral &&
        gotas.map((g) => (
          <motion.div
            key={`gota-${g.id}`}
            className="absolute left-1/2 top-1/2"
            style={{
              width: g.largura,
              height: g.altura,
              background: `radial-gradient(circle at 34% 26%, ${cfg.corGlow}, ${
                cfg.corParticula[g.cor % cfg.corParticula.length]
              } 55%, #1a0305 100%)`,
              borderRadius: "58% 58% 58% 8%",
              mixBlendMode: cfg.modoMistura,
              boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
            }}
            initial={{ x: 0, y: 0, opacity: 0.95, scale: 0.3, rotate: g.rotacaoVoo }}
            animate={{
              x: [0, g.xFinal * 0.55, g.xFinal],
              y: [0, g.yPico, g.yFinal],
              scale: [0.3, 1, 0.65],
              rotate: g.rotacaoVoo,
              opacity: [0.95, 1, 0],
            }}
            transition={{
              duration: intensidade.duracao,
              delay: g.atraso,
              times: [0, 0.4, 1],
              ease: [0.36, 0, 0.66, -0.06],
            }}
          />
        ))}

      {!espectral &&
        respingos.map((r) => (
          <motion.div
            key={`respingo-${r.id}`}
            className="absolute left-1/2 top-1/2 origin-top"
            style={{
              width: r.espessura,
              background: `linear-gradient(to bottom, ${cfg.corParticula[0]}, ${cfg.corParticula[2]} 70%, transparent)`,
              borderRadius: "50% 50% 60% 60% / 20% 20% 80% 80%",
              mixBlendMode: cfg.modoMistura,
            }}
            initial={{ x: 0, y: 0, height: 0, opacity: 0.9, rotate: r.rotacao }}
            animate={{
              x: r.x,
              y: r.y,
              height: [0, r.comprimento, r.comprimento * 0.8],
              opacity: [0.9, 0.9, 0],
            }}
            transition={{ duration: intensidade.duracao * 0.8, delay: r.atraso, ease: "easeOut" }}
          />
        ))}

      {espectral &&
        fumaca.map((f) => (
          <motion.div
            key={`fumaca-${f.id}`}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: 22,
              height: 22,
              background: `radial-gradient(circle, ${cfg.corParticula[f.id % cfg.corParticula.length]} 0%, rgba(0,0,0,0.5) 55%, transparent 78%)`,
              filter: `blur(${f.blur}px)`,
            }}
            initial={{ x: 0, y: 6, opacity: 0.7, scale: 0.5, rotate: 0 }}
            animate={{
              x: f.x,
              y: f.yFinal,
              opacity: [0.7, 0.5, 0],
              scale: f.escala,
              rotate: f.rotacaoFinal,
            }}
            transition={{ duration: intensidade.duracao + f.duracaoExtra, delay: f.atraso, ease: "easeOut" }}
          />
        ))}

      {espectral && (
        <motion.div
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: 8,
            height: 8,
            background: "radial-gradient(circle, rgba(150,120,190,0.9), transparent 70%)",
            filter: "blur(1px)",
          }}
          initial={{ opacity: 1, scale: 0.4 }}
          animate={{ opacity: 0, scale: 3.5 }}
          transition={{ duration: intensidade.duracao * 0.55, ease: "easeOut" }}
        />
      )}
    </motion.div>
  );
}

/**
 * Marcas de ferimento: ficam DENTRO da moldura do retrato (que já tem overflow-hidden),
 * nunca vazam pra fora do card. Substituem a antiga "poça" flutuante.
 */
function MarcasFerimento({ manchas, cfgMaterial }) {
  if (!manchas || manchas.length === 0) return null;
  const cores = cfgMaterial.corMancha;
  if (!cores) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {manchas.map((m) => (
        <motion.div
          key={m.id}
          className="absolute"
          style={{ left: `${m.xPct}%`, top: `${m.yPct}%`, transform: "translate(-50%, -50%)" }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {m.blobs.map((b, idx) => (
            <div
              key={idx}
              className="absolute"
              style={{
                left: b.dx,
                top: b.dy,
                width: m.tamanho,
                height: m.tamanho,
                transform: `translate(-50%, -50%) scale(${b.escalaX}, ${b.escalaY})`,
                borderRadius: b.raio,
                background: cores[0],
                mixBlendMode: cfgMaterial.tipo === "sangue" ? "multiply" : "normal",
                opacity: cfgMaterial.tipo === "sangue" ? 0.75 : 0.55,
              }}
            />
          ))}
        </motion.div>
      ))}
    </div>
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
  const [manchas, setManchas] = useState({});
  const [tremores, setTremores] = useState({});

  // Espelha a lista atual para o handler do WebSocket comparar o PV anterior sem fechar sobre estado obsoleto.
  const monstrosRef = useRef([]);
  useEffect(() => {
    monstrosRef.current = monstros;
  }, [monstros]);

  const dispararTremor = useCallback((id) => {
    setTremores((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => setTremores((prev) => ({ ...prev, [id]: false })), 350);
  }, []);

  // Efeito visual de impacto (tremor + partículas + mancha). Usado tanto por quem aplica o dano
  // quanto pelo handler do WebSocket, para que todos os jogadores vejam a animação.
  const dispararEfeitoDano = useCallback(
    (monstro, novoPv, danoAplicado) => {
      const percentualPerdido = danoAplicado / (monstro.pvMaximo || monstro.pv || 1);
      const severidade = classificarSeveridade(percentualPerdido, novoPv === 0);
      const cfgMaterial = MATERIAL_CONFIG[monstro.material] || MATERIAL_CONFIG.CARNE;

      dispararTremor(monstro.id);
      setEfeitosAtivos((prev) => ({ ...prev, [monstro.id]: { severidade, key: Date.now() } }));

      if (cfgMaterial.corMancha) {
        setManchas((prev) => {
          const atuais = prev[monstro.id] || [];
          const novaLista = [...atuais, criarMancha(severidade)].slice(-5);
          return { ...prev, [monstro.id]: novaLista };
        });
      }
    },
    [dispararTremor]
  );

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
        
        // Buscamos a versão anterior do monstro na memória
        const anterior = monstrosRef.current.find((m) => m.id === monstroAtualizado.id);

        // 1. Efeito de dano visual
        if (anterior && monstroAtualizado.pv < anterior.pv) {
          dispararEfeitoDano(anterior, monstroAtualizado.pv, anterior.pv - monstroAtualizado.pv);
        }

        // 2. DETECÇÃO DE BATALHA (Backup): Se o backend atualizar o status de batalha por este canal geral, 
        // nós detectamos a mudança e disparamos o aviso para todos na tela!
        if (monstroAtualizado.emBatalha && (!anterior || !anterior.emBatalha)) {
          setAvisoBatalha(monstroAtualizado.nome || anterior?.nome || "uma ameaça");
        }

        setMonstros((prev) => {
          const existe = prev.some((m) => m.id === monstroAtualizado.id);
          // Forçamos o 'conhecido' a ser true se entrou em batalha, para revelar a carta aos Agentes
          const conhecido = monstroAtualizado.emBatalha ? true : (monstroAtualizado.conhecido ?? anterior?.conhecido);
          const atualizado = { ...monstroAtualizado, conhecido };
          
          return existe
            ? prev.map((m) => (m.id === monstroAtualizado.id ? atualizado : m))
            : [...prev, atualizado];
        });
      });

      const subBatalha = stompClient.subscribe(`/topic/caso/${idCaso}/batalha`, (message) => {
        const payload = JSON.parse(message.body);

        // Previne erro caso o backend mande apenas o ID do monstro (ex: um número 12 em vez do objeto)
        const idMonstro = typeof payload === "number" ? payload : payload.id;
        const anterior = monstrosRef.current.find((m) => m.id === idMonstro);
        
        // Se o payload não tiver o nome, pegamos da memória. Se não tiver na memória, colocamos um genérico.
        const nomeDoMonstro = payload.nome || anterior?.nome || "uma criatura desconhecida";
        setAvisoBatalha(nomeDoMonstro);

        setMonstros((prev) => {
          const existe = prev.some((m) => m.id === idMonstro);
          const atualizacoes = typeof payload === "object" ? payload : {};
          
          return existe
            ? prev.map((m) => (m.id === idMonstro ? { ...m, ...atualizacoes, emBatalha: true, conhecido: true } : m))
            : [...prev, { ...atualizacoes, id: idMonstro, emBatalha: true, conhecido: true }];
        });
      });

      return () => {
        subPv.unsubscribe();
        subBatalha.unsubscribe();
      };
    }
  }, [idCaso, stompClient, dispararEfeitoDano]);

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
    if (delta > 0 && novoPv >= monstro.pvMaximo) {
      setManchas((prev) => ({ ...prev, [monstro.id]: [] }));
    }
  };

  const aplicarDanoEmMassa = (monstro) => {
    const dano = parseInt(danoInputs[monstro.id], 10);
    if (!dano || dano <= 0) return;

    const novoPv = Math.max(0, monstro.pv - dano);

    atualizarPv(monstro, novoPv);
    dispararEfeitoDano(monstro, novoPv, dano);

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
              const manchasDoMonstro = manchas[m.id];

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

                    {/* Moldura do retrato: overflow-hidden já existente agora também contém
                        os efeitos de impacto e as marcas de ferimento, então nada vaza pra fora do card. */}
                    <div className="bg-[#201A1E] relative rounded-t-sm overflow-hidden">
                      {m.imagemUrl && (
                        <div className="h-28 sm:h-32 flex items-end justify-center overflow-hidden pt-2">
                          <RetratoElegante imagemUrl={m.imagemUrl} className="h-32 sm:h-36 w-auto max-w-[85%]" />
                        </div>
                      )}

                      <MarcasFerimento manchas={manchasDoMonstro} cfgMaterial={cfgMaterial} />

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