// chart: the audio-to-chart domain. DSP and onset/tempo analysis, deterministic
// chart generation, the beat/second timing map (createTiming), StepMania .sm/.ssc
// read and write, the groove radar, and the optional WebGPU stem isolation. Pure
// logic (the stem path feature-detects and no-ops off the browser), so it tests in
// Node.

export * from './dsp.js';
export * from './analysis.js';
export * from './charter.js';
export * from './simfile.js';
export * from './radar.js';
export * from './stems.js';
export * from './compose.js';
export * from './composeChart.js';
// pipeline's generate collides with charter's; expose it as generateFromAudio.
export { ENGINES, generate as generateFromAudio, generateChart } from './pipeline.js';
