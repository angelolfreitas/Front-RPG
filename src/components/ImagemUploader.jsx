import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Camera, Loader2, Check, AlertCircle } from "lucide-react";

/**
 * Uploader genérico de imagem: sobe pro Cloudinary (via backend) e
 * já persiste a imagemUrl na entidade certa (personagem ou monstro).
 *
 * Props:
 * - tipo: "personagem" | "monstro"
 * - entidadeId: id do personagem ou monstro que vai receber a imagem
 * - imagemAtual: url atual (pra mostrar preview antes de trocar)
 * - onSucesso: (novaUrl) => void  -> chamado quando tudo terminar com sucesso
 * - tamanho: "sm" | "md" | "lg" -> controla o tamanho do círculo de preview
 */
export default function ImagemUploader({
  tipo,
  entidadeId,
  imagemAtual,
  onSucesso,
  tamanho = "md",
}) {
  const API_URL = import.meta.env.VITE_API_URL;
  const [preview, setPreview] = useState(imagemAtual || null);
  const [status, setStatus] = useState("idle"); // idle | subindo | salvando | sucesso | erro
  const [erro, setErro] = useState(null);
  const inputRef = useRef(null);

  const tamanhos = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  const handleSelecionar = () => inputRef.current?.click();

  const handleArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validações básicas antes de gastar banda
    if (!file.type.startsWith("image/")) {
      setErro("Selecione um arquivo de imagem.");
      setStatus("erro");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErro("Imagem muito grande (máx. 8MB).");
      setStatus("erro");
      return;
    }

    // Preview instantâneo local, antes mesmo do upload terminar
    const previewLocal = URL.createObjectURL(file);
    setPreview(previewLocal);
    setErro(null);
    setStatus("subindo");

    try {
      const token = localStorage.getItem("token");

      // 1. Upload da imagem pro Cloudinary via backend
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipo", tipo === "personagem" ? "personagens" : "monstros");

      const uploadResponse = await fetch(`${API_URL}/uploads/imagem`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Falha ao subir a imagem.");
      }

      const { url } = await uploadResponse.json();

      // 2. Persiste a imagemUrl na entidade (personagem ou monstro)
      setStatus("salvando");
      const endpoint = tipo === "personagem" ? "personagem" : "monstro";

      const patchResponse = await fetch(
        `${API_URL}/${endpoint}/${entidadeId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imagemUrl: url }),
        }
      );

      if (!patchResponse.ok) {
        throw new Error("Imagem subiu, mas não consegui salvar no personagem/monstro.");
      }

      setPreview(url);
      setStatus("sucesso");
      onSucesso?.(url);

      // Volta pro estado neutro depois de mostrar o check de sucesso
      setTimeout(() => setStatus("idle"), 1800);
    } catch (err) {
      console.error(err);
      setErro(err.message || "Erro ao enviar imagem.");
      setStatus("erro");
    } finally {
      e.target.value = ""; // permite re-selecionar o mesmo arquivo depois
    }
  };

  const carregando = status === "subindo" || status === "salvando";

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleSelecionar}
        disabled={carregando}
        className={`relative ${tamanhos[tamanho]} rounded-full border-4 border-[#B99A4B] bg-[#15121A] overflow-hidden shrink-0 group disabled:opacity-70`}
      >
        {preview ? (
          <img
            src={preview}
            alt="Retrato"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#201A1E]">
            <Camera className="w-6 h-6 text-[#B99A4B]/60" />
          </div>
        )}

        {/* Overlay de hover / estado */}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {!carregando && status !== "sucesso" && (
            <Camera className="w-5 h-5 text-[#EAE0C4]" />
          )}
        </div>

        {carregando && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#EAE0C4] animate-spin" />
          </div>
        )}

        {status === "sucesso" && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute inset-0 bg-[#3F8574]/80 flex items-center justify-center"
          >
            <Check className="w-6 h-6 text-[#EAE0C4]" />
          </motion.div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleArquivo}
      />

      <span className="font-mono-ieji text-[10px] text-[#B99A4B]/70 text-center">
        {status === "subindo" && "Enviando..."}
        {status === "salvando" && "Salvando..."}
        {status === "erro" && (
          <span className="text-[#7A1230] flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {erro}
          </span>
        )}
        {(status === "idle" || status === "sucesso") && "Toque pra trocar a foto"}
      </span>
    </div>
  );
}

export function RetratoElegante({ imagemUrl, className = "" }) {
  if (!imagemUrl) return null;

  return (
    <div className={`relative overflow-hidden pointer-events-none ${className}`}>
      <img
        src={imagemUrl}
        alt="Retrato"
        className="w-full h-full object-cover object-top"
        style={{
          maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))",
        }}
      />
    </div>
  );
}