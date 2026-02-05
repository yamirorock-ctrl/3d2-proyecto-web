import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Sparkles, Loader2, Minimize2, ShoppingBag, Eye, Printer } from 'lucide-react';
import { Message, Product } from '../types';
import { createChatSession, sendMessageToGemini } from '../services/geminiService';
import { ChatSession } from '@google/generative-ai';
import { useNavigate } from 'react-router-dom';

interface ChatAssistantProps {
  products: Product[];
}

interface ParsedContent {
  text: string;
  recommendations: Array<{
    id: string;
    name: string;
    price: number;
    image: string;
  }>;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ products }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: '¡Hola! 👇 Soy Printy 🖨️, el asistente virtual de 3D2. ¿En qué puedo ayudarte hoy?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<ChatSession | null>(null);

  // Estados para manejar errores de imagen (fallback)
  const [imgErrorButton, setImgErrorButton] = useState(false);
  const [imgErrorHeader, setImgErrorHeader] = useState(false);

  useEffect(() => {
    if (isOpen && !chatSessionRef.current) {
      chatSessionRef.current = createChatSession(products);
    }
  }, [isOpen, products]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || !chatSessionRef.current) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const responseText = await sendMessageToGemini(chatSessionRef.current, userMessage.text);

    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMessage]);
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const parseMessageContent = (text: string): ParsedContent => {
    const productRegex = /\[PRODUCT:({.*?})\]/g;
    const recommendations: any[] = [];
    
    let cleanText = text.replace(productRegex, (match, jsonStr) => {
      try {
        const product = JSON.parse(jsonStr);
        recommendations.push(product);
        return '';
      } catch (e) {
        return '';
      }
    });

    return { text: cleanText.trim(), recommendations };
  };

  const handleProductClick = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-indigo-600 text-white rounded-full shadow-xl hover:bg-indigo-700 hover:scale-110 transition-all flex items-center gap-2 group animate-in fade-in zoom-in duration-300"
      >
        <div className="relative w-12 h-12">
            {!imgErrorButton ? (
              <img 
                src="/printy.png?v=3" 
                alt="Printy" 
                className="w-full h-full object-cover rounded-full shadow-sm group-hover:rotate-12 transition-transform border border-indigo-400"
                onError={() => setImgErrorButton(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-indigo-500 rounded-full">
                 <Printer size={24} className="group-hover:rotate-12 transition-transform" />
              </div>
            )}
            
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 z-10">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500 border border-white"></span>
            </span>
        </div>
        <span className="font-medium max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
          Chat con Printy
        </span>
      </button>
    );
  }

  return (
    <div 
      className={`fixed z-50 bg-white shadow-2xl rounded-2xl border border-gray-200 transition-all duration-300 flex flex-col font-sans ${
        isMinimized 
          ? 'bottom-6 right-6 w-72 h-16 overflow-hidden cursor-pointer' 
          : 'bottom-6 right-6 w-[90vw] sm:w-96 h-[80vh] sm:h-[600px] max-h-[600px]'
      }`}
    >
      {/* Header */}
      <div 
        className="bg-indigo-600 p-4 flex justify-between items-center text-white cursor-pointer rounded-t-2xl group"
        onClick={() => isMinimized ? setIsMinimized(false) : null}
      >
        <div className="flex items-center gap-2">
          <div className={`rounded-full overflow-hidden transition-all duration-300 w-9 h-9 border border-white/20 bg-white ${isLoading ? 'animate-pulse ring-2 ring-white/40' : 'group-hover:scale-110 group-hover:rotate-6'}`}>
            {!imgErrorHeader ? (
              <img 
                src="/printy.png?v=3" 
                alt="Printy" 
                className={`w-full h-full object-cover ${isLoading ? 'animate-bounce' : ''}`}
                onError={() => setImgErrorHeader(true)}
              />
            ) : (
               <div className="w-full h-full flex items-center justify-center bg-white/20 text-indigo-600">
                  <Printer size={18} />
               </div>
            )}
          </div>
          <div>
            <h3 className="font-bold text-sm">Printy (Asistente 3D2)</h3>
            {!isMinimized && (
                <p className="text-xs text-indigo-100 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 bg-green-400 rounded-full ${isLoading ? 'animate-ping' : 'animate-pulse'}`}></span> 
                    {isLoading ? 'Imprimiendo respuesta...' : 'Online (Gemini 3.0)'}
                </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isMinimized && (
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Minimize2 size={16} />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsMinimized(false); }}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
            {messages.map((msg) => {
              const { text, recommendations } = parseMessageContent(msg.text);
              const isUser = msg.role === 'user';

              return (
                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-2`}>
                  {/* Bubble */}
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white text-slate-700 border border-gray-100 rounded-tl-none'
                    }`}
                  >
                    {text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                      part.match(/https?:\/\/[^\s]+/) ? (
                        <a 
                          key={i} 
                          href={part} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className={`underline break-all ${isUser ? 'text-indigo-100 hover:text-white' : 'text-indigo-600 hover:text-indigo-800'}`}
                        >
                          {part}
                        </a>
                      ) : (
                        <span key={i} className="whitespace-pre-wrap">{part}</span>
                      )
                    )}
                  </div>

                  {/* Recommendations Cards (Only for Bot) */}
                  {!isUser && recommendations.length > 0 && (
                     <div className="flex gap-2 overflow-x-auto pb-2 w-full max-w-[90%] snap-x">
                        {recommendations.map((rec, idx) => (
                          <div 
                             key={idx}
                             onClick={() => handleProductClick(rec.id)}
                             className="snap-center min-w-[200px] w-[200px] bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group shrink-0"
                          >
                             <div className="h-24 w-full bg-gray-100 relative overflow-hidden">
                                {rec.image ? (
                                    <img src={rec.image} alt={rec.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><ShoppingBag size={24} /></div>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all" />
                             </div>
                             <div className="p-3">
                                <h4 className="font-semibold text-slate-800 text-xs line-clamp-1 mb-1">{rec.name}</h4>
                                <div className="flex justify-between items-center">
                                    <span className="text-indigo-600 font-bold text-sm">${rec.price?.toLocaleString()}</span>
                                    <button className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors">
                                        <Eye size={14} />
                                    </button>
                                </div>
                             </div>
                          </div>
                        ))}
                     </div>
                  )}
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 flex items-center gap-3">
                  <Loader2 size={18} className="animate-spin text-indigo-600" />
                  <span className="text-xs text-slate-500 animate-pulse">Pensando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-gray-100 bg-white rounded-b-2xl">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Pregunta sobre productos..."
                className="w-full pl-4 pr-12 py-3.5 bg-gray-50 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all border border-transparent placeholder:text-gray-400"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                <Send size={18} />
              </button>
            </div>
            <div className="text-center mt-2">
                 <span className="text-[10px] text-gray-300">Powered by Gemini 3.0</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatAssistant;