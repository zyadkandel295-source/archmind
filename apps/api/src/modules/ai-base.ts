import { Router, Request, Response } from "express";
import { asyncHandler } from "../lib/async-handler";
import { AIBaseService } from "../services/ai-base-service";

export function aiBaseRouter() {
  const router = Router();
  const service = new AIBaseService();

  // GET /api/ai-base/articles
  router.get(
    "/articles",
    asyncHandler(async (req: Request, res: Response) => {
      const category = req.query.category as string | undefined;
      const articles = service.getArticles(category);
      res.json({ success: true, count: articles.length, articles });
    })
  );

  // GET /api/ai-base/articles/:slug
  router.get(
    "/articles/:slug",
    asyncHandler(async (req: Request, res: Response) => {
      const article = service.getArticleBySlug(req.params.slug!);
      if (!article) {
        return res.status(404).json({ success: false, error: "Article not found" });
      }
      res.json({ success: true, article });
    })
  );

  // GET /api/ai-base/science
  router.get(
    "/science",
    asyncHandler(async (_req: Request, res: Response) => {
      const domains = service.getScienceDomains();
      res.json({ success: true, domains });
    })
  );

  // GET /api/ai-base/papers
  router.get(
    "/papers",
    asyncHandler(async (req: Request, res: Response) => {
      const query = req.query.q as string | undefined;
      const papers = service.getPapers(query);
      res.json({ success: true, count: papers.length, papers });
    })
  );

  // GET /api/ai-base/timeline
  router.get(
    "/timeline",
    asyncHandler(async (_req: Request, res: Response) => {
      const timeline = service.getTimeline();
      res.json({ success: true, timeline });
    })
  );

  // POST /api/ai-base/search
  router.post(
    "/search",
    asyncHandler(async (req: Request, res: Response) => {
      const query = req.body?.query || "";
      const searchResult = service.searchKnowledge(query);
      res.json({ success: true, ...searchResult });
    })
  );

  // POST /api/ai-base/research-agent
  router.post(
    "/research-agent",
    asyncHandler(async (req: Request, res: Response) => {
      const topic = req.body?.topic || "Latest LLM Architectures";
      const report = await service.runResearchAgent(topic);
      res.json({ success: true, report });
    })
  );

  return router;
}
