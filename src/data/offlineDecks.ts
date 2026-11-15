import type { AnalysisResult, ChallengeQuestion } from '../types';

export const SOLO_CATEGORIES = [
  'Wildcard Mix',
  'Everyday Habits',
  'Social Dilemmas',
  'Work & Ambition',
  'Creative Scenarios',
] as const;

export type SoloCategory = (typeof SOLO_CATEGORIES)[number];

export interface OfflineDeck {
  id: string;
  category: SoloCategory;
  title: string;
  deckNumber: number;
  questions: ChallengeQuestion[];
  selfReviewQuestions: string[];
}

export const OFFLINE_DECKS: Record<SoloCategory, OfflineDeck[]> = {
  'Wildcard Mix': [
    {
      id: 'wildcard-1',
      category: 'Wildcard Mix',
      title: 'Instinct vs. Routine',
      deckNumber: 1,
      questions: [
        {
          id: 'wc1-q1',
          prompt: 'Do you think of yourself as someone who follows a strict plan or improvises on the fly?',
          hint: 'Pick your honest default style',
        },
        {
          id: 'wc1-q2',
          prompt: 'Tell the story of the last time a sudden change of plans actually went better than expected.',
          hint: 'Notice how quickly you adapted',
        },
        {
          id: 'wc1-q3',
          prompt: 'If a friend offered you a free mystery weekend trip leaving in three hours, what would stop you—or make you go?',
          hint: 'Be specific about your tipping point',
        },
        {
          id: 'wc1-q4',
          prompt: 'Which daily small comfort would you refuse to give up even during an adventure?',
          hint: 'Coffee, pillow, playlist, or routine',
        },
        {
          id: 'wc1-q5',
          prompt: 'Looking at your first four answers, are you secretly more cautious or more impulsive than people assume?',
          hint: 'Connect your earlier choices',
        },
      ],
      selfReviewQuestions: [
        'Did your self-label in Question 1 (planner vs. improviser) match how you reacted to the mystery trip in Question 3?',
        'Notice where you used hedging words like "probably", "depends", or "maybe"—which question felt least certain?',
        'Does your non-negotiable comfort in Question 4 reveal a hidden boundary beneath your adventurous side?',
        'If a close friend read all 5 answers side by side, which two answers would surprise them most?',
      ],
    },
    {
      id: 'wildcard-2',
      category: 'Wildcard Mix',
      title: 'Public Persona vs. Private Habits',
      deckNumber: 2,
      questions: [
        {
          id: 'wc2-q1',
          prompt: 'What first impression do strangers usually get from you within five minutes of meeting?',
          hint: 'Calm, chatty, serious, or playful?',
        },
        {
          id: 'wc2-q2',
          prompt: 'What opinion do you hold strongly in private that you rarely bring up at dinner parties?',
          hint: 'Keep it lighthearted or everyday',
        },
        {
          id: 'wc2-q3',
          prompt: 'When you want to make a good impression, do you ask more questions or share bigger stories?',
          hint: 'Think about your conversational habit',
        },
        {
          id: 'wc2-q4',
          prompt: 'What harmless habit at home completely contradicts how put-together you look outside?',
          hint: 'No judgment—everyone has one',
        },
        {
          id: 'wc2-q5',
          prompt: 'If a camera recorded your typical Saturday morning, how closely would it match your Question 1 impression?',
          hint: 'Compare the vibe directly',
        },
      ],
      selfReviewQuestions: [
        'How big is the contrast between your Question 1 public impression and your Question 4 private habit?',
        'In Question 2 and Question 3, did you sound confident and direct or careful to soften your stance?',
        'Do your answers suggest you adapt heavily to the room, or stay basically the same everywhere?',
        'Which answer felt most unfiltered, and which one felt most edited?',
      ],
    },
    {
      id: 'wildcard-3',
      category: 'Wildcard Mix',
      title: 'Risk, Luck & Regret',
      deckNumber: 3,
      questions: [
        {
          id: 'wc3-q1',
          prompt: 'Would you rather guarantee a good outcome today or take a 50/50 shot at an extraordinary one next year?',
          hint: 'Explain why your gut leans that way',
        },
        {
          id: 'wc3-q2',
          prompt: 'Describe a minor risk you hesitated over that now feels funny to worry about.',
          hint: 'A hobby, purchase, or bold text',
        },
        {
          id: 'wc3-q3',
          prompt: 'When something works out well for you, do you usually credit preparation or good timing?',
          hint: 'Notice your first instinct',
        },
        {
          id: 'wc3-q4',
          prompt: 'What rule do you tell other people to follow that you occasionally bend yourself?',
          hint: 'Sleep, spending, or screen limits',
        },
        {
          id: 'wc3-q5',
          prompt: 'After answering all four, would you trust your past self or your future self to make a bold decision?',
          hint: 'Tie back to your risk style',
        },
      ],
      selfReviewQuestions: [
        'Compare Question 1 and Question 3: does someone who values preparation or luck usually pick that bet?',
        'Did Question 4 expose a playful double standard compared with your earlier principles?',
        'Check whether your phrasing stayed decisive ("definitely", "always") or shifted into qualifiers ("sometimes", "usually").',
        'Do your five responses tell one steady story about how you handle uncertainty?',
      ],
    },
    {
      id: 'wildcard-4',
      category: 'Wildcard Mix',
      title: 'Memory & Storytelling',
      deckNumber: 4,
      questions: [
        {
          id: 'wc4-q1',
          prompt: 'Are you the friend who remembers exact details of an event or the one who remembers the emotional vibe?',
          hint: 'Accuracy vs. atmosphere',
        },
        {
          id: 'wc4-q2',
          prompt: 'When retelling a funny mishap, do you ever trim boring parts to keep the pacing snappy?',
          hint: 'Confess your editing style',
        },
        {
          id: 'wc4-q3',
          prompt: 'What ordinary object on your desk or shelf has a surprisingly good backstory behind it?',
          hint: 'Give the short version',
        },
        {
          id: 'wc4-q4',
          prompt: 'How quickly do you admit when someone catches a detail wrong in a story you were telling?',
          hint: 'Immediate correction or graceful pivot?',
        },
        {
          id: 'wc4-q5',
          prompt: 'Did you answer these questions focusing more on facts or on keeping the narrative entertaining?',
          hint: 'Reflect on your own tone',
        },
      ],
      selfReviewQuestions: [
        'Does your answer in Question 2 conflict at all with how accurate you claimed to be in Question 1?',
        'Look at Question 3: did you include concrete specifics (times, places, objects) or keep things broad?',
        'How does your reaction in Question 4 align with your storytelling style in Question 5?',
        'Where did you give the clearest, most direct explanation across the five prompts?',
      ],
    },
  ],

  'Everyday Habits': [
    {
      id: 'habits-1',
      category: 'Everyday Habits',
      title: 'Mornings, Alarms & Punctuality',
      deckNumber: 1,
      questions: [
        {
          id: 'eh1-q1',
          prompt: 'How many alarms are currently saved on your phone, and how many do you actually snooze?',
          hint: 'Count both honestly',
        },
        {
          id: 'eh1-q2',
          prompt: 'When you text someone "on my way", where are you usually standing at that exact second?',
          hint: 'Doorstep, couch, or halfway there?',
        },
        {
          id: 'eh1-q3',
          prompt: 'Would friends describe you as the early planner or the person who thrives on last-minute adrenaline?',
          hint: 'Think of group trips or dinners',
        },
        {
          id: 'eh1-q4',
          prompt: 'What is the one morning step you refuse to skip even when you are 15 minutes behind schedule?',
          hint: 'Coffee, hair, playlist, or breakfast',
        },
        {
          id: 'eh1-q5',
          prompt: 'If you had to arrive 20 minutes early to everything for a month, what part of your day would break first?',
          hint: 'Spot the bottleneck',
        },
      ],
      selfReviewQuestions: [
        'Do your alarm count (Question 1) and your "on my way" timing (Question 2) match how punctual you framed yourself in Question 3?',
        'Notice Question 4: is your non-negotiable morning step the real reason mornings feel rushed or calm?',
        'Look for any excuses or softening words ("just", "only", "usually") in your timing answers.',
        'Which single change across your answers would make Question 5 effortless?',
      ],
    },
    {
      id: 'habits-2',
      category: 'Everyday Habits',
      title: 'Phone, Focus & Micro-Breaks',
      deckNumber: 2,
      questions: [
        {
          id: 'eh2-q1',
          prompt: 'How long can you sit through a great movie without glancing at your phone once?',
          hint: 'Full runtime or quick check?',
        },
        {
          id: 'eh2-q2',
          prompt: 'When you pick up your phone to check one specific thing, how often do you forget why you unlocked it?',
          hint: 'Be candid about the scroll trap',
        },
        {
          id: 'eh2-q3',
          prompt: 'Do you leave messages unread until you can write a proper reply, or answer instantly with two words?',
          hint: 'Describe your inbox philosophy',
        },
        {
          id: 'eh2-q4',
          prompt: 'What offline activity makes you completely lose track of time for two hours straight?',
          hint: 'Cooking, walking, reading, or tinkering',
        },
        {
          id: 'eh2-q5',
          prompt: 'Compare Question 1 and Question 4: what makes offline focus easier for you than screen focus?',
          hint: 'Connect the pattern',
        },
      ],
      selfReviewQuestions: [
        'Did your claimed focus span in Question 1 hold up alongside your phone unlock habit in Question 2?',
        'Does your messaging habit in Question 3 match how available or distracted you feel during movies?',
        'Look at how specific your Question 4 activity sounded compared to your screen habits.',
        'Where in these 5 answers were you strictest with yourself vs. most forgiving?',
      ],
    },
    {
      id: 'habits-3',
      category: 'Everyday Habits',
      title: 'Kitchen, Shopping & Clutter',
      deckNumber: 3,
      questions: [
        {
          id: 'eh3-q1',
          prompt: 'When you open the fridge tired at 9 p.m., do you cook from scratch or improvise snacks?',
          hint: 'Ideal routine vs. real Tuesday night',
        },
        {
          id: 'eh3-q2',
          prompt: 'How strictly do you stick to a grocery list once you walk past the bakery or snack aisle?',
          hint: '100% disciplined or impulse explorer?',
        },
        {
          id: 'eh3-q3',
          prompt: 'What chore do you weirdly enjoy doing, and which one do you procrastinate until the very end?',
          hint: 'Name both sides',
        },
        {
          id: 'eh3-q4',
          prompt: 'If a friend dropped by with 10 minutes’ notice, what one spot would you hurriedly tidy first?',
          hint: 'Couch, sink, or mystery chair?',
        },
        {
          id: 'eh3-q5',
          prompt: 'Looking back at Questions 1–4, are you more tidy in public spaces or behind closed cabinet doors?',
          hint: 'Summarize your home style',
        },
      ],
      selfReviewQuestions: [
        'Compare Question 2 (list discipline) and Question 1 (tired dinner choices): do both reflect the same level of planning?',
        'Does the panic-tidy spot in Question 4 match the chore you admitted avoiding in Question 3?',
        'Check if you started strong and disciplined in Q1–Q2 before conceding more chaos by Q4–Q5.',
        'Which answer felt closest to your actual week, and which felt slightly aspirational?',
      ],
    },
    {
      id: 'habits-4',
      category: 'Everyday Habits',
      title: 'Sleep, Energy & Weekend Reset',
      deckNumber: 4,
      questions: [
        {
          id: 'eh4-q1',
          prompt: 'Are you genuinely a morning person, a night owl, or someone pretending to be the opposite?',
          hint: 'Energy reality check',
        },
        {
          id: 'eh4-q2',
          prompt: 'What usually keeps you awake past the bedtime you promised yourself at noon?',
          hint: 'One more episode, ideas, or scrolling?',
        },
        {
          id: 'eh4-q3',
          prompt: 'On a completely free Sunday, do you pack it with errands and plans or protect empty hours?',
          hint: 'Describe your ideal Sunday pace',
        },
        {
          id: 'eh4-q4',
          prompt: 'Which small daily habit gives you way more energy than you expect whenever you actually do it?',
          hint: 'Walk, water, stretching, or tidying',
        },
        {
          id: 'eh4-q5',
          prompt: 'If your energy habit in Question 4 works so well, why does it still slip on busy weeks?',
          hint: 'Be honest about the friction',
        },
      ],
      selfReviewQuestions: [
        'Does your bedtime thief in Question 2 line up with your chronotype claim in Question 1?',
        'Compare Question 3 and Question 5: do packed schedules or unstructured evenings throw your rhythm off more?',
        'Notice any contrast between knowing what boosts your energy (Question 4) and actually prioritizing it.',
        'Did your tone stay consistent or shift when explaining why good habits slip?',
      ],
    },
  ],

  'Social Dilemmas': [
    {
      id: 'social-1',
      category: 'Social Dilemmas',
      title: 'Polite White Lies & Group Plans',
      deckNumber: 1,
      questions: [
        {
          id: 'sd1-q1',
          prompt: 'When a friend cooks a meal that turns out way too salty, do you give gentle feedback or rave politely?',
          hint: 'Honesty vs. kindness in the moment',
        },
        {
          id: 'sd1-q2',
          prompt: 'If you need to cancel Friday plans just because your social battery is empty, do you say so directly?',
          hint: 'Real reason vs. soft excuse',
        },
        {
          id: 'sd1-q3',
          prompt: 'In a group chat trying to pick a restaurant, are you the tie-breaker or the "anything works" responder?',
          hint: 'Think of your last group thread',
        },
        {
          id: 'sd1-q4',
          prompt: 'How do you feel when a friend politely cancels on you at the last minute with a vague excuse?',
          hint: 'Notice if your standard flips',
        },
        {
          id: 'sd1-q5',
          prompt: 'Looking across Questions 1–4, do you expect more bluntness from others than you give yourself?',
          hint: 'Compare both sides fairly',
        },
      ],
      selfReviewQuestions: [
        'Compare Question 2 (how you cancel) with Question 4 (how you react when cancelled on): is your standard symmetric?',
        'Did you favor blunt honesty in Question 1 yet choose diplomacy in Question 2 or 3?',
        'Spot qualifying phrases like "it depends on who" or "only if they ask"—where did your rule bend?',
        'What pattern stands out most about how you balance harmony and directness?',
      ],
    },
    {
      id: 'social-2',
      category: 'Social Dilemmas',
      title: 'Secrets, Gossip & Awkward Moments',
      deckNumber: 2,
      questions: [
        {
          id: 'sd2-q1',
          prompt: 'If a friend says "don’t tell anyone", does that include your partner/best friend or truly nobody?',
          hint: 'Draw your real privacy line',
        },
        {
          id: 'sd2-q2',
          prompt: 'You spot a stranger with spinach in their teeth right before a presentation—do you whisper a heads-up or stay quiet?',
          hint: 'Quick awkward save or non-interference?',
        },
        {
          id: 'sd2-q3',
          prompt: 'When two friends are mildly feuding and both vent to you, how do you avoid taking a side?',
          hint: 'Listener, mediator, or subject-changer?',
        },
        {
          id: 'sd2-q4',
          prompt: 'Have you ever pretended to remember someone’s name for ten minutes hoping a clue would drop?',
          hint: 'Confess your rescue move',
        },
        {
          id: 'sd2-q5',
          prompt: 'Across these four situations, do you prioritize protecting someone’s comfort or avoiding awkwardness?',
          hint: 'Name your driving instinct',
        },
      ],
      selfReviewQuestions: [
        'Did your boundary in Question 1 feel absolute, or did you add exceptions?',
        'Compare Question 2 and Question 4: you might intervene to save a stranger embarrassment, yet stay quiet to avoid admitting you forgot a name!',
        'Look at whether your answers leaned principled ("never") or pragmatic ("depends on the moment").',
        'Which situation made you hesitate longest while writing?',
      ],
    },
    {
      id: 'social-3',
      category: 'Social Dilemmas',
      title: 'Favors, Money & Boundaries',
      deckNumber: 3,
      questions: [
        {
          id: 'sd3-q1',
          prompt: 'At a birthday dinner where everyone orders differently, do you prefer splitting the bill evenly or itemizing?',
          hint: 'Simplicity vs. fairness',
        },
        {
          id: 'sd3-q2',
          prompt: 'If you lend a friend a favorite book or jacket and three months pass, how directly do you ask for it back?',
          hint: 'Casual reminder vs. silent write-off',
        },
        {
          id: 'sd3-q3',
          prompt: 'When a friend asks for a favor on your only free Saturday, what makes you say yes even when tired?',
          hint: 'Loyalty, guilt, or clear boundaries?',
        },
        {
          id: 'sd3-q4',
          prompt: 'How easy is it for you to ask friends for help moving or assembling furniture?',
          hint: 'Compare giving vs. asking',
        },
        {
          id: 'sd3-q5',
          prompt: 'Comparing Questions 3 and 4, why do we often accept favors for others faster than we ask for ourselves?',
          hint: 'Notice your own symmetry',
        },
      ],
      selfReviewQuestions: [
        'Compare Question 1 and Question 2: did you care more about avoiding money awkwardness in one than the other?',
        'Look at Question 3 vs. Question 4: are you comfortable saying yes to others yet reluctant to ask for help yourself?',
        'Did your answers stay decisive or soften whenever a close friend was involved?',
        'Which answer best sums up your unspoken rule about fairness?',
      ],
    },
    {
      id: 'social-4',
      category: 'Social Dilemmas',
      title: 'Parties, Hosts & First Impressions',
      deckNumber: 4,
      questions: [
        {
          id: 'sd4-q1',
          prompt: 'At a party where you only know the host, do you mingle across groups or stick near one familiar face?',
          hint: 'Social explorer or anchor buddy?',
        },
        {
          id: 'sd4-q2',
          prompt: 'Do you believe in proper goodbyes to everyone in the room or the quiet stealth exit?',
          hint: 'Grand farewell vs. Irish goodbye',
        },
        {
          id: 'sd4-q3',
          prompt: 'If two guests show up wearing the exact same outfit, do you point it out as a joke or pretend not to notice?',
          hint: 'Spotlight or smooth past?',
        },
        {
          id: 'sd4-q4',
          prompt: 'When hosting friends, are you relaxed on the couch with everyone or fussily clearing glasses every five minutes?',
          hint: 'Host energy check',
        },
        {
          id: 'sd4-q5',
          prompt: 'Does your guest persona in Questions 1–2 match your host persona in Question 4?',
          hint: 'Compare both roles',
        },
      ],
      selfReviewQuestions: [
        'Compare Question 2 (your exit style) with Question 4 (your hosting style): do you crave closure or low-friction ease?',
        'Did Question 1 and Question 3 show the same comfort level with drawing attention in a room?',
        'Check if your phrasing got livelier on stories where you felt strongly.',
        'Which single answer would your friends recognize as 100% classic you?',
      ],
    },
  ],

  'Work & Ambition': [
    {
      id: 'work-1',
      category: 'Work & Ambition',
      title: 'Deadlines, Perfection & Momentum',
      deckNumber: 1,
      questions: [
        {
          id: 'wa1-q1',
          prompt: 'Do you do better work polishing details slowly all week or sprinting with deadline pressure?',
          hint: 'Steady pace vs. final-hour focus',
        },
        {
          id: 'wa1-q2',
          prompt: 'When you finish a project early, do you ship it immediately or tweak fonts and wording until the clock runs out?',
          hint: 'Done vs. endlessly refined',
        },
        {
          id: 'wa1-q3',
          prompt: 'What type of feedback energizes you most—and what kind makes you overthink for a day?',
          hint: 'Name the specific trigger',
        },
        {
          id: 'wa1-q4',
          prompt: 'If a teammate proposes a chaotic shortcut that saves three hours, do you test it or insist on the textbook process?',
          hint: 'Speed vs. structure',
        },
        {
          id: 'wa1-q5',
          prompt: 'Looking back at Questions 1–4, are you chasing perfection or chasing momentum?',
          hint: 'Reconcile any contradiction',
        },
      ],
      selfReviewQuestions: [
        'Did Question 1 and Question 2 agree—or did you claim to ship steadily while admitting to last-minute tweaking?',
        'Compare Question 4 (shortcut vs. textbook) with Question 2: do you hold teammates to the same standard as yourself?',
        'Notice where you used cautious phrasing ("usually", "mostly") when describing work habits.',
        'What is the biggest tension between your ideal workflow and your real deadlines?',
      ],
    },
    {
      id: 'work-2',
      category: 'Work & Ambition',
      title: 'Leadership, Credit & Ownership',
      deckNumber: 2,
      questions: [
        {
          id: 'wa2-q1',
          prompt: 'When a group project hits an awkward silence at kickoff, do you step up to organize or wait for a role?',
          hint: 'First mover or thoughtful observer?',
        },
        {
          id: 'wa2-q2',
          prompt: 'If a strategy you championed turns out wrong, how quickly do you pivot publicly versus defend your logic?',
          hint: 'Ego check in real scenarios',
        },
        {
          id: 'wa2-q3',
          prompt: 'Would you rather lead a small experimental project with huge autonomy or contribute to a flagship global effort?',
          hint: 'Ownership scale vs. stage size',
        },
        {
          id: 'wa2-q4',
          prompt: 'When mentoring someone, do you let them make harmless mistakes to learn or step in early to prevent rework?',
          hint: 'Hands-off trust vs. quality control',
        },
        {
          id: 'wa2-q5',
          prompt: 'Across Questions 1–4, what matters more to your ambition: autonomy, recognition, or mastery?',
          hint: 'Pick your #1 driver',
        },
      ],
      selfReviewQuestions: [
        'Compare Question 1 (taking initiative) and Question 3 (autonomy vs. flagship): do both point to the same kind of role?',
        'Does your coaching style in Question 4 match how freely you let yourself experiment in Question 2?',
        'Check whether your answer in Question 5 accurately reflects the priorities visible in Questions 1–4.',
        'Which question prompted your most nuanced or conflicted answer?',
      ],
    },
    {
      id: 'work-3',
      category: 'Work & Ambition',
      title: 'Balance, Ambition & Switching Off',
      deckNumber: 3,
      questions: [
        {
          id: 'wa3-q1',
          prompt: 'How cleanly can you close your laptop at 6 p.m. and stop thinking about unfinished tasks?',
          hint: 'Hard cutoff or mental background tabs?',
        },
        {
          id: 'wa3-q2',
          prompt: 'Have you ever told friends "work is crazy right now" mainly because you enjoyed the rush of being busy?',
          hint: 'Honest look at busyness',
        },
        {
          id: 'wa3-q3',
          prompt: 'If you received a 20% raise tomorrow with zero extra hours vs. a bigger title with 15 extra hours weekly, which wins?',
          hint: 'Time freedom vs. status',
        },
        {
          id: 'wa3-q4',
          prompt: 'What side curiosity or skill do you keep telling yourself you will pursue "next quarter"?',
          hint: 'Name the deferred dream',
        },
        {
          id: 'wa3-q5',
          prompt: 'Does your choice in Question 3 match how you actually spent your evenings this past month?',
          hint: 'Compare ideals vs. calendar',
        },
      ],
      selfReviewQuestions: [
        'Look at Question 1 vs. Question 3: if you chose time freedom, do your evening habits protect it?',
        'Compare Question 2 and Question 4: is "being busy" sometimes what delays your Question 4 curiosity?',
        'Notice any shift between aspirational values in Q3 and practical reality in Q5.',
        'Which of your five answers felt most eye-opening to put into words?',
      ],
    },
    {
      id: 'work-4',
      category: 'Work & Ambition',
      title: 'Meetings, Focus & Big Ideas',
      deckNumber: 4,
      questions: [
        {
          id: 'wa4-q1',
          prompt: 'In a brainstorming meeting, do you blurt out wild half-formed ideas or wait until your thought is airtight?',
          hint: 'Think aloud vs. polish internally',
        },
        {
          id: 'wa4-q2',
          prompt: 'What percentage of meetings on your calendar could honestly have been a crisp three-bullet message?',
          hint: 'Give a rough number and why',
        },
        {
          id: 'wa4-q3',
          prompt: 'When someone challenges your favorite idea in front of others, what is your immediate internal reaction?',
          hint: 'Curiosity, defensiveness, or calm?',
        },
        {
          id: 'wa4-q4',
          prompt: 'Do you learn faster by reading the manual front to back or breaking things hands-on until it clicks?',
          hint: 'Theory first vs. trial first',
        },
        {
          id: 'wa4-q5',
          prompt: 'Compare Question 1 and Question 4: why do our brainstorming style and learning style often mirror each other?',
          hint: 'Spot your communication theme',
        },
      ],
      selfReviewQuestions: [
        'Did your willingness to share rough ideas in Question 1 align with learning hands-on (vs. manual-first) in Question 4?',
        'Check Question 2 and Question 3: do you value crisp directness from others even when they challenge your idea?',
        'Review your answers for concrete details vs. vague generalities.',
        'What single word would summarize your working style across all 5 answers?',
      ],
    },
  ],

  'Creative Scenarios': [
    {
      id: 'creative-1',
      category: 'Creative Scenarios',
      title: 'Time Capsules & Strange Inventions',
      deckNumber: 1,
      questions: [
        {
          id: 'cs1-q1',
          prompt: 'If you could freeze one ordinary sensory detail—a smell, sound, or light—in a jar forever, what would you bottle?',
          hint: 'Be vivid and specific',
        },
        {
          id: 'cs1-q2',
          prompt: 'You invent a tiny pocket gadget that solves one trivial daily annoyance—what does it fix?',
          hint: 'Keep it wonderfully practical or absurd',
        },
        {
          id: 'cs1-q3',
          prompt: 'If someone made a movie about a regular week in your life, what genre would it unexpectedly turn into?',
          hint: 'Sitcom, indie drama, heist, or cozy?',
        },
        {
          id: 'cs1-q4',
          prompt: 'Which fictional world would you visit for 48 hours—knowing you absolutely must come back when the timer ends?',
          hint: 'Pick one and say why',
        },
        {
          id: 'cs1-q5',
          prompt: 'Look at your answers to Questions 1, 3, and 4: what hidden mood connects all three?',
          hint: 'Nostalgia, humor, wonder, or calm?',
        },
      ],
      selfReviewQuestions: [
        'Do your jar memory (Q1), life genre (Q3), and fictional getaway (Q4) share one consistent emotional tone or jump between worlds?',
        'Notice whether your invention in Q2 stayed grounded and practical or leaned playful and surreal.',
        'Did your writing feel vivid and decisive, or did you hedge with "probably something like..."?',
        'Which image across your five answers felt most uniquely yours?',
      ],
    },
    {
      id: 'creative-2',
      category: 'Creative Scenarios',
      title: 'Alternate Timelines & Secret Talents',
      deckNumber: 2,
      questions: [
        {
          id: 'cs2-q1',
          prompt: 'If you woke up fluent in any creative craft overnight—pottery, jazz piano, or cinema—which one wins?',
          hint: 'Choose one and picture your first week',
        },
        {
          id: 'cs2-q2',
          prompt: 'In an alternate timeline where your current career never existed, what completely unrelated job would you pick?',
          hint: 'Park ranger, baker, archivist?',
        },
        {
          id: 'cs2-q3',
          prompt: 'You get an unexpected grant to host a one-night pop-up event in your city with zero commercial pressure—what happens inside?',
          hint: 'Paint the scene briefly',
        },
        {
          id: 'cs2-q4',
          prompt: 'What weird creative hobby did you quit as a kid that would actually fit you well today?',
          hint: 'Drawing comics, magic tricks, radio?',
        },
        {
          id: 'cs2-q5',
          prompt: 'Looking across Questions 1–4, do your creative instincts point toward solo craft or shared spectacle?',
          hint: 'Compare studio vs. crowd',
        },
      ],
      selfReviewQuestions: [
        'Compare Question 1 (overnight craft) with Question 3 (pop-up event): were both solo-focused or community-focused?',
        'Does your alternate career in Q2 echo the childhood spark in Q4?',
        'Check if your explanation in Question 5 truly fits the evidence in your earlier 4 answers.',
        'Which prompt sparked the fastest, least-filtered creative idea?',
      ],
    },
    {
      id: 'creative-3',
      category: 'Creative Scenarios',
      title: 'Desert Island, Museum & Signals',
      deckNumber: 3,
      questions: [
        {
          id: 'cs3-q1',
          prompt: 'A tiny museum opens dedicated to everyday human life this decade—what single item from your pocket or bag goes in?',
          hint: 'Receipt, earbuds, keychain, or note?',
        },
        {
          id: 'cs3-q2',
          prompt: 'If you had to communicate your personality to aliens using only one song and one meal, what are they?',
          hint: 'Explain the pairing',
        },
        {
          id: 'cs3-q3',
          prompt: 'You discover an extra hidden 25th hour in every day that only you can use—no work allowed. How do you spend it?',
          hint: 'Rest, art, wandering, or mischief?',
        },
        {
          id: 'cs3-q4',
          prompt: 'Would you rather read everyone’s honest internal subtitles for one day or have cinematic background music follow you?',
          hint: 'Pick your surreal power',
        },
        {
          id: 'cs3-q5',
          prompt: 'Did your answers lean more curious about other people or absorbed in your own atmosphere?',
          hint: 'Spot the thread',
        },
      ],
      selfReviewQuestions: [
        'Look at Question 2 (song + meal) and Question 3 (extra 25th hour): do they suggest high energy or slow comfort?',
        'Compare Question 4 (internal subtitles vs. soundtrack) with Question 5: did your choice match your self-assessment?',
        'Notice whether you explained *why* behind each creative pick or kept things mysterious.',
        'Which answer would spark the longest debate if you read it out loud to friends?',
      ],
    },
    {
      id: 'creative-4',
      category: 'Creative Scenarios',
      title: 'Impossible Architecture & Mini-Worlds',
      deckNumber: 4,
      questions: [
        {
          id: 'cs4-q1',
          prompt: 'You can add one impossible room to your home—floating library, indoor rain conservatory, or midnight diner—what do you build?',
          hint: 'Describe the vibe in one or two lines',
        },
        {
          id: 'cs4-q2',
          prompt: 'If weather reflected your mood every time you opened the front door, what forecast would friends see most often?',
          hint: 'Crisp autumn sun, warm drizzle, or wind?',
        },
        {
          id: 'cs4-q3',
          prompt: 'You are designing a board game called "Tuesday Night"—what is the funniest obstacle card in the deck?',
          hint: 'Turn everyday chaos into a rule',
        },
        {
          id: 'cs4-q4',
          prompt: 'If you could step inside any painting or album cover for an afternoon walk, which one pulls you in?',
          hint: 'Focus on the feeling of being there',
        },
        {
          id: 'cs4-q5',
          prompt: 'Put Questions 1, 2, and 4 side by side: did you build a cozy refuge or a wild adventure?',
          hint: 'Summarize your worldbuilding style',
        },
      ],
      selfReviewQuestions: [
        'Check whether your impossible room (Q1), personal weather (Q2), and artwork walk (Q4) form one cohesive aesthetic.',
        'Did Question 3 (the funny obstacle card) break the mood playfully or fit right inside your world?',
        'Look back at your word choices—were they sensory and direct, or hesitant and abstract?',
        'How closely does your imagined world in Question 5 reflect what recharges you in real life?',
      ],
    },
  ],
};

let inMemoryRecentDeckIds: string[] = [];

export function readRecentOfflineDeckIds(): string[] {
  return [...inMemoryRecentDeckIds];
}

export function writeRecentOfflineDeckIds(deckIds: string[]): void {
  inMemoryRecentDeckIds = deckIds.slice(-20);
}

export function resetRecentOfflineDeckIdsForTest(): void {
  inMemoryRecentDeckIds = [];
}

export const DEFAULT_20_QUESTIONS: ChallengeQuestion[] = [
  { id: 'def-1', prompt: 'Have you ever pretended to understand a movie ending you found totally confusing?', hint: 'Be dramatic or specific' },
  { id: 'def-2', prompt: 'Do you secretly sing full concerts in the shower when nobody is home?', hint: 'Genre choices welcome' },
  { id: 'def-3', prompt: 'Have you ever blamed slow Wi-Fi when you simply forgot to reply to a message?', hint: 'Tech excuses count' },
  { id: 'def-4', prompt: 'Would you survive 48 hours in the woods without checking your phone once?', hint: 'Honest instinct' },
  { id: 'def-5', prompt: 'Have you ever eaten someone else’s labeled leftovers from the fridge?', hint: 'No judgment here' },
  { id: 'def-6', prompt: 'Do you look at restaurant menus online before leaving the house?', hint: 'Planner check' },
  { id: 'def-7', prompt: 'Have you ever waved back at someone who was waving at the person behind you?', hint: 'Classic moment' },
  { id: 'def-8', prompt: 'Would you take a mystery flight tomorrow morning if the ticket was completely free?', hint: 'Spontaneity test' },
  { id: 'def-9', prompt: 'Have you ever rehearsed a tiny argument in your head hours after it happened?', hint: 'Shower thoughts' },
  { id: 'def-10', prompt: 'Do you set more than four morning alarms just to feel safe?', hint: 'Morning routine' },
  { id: 'def-11', prompt: 'Have you ever said "on my way" before even putting your shoes on?', hint: 'Timing check' },
  { id: 'def-12', prompt: 'Could you keep a surprise party secret from your best friend for a whole month?', hint: 'Secret keeper test' },
  { id: 'def-13', prompt: 'Have you ever bought something purely because the packaging looked cool?', hint: 'Impulse reveal' },
  { id: 'def-14', prompt: 'Do you talk to pets as if they understand full multi-step instructions?', hint: 'Pet logic' },
  { id: 'def-15', prompt: 'Have you ever googled yourself just to see what pops up first?', hint: 'Curiosity check' },
  { id: 'def-16', prompt: 'Would you rather give up coffee/tea for a year or give up dessert for a year?', hint: 'Tough trade-off' },
  { id: 'def-17', prompt: 'Have you ever laughed at a joke you definitely did not hear properly?', hint: 'Polite nod moment' },
  { id: 'def-18', prompt: 'Do you leave dishes to "soak" overnight when you simply do not want to wash them?', hint: 'Kitchen truth' },
  { id: 'def-19', prompt: 'Have you ever checked your reflection in a dark car window while walking past?', hint: 'Mirror check' },
  { id: 'def-20', prompt: 'If your group chat leaked right now, would you be totally relaxed or mildly panicked?', hint: 'Final gut reaction' },
];

/**
 * Selects the next curated 5-question deck for a category while avoiding
 * immediate repetition across consecutive rounds and rotating through all decks
 * in that category before repeating any earlier deck.
 */
export function pickNextOfflineDeck(
  categoryInput: string,
  recentDeckIds: string[] = []
): { deck: OfflineDeck; totalDecksInCategory: number; updatedRecentIds: string[] } {
  const category: SoloCategory = (SOLO_CATEGORIES as readonly string[]).includes(categoryInput)
    ? (categoryInput as SoloCategory)
    : 'Wildcard Mix';

  const decks = OFFLINE_DECKS[category];
  const categoryDeckIds = new Set(decks.map((d) => d.id));
  const recentForCategory = recentDeckIds.filter((id) => categoryDeckIds.has(id));
  const lastDeckId = recentForCategory[recentForCategory.length - 1];

  // First prefer decks not played in the current full rotation cycle
  const unplayedInCycle = decks.filter((d) => !recentForCategory.includes(d.id));
  let chosen: OfflineDeck;
  let nextCategoryHistory: string[];

  if (unplayedInCycle.length > 0) {
    chosen = unplayedInCycle[0];
    nextCategoryHistory = [...recentForCategory, chosen.id];
  } else {
    // Full cycle completed: reset cycle while strictly avoiding repeating the immediately preceding deck
    const nonImmediate = decks.filter((d) => d.id !== lastDeckId);
    chosen = nonImmediate[0] ?? decks[0];
    nextCategoryHistory = [chosen.id];
  }

  const otherCategories = recentDeckIds.filter((id) => !categoryDeckIds.has(id));
  const updatedRecentIds = [...otherCategories, ...nextCategoryHistory];

  return {
    deck: chosen,
    totalDecksInCategory: decks.length,
    updatedRecentIds,
  };
}

export const DEMO_ILLUSTRATIVE_RESULT: AnalysisResult = {
  mode: 'challenge',
  isDemo: true,
  evidenceStatus: 'sufficient',
  theme: 'Wildcard Mix',
  // 60% * 78 + 25% * 86 + 15% * 72 = 46.8 + 21.5 + 10.8 = 79.1 -> 79
  consistencyScore: 79,
  scoreLabel: 'Demo — Illustrative Storyline',
  indicators: [
    {
      title: 'Clarity & Directness',
      score: 86,
      summary:
        'Illustrative example: direct phrasing with clear everyday examples across five prompts.',
    },
    {
      title: 'Certainty vs. Hedging',
      score: 72,
      summary:
        'Illustrative example: mostly steady tone with a few playful qualifiers like "maybe" and "kind of". Hedging reflects phrasing tone only—never dishonesty.',
    },
    {
      title: 'Cross-Answer Alignment',
      score: 78,
      summary:
        'Illustrative example: answers stay aligned around valuing quiet mornings with one explicit exception for surprise weekend plans.',
    },
  ],
  scoreBreakdown: {
    weights: { consistency: 0.6, clarity: 0.25, directness: 0.15 },
    raw: { consistency: 78, clarity: 86, directness: 72, hedgingLevel: 28 },
    weighted: { consistency: 46.8, clarity: 21.5, directness: 10.8 },
    formulaText: '60% × 78 + 25% × 86 + 15% × 72 = 79.1 → 79/100',
    exactWeightedSum: 79.1,
    overallScore: 79,
  },
  plainLanguageSummary:
    'This is a static illustrative example showing how a live Gemini consistency report is structured—not your personal score. In live mode, TruthCheck AI evaluates narrative alignment and clarity using the documented weighted formula below.',
  observations: [
    'Demo tip 1: General habits paired with clear exceptions ("except when friends visit") remain logically coherent.',
    'Demo tip 2: Cautious phrasing ("maybe", "kind of") simply shows flexible language, not deception.',
    'Demo tip 3: Submit your own text or 5 answers to replace this static example with a live analysis.',
  ],
  highlights: [
    {
      classification: 'explicit_exception',
      quotes: [
        'I keep weekday mornings completely screen-free',
        'unless a close friend sends an urgent travel update',
      ],
      excerpt: 'Sample Q1 & Q3 — General rule with explicit carve-out',
      note: 'Illustrative example of an explicit exception: naming a specific condition ("unless...") keeps the preference coherent rather than contradictory.',
    },
  ],
};
