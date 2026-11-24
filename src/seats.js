const rowNames = 'ABCDEFGH';
const rowHeights = [333, 371, 410, 451, 493, 536, 581, 628];
const occupied = [
  [1, 2, 11], [5, 6], [3, 4, 9, 10], [1, 7, 8, 9],
  [2, 3, 4, 11, 12], [1, 2, 10, 11, 12],
  [3, 4, 5, 6, 7, 8], [1, 2, 3, 9, 10, 11, 12]
];

export const seats = rowHeights.flatMap((y, row) => {
  const pitch = 32 + row * 0.5;
  return Array.from({ length: 12 }, (_, i) => ({
    row, num: i + 1, y,
    x: i < 6 ? 458 - (5 - i) * pitch : 542 + (i - 6) * pitch,
    taken: occupied[row].includes(i + 1)
  }));
});

function center(group) {
  return { x: (group[0].x + group[group.length - 1].x) / 2, y: group[0].y };
}

function validGroups(count) {
  const groups = [];
  for (let row = 0; row < 8; row++) {
    for (const side of [0, 6]) {
      for (let offset = 0; offset <= 6 - count; offset++) {
        const start = row * 12 + side + offset;
        const group = seats.slice(start, start + count);
        if (group.every(seat => !seat.taken)) groups.push(group);
      }
    }
  }
  return groups;
}

function nearest(groups, point) {
  let best = null;
  let distance = Infinity;
  for (const group of groups) {
    const p = center(group);
    const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
    if (d < distance) {
      distance = d;
      best = group;
    }
  }
  return best;
}

function groupLabel(group) {
  const first = group[0];
  const last = group[group.length - 1];
  return 'Row ' + rowNames[first.row] + ' · ' + first.num + (first === last ? '' : '–' + last.num);
}

function seatGlyph() {
  const face = document.createElement('span');
  face.className = 'sm-face';
  face.setAttribute('aria-hidden', 'true');
  return face;
}

export function createSeatMap(root, onCommit = () => {}) {
  root.classList.add('sm-map');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Choose seats');
  root.innerHTML = `
    <svg class="sm-screen" viewBox="0 0 434 48" aria-hidden="true">
      <defs>
        <linearGradient id="sm-screen-glow" x1="0" x2="0" y1="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0" stop-color="#e9ebed" stop-opacity=".09"/>
          <stop offset="1" stop-color="#e9ebed" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="sm-edge-fade">
          <stop stop-color="#fff" stop-opacity="0"/><stop offset=".16" stop-color="#fff"/>
          <stop offset=".84" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
        <mask id="sm-light-mask"><rect width="434" height="48" fill="url(#sm-edge-fade)"/></mask>
      </defs>
      <path d="M1 16 Q217 -12 433 16 L433 47 Q217 21 1 47 Z" fill="url(#sm-screen-glow)" mask="url(#sm-light-mask)"/>
      <path d="M1 16 Q217 -12 433 16" stroke="#666668" stroke-width="1" fill="none"/>
    </svg>
    <div class="sm-screen-label">SCREEN</div>
    <div class="sm-legend" aria-label="Seat availability">
      <span><i class="sm-key-free"></i>Free</span><span><i class="sm-key-taken"></i>Taken</span><span><i class="sm-key-yours"></i>Yours</span>
    </div>`;

  const buttons = new Map();
  let selected = seats.filter(s => s.row === 6 && (s.num === 9 || s.num === 10));
  let focusSeat = selected[0];
  let enabled = true;
  let drag = null;
  const frag = document.createDocumentFragment();
  rowHeights.forEach((y, i) => {
    for (const x of [249, 751]) {
      const label = document.createElement('span');
      label.className = 'sm-row';
      label.textContent = rowNames[i];
      label.setAttribute('aria-hidden', 'true');
      label.style.left = x + 'px';
      label.style.top = y + 'px';
      frag.append(label);
    }
  });

  function updateButtons() {
    for (const [seat, button] of buttons) {
      const yours = selected.includes(seat);
      button.classList.toggle('sm-taken', seat.taken);
      button.classList.toggle('sm-yours', yours && !drag);
      button.classList.toggle('sm-target', !!drag?.candidate.includes(seat));
      button.firstElementChild.textContent = yours && !drag ? seat.num : '';
      button.setAttribute('aria-pressed', String(yours));
      button.setAttribute('aria-disabled', String(seat.taken || !enabled));
      button.setAttribute('aria-label', 'Row ' + rowNames[seat.row] + ', seat ' + seat.num + (seat.taken ? ', taken' : yours ? ', selected' : ', available'));
      button.tabIndex = enabled && seat === focusSeat ? 0 : -1;
    }
  }
  function select(group) {
    const changed = group.length !== selected.length || group[0] !== selected[0];
    selected = group;
    focusSeat = group[0];
    updateButtons();
    if (changed) onCommit(selected.slice());
  }
  function localPoint(e) {
    const rect = root.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * 1000 / rect.width, y: (e.clientY - rect.top) * 1000 / rect.height };
  }
  function pointerDown(e, seat, button) {
    if (!enabled || drag || e.button !== 0 || !e.isPrimary || !selected.includes(seat)) return;
    e.preventDefault();
    const point = localPoint(e);
    const overlay = document.createElement('div');
    overlay.className = 'sm-lift';
    overlay.setAttribute('aria-hidden', 'true');
    for (const item of selected) {
      const ghost = seatGlyph();
      ghost.classList.add('sm-ghost');
      ghost.style.left = item.x + 'px';
      ghost.style.top = item.y + 'px';
      ghost.textContent = item.num;
      overlay.append(ghost);
    }
    const bubble = document.createElement('span');
    bubble.className = 'sm-bubble';
    bubble.style.left = point.x + 'px';
    bubble.style.top = point.y - 25 + 'px';
    bubble.textContent = groupLabel(selected);
    overlay.append(bubble);
    root.append(overlay);
    drag = {
      id: e.pointerId, button, start: point, origin: center(selected),
      dx: 0, dy: 0, groups: validGroups(selected.length), candidate: selected, overlay, bubble
    };
    root.classList.add('sm-dragging');
    button.setPointerCapture(e.pointerId);
    updateButtons();
  }
  function pointerMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const point = localPoint(e);
    drag.dx = point.x - drag.start.x;
    drag.dy = point.y - drag.start.y;
    drag.overlay.style.transform = 'translate(' + drag.dx + 'px,' + drag.dy + 'px)';
    const group = nearest(drag.groups, { x: drag.origin.x + drag.dx, y: drag.origin.y + drag.dy });
    if (group && group[0] !== drag.candidate[0]) {
      drag.candidate = group;
      drag.bubble.textContent = groupLabel(group);
      updateButtons();
    }
  }
  function endDrag(commit) {
    if (!drag) return;
    const state = drag;
    const previous = selected;
    const target = commit ? state.candidate : previous;
    drag = null;
    if (state.button.hasPointerCapture(state.id)) state.button.releasePointerCapture(state.id);
    root.classList.remove('sm-dragging');
    state.overlay.remove();
    select(target);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    target.forEach((s, i) => {
      const dx = previous[i].x + state.dx - s.x;
      const dy = previous[i].y + state.dy - s.y - 4;
      buttons.get(s).firstElementChild.animate([
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1.055)' },
        { transform: 'translate(0,1px) scale(.98)', offset: .78 },
        { transform: 'translate(0,0) scale(1)' }
      ], { duration: 228, easing: 'cubic-bezier(.2,.74,.28,1)' });
    });
  }
  function chooseAt(seat) {
    if (!enabled || drag || seat.taken || selected.includes(seat)) return;
    const groups = validGroups(selected.length).filter(group => group.includes(seat));
    if (!groups.length) return;
    select(groups.find(group => group[0] === seat) ?? groups[groups.length - 1]);
  }
  function navigate(e, seat) {
    if (!enabled || drag) return;
    const deltas = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 12, ArrowUp: -12 };
    if (!Object.hasOwn(deltas, e.key)) return;
    e.preventDefault();
    const index = seat.row * 12 + seat.num - 1;
    const next = seats[index + deltas[e.key]];
    if (!next || (Math.abs(deltas[e.key]) === 1 && next.row !== seat.row)) return;
    focusSeat = next;
    updateButtons();
    buttons.get(next).focus({ preventScroll: true });
  }
  for (const seat of seats) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sm-seat';
    button.dataset.seat = rowNames[seat.row] + seat.num;
    button.style.left = seat.x + 'px';
    button.style.top = seat.y + 'px';
    button.append(seatGlyph());
    button.addEventListener('pointerdown', e => pointerDown(e, seat, button));
    button.addEventListener('click', () => chooseAt(seat));
    button.addEventListener('keydown', e => navigate(e, seat));
    frag.append(button);
    buttons.set(seat, button);
  }
  root.append(frag);
  root.addEventListener('pointermove', pointerMove);
  root.addEventListener('pointerup', e => {
    if (e.pointerId === drag?.id) {
      pointerMove(e);
      // Capture redirects the ensuing click to the original seat after a drop.
      root.addEventListener('click', swallowDropClick, true);
      setTimeout(() => root.removeEventListener('click', swallowDropClick, true), 0);
      endDrag(true);
    }
  });
  function swallowDropClick(e) {
    e.stopImmediatePropagation();
    root.removeEventListener('click', swallowDropClick, true);
  }
  for (const type of ['pointercancel', 'lostpointercapture']) {
    root.addEventListener(type, e => { if (e.pointerId === drag?.id) endDrag(false); });
  }
  window.addEventListener('keydown', e => { if (drag && e.key === 'Escape') endDrag(false); });
  updateButtons();

  return {
    getSelection: () => selected.slice(),
    setCount(count) {
      if (!Number.isInteger(count) || count < 1 || count > 6) return false;
      endDrag(false);
      if (count === selected.length) return true;
      const group = nearest(validGroups(count), center(selected));
      if (!group) return false;
      select(group);
      return true;
    },
    setEnabled(value) {
      enabled = !!value;
      if (!enabled) endDrag(false);
      root.inert = !enabled;
      updateButtons();
    }
  };
}
