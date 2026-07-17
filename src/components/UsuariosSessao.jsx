import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, ChevronDown, ShieldCheck, Trash2 } from "lucide-react";
import { hasAuthority } from "@/utils/auth";
import { api } from "@/services/api";

const ROLE_STYLES = {
  ADMIN: { label: "Mestre", bg: "#7A1230", text: "#EAE0C4" },
  MANAGER: { label: "Auxiliar", bg: "#B99A4B", text: "#0B0A0D" },
  USER: { label: "Agente", bg: "#3F8574", text: "#EAE0C4" },
};
const ROLE_OPTIONS = ["USER", "MANAGER", "ADMIN"];

export default function UsuariosSessao({ idCaso }) {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [menuAbertoId, setMenuAbertoId] = useState(null);
  const [salvandoId, setSalvandoId] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);
  const podeGerenciar = hasAuthority("admin::write");

  const fetchUsuarios = async () => {
    setCarregando(true);
    try {
      const response = await api.get(`/auth`);
      setUsuarios(response.data);
    } catch (error) {
      console.error("Erro ao buscar usuários do sistema:", error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (podeGerenciar && idCaso) fetchUsuarios();
  }, [idCaso]);

  const handleAlterarRole = async (usuario, novaRole) => {
    if (novaRole === usuario.role) return setMenuAbertoId(null);
    setSalvandoId(usuario.id);
    try {
      await api.patch(`/auth/${usuario.id}/role`, { role: novaRole });
      setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? { ...u, role: novaRole } : u)));
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
      setUsuarios((prev) => prev.filter((u) => u.id !== usuario.id));
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      alert("Não foi possível excluir esse usuário.");
    } finally {
      setExcluindoId(null);
      setMenuAbertoId(null);
    }
  };

  if (!podeGerenciar) return null;

  return (
    <div className="bg-[#15121A] border-2 border-[#3F8574]/40 rounded-sm p-4 mb-6">
      <h3 className="font-mono-ieji text-[10px] uppercase tracking-widest text-[#B99A4B] flex items-center gap-2 mb-3">
        <Users className="w-3.5 h-3.5" /> Agentes da sessão ({usuarios.length})
      </h3>

      {carregando ? (
        <span className="font-mono-ieji text-[10px] text-[#5b5346] animate-pulse">Carregando agentes...</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {usuarios.map((u) => {
            const estilo = ROLE_STYLES[u.role] || ROLE_STYLES.USER;
            const aberto = menuAbertoId === u.id;
            return (
              <div key={u.id} className="relative flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMenuAbertoId(aberto ? null : u.id)}
                  disabled={salvandoId === u.id}
                  className={`flex items-center gap-2 border-2 border-[#0B0A0D] rounded-full pl-3 pr-2 py-1.5 font-body text-sm bg-[#EAE0C4] text-[#201A1E] cursor-pointer hover:opacity-90 transition-opacity ${
                    salvandoId === u.id ? "opacity-50" : ""
                  }`}
                >
                  <span className="font-display font-semibold">{u.username}</span>
                  <span
                    className="font-mono-ieji text-[9px] uppercase px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: estilo.bg, color: estilo.text }}
                  >
                    {estilo.label}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {u.role == "ADMIN" && (
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
                  {aberto && (
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
          {usuarios.length === 0 && (
            <span className="font-body text-[#5b5346] italic text-sm">Nenhum agente registrado nesta sessão.</span>
          )}
        </div>
      )}

      <p className="font-mono-ieji text-[9px] text-[#5b5346] mt-3">
        O novo cargo só passa a valer quando o usuário fizer login novamente.
      </p>
    </div>
  );
}
