import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

/**
 * Abre (e fecha) uma conexão STOMP para o caso informado, no mesmo padrão
 * que o ChatSessao já usa. Qualquer tela que precise publicar/assinar tópicos
 * de um caso (chat, monstros, batalha...) pode chamar esse hook em vez de
 * depender de receber um stompClient já conectado via prop.
 *
 * Retorna o client do @stomp/stompjs assim que ele conecta, ou null enquanto
 * não há conexão ativa (ainda conectando, sem idCaso, ou desconectado).
 */
export function useStompClient(idCaso) {
  const API_URL = import.meta.env.VITE_API_URL;
  const clientRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!idCaso) return undefined;

    const token = localStorage.getItem("token");

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => setIsConnected(true),
      onWebSocketClose: () => setIsConnected(false),
      onStompError: () => setIsConnected(false),
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
      setIsConnected(false);
    };
  }, [idCaso]);

  return isConnected ? clientRef.current : null;
}
