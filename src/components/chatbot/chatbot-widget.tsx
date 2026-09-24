'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

import Image from 'next/image';

import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bot, Clock3, MessageCircle, Plus, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { CHATBOT_NAME } from '@/constants/chatbot';
import { addToCart } from '@/services/cart.service';
import { isSessionExpired } from '@/constants/auth';

type ChatMessage = { id: string; role: 'USER' | 'ASSISTANT'; content: string; metadata?: AssistantContent | null; createdAt: string };
type ChatSession = { id: string; title: string; createdAt: string; updatedAt: string; _count?: { messages: number } };
type ProductCard = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  category: string;
  reason: string;
  variants: Array<{ id: string; sku: string; stock: number; attributes: Record<string, string> }>;
};
type AssistantContent = { productCards: ProductCard[]; actions: Array<{ productId: string; variantId: string | null; quantity: number }> };
type SessionPage = { session: ChatSession; messages: ChatMessage[]; hasMore: boolean; nextBeforeId?: string };
type ApiEnvelope<T> = { success: boolean; message: string; data?: T };

async function readApiData<T>(response: Response): Promise<T> {
  const result = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !result.success || !result.data) throw new Error(result.message || 'Request failed');
  return result.data;
}

async function fetchSessions(): Promise<ChatSession[]> {
  const response = await fetch('/api/chatbot/sessions', { cache: 'no-store' });
  const data = await readApiData<{ sessions: ChatSession[] }>(response);
  return data.sessions;
}

async function fetchSession(sessionId: string, beforeId?: string): Promise<SessionPage> {
  const query = beforeId ? `?before=${encodeURIComponent(beforeId)}` : '';
  const response = await fetch(`/api/chatbot/sessions/${encodeURIComponent(sessionId)}${query}`, { cache: 'no-store' });
  return readApiData<SessionPage>(response);
}

function ChatProductCard({ product }: { product: ProductCard }) {
  const { showSuccess, showError } = useToast();
  const availableVariants = product.variants.filter((variant) => variant.stock > 0);
  const [variantId, setVariantId] = useState(availableVariants[0]?.id || '');
  const selectedVariant = product.variants.find((variant) => variant.id === variantId);
  const variantLabel = (variant: ProductCard['variants'][number]) => {
    const attributes = Object.entries(variant.attributes).map(([key, value]) => `${key}: ${value}`);
    return attributes.length ? attributes.join(' · ') : variant.sku;
  };

  const handleAdd = async () => {
    try {
      await addToCart(product.id, selectedVariant?.id || null, 1);
      showSuccess(`${product.name} added to your cart.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not add this item to your cart.');
    }
  };

  return (
    <article className="w-[250px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex gap-3 p-3">
        <Image
          src={product.imageUrl || '/FastShopStore.png'}
          alt={product.name}
          width={72}
          height={72}
          unoptimized
          className="h-[72px] w-[72px] rounded-lg bg-slate-100 object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold text-slate-900">{product.name}</p>
          <p className="mt-1 text-xs text-slate-500">{product.category}</p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {product.price.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
          </p>
        </div>
      </div>
      {product.variants.length > 1 && (
        <div className="px-3 pb-2">
          <label className="sr-only" htmlFor={`variant-${product.id}`}>Choose a variant</label>
          <select
            id={`variant-${product.id}`}
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {product.variants.map((variant) => (
              <option key={variant.id} value={variant.id} disabled={variant.stock < 1}>
                {variantLabel(variant)}{variant.stock < 1 ? ' · Out of stock' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
        <span className="text-xs text-slate-500">{selectedVariant?.stock ?? product.stock} in stock</span>
        <Button size="sm" className="h-8" disabled={product.stock < 1 || Boolean(product.variants.length && !selectedVariant?.stock)} onClick={handleAdd}>
          Add to cart
        </Button>
      </div>
    </article>
  );
}

function messageAssistantContent(message: ChatMessage): AssistantContent | undefined {
  return message.metadata && Array.isArray(message.metadata.productCards) ? message.metadata : undefined;
}

export function ChatbotWidget() {
  const { status, data: session } = useSession();
  const isAuthenticated = status === 'authenticated' && !isSessionExpired(session?.user?.sessionExpiresAt);
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sessionsQuery = useQuery({
    queryKey: ['chatbot', 'sessions'],
    queryFn: fetchSessions,
    enabled: isAuthenticated && isOpen,
    staleTime: 15_000
  });
  const chatQueryKey = ['chatbot', 'session', activeSessionId];
  const chatQuery = useQuery({
    queryKey: chatQueryKey,
    queryFn: () => fetchSession(activeSessionId!),
    enabled: Boolean(isAuthenticated && isOpen && activeSessionId)
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/chatbot/sessions', { method: 'POST' });
      return readApiData<{ session: ChatSession }>(response);
    },
    onSuccess: ({ session: created }) => {
      setActiveSessionId(created.id);
      setShowHistory(false);
      queryClient.setQueryData<SessionPage>(['chatbot', 'session', created.id], {
        session: created,
        messages: [],
        hasMore: false
      });
      void queryClient.invalidateQueries({ queryKey: ['chatbot', 'sessions'] });
    }
  });

  const sendMutation = useMutation({
    mutationFn: async (input: { message: string; sessionId?: string }) => {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      return readApiData<{
        sessionId: string;
        userMessage: ChatMessage;
        message: ChatMessage;
        response: { productCards: ProductCard[]; actions: AssistantContent['actions'] };
      }>(response);
    },
    onSuccess: (result) => {
      setActiveSessionId(result.sessionId);
      const key = ['chatbot', 'session', result.sessionId];
      queryClient.setQueryData<SessionPage>(key, (current) => ({
        session: current?.session || { id: result.sessionId, title: 'New Chat', createdAt: result.userMessage.createdAt, updatedAt: result.message.createdAt },
        messages: [...(current?.messages || []), result.userMessage, result.message],
        hasMore: current?.hasMore || false,
        nextBeforeId: current?.nextBeforeId
      }));
      void queryClient.invalidateQueries({ queryKey: ['chatbot', 'sessions'] });
      setShowHistory(false);
    }
  });

  const messages = chatQuery.data?.messages || [];
  const activeSession = useMemo(() =>
    sessionsQuery.data?.find((item) => item.id === activeSessionId) || chatQuery.data?.session,
  [sessionsQuery.data, activeSessionId, chatQuery.data?.session]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen, activeSessionId]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, sendMutation.isPending]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  if (!isAuthenticated) return null;

  const sendMessage = (event?: FormEvent) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || sendMutation.isPending) return;
    sendMutation.mutate({ message, ...(activeSessionId ? { sessionId: activeSessionId } : {}) });
    setDraft('');
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const loadOlderMessages = async () => {
    const current = chatQuery.data;
    if (!activeSessionId || !current?.nextBeforeId) return;
    try {
      const older = await fetchSession(activeSessionId, current.nextBeforeId);
      queryClient.setQueryData<SessionPage>(chatQueryKey, {
        ...older,
        messages: [...older.messages, ...current.messages]
      });
    } catch {
      // Keep the current conversation visible if an older page cannot load.
    }
  };

  return (
    <>
      {!isOpen && (
        <Button
          aria-label={`Open ${CHATBOT_NAME}`}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-[70] h-14 w-14 rounded-full bg-blue-600 p-0 text-white shadow-lg transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/20 sm:bg-transparent" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsOpen(false);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="shopfast-chat-title"
            className="animate-in fade-in zoom-in-95 fixed inset-x-2 bottom-2 flex h-[min(720px,calc(100dvh-16px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-200 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px]"
          >
            <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {showHistory ? (
                  <button type="button" aria-label="Back to conversation" onClick={() => setShowHistory(false)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Bot className="h-5 w-5" /></span>
                )}
                <div className="min-w-0">
                  <h2 id="shopfast-chat-title" className="truncate text-sm font-semibold text-slate-900">{showHistory ? 'Your conversations' : activeSession?.title || CHATBOT_NAME}</h2>
                  {!showHistory && <p className="text-xs text-slate-500">ShopFast support</p>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!showHistory && (
                  <>
                    <button type="button" aria-label="Chat history" title="Chat history" onClick={() => setShowHistory(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Clock3 className="h-4 w-4" /></button>
                    <button type="button" aria-label="New conversation" title="New conversation" onClick={() => createSessionMutation.mutate()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Plus className="h-4 w-4" /></button>
                  </>
                )}
                <button type="button" aria-label="Close chat" onClick={() => setIsOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><X className="h-4 w-4" /></button>
              </div>
            </header>

            {showHistory ? (
              <div className="flex-1 overflow-y-auto p-3">
                {sessionsQuery.isLoading ? <p className="p-4 text-sm text-slate-500">Loading conversations…</p> : null}
                {(sessionsQuery.data || []).length === 0 && !sessionsQuery.isLoading ? (
                  <p className="p-4 text-sm text-slate-500">Your conversations will appear here.</p>
                ) : null}
                {(sessionsQuery.data || []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setActiveSessionId(item.id); setShowHistory(false); }}
                    className="mb-1 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{item.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">{new Date(item.updatedAt).toLocaleDateString()}</span>
                    </span>
                    <span className="ml-3 text-xs text-slate-400">{item._count?.messages || 0}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 px-3 py-4 sm:px-4" aria-live="polite">
                  {chatQuery.data?.hasMore && (
                    <div className="text-center">
                      <button type="button" onClick={loadOlderMessages} className="text-xs font-medium text-blue-600 hover:underline">Load earlier messages</button>
                    </div>
                  )}
                  {messages.length === 0 && !chatQuery.isLoading && (
                    <div className="mx-auto mt-10 max-w-[280px] text-center">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Bot className="h-6 w-6" /></span>
                      <p className="mt-4 text-sm font-semibold text-slate-900">How can I help?</p>
                      <p className="mt-1 text-sm text-slate-500">Ask about products, your orders, or your cart.</p>
                    </div>
                  )}
                  {chatQuery.isLoading && <p className="py-8 text-center text-sm text-slate-500">Loading conversation…</p>}
                  {messages.map((message) => {
                    const isAssistant = message.role === 'ASSISTANT';
                    const enhanced = isAssistant ? messageAssistantContent(message) : undefined;
                    return (
                      <div key={message.id} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[90%] ${isAssistant ? 'items-start' : 'items-end'} flex flex-col`}>
                          <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isAssistant ? 'rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm' : 'rounded-br-md bg-blue-600 text-white'}`}>
                            {message.content}
                          </div>
                          {enhanced?.productCards?.length ? (
                            <div className="mt-2 flex max-w-[calc(100vw-48px)] gap-2 overflow-x-auto pb-2 sm:max-w-[365px]">
                              {enhanced.productCards.map((product) => <ChatProductCard key={product.id} product={product} />)}
                            </div>
                          ) : null}
                          <span className="mt-1 px-1 text-[10px] text-slate-400">{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })}
                  {sendMutation.isPending && (
                    <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm"><span className="animate-pulse">ShopFast Assistant is typing…</span></div></div>
                  )}
                </div>

                {sendMutation.isError && <p role="alert" className="px-4 py-2 text-xs text-red-600">{sendMutation.error.message}</p>}
                <form onSubmit={sendMessage} className="border-t border-slate-100 bg-white p-3">
                  <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={onInputKeyDown}
                      maxLength={1000}
                      rows={1}
                      placeholder="Ask ShopFast Assistant…"
                      aria-label="Message ShopFast Assistant"
                      className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    <Button type="submit" size="icon" aria-label="Send message" disabled={!draft.trim() || sendMutation.isPending} className="h-9 w-9 shrink-0 rounded-lg">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1.5 text-center text-[10px] text-slate-400">ShopFast Assistant can make mistakes. Check current product details before ordering.</p>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
