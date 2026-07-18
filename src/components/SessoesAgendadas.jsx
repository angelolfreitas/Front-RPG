import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarPlus, CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { hasAuthority } from "@/utils/auth";
import { api } from "@/services/api";

export default function SessoesAgendadas({ idCaso }) {
  const [sessoes, setSessoes] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const podeMarcar = hasAuthority("manager::write") || hasAuthority("admin::write");

  const fetchSessoes = async () => {
    try {
      const response = await api.get(`/casos/${idCaso}/sessoes`);
      setSessoes(response.data);
    } catch (error) {
      console.error("Erro ao buscar sessões agendadas:", error);
    }
  };

  useEffect(() => {
    if (idCaso) fetchSessoes();
  }, [idCaso]);

  const handleMarcarSessao = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const form = e.target;

    const payload = {
      conteudo: form.conteudo.value,
      dataSessao: form.dataSessao.value, // input datetime-local -> "YYYY-MM-DDTHH:mm"
    };

    try {
      const response = await api.post(`/casos/${idCaso}/sessoes`, payload);
      setSessoes((prev) =>
        [...prev, response.data].sort((a, b) => new Date(a.dataSessao) - new Date(b.dataSessao))
      );
      setModalAberto(false);
      form.reset();
    } catch (error) {
      console.error("Erro ao marcar sessão:", error);
      alert("Não foi possível marcar a sessão.");
    } finally {
      setSalvando(false);
    }
  };

  const formatarData = (iso) =>
    new Date(iso).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="bg-[#15121A] border-2 border-[#3F8574]/40 rounded-sm p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono-ieji text-[10px] uppercase tracking-widest text-[#B99A4B] flex items-center gap-2">
          <CalendarClock className="w-3.5 h-3.5" /> Próximas sessões
        </h3>
        {podeMarcar && (
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="w-7 h-7 rounded-sm border border-[#3F8574] text-[#3F8574] hover:bg-[#3F8574] hover:text-[#EAE0C4] flex items-center justify-center transition-colors"
            title="Marcar nova sessão"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {sessoes.length === 0 ? (
        <span className="font-body text-[#5b5346] italic text-sm">Nenhuma sessão marcada ainda.</span>
      ) : (
        <ul className="space-y-2">
          {sessoes.map((s) => (
            <li key={s.id} className="bg-[#EAE0C4] border-2 border-[#0B0A0D] rounded-sm p-2.5">
              <span className="font-mono-ieji text-[10px] text-[#7A1230] block mb-1">
                {formatarData(s.dataSessao)}
              </span>
              <p className="font-body text-sm text-[#201A1E] whitespace-pre-wrap">{s.conteudo}</p>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {modalAberto && podeMarcar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setModalAberto(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm p-6 shadow-[8px_8px_0px_0px_#3F8574] w-full max-w-md relative z-10"
            >
              <div className="flex justify-between items-center mb-4 border-b-2 border-[#0B0A0D] pb-2">
                <h3 className="font-display font-bold text-xl text-[#201A1E]">MARCAR SESSÃO</h3>
                <button onClick={() => setModalAberto(false)}>
                  <X className="w-5 h-5 text-[#5b5346] hover:text-[#7A1230]" />
                </button>
              </div>

              <form onSubmit={handleMarcarSessao} className="space-y-4">
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Aviso da sessão</Label>
                  <textarea
                    name="conteudo" rows={4} required
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-body text-base resize-none"
                    placeholder="Ex: Traremos o desfecho do caso Nakamura, tragam seus mantimentos."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Data e horário</Label>
                  <input
                    name="dataSessao" type="datetime-local" required
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-mono-ieji text-sm"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-3 border-t border-dashed border-[#B99A4B]">
                  <Button type="button" onClick={() => setModalAberto(false)} className="bg-transparent border-2 border-[#0B0A0D] text-[#201A1E] font-mono-ieji text-xs">
                    CANCELAR
                  </Button>
                  <Button type="submit" disabled={salvando} className="bg-[#7A1230] text-[#EAE0C4] border-2 border-[#0B0A0D] font-display font-bold">
                    {salvando ? "ENVIANDO..." : "MARCAR E NOTIFICAR"}
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