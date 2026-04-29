'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Trash2, Minimize2, Database } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  message: string;
  timestamp: Date;
}

export default function AIChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', message: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, sessionId }),
      });
      const json = await res.json();

      if (json.success) {
        setMessages(prev => [...prev, { role: 'assistant', message: json.reply, timestamp: new Date() }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', message: `❌ Error: ${json.error}`, timestamp: new Date() }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', message: '❌ Gagal terhubung ke server', timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0f766e, #0d9488)',
          border: 'none',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(15, 118, 110, 0.3)',
          transition: 'all 200ms ease',
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.1)'; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
        title="Chat AI Asisten"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 1000,
      width: isMinimized ? 300 : 400,
      height: isMinimized ? 48 : 560,
      borderRadius: 16,
      background: 'rgba(255,255,255,0.75)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255,255,255,0.4)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'all 250ms ease',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #0f766e, #0d9488)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }} onClick={() => isMinimized && setIsMinimized(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={16} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>AI Asisten Anggaran</div>
            {!isMinimized && (
              <div style={{ fontSize: 10, opacity: 0.8 }}>RAG-Powered • Tanya seputar data & keuangan</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!isMinimized && (
            <>
              <button 
                onClick={async (e) => { 
                  e.stopPropagation(); 
                  if(confirm('Sync data ke AI Vector (Embedding)? Butuh beberapa saat.')) {
                    try {
                      setMessages(prev => [...prev, { role: 'assistant', message: '🔄 Memulai sync data ke Vector DB...', timestamp: new Date() }]);
                      const res = await fetch('/api/embeddings/sync', { method: 'POST' });
                      const json = await res.json();
                      if(json.success) setMessages(prev => [...prev, { role: 'assistant', message: `✅ Sync sukses: ${json.message}`, timestamp: new Date() }]);
                      else setMessages(prev => [...prev, { role: 'assistant', message: `❌ Sync gagal: ${json.error}`, timestamp: new Date() }]);
                    } catch(err) {
                      setMessages(prev => [...prev, { role: 'assistant', message: `❌ Sync error, coba lagi`, timestamp: new Date() }]);
                    }
                  }
                }} 
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'white' }} 
                title="Sync Semantic Search Data"
              >
                <Database size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); clearChat(); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'white' }} title="Hapus chat">
                <Trash2 size={14} />
              </button>
            </>
          )}
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'white' }} title="Minimize">
            <Minimize2 size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'white' }} title="Tutup">
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'rgba(248, 250, 252, 0.6)',
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Bot size={40} color="#99f6e4" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 6 }}>
                  Halo! Saya AI asisten untuk Rencana Anggaran.
                </p>
                <p style={{ color: '#9ca3af', fontSize: 11, marginBottom: 16 }}>
                  Saya terhubung langsung ke database Anda dan dapat menjawab pertanyaan tentang hutang, vendor, harga barang, stok, dan lainnya.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    '📊 Berapa total hutang bulan ini?',
                    '🏪 Vendor mana yang hutangnya paling besar?',
                    '📈 Ada barang yang harganya naik drastis?',
                    '🤖 Berapa item yang statusnya selisih?',
                    '⏰ Invoice mana yang sudah jatuh tempo?',
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(suggestion); }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        background: 'white',
                        color: '#374151',
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#f0fdfa'; (e.target as HTMLElement).style.borderColor = '#99f6e4'; }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'white'; (e.target as HTMLElement).style.borderColor = '#e5e7eb'; }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 8,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #0f766e, #0d9488)' : 'rgba(243, 244, 246, 0.7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'user' ? <User size={14} color="white" /> : <Bot size={14} color="#6b7280" />}
                </div>
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #0f766e, #0d9488)' : 'rgba(255,255,255,0.8)',
                  color: msg.role === 'user' ? 'white' : '#374151',
                  fontSize: 13,
                  lineHeight: 1.5,
                  boxShadow: msg.role === 'assistant' ? '0 2px 8px rgba(0,0,0,0.06)' : '0 2px 8px rgba(15,118,110,0.15)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.message}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={14} color="#6b7280" />
                </div>
                <div style={{
                  padding: '10px 14px', borderRadius: 12, background: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Loader2 size={14} className="pulse" color="#6b7280" />
                  <span style={{ color: '#6b7280', fontSize: 12 }}>Sedang berpikir...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: 8,
            background: 'rgba(255,255,255,0.7)',
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pertanyaan..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: 13,
                outline: 'none',
                transition: 'border 150ms',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#0d9488'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                width: 40, height: 40,
                borderRadius: 10,
                border: 'none',
                background: input.trim() ? 'linear-gradient(135deg, #0f766e, #0d9488)' : 'rgba(229,231,235,0.7)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all 150ms ease',
                flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
