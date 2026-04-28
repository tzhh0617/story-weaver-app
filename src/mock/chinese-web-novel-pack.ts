export const chineseWebNovelPack = {
  genres: [
    {
      id: 'xianxia-revenge',
      keywords: ['宗门', '古镜', '因果', '师尊', '逐出', '山门'],
      tone: '压抑开局，随后快速升级与反转',
      protagonistSurname: ['陆', '沈', '顾', '秦'],
      protagonistGiven: ['照', '玄', '临', '渊'],
      factions: ['太衡宗', '北辰殿', '执律堂', '藏锋峰'],
      locations: ['祖祠废井', '问罪台', '藏经阁', '外门石阶'],
      openingImages: ['夜雨压在残檐上', '山风卷过石阶尽头', '祠堂冷火映着断碑'],
      pressureSources: ['宗门戒律', '长老审讯', '旧案反噬'],
      hookPhrases: [
        '然而真正的代价，此刻才刚刚开始。',
        '可偏偏就在这时，古镜深处再次传来低鸣。',
      ],
      conflict: '主角在被逐出与旧案反噬之间，被迫踏上逆势翻盘的道路。',
    },
    {
      id: 'urban-ability',
      keywords: ['公司', '异能', '债务', '夜市', '调查', '档案'],
      tone: '都市压迫感与爽点并行',
      protagonistSurname: ['林', '周', '许', '陈'],
      protagonistGiven: ['墨', '野', '川', '澈'],
      factions: ['债务审理局', '雾港财团', '夜巡队', '黑市中介'],
      locations: ['旧城夜市', '高架桥下', '封账大厅', '地下档案库'],
      openingImages: ['霓虹被雨水拉成长线', '高架桥下的尾灯映在积水里', '旧城广播在夜色里反复播报催缴名单'],
      pressureSources: ['债务催缴', '档案追查', '财团清算'],
      hookPhrases: [
        '然而那份旧账，终于还是找上了门。',
        '就在这时，他才发现自己已经被卷进更深的局。',
      ],
      conflict: '主角在债务与异能失控的双重压力下追查真相。',
    },
  ],
  chapterBeats: [
    '开场压迫',
    '信息揭示',
    '冲突升级',
    '代价落地',
    '悬念收束',
  ],
} as const;

export type ChineseWebNovelGenre = (typeof chineseWebNovelPack.genres)[number];
