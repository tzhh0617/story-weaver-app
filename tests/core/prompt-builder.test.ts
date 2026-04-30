import { describe, expect, it } from 'vitest';
import {
  buildChapterDraftPrompt,
  buildChapterOutlinePrompt,
  buildMasterOutlinePrompt,
  buildVolumeOutlinePrompt,
  buildWorldPrompt,
} from '../../src/core/prompt-builder';

describe('buildWorldPrompt', () => {
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
});
