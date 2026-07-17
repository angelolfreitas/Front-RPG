import { useState, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { Send, Users, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChatSessao({ idCaso }) {
  const API_URL = import.meta.env.VITE_API_URL;
  const [mensagens, setMensagens] = useState([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [jogadoresOnline, setJogadoresOnline] = useState([]);
  const [usuariosRegistrados, setUsuariosRegistrados] = useState([]);
  const stompClient = useRef(null);
  const messagesEndRef = useRef(null);

  // Rola o chat para baixo automaticamente
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    // 1. Busca Histórico REST
    const fetchHistorico = async () => {
      try {
        const response = await fetch(`${API_URL}/chat/caso/${idCaso}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setMensagens(data);
        }
      } catch (error) {
        console.error("Erro ao buscar histórico:", error);
      }
    };

    // 2. Busca todos os usuários cadastrados no caso (não só os online)
    const fetchUsuariosRegistrados = async () => {
      try {
        const response = await fetch(`${API_URL}/casos/${idCaso}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUsuariosRegistrados(data);
        }
      } catch (error) {
        console.error("Erro ao buscar usuários do caso:", error);
      }
    };

    fetchHistorico();
    fetchUsuariosRegistrados();

    // 3. Conecta no WebSocket
    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/caso/${idCaso}/chat`, (message) => {
          const msg = JSON.parse(message.body);
          setMensagens((prev) => [...prev, msg]);
        });
        client.subscribe(`/topic/caso/${idCaso}/presenca`, (message) => {
          setJogadoresOnline(JSON.parse(message.body));
        });
      },
    });

    client.activate();
    stompClient.current = client;

    return () => client.deactivate();
  }, [idCaso]);

  const enviarMensagem = (e) => {
    e.preventDefault();
    const autorId = localStorage.getItem("usuarioId");
    const personagemId = localStorage.getItem("personagemSelecionadoId");

    if (!autorId) {
      console.error("Erro: Usuário não identificado. Faça login novamente.");
      return;
    }

    if (novaMensagem.trim() && stompClient.current?.connected) {
      stompClient.current.publish({
        destination: `/app/caso/${idCaso}/chat`,
        body: JSON.stringify({
            idCaso: idCaso,
            conteudo: novaMensagem,
            authorId: Number(autorId),
            personagemId: personagemId ? Number(personagemId) : null,
        })
      });
      setNovaMensagem("");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[75vh] max-h-[600px] w-full">
      {/* ÁREA DO CHAT */}
      <div className="order-1 lg:order-none flex-1 flex flex-col bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm shadow-[6px_6px_0px_0px_#3F8574] overflow-hidden">
        <div className="bg-[#201A1E] px-4 py-3 flex items-center gap-2 border-b-2 border-[#0B0A0D]">
          <ShieldAlert className="w-5 h-5 text-[#3F8574]" />
          <h3 className="font-display font-bold text-lg text-[#EAE0C4] leading-none mt-1">REGISTRO DE COMUNICAÇÃO</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5EFDD]">
          {mensagens.map((msg, idx) => (
            <div key={idx} className="flex flex-col">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-display font-bold text-[#7A1230]">{msg.autorNome}</span>
                <span className="font-mono-ieji text-[9px] text-[#5b5346]">
                  {new Date(msg.enviadoEm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
             <p className="font-body text-[#201A1E] text-base leading-snug bg-[#EAE0C4] border border-[#0B0A0D]/20 p-2.5 rounded-sm w-fit max-w-[85%] break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                {msg.conteudo}
              </p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={enviarMensagem} className="p-3 bg-[#EAE0C4] border-t-2 border-[#0B0A0D] flex gap-2">
          <input
            type="text"
            value={novaMensagem}
            onChange={(e) => setNovaMensagem(e.target.value)}
            placeholder="Descreva sua ação ou fala..."
            className="flex-1 bg-[#F5EFDD] border-2 border-[#0B0A0D] rounded-sm px-3 py-2 font-body text-[#201A1E] focus:outline-none focus:border-[#3F8574] placeholder:italic"
          />
          <Button type="submit" className="bg-[#3F8574] text-[#EAE0C4] hover:bg-[#201A1E] border-2 border-[#0B0A0D] font-mono-ieji font-bold px-4">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* ÁREA DE AGENTES — todos os cadastrados no caso, com indicador de online */}
      <div className="order-2 lg:order-none w-full lg:w-64 flex flex-col bg-[#EAE0C4] border-4 border-[#0B0A0D] rounded-sm shadow-[6px_6px_0px_0px_#B99A4B] lg:h-full overflow-hidden">
        <div className="bg-[#201A1E] px-4 py-3 flex items-center justify-between border-b-2 border-[#0B0A0D]">
          <h3 className="font-display font-bold text-lg text-[#EAE0C4] leading-none mt-1">AGENTES</h3>
          <Users className="w-4 h-4 text-[#B99A4B]" />
        </div>
        <div className="p-4 flex-1 bg-[#F5EFDD] overflow-y-auto">
          <span className="font-mono-ieji text-[10px] uppercase tracking-widest text-[#5b5346] mb-3 block">
            Registrados ({usuariosRegistrados.length})
          </span>
          <ul className="space-y-2">
            {usuariosRegistrados.map((usuario) => {
              const online = jogadoresOnline.some((j) => j.id === usuario.id);
              return (
                <li key={usuario.id} className="flex items-center gap-2 font-mono-ieji text-sm text-[#201A1E]">
                  <span
                    className={`w-2 h-2 rounded-full border border-[#0B0A0D] shrink-0 ${
                      online ? "bg-[#3F8574] animate-pulse" : "bg-[#5b5346]/40"
                    }`}
                  />
                  <span className={online ? "" : "opacity-50"}>{usuario.username}</span>
                </li>
              );
            })}
            {usuariosRegistrados.length === 0 && (
              <li className="font-body text-[#5b5346] italic text-sm">Nenhum agente registrado nesta sessão.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
