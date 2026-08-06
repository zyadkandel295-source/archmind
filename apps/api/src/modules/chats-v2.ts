import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Env } from '../config/env';
import type { MemoryStore } from '../db/memory';
import { authenticate } from '../middleware/auth';
import type { AuthedRequest } from '../types';

const isSupabaseConfigured = () => {
  const url = process.env.SUPABASE_URL || 'https://irjvqukildhucqbfotux.supabase.co';
  return Boolean(url && !url.includes('placeholder'));
};

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || 'https://irjvqukildhucqbfotux.supabase.co';
  const key = process.env.SUPABASE_ADMIN_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SA9Fx4epoTqtNdt0YCuN7g_gov6kD8M';
  return createClient(url, key);
};

const CreateChatSchema = z.object({
  assistant_id: z.string(),
  title: z.string().optional(),
});

const CreateMessageSchema = z.object({
  chat_id: z.string(),
  assistant_id: z.string(),
  content: z.string().min(1),
  role: z.enum(['user', 'assistant']),
});

export function chatsV2Router(env: Env, store: MemoryStore) {
  const router = Router();
  const supabase = getSupabaseClient();

  router.use(authenticate(env, store));

  // GET ALL CHATS FOR CURRENT USER
  router.get('/chats', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!isSupabaseConfigured()) {
        return res.status(200).json({
          success: true,
          data: [],
          count: 0,
        });
      }

      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });


      if (error || !data) {
        return res.status(200).json({
          success: true,
          data: [],
          count: 0,
        });
      }

      return res.status(200).json({
        success: true,
        data: data || [],
        count: data?.length || 0,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // GET SINGLE CHAT WITH MESSAGES
  router.get('/chats/:id', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id;

      if (!userId || !id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!isSupabaseConfigured()) {
        const conv = store.getConversation(id);
        if (conv) {
          const msgs = store.listMessages(id);
          return res.status(200).json({
            success: true,
            data: {
              ...conv,
              messages: msgs || [],
            },
          });
        }
        return res.status(404).json({ error: 'Chat not found' });
      }

      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();


      if (chatError || !chat) {
        const conv = store.getConversation(id);
        if (conv) {
          const msgs = store.listMessages(id);
          return res.status(200).json({
            success: true,
            data: {
              ...conv,
              messages: msgs || [],
            },
          });
        }
        return res.status(404).json({ error: 'Chat not found' });
      }

      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      return res.status(200).json({
        success: true,
        data: {
          ...chat,
          messages: messages || [],
        },
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // CREATE NEW CHAT
  router.post('/chats', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validation = CreateChatSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { assistant_id, title } = validation.data;

      const chatData = {
        user_id: userId,
        assistant_id,
        title: title || `Chat with Assistant`,
        model_name: 'Jellyfish',
        model_version: 'BIA 1',
        message_count: 0,
      };

      const { data, error } = await supabase
        .from('chats')
        .insert([chatData])
        .select()
        .single();

      if (error || !data) {
        const conv = store.ensureConversation({ assistantId: assistant_id, userId, conversationId: undefined });
        return res.status(201).json({
          success: true,
          data: conv,
          message: 'Chat created successfully (Memory)',
        });
      }

      return res.status(201).json({
        success: true,
        data,
        message: 'Chat created successfully',
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // ADD MESSAGE TO CHAT
  router.post('/messages', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validation = CreateMessageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { chat_id, assistant_id, content, role } = validation.data;

      // Enforce limit: max 100 messages per day per user
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      if (isSupabaseConfigured()) {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', startOfDay.toISOString());

        if ((count ?? 0) >= 100) {
          return res.status(429).json({
            error: 'Daily message limit reached (100 messages/day across your assistants).',
            code: 'DAILY_MESSAGE_LIMIT_EXCEEDED'
          });
        }
      }

      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert([
          {
            chat_id,
            user_id: userId,
            assistant_id,
            content,
            role,
          },
        ])
        .select()
        .single();

      if (messageError || !message) {
        const savedMsg = store.addMessage({
          conversationId: chat_id,
          role,
          content,
          tokensUsed: Math.ceil(content.length / 4),
          sources: [],
        });



        return res.status(201).json({
          success: true,
          data: savedMsg,
          message: 'Message added successfully (Memory)',
        });
      }

      await supabase
        .from('chats')
        .update({
          last_message_at: new Date().toISOString(),
        })
        .eq('id', chat_id);

      return res.status(201).json({
        success: true,
        data: message,
        message: 'Message added successfully',
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // GET MESSAGES FOR CHAT
  router.get('/chats/:id/messages', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id;

      if (!userId || !id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!isSupabaseConfigured()) {
        const msgs = store.listMessages(id);
        return res.status(200).json({
          success: true,
          data: msgs || [],
          count: msgs?.length || 0,
        });
      }

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });


      if (error || !data) {
        const msgs = store.listMessages(id);
        return res.status(200).json({
          success: true,
          data: msgs || [],
          count: msgs?.length || 0,
        });
      }

      return res.status(200).json({
        success: true,
        data: data || [],
        count: data?.length || 0,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // DELETE CHAT (Soft Delete)
  router.delete('/chats/:id', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id;

      if (!userId || !id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { error } = await supabase
        .from('chats')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      return res.status(200).json({
        success: true,
        message: 'Chat deleted successfully',
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  return router;
}

export default chatsV2Router;
