import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Backpack, Plus, Trash2, Minus, X, Package, ScrollText,
  ArrowLeft, Search, Skull
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

const Inventario = () => {
  const [inventario, setInventario] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [personagemId, setPersonagemId] = useState(null);
  const podeCriarItem = hasAuthority("manager::write");

  const fetchAll = async () => {
  try {
    const [personagemRes, itemRes] = await Promise.all([
      api.get("/personagem/meu"),
      api.get("/item"),
    ]);
    const meus = Array.isArray(personagemRes.data) ? personagemRes.data : [];
    const meuId = meus[0]?.id ?? null;
    setPersonagemId(meuId);
    setCatalogo(itemRes.data);

    const invRes = meuId ? await api.get("/inventario/meu") : { data: [] };
    setInventario(invRes.data);
  } catch (error) {
    console.error("Erro ao carregar inventário:", error);
  }
};
  useEffect(() => { fetchAll(); }, []);

  const handleAddToInventory = async (e) => {
  e.preventDefault();

  if (!personagemId) {
    alert("Ainda não consegui identificar seu personagem. Aguarde a página carregar ou recarregue.");
    return;
  }

  try {
    const response = await api.post("/inventario", {
      id: { idPersonagem: personagemId, idItem: Number(selectedItemId) },
      personagemId,
      quantidade: Number(quantidade),
    });
    setInventario((prev) => [...prev, response.data]);
    setIsModalOpen(false);
    setSelectedItemId("");
    setQuantidade(1);
    fetchAll();
  } catch (error) {
    if (error.response?.status === 409) {
      alert(error.response?.data?.message || "Não foi possível adicionar o item — verifique o estoque disponível.");
    } else {
      console.error("Erro ao adicionar item ao inventário:", error);
    }
  }
};

  const handleCreateItem = async (e) => {
    e.preventDefault();
    const form = e.target;
    const nome = form.elements.namedItem("nome").value;
    const descricao = form.elements.namedItem("descricao").value;
    const quantidadeBase = form.elements.namedItem("quantidadeBase").value;
    try {
      const response = await api.post("/item", { nome, descricao, quantidade: Number(quantidadeBase) });
      setCatalogo((prev) => [...prev, response.data]);
      form.reset();
      setIsCatalogModalOpen(false);
    } catch (error) {
      console.error("Erro ao criar item no catálogo:", error);
    }
  };

  const handleRemove = async (entry) => {
  try {
    await api.delete(`/inventario/${entry.id.idPersonagem}/${entry.id.idItem}`);
    setInventario((prev) => prev.filter((i) => i !== entry));
    fetchAll(); // atualiza estoque do catálogo
  } catch (error) {
    console.error("Erro ao remover item do inventário:", error);
  }
};
const handleChangeQuantity = async (entry, delta) => {
  
  if (delta < 0 && entry.quantidade + delta <= 0) {
    return handleRemove(entry);
  }

  try {
    const response = await api.patch(
      `/inventario/${entry.id.idPersonagem}/${entry.id.idItem}?delta=${delta}`
    );

    if (response.status === 204) {
      setInventario((prev) => prev.filter((i) => i !== entry));
    } else {
      setInventario((prev) =>
        prev.map((i) => (i === entry ? response.data : i))
      );
    }

    fetchAll();
  } catch (error) {
    if (error.response?.status === 409) {
      alert(error.response?.data?.message || "Não foi possível adicionar o item — verifique o estoque disponível.");
    } else {
      console.error("Erro ao adicionar item ao inventário:", error);
    }
  }
};

  const filtered = inventario.filter((i) =>
    i.nomeItem?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full bg-[#0B0A0D] font-body relative">
      <FontImports />
      <div className="fixed inset-0 pointer-events-none opacity-[0.12] z-0"
           style={{ backgroundImage: 'radial-gradient(#B99A4B 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

      <header className="sticky top-0 z-30 bg-[#15121A] border-b-2 border-[#B99A4B]/40 px-4 md:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/personagem" className="w-9 h-9 rounded-full bg-[#7A1230] border-2 border-[#B99A4B] flex items-center justify-center shrink-0 hover:bg-[#3F8574] transition-colors">
            <ArrowLeft className="w-4 h-4 text-[#EAE0C4]" />
          </Link>
          <div>
            <h1 className="font-display font-bold text-lg text-[#EAE0C4] leading-none">INVENTÁRIO</h1>
            <span className="font-mono-ieji text-[10px] text-[#B99A4B] tracking-widest">EVIDÊNCIAS E PERTENCES</span>
          </div>
        </div>
        <Backpack className="w-6 h-6 text-[#B99A4B]" />
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10 relative z-10">

        <div className="flex flex-col gap-4 mb-8">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-[#5b5346] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar item..."
              className="w-full bg-[#EAE0C4] border-2 border-[#0B0A0D] rounded-sm pl-9 pr-3 py-2 font-mono-ieji text-sm text-[#201A1E] focus:outline-none focus:border-[#7A1230]"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:self-end">
            {podeCriarItem && (
              <Button onClick={() => setIsCatalogModalOpen(true)} className="w-full sm:w-auto justify-center bg-transparent border-2 border-[#B99A4B] text-[#EAE0C4] hover:bg-[#B99A4B]/10 font-mono-ieji text-xs gap-2 whitespace-normal py-2.5">
                <Package className="w-4 h-4 shrink-0" /> Novo item no catálogo
              </Button>
            )}
            <Button
              onClick={() => setIsModalOpen(true)}
              disabled={!personagemId}
              className="w-full sm:w-auto justify-center bg-[#7A1230] text-[#EAE0C4] hover:bg-[#EAE0C4] hover:text-[#201A1E] border-2 border-[#0B0A0D] font-display font-bold gap-2 shadow-[3px_3px_0px_0px_#B99A4B] disabled:opacity-40 disabled:cursor-not-allowed whitespace-normal py-2.5"
            >
              <Plus className="w-4 h-4 shrink-0" /> Adicionar ao inventário
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-[#EAE0C4] border-4 border-dashed border-[#B99A4B] rounded-sm p-16 text-center">
            <Skull className="w-10 h-10 text-[#7A1230] mx-auto mb-4" strokeWidth={1.3} />
            <p className="font-display font-bold text-xl text-[#201A1E]">Mochila vazia</p>
            <p className="font-body text-[#5b5346] mt-1">Nenhum item registrado neste dossiê ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {filtered.map((entry, idx) => (
                <motion.div
                  key={`${entry.id?.idPersonagem}-${entry.id?.idItem}-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm overflow-hidden shadow-[6px_6px_0px_0px_#7A1230] flex flex-col"
                >
                  <div className="bg-[#201A1E] px-4 py-2 flex justify-between items-center">
                    <span className="font-mono-ieji text-[10px] text-[#B99A4B] uppercase tracking-widest truncate">
                      Item nº{entry.id?.itemId ?? "—"}
                    </span>
                    <button onClick={() => handleRemove(entry)} className="text-[#7A1230] hover:text-[#EAE0C4] transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-display font-bold text-lg text-[#201A1E] mb-2">{entry.nomeItem}</h3>
                    <p className="font-mono-ieji text-[10px] text-[#5b5346] uppercase tracking-wide mb-4">
                      Portado por {entry.nomePersonagem}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-dashed border-[#B99A4B]">
                      <span className="font-mono-ieji text-[10px] uppercase text-[#5b5346]">Quantidade</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleChangeQuantity(entry, -1)}
                          className="w-7 h-7 border-2 border-[#0B0A0D] rounded-sm hover:bg-[#0B0A0D] hover:text-[#EAE0C4] flex items-center justify-center transition-colors"
                          title="Diminuir quantidade"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <span className="font-display font-bold text-2xl text-[#7A1230] w-8 text-center">
                          {entry.quantidade}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleChangeQuantity(entry, 1)}
                          className="w-7 h-7 border-2 border-[#0B0A0D] rounded-sm hover:bg-[#0B0A0D] hover:text-[#EAE0C4] flex items-center justify-center transition-colors"
                          title="Aumentar quantidade"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* CATÁLOGO */}
        <div className="mt-14">
          <h3 className="font-display font-bold text-2xl text-[#EAE0C4] mb-4 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-[#B99A4B]" /> Catálogo de Itens
          </h3>
          <div className="bg-[#15121A] border-2 border-[#B99A4B]/40 rounded-sm divide-y divide-[#B99A4B]/20">
            {catalogo.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-display font-semibold text-[#EAE0C4]">{item.nome}</p>
                  <p className="font-body text-sm text-[#8A8578]">{item.descricao}</p>
                </div>
                <span className="font-mono-ieji text-xs text-[#B99A4B]">x{item.quantidade}</span>
              </div>
            ))}
            {catalogo.length === 0 && (
              <p className="font-mono-ieji text-xs text-[#5b5346] px-5 py-6 text-center">Nenhum item cadastrado no catálogo.</p>
            )}
          </div>
        </div>
      </main>

      {/* MODAL: ADICIONAR AO INVENTÁRIO */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm p-6 shadow-[8px_8px_0px_0px_#7A1230] w-full max-w-md relative z-10">
              <div className="flex justify-between items-center mb-5 border-b-2 border-[#0B0A0D] pb-2">
                <h3 className="font-display font-bold text-2xl text-[#201A1E]">ADICIONAR ITEM</h3>
                <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 hover:text-[#7A1230]" /></button>
              </div>
              <form onSubmit={handleAddToInventory} className="space-y-4">
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Item do catálogo</Label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-body text-sm"
                    required
                  >
                    <option value="">Selecione um item...</option>
                    {catalogo.map((item) => (
                      <option key={item.id} value={item.id}>{item.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Quantidade</Label>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setQuantidade((q) => Math.max(1, q - 1))} className="w-8 h-8 border-2 border-[#0B0A0D] rounded-sm hover:bg-[#0B0A0D] hover:text-[#EAE0C4]"><Minus className="w-4 h-4 mx-auto" /></button>
                    <span className="font-mono-ieji font-bold text-lg w-8 text-center">{quantidade}</span>
                    <button type="button" onClick={() => setQuantidade((q) => q + 1)} className="w-8 h-8 border-2 border-[#0B0A0D] rounded-sm hover:bg-[#0B0A0D] hover:text-[#EAE0C4]"><Plus className="w-4 h-4 mx-auto" /></button>
                  </div>
                </div>
                <div className="pt-3 flex justify-end gap-2">
                  <Button type="button" onClick={() => setIsModalOpen(false)} className="bg-transparent border-2 border-[#0B0A0D] font-mono-ieji text-xs">CANCELAR</Button>
                  <Button type="submit" className="bg-[#7A1230] text-[#EAE0C4] border-2 border-[#0B0A0D] font-display font-bold">GUARDAR ITEM</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: NOVO ITEM NO CATÁLOGO */}
      <AnimatePresence>
        {isCatalogModalOpen && podeCriarItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCatalogModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm p-6 shadow-[8px_8px_0px_0px_#B99A4B] w-full max-w-md relative z-10">
              <div className="flex justify-between items-center mb-5 border-b-2 border-[#0B0A0D] pb-2">
                <h3 className="font-display font-bold text-2xl text-[#201A1E]">NOVO ITEM</h3>
                <button onClick={() => setIsCatalogModalOpen(false)}><X className="w-5 h-5 hover:text-[#7A1230]" /></button>
              </div>
              <form onSubmit={handleCreateItem} className="space-y-4">
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Nome</Label>
                  <input name="nome" required className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-body text-sm" placeholder="Ex: Lanterna consagrada" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Descrição</Label>
                  <textarea name="descricao" rows={3} className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-body text-sm resize-none" placeholder="Para que serve, como foi obtido..." />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono-ieji text-[10px] uppercase">Quantidade base</Label>
                  <input name="quantidadeBase" type="number" defaultValue={1} min={0} className="w-full bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm p-2.5 font-mono-ieji text-sm" />
                </div>
                <div className="pt-3 flex justify-end gap-2">
                  <Button type="button" onClick={() => setIsCatalogModalOpen(false)} className="bg-transparent border-2 border-[#0B0A0D] font-mono-ieji text-xs">CANCELAR</Button>
                  <Button type="submit" className="bg-[#B99A4B] text-[#0B0A0D] border-2 border-[#0B0A0D] font-display font-bold">CADASTRAR</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventario;
