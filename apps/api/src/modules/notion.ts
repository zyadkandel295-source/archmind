/**
 * Notion Operations Router — `/api/notion`
 *
 * Provides REST endpoints for Notion workspace operations.
 * All routes require authentication. Every call delegates to
 * NotionService which performs 6-layer permission validation.
 */

import { Router } from "express";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import { NotionService } from "../services/notion-service";
import type { AuthedRequest } from "../types";

export function notionRouter(env: Env, store: MemoryStore) {
  const router = Router();
  const notion = new NotionService(env, store);

  // All routes require authenticated user
  router.use(authenticate(env, store));

  /**
   * GET /api/notion/pages?query=...
   * Search pages in the user's Notion workspace.
   */
  router.get(
    "/pages",
    asyncHandler(async (req: AuthedRequest, res) => {
      const query = (req.query.query as string) || undefined;
      const result = await notion.searchPages(req.user!.id, query);
      if (!result.success) {
        throw new HttpError(400, result.error!, result.errorCode);
      }
      res.json(result.data);
    })
  );

  /**
   * GET /api/notion/databases?query=...
   * Search databases in the user's Notion workspace.
   */
  router.get(
    "/databases",
    asyncHandler(async (req: AuthedRequest, res) => {
      const query = (req.query.query as string) || undefined;
      const result = await notion.searchDatabases(req.user!.id, query);
      if (!result.success) {
        throw new HttpError(400, result.error!, result.errorCode);
      }
      res.json(result.data);
    })
  );

  /**
   * GET /api/notion/pages/:pageId
   * Retrieve complete page content and metadata.
   */
  router.get(
    "/pages/:pageId",
    asyncHandler(async (req: AuthedRequest, res) => {
      const pageId = req.params.pageId!;
      const result = await notion.getPageContent(req.user!.id, pageId);
      if (!result.success) {
        const status = result.errorCode === "NOTION_RESOURCE_NOT_FOUND" ? 404 : 400;
        throw new HttpError(status, result.error!, result.errorCode);
      }
      res.json(result.data);
    })
  );

  /**
   * POST /api/notion/pages
   * Create a new page in Notion.
   * Body: { parentId, title, children? }
   */
  router.post(
    "/pages",
    asyncHandler(async (req: AuthedRequest, res) => {
      const { parentId, title, children } = req.body as {
        parentId: string;
        title: string;
        children?: any[];
      };
      if (!parentId || !title) {
        throw new HttpError(400, "parentId and title are required", "VALIDATION_ERROR");
      }
      const result = await notion.createPage(req.user!.id, parentId, title, children);
      if (!result.success) {
        throw new HttpError(400, result.error!, result.errorCode);
      }
      res.status(201).json(result.data);
    })
  );

  /**
   * PATCH /api/notion/pages/:pageId
   * Update page properties.
   * Body: { properties }
   */
  router.patch(
    "/pages/:pageId",
    asyncHandler(async (req: AuthedRequest, res) => {
      const pageId = req.params.pageId!;
      const { properties } = req.body as { properties: Record<string, any> };
      if (!properties) {
        throw new HttpError(400, "properties object is required", "VALIDATION_ERROR");
      }
      const result = await notion.updatePage(req.user!.id, pageId, properties);
      if (!result.success) {
        throw new HttpError(400, result.error!, result.errorCode);
      }
      res.json(result.data);
    })
  );

  /**
   * POST /api/notion/databases/:databaseId/entries
   * Create a new entry in a Notion database.
   * Body: { properties }
   */
  router.post(
    "/databases/:databaseId/entries",
    asyncHandler(async (req: AuthedRequest, res) => {
      const databaseId = req.params.databaseId!;
      const { properties } = req.body as { properties: Record<string, any> };
      if (!properties) {
        throw new HttpError(400, "properties object is required", "VALIDATION_ERROR");
      }
      const result = await notion.createDatabaseEntry(req.user!.id, databaseId, properties);
      if (!result.success) {
        throw new HttpError(400, result.error!, result.errorCode);
      }
      res.status(201).json(result.data);
    })
  );

  /**
   * PATCH /api/notion/databases/:databaseId/entries/:entryId
   * Update a database entry.
   * Body: { properties }
   */
  router.patch(
    "/databases/:databaseId/entries/:entryId",
    asyncHandler(async (req: AuthedRequest, res) => {
      const entryId = req.params.entryId!;
      const { properties } = req.body as { properties: Record<string, any> };
      if (!properties) {
        throw new HttpError(400, "properties object is required", "VALIDATION_ERROR");
      }
      const result = await notion.updateDatabaseEntry(req.user!.id, entryId, properties);
      if (!result.success) {
        throw new HttpError(400, result.error!, result.errorCode);
      }
      res.json(result.data);
    })
  );

  /**
   * GET /api/notion/search?query=...
   * Search across all content types in the Notion workspace.
   */
  router.get(
    "/search",
    asyncHandler(async (req: AuthedRequest, res) => {
      const query = (req.query.query as string) || undefined;
      const result = await notion.searchNotion(req.user!.id, query);
      if (!result.success) {
        throw new HttpError(400, result.error!, result.errorCode);
      }
      res.json(result.data);
    })
  );

  /**
   * GET /api/notion/workspace
   * Retrieve workspace metadata.
   */
  router.get(
    "/workspace",
    asyncHandler(async (req: AuthedRequest, res) => {
      const result = await notion.getWorkspaceMetadata(req.user!.id);
      if (!result.success) {
        throw new HttpError(400, result.error!, result.errorCode);
      }
      res.json(result.data);
    })
  );

  return router;
}
