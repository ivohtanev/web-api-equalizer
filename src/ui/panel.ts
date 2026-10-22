import { EQ_FREQUENCIES, type EqualizerPort } from "../core/equalizer";
import { EQ_APPROACHES, parseApproach } from "../core/equalizer-approaches";
import { EQ_PRESETS } from "../core/equalizer-presets";
function iconButton(label: string, path: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  return button;
}
export function mountPanel(container: HTMLElement, audio: EqualizerPort) {
  const panel = document.createElement("div");
  panel.className = "eq-panel";
  const heading = document.createElement("div");
  heading.className = "panel-heading";
  const title = document.createElement("strong");
  title.textContent = "Web API Equalizer";
  const toggle = document.createElement("button");
  toggle.className = "eq-switch";
  toggle.type = "button";
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-label", "Enable equalizer");
  const thumb = document.createElement("span");
  thumb.className = "eq-switch-thumb";
  toggle.append(thumb);
  toggle.onclick = () => {
    void audio.setEnabled(!audio.snapshot().requestedEnabled);
  };
  const switchControl = document.createElement("div");
  switchControl.className = "eq-switch-control";
  const offLabel = document.createElement("span");
  offLabel.textContent = "OFF";
  const onLabel = document.createElement("span");
  onLabel.textContent = "ON";
  switchControl.append(offLabel, toggle, onLabel);
  const reset = iconButton(
    "Restore preset defaults",
    '<path d="M3 10a9 9 0 1 1 2.7 8.4M3 4v6h6"/>',
  );
  reset.classList.add("eq-restore");
  reset.onclick = () => audio.reset();
  heading.append(title, switchControl);
  const presetRow = document.createElement("div");
  presetRow.className = "eq-preset-row";
  const presets = document.createElement("div");
  presets.className = "eq-presets";
  presets.setAttribute("role", "group");
  presets.setAttribute("aria-label", "EQ presets");
  const presetButtons = EQ_PRESETS.map((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = preset.label;
    button.onclick = () => audio.setPreset(preset.id);
    presets.append(button);
    return button;
  });
  presetRow.append(presets, reset);
  const presetHint = document.createElement("p");
  presetHint.className = "eq-preset-hint";
  presetHint.textContent = "Make it yours · edits save automatically";
  const approachLabel = document.createElement("label");
  approachLabel.className = "eq-approach";
  const approachCaption = document.createElement("span");
  approachCaption.textContent = "EQ approach";
  const approachSelect = document.createElement("select");
  approachSelect.setAttribute("aria-label", "EQ approach");
  for (const approach of EQ_APPROACHES) {
    const option = document.createElement("option");
    option.value = approach.id;
    option.textContent = approach.label;
    approachSelect.append(option);
  }
  approachSelect.onchange = () =>
    audio.setApproach(parseApproach(approachSelect.value));
  approachLabel.append(approachCaption, approachSelect);
  const level = document.createElement("p");
  level.className = "eq-note";
  const bands = document.createElement("div");
  bands.className = "eq-bands";
  const controls = EQ_FREQUENCIES.map((frequency, index) => {
    const label = document.createElement("label");
    label.className = "eq-band";
    const output = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = "-12";
    input.max = "12";
    input.step = "0.1";
    input.title = "Scroll to adjust by 0.2 dB";
    input.setAttribute("aria-label", `${frequency} Hz gain`);
    input.setAttribute("aria-orientation", "vertical");
    input.oninput = () => audio.setGain(index, Number(input.value));
    input.addEventListener(
      "wheel",
      (event) => {
        if (event.ctrlKey || event.metaKey || event.deltaY === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const gain = audio.snapshot().gains[index] ?? 0;
        audio.setGain(
          index,
          Math.max(
            -12,
            Math.min(
              12,
              Math.round((gain - Math.sign(event.deltaY) * 0.2) * 10) / 10,
            ),
          ),
        );
      },
      { passive: false },
    );
    const caption = document.createElement("span");
    caption.textContent =
      frequency >= 1000
        ? `${frequency / 1000}k`
        : String(Math.round(frequency));
    label.append(output, input, caption);
    bands.append(label);
    return { input, output };
  });
  const footer = document.createElement("div");
  footer.className = "eq-footer";
  const precision = document.createElement("span");
  precision.textContent = "Scroll to fine-tune · 0.2 dB";
  const credit = document.createElement("span");
  credit.className = "eq-credit";
  credit.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/></svg>Made with AI';
  footer.append(precision, credit);
  const status = document.createElement("p");
  status.className = "eq-note";
  status.setAttribute("role", "status");
  panel.append(
    heading,
    presetRow,
    presetHint,
    bands,
    approachLabel,
    level,
    footer,
    status,
  );

  const scope = document.createElement("p");
  scope.className = "scope";
  scope.textContent = "Audio from this tab · enable separately in each tab";
  panel.insertBefore(scope, presetRow);
  container.replaceChildren(panel);
  const render = () => {
    const state = audio.snapshot();
    panel.dataset.enabled = String(state.enabled);
    toggle.setAttribute("aria-checked", String(state.requestedEnabled));
    toggle.setAttribute("aria-busy", String(state.pending));
    approachSelect.value = state.approach;
    level.textContent =
      state.approach === "response"
        ? `Overall compensation: ${state.preampDb.toFixed(1)} dB`
        : "If you experience audio problems, switch to Curve Headroom (Compensation).";
    status.textContent =
      state.error ||
      (state.enabled
        ? ""
        : state.requestedEnabled
          ? "Waiting for playback or audio activation..."
          : "EQ is OFF · your settings are saved");
    status.hidden = !status.textContent;
    const definition = EQ_PRESETS.find((preset) => preset.id === state.preset)!;
    const customized = state.gains.some(
      (gain, i) => gain !== (definition.gains?.[i] ?? 0),
    );
    reset.disabled = !customized;
    reset.title = `Restore ${definition.label} defaults`;
    reset.setAttribute("aria-label", reset.title);
    presetButtons.forEach((button, index) => {
      const selected = EQ_PRESETS[index]!.id === state.preset;
      button.dataset.customized = String(selected && customized);
      button.title =
        selected && customized
          ? `${EQ_PRESETS[index]!.label} · customized`
          : EQ_PRESETS[index]!.label;
      button.setAttribute(
        "aria-pressed",
        String(EQ_PRESETS[index]!.id === state.preset),
      );
    });
    controls.forEach(({ input, output }, i) => {
      input.value = String(state.gains[i]);
      output.textContent = `${(state.gains[i] ?? 0) > 0 ? "+" : ""}${state.gains[i]}`;
      input.setAttribute("aria-valuetext", `${state.gains[i]} dB`);
    });
  };
  const unsubscribe = audio.subscribe(render);

  render();
  return () => {
    unsubscribe();
    panel.remove();
  };
}
