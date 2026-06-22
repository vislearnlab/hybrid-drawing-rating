import 'jspsych/css/jspsych.css';
import './assets/styles.css';
import { initJsPsych, JsPsych } from 'jspsych';
import HtmlKeyboardResponsePlugin from '@jspsych/plugin-html-keyboard-response';
import HtmlButtonResponsePlugin from '@jspsych/plugin-html-button-response';
import SurveyHtmlFormPlugin from '@jspsych/plugin-survey-html-form';
import SurveyTextPlugin from '@jspsych/plugin-survey-text';
import PreloadPlugin from '@jspsych/plugin-preload';
import ExternalHtml from '@jspsych/plugin-external-html';
 import { nanoid } from 'nanoid'

// ═══════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════

const CATEGORIES = [
  'bike', 'bee', 'elephant', 'snail', 'mushroom', 'house', 'rabbit',
  'boat', 'sheep', 'fish', 'tiger', 'frog', 'train', 'cat'
];
const NUM_SELECTIONS = 4;
const PROD = true;

// ═══════════════════════════════════════════════════════════
//  PARTICIPANT IDENTITY
// ═══════════════════════════════════════════════════════════

// Use Prolific IDs if available (participant came from Prolific),
// otherwise generate a random ID (standalone access).
function getParticipantInfo() {
  const params = new URLSearchParams(window.location.search);
  const prolificID = params.get('PROLIFIC_PID');
  const studyID = params.get('STUDY_ID');
  const sessionID = params.get('SESSION_ID');
  const participantCode = params.get('code')
  let source = "direct"
  if (prolificID) {
    source = "prolific"
  } else if (participantCode) {
    source = "sona"
  }
  return {
    participantID: prolificID || nanoid(),
    source,
    prolificID,
    studyID,
    sessionID,
    participantCode,
  };
}

const participant = getParticipantInfo();

// ═══════════════════════════════════════════════════════════
//  STIMULUS TYPE & LOADING
// ═══════════════════════════════════════════════════════════

interface Stimulus {
  id: string;
  image: string;      // filename, e.g. "drawing_001.png"
  metadata?: Record<string, any>;
}

async function loadStimulusList(): Promise<Stimulus[]> {
  const res = await fetch('stimuli/index.json');
  return await res.json();
}

function stimulusUrl(filename: string): string {
  return `stimuli/${filename}`;
}

// ═══════════════════════════════════════════════════════════
//  DATA SAVING
// ═══════════════════════════════════════════════════════════

const sessionStart = new Date().toISOString(); // UTC

function participantMeta() {
  return {
    participantID: participant.participantID,
    source: participant.source,
    prolificID: participant.prolificID,
    sonaCode: participant.participantCode,
    studyID: participant.studyID,
    sessionID: participant.sessionID,
    sessionStart,
  };
}

async function saveTrial(trial: object) {
  try {
    await fetch('submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trial }),
    });
  } catch (err) {
    console.error('Failed to save trial:', err);
  }
}

// ═══════════════════════════════════════════════════════════
//  BUILD ONE DRAWING-RATING TRIAL
// ═══════════════════════════════════════════════════════════

function makeRatingTrial(
  jsPsych: JsPsych,
  stimulus: Stimulus,
  trialIndex: number,
  totalTrials: number,
) {
  const shuffled: string[] = jsPsych.randomization.shuffle([...CATEGORIES]);

  const checkboxHtml = shuffled
    .map(
      (cat) => `
      <label class="cat-label" id="lbl-${cat}">
        <input type="checkbox" class="cat-cb" data-cat="${cat}">
        <span class="cat-name">${cat}</span>
      </label>`,
    )
    .join('');

  const sliderHtml = CATEGORIES.map(
    (cat) => `
    <div class="slider-row" id="row-${cat}" style="display:none;">
      <span class="sr-label">${cat}</span>
      <input type="range" class="sr-slider" data-cat="${cat}"
             min="1" max="100" value="0" step="1">
      <span class="sr-value" id="val-${cat}">0</span>
    </div>`,
  ).join('');

  const hiddenInputs = `
    <input type="hidden" name="selected_categories" id="hidden-selected" value="">
    ${CATEGORIES.map((cat) => `<input type="hidden" name="conf_${cat}" id="hidden-${cat}" value="">`).join('\n')}
  `;

  const html = `
    <div class="cat-grid" id="cat-grid">
      ${checkboxHtml}
    </div>

    <p class="select-count" id="select-count">0 / ${NUM_SELECTIONS} selected</p>

    <div class="slider-area" id="slider-area">
      <p class="slider-heading" id="slider-heading" style="display:none;">
        Rate your confidence (0 = not at all, 100 = extremely confident):
      </p>
      ${sliderHtml}
    </div>

    <p class="val-hint" id="val-hint"></p>

    ${hiddenInputs}
  `;

  return {
    type: SurveyHtmlFormPlugin,
    preamble: `
      <div class="trial-counter">
        Drawing ${trialIndex + 1} of ${totalTrials}
      </div>
      <div class="drawing-container">
        <img src="${stimulusUrl(stimulus.image)}" alt="Drawing">
      </div>
      <p class="prompt-text">What do you see in this drawing?</p>
      <p class="prompt-sub">
        Select exactly <strong>${NUM_SELECTIONS}</strong> categories,
        then rate your confidence for each.
      </p>
    `,
    html,
    autofocus: '',
    button_label: 'Continue',
    data: {
      task: 'rating',
      stimulus_id: stimulus.id,
    },

    on_load: function () {
      const checkboxes = document.querySelectorAll<HTMLInputElement>('.cat-cb');
      const countDisplay = document.getElementById('select-count')!;
      const sliderHeading = document.getElementById('slider-heading')!;
      const valHint = document.getElementById('val-hint')!;
      const hiddenSelected = document.getElementById('hidden-selected') as HTMLInputElement;
      const submitBtn = document.getElementById(
        'jspsych-survey-html-form-next',
      ) as HTMLInputElement;

      // Track which sliders have been deliberately moved (touched)
      const selected = new Set<string>();
      const touched = new Set<string>();

      // Hide the real submit button; we drive submission manually
      submitBtn.style.display = 'none';

      // Our visible "Continue" button
      const continueBtn = document.createElement('button');
      continueBtn.type = 'button';
      continueBtn.id = 'continue-btn';
      continueBtn.className = 'jspsych-btn';
      continueBtn.textContent = 'Continue';
      submitBtn.insertAdjacentElement('afterend', continueBtn);

      function showError(msg: string) {
        valHint.textContent = msg;
        valHint.style.color = '#c0392b';
      }

      function clearError() {
        valHint.textContent = '';
      }

      function canAdvance(): boolean {
        if (selected.size !== NUM_SELECTIONS) return false;
        return [...selected].every((cat) => touched.has(cat));
      }

      function updateState() {
        // Count display
        countDisplay.textContent = `${selected.size} / ${NUM_SELECTIONS} selected`;
        countDisplay.classList.toggle('count-ready', selected.size === NUM_SELECTIONS);

        // Checkbox enable/disable
        checkboxes.forEach((cb) => {
          const cat = cb.dataset.cat!;
          const label = document.getElementById(`lbl-${cat}`)!;
          const atMax = !selected.has(cat) && selected.size >= NUM_SELECTIONS;
          label.classList.toggle('disabled', atMax);
          label.classList.toggle('checked', selected.has(cat));
          // Disable checkbox selection when four have been selected
          cb.disabled = atMax;
        });

        // Slider rows
        CATEGORIES.forEach((cat) => {
          const row = document.getElementById(`row-${cat}`)!;
          const isSelected = selected.has(cat);
          row.style.display = isSelected ? 'flex' : 'none';
          if (!isSelected) {
            // Reset if deselected
            const slider = row.querySelector<HTMLInputElement>('.sr-slider')!;
            slider.value = '1';
            document.getElementById(`val-${cat}`)!.textContent = '—';
            (document.getElementById(`hidden-${cat}`) as HTMLInputElement).value = '';
            touched.delete(cat);
          }
        });

        sliderHeading.style.display = selected.size > 0 ? 'block' : 'none';
        hiddenSelected.value = [...selected].join(',');

        // Hint text
        if (selected.size === NUM_SELECTIONS) {
          const untouched = [...selected].filter((c) => !touched.has(c));
          if (untouched.length > 0) {
            showError(`Please rate your confidence for: ${untouched.join(', ')}`);
          } else {
            clearError();
          }
        } else {
          clearError();
        }
      }

      // Checkbox listeners
      checkboxes.forEach((cb) => {
        cb.addEventListener('change', () => {
          const cat = cb.dataset.cat!;
          cb.checked ? selected.add(cat) : selected.delete(cat);
          updateState();
        });
      });

      // Slider listeners
      document.querySelectorAll<HTMLInputElement>('.sr-slider').forEach((slider) => {
        slider.addEventListener('input', () => {
          const cat = slider.dataset.cat!;
          const val = slider.value;
          document.getElementById(`val-${cat}`)!.textContent = val;
          (document.getElementById(`hidden-${cat}`) as HTMLInputElement).value = val;
          touched.add(cat);
          updateState();
        });
      });

      // Continue button triggers the hidden submit
      continueBtn.addEventListener('click', () => {
        if (!canAdvance()) {
          if (selected.size !== NUM_SELECTIONS) {
            showError(`Please select exactly ${NUM_SELECTIONS} categories.`);
          } else {
            const untouched = [...selected].filter((c) => !touched.has(c));
            showError(`Please rate your confidence for: ${untouched.join(', ')}`);
          }
          return;
        }
        submitBtn.click();
      });

      updateState();
    },

    on_finish: function (data: any) {
      const raw = data.response;
      const cats: string[] = raw.selected_categories
        ? raw.selected_categories.split(',')
        : [];
      const confidence: Record<string, number> = {};
      for (const cat of cats) {
        confidence[cat] = parseInt(raw[`conf_${cat}`] || '0', 10);
      }
      data.selected_categories = cats;
      data.confidence = confidence;

      saveTrial({
        ...participantMeta(),
        trialKey: `${participant.participantID}_${data.trial_index}`,
        trialType: 'rating',
        trialIndex: data.trial_index,
        stimulus_id: data.stimulus_id,
        selected_categories: cats,
        confidence,
        rt: data.rt,
        trialTimestamp: new Date().toISOString(),
      });
    },
  };
}

// ═══════════════════════════════════════════════════════════
//  ATTENTION CHECKS
// ═══════════════════════════════════════════════════════════

function attentionCheck1() {
  return {
    type: SurveyTextPlugin,
    preamble: `
      <div class="attn-card">
        <h2>Quick check-in</h2>
        <p>In your own words, briefly describe what task you are doing
           in this experiment.</p>
      </div>
    `,
    questions: [
      {
        prompt: '',
        placeholder: 'Type your answer here...',
        required: PROD,
        rows: 3,
        name: 'task_description',
      },
    ],
    button_label: 'Continue',
    data: {
      task: 'attention_check',
      check_type: 'describe_task',
    },
    on_finish: function (data: any) {
      saveTrial({
        ...participantMeta(),
        trialKey: `${participant.participantID}_attn_${data.trial_index}`,
        trialType: 'attention_check',
        checkType: 'describe_task',
        trialIndex: data.trial_index,
        response: data.response?.task_description,
        rt: data.rt,
        trialTimestamp: new Date().toISOString(),
      });
    },
  };
}

// Placeholder — replace with your real "ignore instructions" check
function attentionCheck2() {
  return {
    type: SurveyHtmlFormPlugin,
    preamble: `
      <div class="attn-card">
        <h2>Quick check-in</h2>
      </div>
    `,
    html: `
      <div class="attn-body">
        <p>
          Please read the following instructions carefully before
          answering.
        </p>
        <p>
          We would like you to select all the categories that you think
          appear most frequently in children's drawings. However, to
          show that you are reading this carefully, please
          <strong>ignore the above instructions</strong> and simply type
          the word <strong>purple</strong> in the box below.
        </p>
        <p>
          <input type="text" name="ignore_response"
                 placeholder="Type here..." required
                 style="width:100%;max-width:300px;padding:8px;
                        border:1.5px solid #ccc;border-radius:6px;
                        font-size:15px;">
        </p>
      </div>
    `,
    button_label: 'Continue',
    data: {
      task: 'attention_check',
      check_type: 'ignore_instructions',
      correct_answer: 'purple',
    },
    on_finish: function (data: any) {
      const resp = (data.response.ignore_response || '').trim().toLowerCase();
      data.passed = resp === 'purple';
      saveTrial({
        ...participantMeta(),
        trialKey: `${participant.participantID}_attn_${data.trial_index}`,
        trialType: 'attention_check',
        checkType: 'ignore_instructions',
        trialIndex: data.trial_index,
        response: data.response?.ignore_response,
        passed: data.passed,
        rt: data.rt,
        trialTimestamp: new Date().toISOString(),
      });
    },
  };
}

// Placeholder — replace with your real audio file and expected answer
function attentionCheck3() {
  const audioSrc = new URL('./assets/audio/attention_check.mp3', import.meta.url).href;

  return {
    type: SurveyHtmlFormPlugin,
    preamble: `
      <div class="attn-card">
        <h2>Quick check-in</h2>
      </div>
    `,
    html: `
      <div class="attn-body">
        <p>Please listen to the audio clip below and type what you hear.</p>
        <audio controls src="${audioSrc}"
               style="width:100%;max-width:400px;margin:16px 0;">
          Your browser does not support audio playback.
        </audio>
        <p>
          <input type="text" name="audio_response"
                 placeholder="Type what you heard..." required
                 style="width:100%;max-width:300px;padding:8px;
                        border:1.5px solid #ccc;border-radius:6px;
                        font-size:15px;">
        </p>
      </div>
    `,
    button_label: 'Continue',
    data: {
      task: 'attention_check',
      check_type: 'audio_transcription',
    },
    on_finish: function (data: any) {
      saveTrial({
        ...participantMeta(),
        trialKey: `${participant.participantID}_attn_${data.trial_index}`,
        trialType: 'attention_check',
        checkType: 'audio_transcription',
        trialIndex: data.trial_index,
        response: data.response?.audio_response,
        rt: data.rt,
        trialTimestamp: new Date().toISOString(),
      });
    },
  };
}

// ═══════════════════════════════════════════════════════════
//  INSTRUCTION & BOOKEND SCREENS
// ═══════════════════════════════════════════════════════════

function consentTrial() {
  const checkConsent = (_elem: any) => {
    const cb = document.getElementById('consent_checkbox') as HTMLInputElement;
    if (cb && cb.checked) return true;
    const err = document.getElementById('error') as HTMLElement;
    if (err) err.style.display = 'block';
    window.scrollTo(0, document.body.scrollHeight);
    return false;
  };
  return {
    type: ExternalHtml,
    url: new URL('./assets/consent.html', import.meta.url).href,
    cont_btn: 'start',
    execute_script: true,
    check_fn: checkConsent,
  };
}

function instructionScreens() {
  return [
    {
      type: HtmlKeyboardResponsePlugin,
      stimulus: `
        <div class="instr-card">
          <h1>Welcome</h1>
          <p>Thank you for participating in this study about
             how people perceive drawings.</p>
          <p>You will see a series of drawings. For each one:</p>
          <p><strong>1.</strong> Select <strong>${NUM_SELECTIONS}</strong>
             categories from a list of ${CATEGORIES.length} that you
             recognise in the drawing.</p>
          <p><strong>2.</strong> For each selected category, rate
             <strong>how confident</strong> you are that you can
             recognise it (0 = not at all, 100 = extremely confident).</p>
          <p>There are no right or wrong answers — we are interested
             in your honest perception.</p>
          <p class="key-hint">Press <strong>any key</strong> to continue</p>
        </div>
      `,
    },
    {
      type: HtmlKeyboardResponsePlugin,
      stimulus: `
        <div class="instr-card">
          <h1>A few things to note</h1>
          <p>The categories will appear in a random order each time.</p>
          <p>Your confidence ratings are independent — they do not
             need to add up to any particular total.</p>
          <p>Please take your time. There is no time limit.</p>
          <p>You will occasionally see brief check-in questions.
             Please answer them carefully.</p>
          <p>The experiment takes about <strong>60 minutes</strong>.</p>
          <p class="key-hint">Press <strong>any key</strong> to begin</p>
        </div>
      `,
    },
  ];
}

function finalScreen() {
  return {
    type: HtmlButtonResponsePlugin,
    stimulus: `
      <div class="instr-card">
        <h1>Thank you!</h1>
        <p>Your responses have been saved.</p>
        ${participant.source === 'prolific'
          ? '<p>Press the button below to return to Prolific.</p>'
          : '<p>You may now close this window.</p>'}
      </div>
    `,
    choices: ['Complete'],
  };
}

// ═══════════════════════════════════════════════════════════
//  ASSEMBLE TIMELINE
// ═══════════════════════════════════════════════════════════

function interleaveAttentionChecks(
  ratingTrials: any[],
  attentionChecks: any[],
): any[] {
  const totalRatings = ratingTrials.length;
  const numChecks = attentionChecks.length;
  const interval = Math.floor(totalRatings / (numChecks + 1));

  const combined: any[] = [];
  let checkIdx = 0;

  for (let i = 0; i < totalRatings; i++) {
    combined.push(ratingTrials[i]);
    if (checkIdx < numChecks && (i + 1) % interval === 0 && i + 1 < totalRatings) {
      combined.push(attentionChecks[checkIdx]);
      checkIdx++;
    }
  }
  while (checkIdx < numChecks) {
    combined.push(attentionChecks[checkIdx]);
    checkIdx++;
  }

  return combined;
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

async function run() {
  const jsPsych = initJsPsych({
    show_progress_bar: true,
    auto_update_progress_bar: true,
    on_finish: async () => {
      await saveTrial({
        ...participantMeta(),
        trialKey: `${participant.participantID}_session_end`,
        trialType: 'session_end',
        sessionEnd: new Date().toISOString(),
      });
      if (participant.source === 'prolific') {
        fetch('prolific', { method: 'GET' });
      }
    },
  });

  const stimuli = await loadStimulusList();
  const shuffledStimuli: Stimulus[] = jsPsych.randomization.shuffle(stimuli);

  const preloadTrial = {
    type: PreloadPlugin,
    images: shuffledStimuli.map((s) => stimulusUrl(s.image)),
    show_progress_bar: true,
    message: '<p>Loading drawings…</p>',
  };

  const ratingTrials = shuffledStimuli.map((stim, i) =>
    makeRatingTrial(jsPsych, stim, i, shuffledStimuli.length),
  );

  const attentionChecks: any[] = jsPsych.randomization.shuffle([
    attentionCheck1(),
    attentionCheck2(),
    attentionCheck3(),
  ]);

  const mainBlock = interleaveAttentionChecks(ratingTrials, attentionChecks);

  const timeline: any[] = [
    ...(PROD ? [consentTrial()] : []),
    preloadTrial,
    ...instructionScreens(),
    ...mainBlock,
    finalScreen(),
  ];

  jsPsych.run(timeline);
}

run();