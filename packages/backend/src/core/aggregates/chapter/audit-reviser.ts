import { decideAuditAction } from '../../narrative/audit.js';
import type {
  ChapterCard,
  NarrativeAudit,
  ViralStoryProtocol,
} from '../../narrative/types.js';
import type { ProgressTrackerDeps } from './progress-tracker.js';
import { createProgressTracker } from './progress-tracker.js';

export type AuditReviserDeps = {
  chapterAuditor?: {
    auditChapter: (input: {
      modelId: string;
      draft: string;
      auditContext: string;
      routePlanText?: string | null;
      viralStoryProtocol?: ViralStoryProtocol | null;
      chapterIndex?: number | null;
    }) => Promise<NarrativeAudit>;
  };
  chapterRevision?: {
    reviseChapter: (input: {
      modelId: string;
      originalPrompt: string;
      draft: string;
      issues: NarrativeAudit['issues'];
    }) => Promise<string>;
  };
  chapterAudits?: {
    save: (input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      attempt: number;
      audit: NarrativeAudit;
    }) => void;
  };
} & ProgressTrackerDeps;

export function createAuditReviser(deps: AuditReviserDeps) {
  const { updateTrackedPhase } = createProgressTracker(deps);

  async function auditAndRevise(input: {
    bookId: string;
    modelId: string;
    content: string;
    prompt: string;
    commandContext: string | null;
    legacyContinuityContext: string;
    routePlanText: string;
    storyBible: {
      viralStoryProtocol?: ViralStoryProtocol | null;
    } | null;
    volumeIndex: number;
    chapterIndex: number;
    effectiveChapterCard: ChapterCard | null;
  }): Promise<{ result: { content: string; usage?: { inputTokens?: number; outputTokens?: number } }; auditScore: number | null; draftAttempts: number }> {
    let result: { content: string; usage?: { inputTokens?: number; outputTokens?: number } } = { content: input.content, usage: undefined };
    let auditScore: number | null = null;
    let draftAttempts = 1;
    if (deps.chapterAuditor && input.effectiveChapterCard) {
      const auditContext = input.commandContext ?? input.legacyContinuityContext;
      const auditStepLabel = `正在审校第 ${input.chapterIndex} 章叙事质量`;
      updateTrackedPhase({
        bookId: input.bookId,
        phase: 'auditing_chapter',
        stepLabel: auditStepLabel,
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
      });
      let audit = await deps.chapterAuditor.auditChapter({
        modelId: input.modelId,
        draft: result.content,
        auditContext,
        routePlanText: input.routePlanText,
        viralStoryProtocol: input.storyBible?.viralStoryProtocol ?? null,
        chapterIndex: input.chapterIndex,
      });
      deps.chapterAudits?.save({
        bookId: input.bookId,
        volumeIndex: input.chapterIndex,
        chapterIndex: input.chapterIndex,
        attempt: draftAttempts,
        audit,
      });

      const auditAction = decideAuditAction(audit, {
        chapterIndex: input.chapterIndex,
      });
      if (auditAction !== 'accept' && deps.chapterRevision) {
        draftAttempts += 1;
        const revisionStepLabel = `正在修订第 ${input.chapterIndex} 章`;
        updateTrackedPhase({
          bookId: input.bookId,
          phase: 'revising_chapter',
          stepLabel: revisionStepLabel,
          currentVolume: input.volumeIndex,
          currentChapter: input.chapterIndex,
        });
        result = {
          ...result,
          content: await deps.chapterRevision.reviseChapter({
            modelId: input.modelId,
            originalPrompt: input.prompt,
            draft: result.content,
            issues: audit.issues,
          }),
        };
        const reauditStepLabel = `正在复审第 ${input.chapterIndex} 章叙事质量`;
        updateTrackedPhase({
          bookId: input.bookId,
          phase: 'auditing_chapter',
          stepLabel: reauditStepLabel,
          currentVolume: input.volumeIndex,
          currentChapter: input.chapterIndex,
        });
        audit = await deps.chapterAuditor.auditChapter({
          modelId: input.modelId,
          draft: result.content,
          auditContext,
          routePlanText: input.routePlanText,
          viralStoryProtocol: input.storyBible?.viralStoryProtocol ?? null,
          chapterIndex: input.chapterIndex,
        });
        deps.chapterAudits?.save({
          bookId: input.bookId,
          volumeIndex: input.volumeIndex,
          chapterIndex: input.chapterIndex,
          attempt: draftAttempts,
          audit,
        });
      }

      auditScore = audit.score;
    }
    return { result, auditScore, draftAttempts };
  }

  return { auditAndRevise };
}
