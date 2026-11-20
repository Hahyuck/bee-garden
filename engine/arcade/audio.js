// Original procedural sound: no recordings, music downloads, or licensed samples.
export function createAudio() {
  let ctx, master, motor, bass, motorGain, bassGain, noise, tyreGain, filter;
  let enabled = false;
  function init() {
    if (ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 700; filter.Q.value = .5; filter.connect(master);
    motor = ctx.createOscillator(); motor.type = 'sawtooth'; motorGain = ctx.createGain(); motorGain.gain.value = .055; motor.connect(motorGain); motorGain.connect(filter); motor.start();
    bass = ctx.createOscillator(); bass.type = 'triangle'; bassGain = ctx.createGain(); bassGain.gain.value = .10; bass.connect(bassGain); bassGain.connect(master); bass.start();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0); let previous = 0;
    for (let i = 0; i < data.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .3) / 1.3; data[i] = previous * 3; }
    noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    const tyreFilter = ctx.createBiquadFilter(); tyreFilter.type = 'bandpass'; tyreFilter.frequency.value = 1500; tyreFilter.Q.value = .6;
    tyreGain = ctx.createGain(); tyreGain.gain.value = 0; noise.connect(tyreFilter); tyreFilter.connect(tyreGain); tyreGain.connect(master); noise.start();
  }
  async function setEnabled(value) {
    enabled = value;
    if (enabled) { try { init(); await ctx?.resume(); } catch { enabled = false; } }
    master?.gain.setTargetAtTime(enabled ? .55 : 0, ctx.currentTime, .08);
    return enabled;
  }
  function update(race) {
    if (!ctx || !enabled) return;
    const active = race.phase === 'racing' || race.phase === 'countdown';
    const rpm = Number.isFinite(race.player.rpm) ? race.player.rpm : 1000;
    const r = rpm > 1 ? rpm / 8000 : rpm;
    motor.frequency.setTargetAtTime(42 + r * 180, ctx.currentTime, .06);
    bass.frequency.setTargetAtTime(26 + r * 95, ctx.currentTime, .06);
    motorGain.gain.setTargetAtTime(active ? .048 : 0, ctx.currentTime, .08);
    bassGain.gain.setTargetAtTime(active ? .065 : 0, ctx.currentTime, .08);
    filter.frequency.setTargetAtTime(350 + r * 1300, ctx.currentTime, .09);
    tyreGain.gain.setTargetAtTime(active && race.player.drifting ? .14 : 0, ctx.currentTime, .07);
  }
  function tone(frequency, duration = .12, delay = 0, gain = .14) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + delay, osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = 'square'; osc.frequency.value = frequency;
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(gain, t + .009); amp.gain.exponentialRampToValueAtTime(.0001, t + duration);
    osc.connect(amp); amp.connect(master); osc.start(t); osc.stop(t + duration + .02);
  }
  function event(type) {
    if (type === 'countdown') tone(540, .10);
    if (type === 'go') { tone(880, .24); tone(1320, .18, .08); }
    if (type === 'checkpoint' || type === 'lap') { tone(660, .12); tone(880, .16, .10); tone(1320, .2, .20); }
    if (type === 'finish') [660, 880, 1100, 1320].forEach((f, i) => tone(f, .22, i * .14));
    if (type === 'timeout') { tone(220, .3); tone(165, .5, .22); }
    if (type === 'collision' || type === 'barrier') tone(70, .09, 0, .19);
  }
  function dispose() { ctx?.close(); }
  return { setEnabled, update, event, dispose, get enabled() { return enabled; } };
}
