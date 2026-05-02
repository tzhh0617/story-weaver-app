import { describe, expect, it } from 'vitest';
import {
  buildChapterDraftPrompt,
  buildChapterOutlinePrompt,
  buildMasterOutlinePrompt,
  buildTitlePrompt,
  buildVolumeOutlinePrompt,
  buildWorldPrompt,
} from '@story-weaver/backend/core/prompt-builder';

describe('buildWorldPrompt', () => {
  it('builds an attractive title prompt from idea and viral strategy', () => {
    const prompt = buildTitlePrompt({
      title: '新作品',
      idea: 'A moon taxes every miracle.',
      targetChapters: 500,
      wordsPerChapter: 2500,
      viralStrategy: {
        readerPayoff: '弱者反杀收税者',
        protagonistDesire: '夺回奇迹定价权',
        cadenceMode: 'fast',
        antiClicheDirection: '主角每次胜利都背上新债',
      },
    });

    expect(prompt).toContain('Reader payoff: 弱者反杀收税者');
    expect(prompt).toContain('Protagonist desire: 夺回奇迹定价权');
    expect(prompt).toContain('Anti-cliche direction: 主角每次胜利都背上新债');
    expect(prompt).toContain('memorable Chinese web novel title');
    expect(prompt).toContain('Avoid generic empty phrases');
  });

  it('includes book title in world and draft prompts', () => {
    const worldPrompt = buildWorldPrompt({
      title: '月税奇谈',
      idea: 'A moon taxes every miracle.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });
    const draftPrompt = buildChapterDraftPrompt({
      title: '月税奇谈',
      idea: 'A moon taxes every miracle.',
      worldSetting: 'World setting',
      masterOutline: 'Master outline',
      continuityContext: null,
      chapterTitle: 'Chapter 1',
      chapterOutline: 'Opening',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    expect(worldPrompt).toContain('Book title: 月税奇谈');
    expect(draftPrompt).toContain('Book title: 月税奇谈');
  });

  it('anchors prompts to target chapters and per-chapter word count', () => {
    const prompt = buildWorldPrompt({
      idea: 'A mountain archive decides who may remember history.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    expect(prompt).toContain(
      'A mountain archive decides who may remember history.'
    );
    expect(prompt).toContain('Target chapters: 500');
    expect(prompt).toContain('Words per chapter: 2500');
    expect(prompt).not.toContain('Target length');
  });

  it('carries chapter-count and per-chapter constraints through later prompts', () => {
    const input = {
      idea: 'A mountain archive decides who may remember history.',
      targetChapters: 800,
      wordsPerChapter: 3000,
    };

    expect(buildMasterOutlinePrompt('World setting', input)).toContain(
      'Target chapters: 800'
    );
    expect(buildVolumeOutlinePrompt('Master outline', input)).toContain(
      'Allocate exactly 800 chapters'
    );
    expect(buildChapterOutlinePrompt('Volume outline', 1, input)).toContain(
      'chapter should be planned for about 3000 words'
    );
    expect(
      buildChapterDraftPrompt({
        idea: input.idea,
        worldSetting: 'World setting',
        masterOutline: 'Master outline',
        continuityContext: null,
        chapterTitle: 'Chapter 1',
        chapterOutline: 'Opening',
        targetChapters: input.targetChapters,
        wordsPerChapter: input.wordsPerChapter,
      })
    ).toContain('Write approximately 3000 Chinese characters');
    expect(
      buildChapterDraftPrompt({
        idea: input.idea,
        worldSetting: 'World setting',
        masterOutline: 'Master outline',
        continuityContext: null,
        chapterTitle: 'Chapter 1',
        chapterOutline: 'Opening',
        targetChapters: input.targetChapters,
        wordsPerChapter: input.wordsPerChapter,
      })
    ).not.toContain('do not exceed');
    expect(
      buildChapterDraftPrompt({
        idea: input.idea,
        worldSetting: 'World setting',
        masterOutline: 'Master outline',
        continuityContext: null,
        chapterTitle: 'Chapter 1',
        chapterOutline: 'Opening',
        targetChapters: input.targetChapters,
        wordsPerChapter: input.wordsPerChapter,
      })
    ).toContain('Do not include any chapter title');
  });

  it('injects story route plans into legacy chapter draft prompts', () => {
    const prompt = buildChapterDraftPrompt({
      idea: 'A mountain archive decides who may remember history.',
      worldSetting: 'World setting',
      masterOutline: 'Master outline',
      continuityContext: null,
      chapterTitle: 'Chapter 1',
      chapterOutline: 'Opening',
      targetChapters: 800,
      wordsPerChapter: 3000,
      routePlanText:
        'Story Skill Route Plan\nRequired Skills\n- story-structure',
    });

    expect(prompt).toContain('Story Skill Route Plan');
    expect(prompt).toContain('story-structure');
    expect(prompt).toContain('Chapter outline: Opening');
  });

  it('caps requested volume count to the target chapter count', () => {
    const prompt = buildVolumeOutlinePrompt('Master outline', {
      targetChapters: 3,
      wordsPerChapter: 1200,
    });

    expect(prompt).toContain('Expand this into 3 volume outlines.');
    expect(prompt).not.toContain('Expand this into 10 volume outlines.');
  });

  it('states the no-title chapter prose rule cleanly', () => {
    const prompt = buildChapterDraftPrompt({
      idea: 'A mountain archive decides who may remember history.',
      worldSetting: 'World setting',
      masterOutline: 'Master outline',
      continuityContext: null,
      chapterTitle: 'Chapter 1',
      chapterOutline: 'Opening',
      targetChapters: 3,
      wordsPerChapter: 1200,
    });

    expect(prompt).toContain(
      'Do not include any chapter title, heading, Markdown title, or title line in the body text.'
    );
    expect(prompt).not.toContain('in the正文');
  });

  it('centralizes AI-first style constraints in legacy generation prompts', () => {
    const worldPrompt = buildWorldPrompt({
      idea: 'A mountain archive decides who may remember history.',
      targetChapters: 80,
      wordsPerChapter: 2500,
    });
    const draftPrompt = buildChapterDraftPrompt({
      idea: 'A mountain archive decides who may remember history.',
      worldSetting: 'World setting',
      masterOutline: 'Master outline',
      continuityContext: 'Previous chapter ended at the archive gate.',
      chapterTitle: 'Gate Debt',
      chapterOutline: 'The protagonist must pay a memory debt.',
      targetChapters: 80,
      wordsPerChapter: 2500,
    });

    for (const prompt of [worldPrompt, draftPrompt]) {
      expect(prompt).toContain('AI-first text policy');
      expect(prompt).toContain(
        'The model is responsible for producing text that already satisfies the requested style and format.'
      );
      expect(prompt).toContain(
        'Local code will only perform structural guards such as trimming, JSON parsing, and storage-safe fallback handling.'
      );
      expect(prompt).toContain(
        'Use Chinese web novel prose: short readable paragraphs, visible conflict, action and dialogue over exposition, and a forward-driving ending hook.'
      );
    }
  });
});
