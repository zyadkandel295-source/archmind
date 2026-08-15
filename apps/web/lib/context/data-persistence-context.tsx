'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import axios from 'axios';
import { readSessionCredential } from '@/lib/session-keys';
import { getPlatformBaseUrl } from '@/lib/platform';
import { useRealtimeSubscription } from '@/lib/hooks/use-realtime-subscription';

const getApiUrl = (path: string) => {
  const baseUrl = getPlatformBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
};

// ============================================================================
// TYPES
// ============================================================================

export interface Assistant {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  instructions: string;
  icon?: string;
  color?: string;
  status: 'idle' | 'active' | 'thinking';
  model_name?: string;
  model_version?: string;
  model_developer?: string;
  is_favorite?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  chat_id: string;
  user_id?: string;
  assistant_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export interface Chat {
  id: string;
  user_id?: string;
  assistant_id: string;
  title: string;
  message_count?: number;
  is_archived?: boolean;
  is_favorite?: boolean;
  created_at?: string;
  updated_at?: string;
  last_message_at?: string;
  messages?: Message[];
}

interface DataPersistenceContextType {
  // Assistants
  assistants: Assistant[];
  selectedAssistant: Assistant | null;
  isLoadingAssistants: boolean;
  assistantError: string | null;

  // Chats
  chats: Chat[];
  selectedChat: Chat | null;
  messages: Message[];
  isLoadingChats: boolean;
  chatError: string | null;

  // Assistant Actions
  fetchAssistants: () => Promise<void>;
  createAssistant: (data: Partial<Assistant>) => Promise<Assistant>;
  updateAssistant: (id: string, data: Partial<Assistant>) => Promise<Assistant | void>;
  deleteAssistant: (id: string) => Promise<void>;
  setSelectedAssistant: (assistant: Assistant | null) => void;
  favoriteAssistant: (id: string, isFavorite: boolean) => Promise<void>;

  // Chat Actions
  fetchChats: () => Promise<void>;
  fetchChatMessages: (chatId: string) => Promise<void>;
  createChat: (assistantId: string, title?: string) => Promise<Chat>;
  addMessage: (chatId: string, assistantId: string, content: string, role: 'user' | 'assistant') => Promise<Message>;
  deleteChat: (id: string) => Promise<void>;
  setSelectedChat: (chat: Chat | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;

  // Sync & Status
  isOnline: boolean;
  syncPending: boolean;
  syncAllData: () => Promise<void>;
}

const DataPersistenceContext = createContext<DataPersistenceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ASSISTANTS: 'agentia_assistants',
  CHATS: 'agentia_chats',
  MESSAGES: 'agentia_messages',
  SELECTED_ASSISTANT: 'agentia_selected_assistant',
  SELECTED_CHAT: 'agentia_selected_chat',
};

const DEFAULT_ASSISTANTS: Assistant[] = [];

const getAuthHeaders = () => {
  const token = readSessionCredential();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function saveToStorage(key: string, data: unknown) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (error) {
    console.warn(`[DataPersistence] Failed to save ${key} to localStorage`, error);
  }
}

function readFromStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof window !== 'undefined') {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) as T : fallback;
    }
  } catch (error) {
    console.warn(`[DataPersistence] Failed to read ${key} from localStorage`, error);
  }
  return fallback;
}

export function DataPersistenceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname === '/' || pathname.startsWith('/auth/');
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedAssistant, setSelectedAssistantState] = useState<Assistant | null>(null);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChatState] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncPending, setSyncPending] = useState<boolean>(false);

  // Connectivity Listener
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Automatic persistent state synchronization to LocalStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ASSISTANTS, assistants);
  }, [assistants]);

  useEffect(() => {
    if (chats.length > 0) {
      saveToStorage(STORAGE_KEYS.CHATS, chats);
    }
  }, [chats]);

  useEffect(() => {
    if (messages.length > 0 && selectedChat?.id) {
      saveToStorage(`${STORAGE_KEYS.MESSAGES}_${selectedChat.id}`, messages);
    }
  }, [messages, selectedChat?.id]);

  // Custom setter for selected assistant
  const setSelectedAssistant = useCallback((assistant: Assistant | null) => {
    setSelectedAssistantState(assistant);
    saveToStorage(STORAGE_KEYS.SELECTED_ASSISTANT, assistant);
  }, []);

  // Custom setter for selected chat
  const setSelectedChat = useCallback((chat: Chat | null) => {
    setSelectedChatState(chat);
    saveToStorage(STORAGE_KEYS.SELECTED_CHAT, chat);
  }, []);

  // Fetch Assistants
  const fetchAssistants = useCallback(async () => {
    setIsLoadingAssistants(true);
    setAssistantError(null);
    try {
      const response = await axios.get(getApiUrl('/api/assistants'), { headers: getAuthHeaders() });
      if (response.data?.success && Array.isArray(response.data.data)) {
        const fetched: Assistant[] = response.data.data;
        setAssistants(fetched);
        saveToStorage(STORAGE_KEYS.ASSISTANTS, fetched);
        setSelectedAssistantState((current) => {
          if (fetched.length === 0) {
            saveToStorage(STORAGE_KEYS.SELECTED_ASSISTANT, null);
            return null;
          }
          if (!current) {
            const next = fetched[0] || null;
            saveToStorage(STORAGE_KEYS.SELECTED_ASSISTANT, next);
            return next;
          }
          return current;
        });
      }
    } catch (err: any) {
      console.warn('[DataPersistence] Fetch assistants failed, falling back to local storage cache', err);
      const cached = readFromStorage(STORAGE_KEYS.ASSISTANTS, []);
      setAssistants(cached);
      setSelectedAssistantState((current) => {
        if (cached.length === 0) {
          saveToStorage(STORAGE_KEYS.SELECTED_ASSISTANT, null);
          return null;
        }
        if (!current) {
          const next = cached[0] || null;
          saveToStorage(STORAGE_KEYS.SELECTED_ASSISTANT, next);
          return next;
        }
        return current;
      });

      setAssistantError(err.message || 'Failed to load assistants from server');
    } finally {
      setIsLoadingAssistants(false);
    }
  }, []);

  // Create Assistant
  const createAssistant = async (data: Partial<Assistant>): Promise<Assistant> => {
    if (assistants.length >= 3) {
      throw new Error("Maximum agents limit reached. Please delete an existing agent to build a new one.");
    }
    const newAssistant: Assistant = {
      id: `ast-${Date.now()}`,
      name: data.name || 'New Assistant',
      description: data.description || 'Custom AI assistant',
      instructions: data.instructions || 'You are a helpful assistant.',
      icon: data.icon || '🤖',
      color: data.color || 'from-blue-500 to-cyan-500',
      status: 'idle',
    };

    // Optimistic Update
    setAssistants((prev) => [newAssistant, ...prev]);
    setSelectedAssistant(newAssistant);

    try {
      const res = await axios.post(getApiUrl('/api/assistants'), newAssistant, { headers: getAuthHeaders() });
      if (res.data?.success && res.data.data) {
        const saved: Assistant = res.data.data;
        setAssistants((prev) => prev.map((a) => (a.id === newAssistant.id ? saved : a)));
        setSelectedAssistant(saved);
        saveToStorage(STORAGE_KEYS.ASSISTANTS, [saved, ...assistants.filter((a) => a.id !== newAssistant.id)]);
        return saved;
      }
    } catch (err) {
      console.warn('[DataPersistence] API creation failed, stored locally', err);
    }

    saveToStorage(STORAGE_KEYS.ASSISTANTS, [newAssistant, ...assistants]);
    return newAssistant;
  };

  // Update Assistant
  const updateAssistant = async (id: string, data: Partial<Assistant>) => {
    setAssistants((prev) =>
      prev.map((ast) => (ast.id === id ? { ...ast, ...data } : ast))
    );
    if (selectedAssistant?.id === id) {
      setSelectedAssistant({ ...selectedAssistant, ...data });
    }

    try {
      const res = await axios.put(getApiUrl(`/api/assistants/${id}`), data, { headers: getAuthHeaders() });
      if (res.data?.success && res.data.data) {
        return res.data.data;
      }
    } catch (err) {
      console.warn('[DataPersistence] API update failed, cached locally', err);
    }
  };

  // Delete Assistant
  const deleteAssistant = async (id: string) => {
    setAssistants((prev) => prev.filter((a) => a.id !== id));
    if (selectedAssistant?.id === id) {
      setSelectedAssistant(null);
    }

    try {
      await axios.delete(getApiUrl(`/api/assistants/${id}`), { headers: getAuthHeaders() });
    } catch (err) {
      console.warn('[DataPersistence] API delete failed, updated locally', err);
    }
  };

  // Favorite Assistant
  const favoriteAssistant = async (id: string, isFavorite: boolean) => {
    setAssistants((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_favorite: isFavorite } : a))
    );
    try {
      await axios.patch(getApiUrl(`/api/assistants/${id}/favorite`), { is_favorite: isFavorite }, { headers: getAuthHeaders() });
    } catch (err) {
      console.warn('[DataPersistence] Favorite update failed API call', err);
    }
  };

  // Fetch Chats
  const fetchChats = useCallback(async () => {
    setIsLoadingChats(true);
    setChatError(null);
    try {
      const response = await axios.get(getApiUrl('/api/chats'), { headers: getAuthHeaders() });
      if (response.data?.success && Array.isArray(response.data.data)) {
        setChats(response.data.data);
        saveToStorage(STORAGE_KEYS.CHATS, response.data.data);
      }
    } catch (err: any) {
      console.warn('[DataPersistence] Fetch chats failed, loading local cache', err);
      const cached = readFromStorage(STORAGE_KEYS.CHATS, []);
      setChats(cached);
      setChatError(err.message || 'Failed to fetch chats');
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  // Fetch Chat Messages
  const fetchChatMessages = useCallback(async (chatId: string) => {
    try {
      const response = await axios.get(getApiUrl(`/api/chats/${chatId}/messages`), { headers: getAuthHeaders() });
      if (response.data?.success && Array.isArray(response.data.data)) {
        setMessages(response.data.data);
        saveToStorage(`${STORAGE_KEYS.MESSAGES}_${chatId}`, response.data.data);
      }
    } catch (err) {
      console.warn(`[DataPersistence] Fetch messages for chat ${chatId} failed, checking local cache`, err);
      const cached = readFromStorage(`${STORAGE_KEYS.MESSAGES}_${chatId}`, []);
      setMessages(cached);
    }
  }, []);

  // Create Chat
  const createChat = async (assistantId: string, title?: string): Promise<Chat> => {
    const newChat: Chat = {
      id: `chat-${Date.now()}`,
      assistant_id: assistantId,
      title: title || 'New Conversation',
      message_count: 0,
      created_at: new Date().toISOString(),
      messages: [],
    };

    setChats((prev) => [newChat, ...prev]);
    setSelectedChat(newChat);

    try {
      const res = await axios.post(getApiUrl('/api/chats'), { assistant_id: assistantId, title }, { headers: getAuthHeaders() });
      if (res.data?.success && res.data.data) {
        const saved: Chat = res.data.data;
        setChats((prev) => prev.map((c) => (c.id === newChat.id ? saved : c)));
        setSelectedChat(saved);
        return saved;
      }
    } catch (err) {
      console.warn('[DataPersistence] API chat create failed, saved locally', err);
    }

    saveToStorage(STORAGE_KEYS.CHATS, [newChat, ...chats]);
    return newChat;
  };

  // Add Message
  const addMessage = async (
    chatId: string,
    assistantId: string,
    content: string,
    role: 'user' | 'assistant'
  ): Promise<Message> => {
    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      chat_id: chatId,
      assistant_id: assistantId,
      content,
      role,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);

    try {
      const res = await axios.post(
        getApiUrl('/api/messages'),
        { chat_id: chatId, assistant_id: assistantId, content, role },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success && res.data.data) {
        const savedMsg: Message = res.data.data;
        setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? savedMsg : m)));
        return savedMsg;
      }
    } catch (err) {
      console.warn('[DataPersistence] API message post failed, saved locally', err);
    }

    return newMsg;
  };

  // Delete Chat
  const deleteChat = async (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (selectedChat?.id === id) {
      setSelectedChat(null);
    }
    try {
      await axios.delete(getApiUrl(`/api/chats/${id}`), { headers: getAuthHeaders() });
    } catch (err) {
      console.warn('[DataPersistence] API chat delete failed', err);
    }
  };

  // Sync All Data
  const syncAllData = async () => {
    setSyncPending(true);
    await Promise.all([fetchAssistants(), fetchChats()]);
    setSyncPending(false);
  };

  // Initial load from storage and API on mount
  useEffect(() => {
    const cachedAssistants = readFromStorage(STORAGE_KEYS.ASSISTANTS, DEFAULT_ASSISTANTS);
    const cachedSelected = readFromStorage(STORAGE_KEYS.SELECTED_ASSISTANT, cachedAssistants[0] || null);
    setAssistants(cachedAssistants);
    setSelectedAssistantState(cachedSelected);

    const cachedChats = readFromStorage(STORAGE_KEYS.CHATS, []);
    setChats(cachedChats);

    // Public pages share this provider, but protected API calls should only
    // start after an authenticated workspace session exists.
    if (readSessionCredential()) {
      void fetchAssistants();
      void fetchChats();
    }
  }, [fetchAssistants, fetchChats]);

  // ============================================================================
  // SUPABASE REAL-TIME SYNCHRONIZATION LISTENERS
  // ============================================================================

  // Real-time synchronization for Assistants table
  useRealtimeSubscription<Assistant>({
    table: 'assistants',
    enabled: !isPublicRoute && Boolean(readSessionCredential()),
    onInsert: (newAssistant) => {
      setAssistants((prev) => {
        if (prev.some((a) => a.id === newAssistant.id)) return prev;
        return [newAssistant, ...prev];
      });
    },
    onUpdate: (updatedAssistant) => {
      setAssistants((prev) =>
        prev.map((a) => (a.id === updatedAssistant.id ? { ...a, ...updatedAssistant } : a))
      );
      if (selectedAssistant?.id === updatedAssistant.id) {
        setSelectedAssistantState((prev) => (prev ? { ...prev, ...updatedAssistant } : null));
      }
    },
    onDelete: (deletedRecord) => {
      if (deletedRecord.id) {
        setAssistants((prev) => prev.filter((a) => a.id !== deletedRecord.id));
        if (selectedAssistant?.id === deletedRecord.id) {
          setSelectedAssistantState(null);
        }
      }
    }
  });

  // Real-time synchronization for Chats table
  useRealtimeSubscription<Chat>({
    table: 'chats',
    enabled: !isPublicRoute && Boolean(readSessionCredential()),
    onInsert: (newChat) => {
      setChats((prev) => {
        if (prev.some((c) => c.id === newChat.id)) return prev;
        return [newChat, ...prev];
      });
    },
    onUpdate: (updatedChat) => {
      setChats((prev) =>
        prev.map((c) => (c.id === updatedChat.id ? { ...c, ...updatedChat } : c))
      );
    },
    onDelete: (deletedRecord) => {
      if (deletedRecord.id) {
        setChats((prev) => prev.filter((c) => c.id !== deletedRecord.id));
        if (selectedChat?.id === deletedRecord.id) {
          setSelectedChatState(null);
        }
      }
    }
  });

  // Real-time synchronization for Messages table
  useRealtimeSubscription<Message>({
    table: 'messages',
    enabled: !isPublicRoute && Boolean(readSessionCredential()),
    onInsert: (newMessage) => {
      if (selectedChat?.id === newMessage.chat_id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      }
    }
  });

  return (
    <DataPersistenceContext.Provider
      value={{
        assistants,
        selectedAssistant,
        isLoadingAssistants,
        assistantError,

        chats,
        selectedChat,
        messages,
        isLoadingChats,
        chatError,

        fetchAssistants,
        createAssistant,
        updateAssistant,
        deleteAssistant,
        setSelectedAssistant,
        favoriteAssistant,

        fetchChats,
        fetchChatMessages,
        createChat,
        addMessage,
        deleteChat,
        setSelectedChat,
        setMessages,

        isOnline,
        syncPending,
        syncAllData,
      }}
    >
      {children}
    </DataPersistenceContext.Provider>
  );
}

export function useDataPersistence() {
  const context = useContext(DataPersistenceContext);
  if (!context) {
    throw new Error('useDataPersistence must be used within a DataPersistenceProvider');
  }
  return context;
}
