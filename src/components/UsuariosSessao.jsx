import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, ChevronDown, ShieldCheck, Trash2, Wifi, List } from "lucide-react";
import { useStompClient } from "@/hooks/useStompClient";
import { hasAuthority } from "@/utils/auth";
import { api } from "@/services/api";

const ROLE_STYLES = {
  ADMIN: { label: "Mestre", bg: "#7A1230", text: "#EAE0C4" },
  MANAGER: { label: "Auxiliar", bg: "#B99A4B", text: "#0B0A0D" },
  USER: { label: "Agente", bg: "#3F8574", text: "#EAE0C4" },
};
const ROLE_OPTIONS = ["USER", "MANAGER", "ADMIN"];

export default function UsuariosSessao({ idCaso }) {
  const stompClient = useStompClient(idCaso);
  const [aba, setAba] = useState("online"); // "online" | "todos"
  const [usuariosOnline, setUsuariosOnline] = useState([]);
  const [todosUsuarios, setTodosUsuarios] = useState([]);
  const [carregandoTodos, setCarregandoTodos] = useState(false);
  const [menuAbertoId, setMenuAbertoId] = useState(null);
  const [salvandoId, setSalvandoId] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);
  const podeAlterarRole = hasAuthority("admin::write");
  const podeExcluirUsuario = hasAuthority("admin::write");
  const podeGerenciar = podeAlterarRole || podeExcluirUsuario;

  useEffect(() => {
    if (!stompClient?.connected || !idCaso) return undefined;
    const sub = stompClient.subscribe(`/topic/caso/${idCaso}/presenca`, (message) => {
      setUsuariosOnline(JSON.parse(message.body));
    });
    return () => sub.unsubscribe();
  }, [stompClient, idCaso]);

  const fetchTodosUsuarios = async () => {
    setCarregandoTodos(true);
    try {
      const response = await api.get(`/casos/${idCaso}/usuarios`);
      setTodosUsuarios(response.data);
    } catch (error) {
      console.error("Erro ao buscar usuários do caso:", error);
    } finally {
      setCarregandoTodos(false);
    }
  };

  useEffect(() => {
    if (aba === "todos" && podeGerenciar) fetchTodosUsuarios();
  }, [aba, idCaso]);

  const handleAlterarRole = async (usuario, novaRole) => {
    if (novaRole === usuario.role) return setMenuAbertoId(null);
    setSalvandoId(usuario.id);
    try {
      await api.patch(`/auth/${usuario.id}/role`, { role: novaRole });
      setTodosUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? { ...u, role: novaRole } : u)));
    } catch (error) {
      console.error("Erro ao alterar cargo:", error);
      alert("Não foi possível alterar o cargo desse usuário.");
    } finally {
      setSalvandoId(null);
      setMenuAbertoId(null);
    }
  };

  const handleExcluirUsuario = async (usuario) => {
    if (!window.confirm(`Excluir a conta de "${usuario.username}"? Essa ação não pode ser desfeita.`)) return;
    setExcluindoId(usuario.id);
    try {
      await api.delete(`/auth/${usuario.id}`);
      setTodosUsuarios((prev) => prev.filter((u) => u.id !== usuario.id));
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      alert("Não foi possível excluir esse usuário.");
    } finally {
      setExcluindoId(null);
      setMenuAbertoId(null);
    }
  };

  const listaAtual = aba === "online" ? usuariosOnline : todosUsuarios;
  if (aba === "online" && usuariosOnline.length === 0 && !podeGerenciar) return null;

  return (
    <div className="bg-[#15121A] border-2 border-[#3F8574]/40 rounded-sm p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setAba("online")}
          className={`flex items-center gap-1.5 font-mono-ieji text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-sm border-2 transition-colors ${
            aba === "online"
              ? "bg-[#3F8574] text-[#EAE0C4] border-[#0B0A0D]"
              : "bg-transparent text-[#5b5346] border-transparent hover:text-[#3F8574]"
          }`}
        >
          <Wifi className="w-3 h-3" /> Online ({usuariosOnline.length})
        </button>
        {podeGerenciar && (
          <button
            onClick={() => setAba("todos")}
            className={`flex items-center gap-1.5 font-mono-ieji text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-sm border-2 transition-colors ${
              aba === "todos"
                ? "bg-[#B99A4B] text-[#0B0A0D] border-[#0B0A0D]"
                : "bg-transparent text-[#5b5346] border-transparent hover:text-[#B99A4B]"
            }`}
          >
            <List className="w-3 h-3" /> Todos
          </button>
        )}
      </div>

      {aba === "todos" && carregandoTodos ? (
        <span className="font-mono-ieji text-[10px] text-[#5b5346] animate-pulse">Carregando agentes...</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {listaAtual.map((u) => {
            const estilo = ROLE_STYLES[u.role] || ROLE_STYLES.USER;
            const aberto = menuAbertoId === u.id;
            const podeGerenciarEssaLinha = aba === "todos" && podeGerenciar;
            return (
              <div key={u.id} className="relative flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => podeAlterarRole && podeGerenciarEssaLinha && setMenuAbertoId(aberto ? null : u.id)}
                  disabled={!podeAlterarRole || !podeGerenciarEssaLinha || salvandoId === u.id}
                  className={`flex items-center gap-2 border-2 border-[#0B0A0D] rounded-full pl-3 pr-2 py-1.5 font-body text-sm bg-[#EAE0C4] text-[#201A1E] transition-opacity ${
                    podeAlterarRole && podeGerenciarEssaLinha ? "cursor-pointer hover:opacity-90" : "cursor-default"
                  } ${salvandoId === u.id ? "opacity-50" : ""}`}
                >
                  <span className="font-display font-semibold">{u.username}</span>
                  <span
                    className="font-mono-ieji text-[9px] uppercase px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: estilo.bg, color: estilo.text }}
                  >
                    {estilo.label}
                  </span>
                  {podeAlterarRole && podeGerenciarEssaLinha && <ChevronDown className="w-3 h-3 opacity-60" />}
                </button>

                {podeExcluirUsuario && podeGerenciarEssaLinha && u.role !== "ADMIN" && (
                  <button
                    type="button"
                    onClick={() => handleExcluirUsuario(u)}
                    disabled={excluindoId === u.id}
                    title="Excluir usuário"
                    className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-[#7A1230]/50 text-[#7A1230] hover:bg-[#7A1230] hover:text-[#EAE0C4] transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <AnimatePresence>
                  {aberto && podeGerenciarEssaLinha && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute z-20 mt-1 bg-[#EAE0C4] border-2 border-[#0B0A0D] rounded-sm shadow-[3px_3px_0px_0px_#0B0A0D] overflow-hidden min-w-[140px]"
                    >
                      {ROLE_OPTIONS.map((role) => {
                        const opt = ROLE_STYLES[role];
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => handleAlterarRole(u, role)}
                            className="w-full flex items-center gap-2 px-3 py-2 font-mono-ieji text-xs uppercase hover:bg-[#0B0A0D]/10 text-left"
                          >
                            {role === u.role && <ShieldCheck className="w-3.5 h-3.5 text-[#3F8574]" />}
                            <span style={{ color: opt.bg }}>{opt.label}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          {listaAtual.length === 0 && (
            <span className="font-body text-[#5b5346] italic text-sm">
              {aba === "online" ? "Nenhum sinal detectado..." : "Nenhum agente registrado nesta sessão."}
            </span>
          )}
        </div>
      )}

      {aba === "todos" && podeAlterarRole && (
        <p className="font-mono-ieji text-[9px] text-[#5b5346] mt-3">
          O novo cargo só passa a valer quando o usuário fizer login novamente.
        </p>
      )}
    </div>
  );
}