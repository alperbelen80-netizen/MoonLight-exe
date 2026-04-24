import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, User } from 'lucide-react';
import { getApiBase } from '../services/api-client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AIStatus {
  available: boolean;
  model: string;
  provider: string;
}

const SUGGESTED_PROMPTS = [
  'MoonLight OS şu an hangi modda çalışıyor? Kısaca özetle.',
  'Canlı sinyal modunda risk yönetimi neleri kapsar?',
  'RSI + MACD kombinasyonu ne zaman en iyi sonuç verir?',
  'Quad-core broker routing mantığı nasıl çalışır?',
];

export function AICoachPage() {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Merhaba! Ben MoonLight AI Coach (Gemini 2.5 Flash). Strateji analizi, piyasa rejimi veya veri kaynakları ile ilgili sorularınızı yanıtlayabilirim.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const base = getApiBase();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${base}/ai-coach/status`);
        if (res.ok) setStatus(await res.json());
      } catch {
        // ignore
      }
    })();
  }, [base]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text || sending) return;

      setInput('');
      setError(null);
      const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      try {
        const res = await fetch(`${base}/ai-coach/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        const reply: ChatMessage = {
          role: 'assistant',
          content: data?.reply ?? '(Boş yanıt)',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, reply]);
      } catch (e: any) {
        setError(e?.message || 'send failed');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `(Hata: ${e?.message || 'bilinmeyen'})`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [base, input, sending],
  );

  return (
    <div data-testid="ai-coach-page" className="h-full flex flex-col space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-600" />
            AI Coach
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Strateji koaçı ve piyasa asistanı — Emergent LLM Gateway üzerinden
            <span className="font-mono mx-1">{status?.model || 'gemini-2.5-flash'}</span> modeliyle çalışır.
          </p>
        </div>
        <span
          data-testid="ai-coach-status-badge"
          className={`px-3 py-1 text-xs font-medium border rounded ${
            status?.available
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {status?.available ? 'AI aktif' : 'AI pasif'}
        </span>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden min-h-[500px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              data-testid={`ai-coach-message-${m.role}`}
              className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.role === 'user'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-violet-100 text-violet-700'
                }`}
              >
                {m.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div
                className={`max-w-2xl rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-gray-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-100 rounded-2xl px-4 py-2.5 text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Düşünüyor…
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="border-t bg-slate-50 px-4 py-3">
            <div className="text-xs text-gray-500 mb-2">Öneriler:</div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((s, i) => (
                <button
                  key={i}
                  data-testid={`ai-coach-suggestion-${i}`}
                  onClick={() => send(s)}
                  disabled={sending}
                  className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:bg-violet-50 hover:border-violet-200 text-gray-700 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t bg-white p-4 flex gap-2"
        >
          <input
            data-testid="ai-coach-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Sorunuzu yazın…"
            disabled={sending || !status?.available}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-gray-400"
          />
          <button
            data-testid="ai-coach-send-btn"
            type="submit"
            disabled={sending || !input.trim() || !status?.available}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Gönder
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          {error}
        </div>
      )}
    </div>
  );
}

export default AICoachPage;
