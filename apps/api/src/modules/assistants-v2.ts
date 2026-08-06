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


const CreateAssistantSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  instructions: z.string().optional(),
  system_prompt: z.string().optional(),
  systemPrompt: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  model_name: z.string().optional(),
  model: z.string().optional(),
  tone: z.string().optional(),
  isPublic: z.boolean().optional(),
  visibility: z.string().optional(),
  temperature: z.number().optional(),
  starterPrompts: z.array(z.string()).optional(),
  enabledTools: z.array(z.string()).optional(),
  slug: z.string().optional(),
});

const UpdateAssistantSchema = CreateAssistantSchema.partial();

export function assistantsV2Router(env: Env, store: MemoryStore) {
  const router = Router();
  const supabase = getSupabaseClient();

  router.use(authenticate(env, store));

  // GET ALL ASSISTANTS FOR CURRENT USER
  router.get('/', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!isSupabaseConfigured()) {
        const memoryAssistants = store.listAssistants(userId);
        return res.status(200).json({
          success: true,
          data: memoryAssistants || [],
          count: memoryAssistants?.length || 0,
        });
      }

      const { data, error } = await supabase
        .from('assistants')
        .select('id, user_id, name, description, instructions, icon, color, status, system_prompt, is_public, is_favorite, created_at, updated_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);


      if (error || !data) {
        const memoryAssistants = store.listAssistants(userId);
        return res.status(200).json({
          success: true,
          data: memoryAssistants || [],
          count: memoryAssistants?.length || 0,
        });
      }

      return res.status(200).json({
        success: true,
        data: data || [],
        assistants: data || [],
        count: data?.length || 0,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // GET SINGLE ASSISTANT BY ID
  router.get('/:id', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id;

      if (!userId || !id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!isSupabaseConfigured()) {
        const memoryAssistant = store.getAssistantForUser(id, userId);
        if (memoryAssistant) {
          return res.status(200).json({ success: true, data: memoryAssistant, assistant: memoryAssistant });
        }
        return res.status(404).json({ error: 'Assistant not found' });
      }

      const { data, error } = await supabase
        .from('assistants')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();


      if (error || !data) {
        const memoryAssistant = store.getAssistantForUser(id, userId);
        if (memoryAssistant) {
          return res.status(200).json({ success: true, data: memoryAssistant, assistant: memoryAssistant });
        }
        return res.status(404).json({ error: 'Assistant not found' });
      }

      return res.status(200).json({ success: true, data, assistant: data });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // CREATE NEW ASSISTANT
  router.post('/', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validation = CreateAssistantSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      // Enforce limit: max 3 assistants per 25 days per user
      const twentyFiveDaysAgo = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();
      if (isSupabaseConfigured()) {
        const { count } = await supabase
          .from('assistants')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('deleted_at', null)
          .gte('created_at', twentyFiveDaysAgo);

        if ((count ?? 0) >= 3) {
          return res.status(403).json({
            error: 'Assistant limit reached. You can create up to 3 assistants per 25 days.',
            code: 'ASSISTANT_LIMIT_EXCEEDED'
          });
        }
      } else {
        const userAssistants = store.listAssistants(userId);
        if (userAssistants.length >= 3) {
          return res.status(403).json({
            error: 'Assistant limit reached. You can create up to 3 assistants per 25 days.',
            code: 'ASSISTANT_LIMIT_EXCEEDED'
          });
        }
      }

      const d = validation.data;
      const resolvedInstructions = d.instructions || d.system_prompt || d.systemPrompt || 'Helpful AI Assistant';

      const assistantData = {
        name: d.name,
        description: d.description || '',
        instructions: resolvedInstructions,
        icon: d.icon || '🤖',
        color: d.color || 'from-blue-500 to-cyan-500',
        user_id: userId,
        status: 'idle',
        model_name: d.model_name || d.model || 'Jellyfish',
        model_version: 'BIA 1',
        model_developer: 'Zyad Kandel',
      };

      const memoryInput = {
        name: assistantData.name,
        description: assistantData.description,
        systemPrompt: resolvedInstructions,
        tone: (d.tone || 'professional') as 'professional' | 'casual' | 'teacher' | 'custom',
        isPublic: d.isPublic ?? false,
        model: d.model || 'openrouter/auto',
        temperature: d.temperature ?? 0.7,
        starterPrompts: d.starterPrompts || [],
        enabledTools: d.enabledTools || [],
        icon: assistantData.icon,
        color: assistantData.color,
      };

      const { data, error } = await supabase
        .from('assistants')
        .insert([assistantData])
        .select()
        .single();

      if (error || !data) {
        const created = store.createAssistant(userId, memoryInput);
        return res.status(201).json({
          success: true,
          data: created,
          assistant: created,
          message: `Assistant "${created.name}" created successfully (Memory)`,
        });
      }

      return res.status(201).json({
        success: true,
        data,
        assistant: data,
        message: `Assistant "${data.name}" created successfully`,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // UPDATE ASSISTANT
  router.put('/:id', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id;

      if (!userId || !id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validation = UpdateAssistantSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { data, error } = await supabase
        .from('assistants')
        .update(validation.data)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !data) {
        const updated = store.updateAssistant(id, userId, {
          name: validation.data.name,
          description: validation.data.description,
          systemPrompt: validation.data.instructions,
        });
        return res.status(200).json({
          success: true,
          data: updated || { id, ...validation.data },
          message: 'Assistant updated successfully',
        });
      }

      return res.status(200).json({
        success: true,
        data,
        message: 'Assistant updated successfully',
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // DELETE ASSISTANT
  router.delete('/:id', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id;

      if (!userId || !id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { error } = await supabase
        .from('assistants')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        store.deleteAssistant(id, userId);
      }

      return res.status(200).json({
        success: true,
        message: 'Assistant deleted successfully',
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // FAVORITE/UNFAVORITE ASSISTANT
  router.patch('/:id/favorite', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id;
      const { is_favorite } = req.body;

      if (!userId || !id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data, error } = await supabase
        .from('assistants')
        .update({ is_favorite })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !data) {
        return res.status(200).json({ success: true, data: { id, is_favorite } });
      }

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // DUPLICATE ASSISTANT
  router.post('/:id/duplicate', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id;

      if (!userId || !id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (isSupabaseConfigured()) {
        const { data: original, error: fetchErr } = await supabase
          .from('assistants')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .single();

        if (original && !fetchErr) {
          const duplicateData = {
            name: `${original.name} (Copy)`,
            description: original.description || '',
            instructions: original.instructions || '',
            icon: original.icon || '🤖',
            color: original.color || 'from-blue-500 to-cyan-500',
            user_id: userId,
            status: 'idle',
            model_name: original.model_name || 'Jellyfish',
            model_version: original.model_version || 'BIA 1',
            model_developer: original.model_developer || 'Zyad Kandel',
          };

          const { data: duplicated, error: dupErr } = await supabase
            .from('assistants')
            .insert([duplicateData])
            .select()
            .single();

          if (duplicated && !dupErr) {
            return res.status(201).json({
              success: true,
              data: duplicated,
              assistant: duplicated,
              message: 'Assistant duplicated successfully',
            });
          }
        }
      }

      const duplicatedMemory = store.duplicateAssistant(id, userId);
      if (duplicatedMemory) {
        return res.status(201).json({
          success: true,
          data: duplicatedMemory,
          assistant: duplicatedMemory,
          message: 'Assistant duplicated successfully',
        });
      }

      return res.status(404).json({ error: 'Assistant not found' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // CLEAR CONVERSATIONS FOR ASSISTANT
  router.post('/:id/conversations/clear', async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id;

      if (!userId || !id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (isSupabaseConfigured()) {
        await supabase
          .from('messages')
          .delete()
          .eq('assistant_id', id);
        await supabase
          .from('chats')
          .update({ deleted_at: new Date().toISOString() })
          .eq('assistant_id', id)
          .eq('user_id', userId);
      }

      store.clearConversationsForAssistant(id, userId);

      return res.status(200).json({
        success: true,
        ok: true,
        message: 'Conversations cleared successfully',
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  return router;
}

export default assistantsV2Router;
