import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Env } from '../config/env';
import type { MemoryStore } from '../db/memory';
import { authenticate } from '../middleware/auth';
import type { AuthedRequest } from '../types';

const isSupabaseConfigured = () => {
  const url = process.env.SUPABASE_URL;
  return Boolean(url && !url.includes('placeholder'));
};

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.SUPABASE_ADMIN_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder';
  return createClient(url, key);
};


const CreateAssistantSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  instructions: z.string().optional(),
  system_prompt: z.string().optional(),
  icon: z.string().max(10).optional(),
  color: z.string().max(50).optional(),
  model_name: z.string().optional(),
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
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });


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
          return res.status(200).json({ success: true, data: memoryAssistant });
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
          return res.status(200).json({ success: true, data: memoryAssistant });
        }
        return res.status(404).json({ error: 'Assistant not found' });
      }

      return res.status(200).json({ success: true, data });
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

      const assistantData = {
        name: validation.data.name,
        description: validation.data.description || '',
        instructions: validation.data.instructions || validation.data.system_prompt || 'Helpful AI Assistant',
        icon: validation.data.icon || '🤖',
        color: validation.data.color || 'from-blue-500 to-cyan-500',
        user_id: userId,
        status: 'idle',
        model_name: validation.data.model_name || 'Jellyfish',
        model_version: 'BIA 1',
        model_developer: 'Zyad Kandel',
      };

      const { data, error } = await supabase
        .from('assistants')
        .insert([assistantData])
        .select()
        .single();

      if (error || !data) {
        const created = store.createAssistant(userId, {
          name: assistantData.name,
          description: assistantData.description,
          systemPrompt: assistantData.instructions,
          tone: 'professional',
          isPublic: false,
          model: 'openrouter/auto',
          temperature: 0.7,
          starterPrompts: [],
          enabledTools: [],
          icon: assistantData.icon,
          color: assistantData.color,
        });
        return res.status(201).json({
          success: true,
          data: created,
          message: `Assistant "${created.name}" created successfully (Memory)`,
        });
      }

      return res.status(201).json({
        success: true,
        data,
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

  return router;
}

export default assistantsV2Router;
