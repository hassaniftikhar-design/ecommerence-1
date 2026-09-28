'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

import Image from 'next/image';

import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock3, MessageSquareText, Plus, Send, Sparkles, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { CHATBOT_NAME } from '@/constants/chatbot';
import { addToCart } from '@/services/cart.service';
import { isSessionExpired } from '@/constants/auth';
import { FormattedChatMessage } from '@/components/chatbot/formatted-chat-message';

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

function ChatProductCard({
  product,
  isAuthenticated,
  isAdmin
}: {
  product: ProductCard;
  isAuthenticated: boolean;
  isAdmin?: boolean;
}) {
  const { showSuccess, showError } = useToast();
  const availableVariants = product.variants.filter((variant) => variant.stock > 0);
  const [variantId, setVariantId] = useState(availableVariants[0]?.id || '');
  const selectedVariant = product.variants.find((variant) => variant.id === variantId);
  const variantLabel = (variant: ProductCard['variants'][number]) => {
    const attributes = Object.entries(variant.attributes).map(([key, value]) => `${key}: ${value}`);
    return attributes.length ? attributes.join(' · ') : variant.sku;
  };

  const handleAdd = async () => {
    if (!isAuthenticated) {
      showError('Please login first as adding items to your cart requires you to login first.');
      return;
    }
    try {
      await addToCart(product.id, selectedVariant?.id || null, 1);
      showSuccess(`${product.name} added to your cart.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not add this item to your cart.');
    }
  };

  return (
    <article className="w-[245px] shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="flex gap-3 p-3">
        <Image
          src={product.imageUrl || '/FastShopStore.png'}
          alt={product.name}
          width={72}
          height={72}
          unoptimized
          className="h-[72px] w-[72px] rounded-lg bg-slate-100 object-cover border border-slate-100"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold text-slate-900 leading-tight">{product.name}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{product.category}</p>
          <p className="mt-1 text-sm font-bold text-blue-600">
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
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {product.variants.map((variant) => (
              <option key={variant.id} value={variant.id} disabled={variant.stock < 1}>
                {variantLabel(variant)}{variant.stock < 1 ? ' · Out of stock' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2">
        <span className="text-xs text-slate-500 font-medium">{selectedVariant?.stock ?? product.stock} in stock</span>
        {!isAdmin ? (
          <Button size="sm" className="h-7 text-xs px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm" disabled={product.stock < 1 || Boolean(product.variants.length && !selectedVariant?.stock)} onClick={handleAdd}>
            Add to cart
          </Button>
        ) : (
          <span className="text-[11px] font-mono text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded font-medium">
            {selectedVariant?.sku || product.variants[0]?.sku || 'SKU'}
          </span>
        )}
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
  const isAdmin = session?.user?.role === 'ADMIN';
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [pendingMessage, setPendingMessage] = useState<ChatMessage | null>(null);
  const [guestSessionId, setGuestSessionId] = useState<string>('guest_session');
  const [guestMessages, setGuestMessages] = useState<ChatMessage[]>([]);
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
      setPendingMessage(null);
      queryClient.setQueryData<SessionPage>(['chatbot', 'session', created.id], {
        session: created,
        messages: [],
        hasMore: false
      });
      void queryClient.invalidateQueries({ queryKey: ['chatbot', 'sessions'] });
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/chatbot/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      });
      return readApiData<{ id: string }>(response);
    },
    onSuccess: ({ id: deletedId }) => {
      showSuccess('Conversation deleted.');
      queryClient.removeQueries({ queryKey: ['chatbot', 'session', deletedId] });
      void queryClient.invalidateQueries({ queryKey: ['chatbot', 'sessions'] });
      if (activeSessionId === deletedId) {
        setActiveSessionId(undefined);
        setPendingMessage(null);
      }
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : 'Could not delete conversation.');
    }
  });

  const sendMutation = useMutation({
    mutationFn: async (input: { message: string; sessionId?: string; context?: ChatMessage[] }) => {
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
      if (isAuthenticated) {
        setActiveSessionId(result.sessionId);
        const key = ['chatbot', 'session', result.sessionId];
        queryClient.setQueryData<SessionPage>(key, (current) => ({
          session: current?.session || { id: result.sessionId, title: 'New Chat', createdAt: result.userMessage.createdAt, updatedAt: result.message.createdAt },
          messages: [...(current?.messages || []), result.userMessage, result.message],
          hasMore: current?.hasMore || false,
          nextBeforeId: current?.nextBeforeId
        }));
        void queryClient.invalidateQueries({ queryKey: ['chatbot', 'sessions'] });
      } else {
        setGuestSessionId(result.sessionId);
        setGuestMessages((prev) => [...prev, result.userMessage, result.message]);
      }

      if (result.response?.actions?.length) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cart-updated'));
        }
        void queryClient.invalidateQueries({ queryKey: ['cart'] });
        const targetCard = result.response.productCards?.[0];
        const toastMsg = targetCard
          ? `${targetCard.name} added to cart successfully!`
          : 'Item added to cart successfully!';
        showSuccess(toastMsg);
      }
      setShowHistory(false);
    },
    onSettled: () => {
      setPendingMessage(null);
    }
  });

  const displayMessages = useMemo(() => {
    const messages = isAuthenticated ? (chatQuery.data?.messages || []) : guestMessages;
    if (!pendingMessage) return messages;
    return [...messages, pendingMessage];
  }, [isAuthenticated, chatQuery.data?.messages, guestMessages, pendingMessage]);

  const activeSession = useMemo(() =>
    isAuthenticated
      ? (sessionsQuery.data?.find((item) => item.id === activeSessionId) || chatQuery.data?.session)
      : undefined,
  [isAuthenticated, sessionsQuery.data, activeSessionId, chatQuery.data?.session]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen, activeSessionId]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [displayMessages.length, sendMutation.isPending]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const sendMessage = (textToSend?: string, event?: FormEvent) => {
    event?.preventDefault();
    const message = (typeof textToSend === 'string' ? textToSend : draft).trim();
    if (!message || sendMutation.isPending) return;
    setPendingMessage({
      id: `temp-${Date.now()}`,
      role: 'USER',
      content: message,
      createdAt: new Date().toISOString()
    });

    if (isAuthenticated) {
      sendMutation.mutate({ message, ...(activeSessionId ? { sessionId: activeSessionId } : {}) });
    } else {
      sendMutation.mutate({
        message,
        sessionId: guestSessionId,
        context: guestMessages.slice(-10)
      });
    }
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

  const handleStartNewChat = () => {
    if (isAuthenticated) {
      createSessionMutation.mutate();
    } else {
      setGuestMessages([]);
      setGuestSessionId(`guest_${Date.now()}`);
      setPendingMessage(null);
      setShowHistory(false);
    }
  };

  const quickPrompts = isAdmin ? [
    'Store revenue & sales summary',
    'Top selling products',
    'Low stock inventory report',
    'Order fulfillment status breakdown',
    'Lowest selling products'
  ] : isAuthenticated ? [
    'Watches under $50',
    'What about my last order?',
    'Do you have any slippers?',
    'What is your return policy?'
  ] : [
    'Watches under $50',
    'Show popular sneakers',
    'What is your return policy?',
    'Do you support Cash on Delivery?'
  ];

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          aria-label={`Open ${CHATBOT_NAME}`}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-white p-1 shadow-xl shadow-blue-500/20 ring-2 ring-blue-600/30 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-blue-500/30 active:scale-95 group"
        >
          <div className="relative h-full w-full overflow-hidden rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5">
            <Image
              src="/Chatbot.png"
              alt={CHATBOT_NAME}
              width={56}
              height={56}
              className="h-full w-full rounded-full object-cover"
              priority
            />
          </div>
          {/* Online Pulse Badge */}
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
          </span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/25 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsOpen(false);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="shopfast-chat-title"
            className="animate-in fade-in zoom-in-95 fixed inset-x-2 bottom-2 flex h-[min(720px,calc(100dvh-16px))] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl duration-200 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px]"
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 shadow-sm text-white">
              <div className="flex min-w-0 items-center gap-3">
                {showHistory ? (
                  <button type="button" aria-label="Back to conversation" onClick={() => setShowHistory(false)} className="rounded-xl p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 p-0.5 shadow-sm ring-1 ring-white/10">
                    <Image
                      src="/Chatbot.png"
                      alt={CHATBOT_NAME}
                      width={40}
                      height={40}
                      className="h-full w-full rounded-full object-cover"
                    />
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-slate-950"></span>
                  </div>
                )}
                <div className="min-w-0">
                  <h2 id="shopfast-chat-title" className="truncate text-sm font-bold text-white leading-tight">
                    {showHistory ? 'Your conversations' : activeSession?.title || CHATBOT_NAME}
                  </h2>
                  {!showHistory && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                      <p className="text-xs text-slate-400">{isAdmin ? 'Admin Intelligence' : 'AI Shopping Assistant'}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!showHistory && (
                  <>
                    {isAuthenticated && activeSessionId && (
                      <button
                        type="button"
                        aria-label="Delete this conversation"
                        title="Delete this conversation"
                        disabled={deleteSessionMutation.isPending}
                        onClick={() => {
                          if (activeSessionId) {
                            deleteSessionMutation.mutate(activeSessionId);
                          }
                        }}
                        className="rounded-xl p-2 text-slate-400 hover:bg-red-950/70 hover:text-red-400 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" aria-label="Chat history" title="Chat history" onClick={() => setShowHistory(true)} className="rounded-xl p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition">
                      <Clock3 className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label="New conversation" title="New conversation" onClick={handleStartNewChat} className="rounded-xl p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition">
                      <Plus className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button type="button" aria-label="Close chat" onClick={() => setIsOpen(false)} className="rounded-xl p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {showHistory ? (
              <div className="flex-1 overflow-y-auto p-3">
                {!isAuthenticated ? (
                  <div className="py-12 text-center px-4">
                    <MessageSquareText className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-800">Sign in to save history</p>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      Sign in or create an account to access and sync your chat conversations across all your devices.
                    </p>
                    <a
                      href="/login"
                      className="mt-4 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                    >
                      Sign In / Register
                    </a>
                  </div>
                ) : (
                  <>
                    {sessionsQuery.isLoading ? <p className="p-4 text-center text-sm text-slate-500">Loading conversations…</p> : null}
                    {(sessionsQuery.data || []).length === 0 && !sessionsQuery.isLoading ? (
                      <div className="py-12 text-center">
                        <MessageSquareText className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-2 text-sm text-slate-500 font-medium">No conversation history yet.</p>
                      </div>
                    ) : null}
                    {(sessionsQuery.data || []).map((item) => (
                      <div
                        key={item.id}
                        className="group mb-1.5 flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left hover:bg-blue-50/60 border border-transparent hover:border-blue-100 transition"
                      >
                        <button
                          type="button"
                          onClick={() => { setActiveSessionId(item.id); setShowHistory(false); }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-sm font-semibold text-slate-800">{item.title}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-400">{new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </button>
                        <div className="ml-2 flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{item._count?.messages || 0}</span>
                          <button
                            type="button"
                            title="Delete conversation"
                            aria-label="Delete conversation"
                            disabled={deleteSessionMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSessionMutation.mutate(item.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <>
                <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-3.5 sm:p-4" aria-live="polite">
                  {isAuthenticated && chatQuery.data?.hasMore && (
                    <div className="text-center">
                      <button type="button" onClick={loadOlderMessages} className="text-xs font-medium text-blue-600 hover:underline">Load earlier messages</button>
                    </div>
                  )}

                  {/* Empty Welcome State */}
                  {displayMessages.length === 0 && !chatQuery.isLoading && (
                    <div className="mx-auto mt-4 max-w-[320px] text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-1 shadow-md shadow-blue-500/10 ring-1 ring-blue-100">
                        <Image
                          src="/Chatbot.png"
                          alt={CHATBOT_NAME}
                          width={64}
                          height={64}
                          className="h-full w-full rounded-xl object-cover"
                        />
                      </div>
                      <h3 className="mt-3 text-base font-bold text-slate-900">
                        {isAdmin ? 'Welcome, Store Admin' : 'Hello! How can I help?'}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                        {isAdmin
                          ? 'Ask for live revenue figures, top selling products, low-stock inventory, or order analytics.'
                          : isAuthenticated
                            ? 'I can search products, compare styles & prices, check stock, or look up your order status.'
                            : 'I can help you search products, check prices, answer store policies, or find what you need.'}
                      </p>

                      <div className="mt-5 text-left">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          Suggested queries
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {quickPrompts.map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              onClick={() => sendMessage(prompt)}
                              className="text-left text-xs text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200/80 rounded-xl px-3 py-2 transition shadow-2xs font-medium"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {isAuthenticated && chatQuery.isLoading && <p className="py-8 text-center text-sm text-slate-500">Loading conversation…</p>}

                  {/* Message Stream */}
                  {displayMessages.map((message) => {
                    const isAssistant = message.role === 'ASSISTANT';
                    const enhanced = isAssistant ? messageAssistantContent(message) : undefined;
                    return (
                      <div key={message.id} className={`flex gap-2 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                        {isAssistant && (
                          <div className="h-7 w-7 shrink-0 rounded-full overflow-hidden bg-blue-100 border border-blue-200 mt-1 shadow-2xs">
                            <Image
                              src="/Chatbot.png"
                              alt={CHATBOT_NAME}
                              width={28}
                              height={28}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div className={`max-w-[85%] ${isAssistant ? 'items-start' : 'items-end'} flex flex-col`}>
                          <div className={`break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isAssistant ? 'rounded-tl-xs border border-slate-200/80 bg-white text-slate-800 shadow-sm' : 'rounded-tr-xs bg-blue-600 text-white shadow-sm'}`}>
                            <FormattedChatMessage content={message.content} isAssistant={isAssistant} />
                          </div>
                          {enhanced?.productCards?.length ? (
                            <div className="mt-2.5 flex max-w-[calc(100vw-56px)] gap-2.5 overflow-x-auto pb-2 sm:max-w-[340px]">
                              {enhanced.productCards.map((product) => (
                                <ChatProductCard key={product.id} product={product} isAuthenticated={isAuthenticated} isAdmin={isAdmin} />
                              ))}
                            </div>
                          ) : null}
                          <span className="mt-1 px-1 text-[10px] text-slate-400 font-medium">
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {sendMutation.isPending && (
                    <div className="flex gap-2 justify-start items-end animate-in fade-in duration-200">
                      <div className="h-7 w-7 shrink-0 rounded-full overflow-hidden bg-blue-100 border border-blue-200 mb-0.5 shadow-2xs">
                        <Image
                          src="/Chatbot.png"
                          alt={CHATBOT_NAME}
                          width={28}
                          height={28}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="rounded-2xl rounded-tl-xs border border-slate-200/80 bg-white px-4 py-3 shadow-sm flex items-center gap-1.5">
                        <span className="flex gap-1.5 items-center h-4">
                          <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '160ms' }}></span>
                          <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '320ms' }}></span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {sendMutation.isError && (
                  <p role="alert" className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
                    {sendMutation.error.message}
                  </p>
                )}

                {/* Input form */}
                <form onSubmit={(e) => sendMessage(undefined, e)} className="border-t border-slate-100 bg-white p-3">
                  <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={onInputKeyDown}
                      maxLength={1000}
                      rows={1}
                      placeholder={isAdmin ? 'Ask store analytics, revenue, or inventory…' : 'Ask ShopFast Assistant…'}
                      aria-label="Message ShopFast Assistant"
                      className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 leading-normal"
                    />
                    <Button type="submit" size="icon" aria-label="Send message" disabled={!draft.trim() || sendMutation.isPending} className="h-8 w-8 shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs">
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="mt-1.5 text-center text-[10px] text-slate-400">
                    ShopFast Assistant can make mistakes. Verify critical product or store information.
                  </p>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
