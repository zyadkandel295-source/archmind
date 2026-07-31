'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { readSessionCredential } from '@/lib/session-keys';
import { getPlatformBaseUrl } from '@/lib/platform';

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

const DEFAULT_ASSISTANTS: Assistant[] = [
  {
    id: 'default-1',
    name: 'Customer Support Assistant',
    icon: '🤖',
    description: 'Ready to assist with questions',
    instructions: 'You are Customer Support Agent powered by PHOENIX 1.0, developed by Zyad Kandel, deployed on AGENTIA. Help users with clear, precise steps.',
    color: 'from-blue-500 to-cyan-500',
    status: 'idle',
  },
  {
    id: 'default-2',
    name: 'Research Specialist',
    icon: '🔍',
    description: 'Deep research and analysis',
    instructions: 'You are a research specialist focused on gathering and analyzing complex information.',
    color: 'from-purple-500 to-pink-500',
    status: 'idle',
  },
  {
    id: 'default-3',
    name: 'Creative Writer',
    icon: '✍️',
    description: 'Engaging content creation',
    instructions: 'You are a creative writer specializing in engaging stories and marketing content.',
    color: 'from-yellow-500 to-orange-500',
    status: 'idle',
  },
  {
    id: 'default-4',
    name: 'Code Engineer',
    icon: '💻',
    description: 'Code generation and debugging',
    instructions: 'You are an expert software engineer capable of writing, auditing, and debugging code.',
    color: 'from-green-500 to-emerald-500',
    status: 'idle',
  },
];

const getAuthHeaders = () => {
  const token = readSessionCredential();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function DataPersistenceProvider({ children }: { children: React.ReactNode }) {
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

  // Sync state to localStorage
  const saveToStorage = (key: string, data: any) => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {
      console.warn(`[DataPersistence] Failed to save ${key} to localStorage`, e);
    }
  };

  const readFromStorage = (key: string, fallback: any) => {
    try {
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
      }
    } catch (e) {
      console.warn(`[DataPersistence] Failed to read ${key} from localStorage`, e);
    }
    return fallback;
  };

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

  // Custom setter for selected assistant
  const setSelectedAssistant = (assistant: Assistant | null) => {
    setSelectedAssistantState(assistant);
    saveToStorage(STORAGE_KEYS.SELECTED_ASSISTANT, assistant);
  };

  // Custom setter for selected chat
  const setSelectedChat = (chat: Chat | null) => {
    setSelectedChatState(chat);
    saveToStorage(STORAGE_KEYS.SELECTED_CHAT, chat);
  };

  // Fetch Assistants
  const fetchAssistants = useCallback(async () => {
    setIsLoadingAssistants(true);
    setAssistantError(null);
    try {
      const response = await axios.get(getApiUrl('/api/assistants'), { headers: getAuthHeaders() });
      if (response.data?.success && Array.isArray(response.data.data)) {
        const fetched: Assistant[] = response.data.data;
        const combined = fetched.length > 0 ? fetched : DEFAULT_ASSISTANTS;
        setAssistants(combined);
        saveToStorage(STORAGE_KEYS.ASSISTANTS, combined);
        if (!selectedAssistant && combined.length > 0) {
          setSelectedAssistant(combined[0] || null);
        }
      }
    } catch (err: any) {
      console.warn('[DataPersistence] Fetch assistants failed, falling back to local storage cache', err);
      const cached = readFromStorage(STORAGE_KEYS.ASSISTANTS, DEFAULT_ASSISTANTS);
      setAssistants(cached);
      if (!selectedAssistant && cached.length > 0) {
        setSelectedAssistant(cached[0] || null);
      }

      setAssistantError(err.message || 'Failed to load assistants from server');
    } finally {
      setIsLoadingAssistants(false);
    }
  }, [selectedAssistant]);

  // Create Assistant
  const createAssistant = async (data: Partial<Assistant>): Promise<Assistant> => {
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

    // Initial server fetch
    fetchAssistants();
    fetchChats();
  }, []);

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
