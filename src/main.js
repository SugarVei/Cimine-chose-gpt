import { createSeatMap, seats } from './seats.js'
import { createTheater } from './theater.js'

const el = id => document.getElementById(id)
const canvas = el('theater')
const preview = el('preview')
const checkout = el('checkout')
const mapRoot = el('map')
const rowName = i => 'ABCDEFGH'[i]
const mix = (a, b, t) => a + (b - a) * t
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const ease = t => t * t * (3 - 2 * t)
const phase = (time, start, end) => ease(clamp((time - start) / (end - start), 0, 1))
const currency = amount => '€' + amount.toFixed(2)
let theater, selection, layout, flight = 0, time = 0, direction = 0, yaw = 0, returnYaw = 0
let quantityAfterReturn = null, look = null, noticeTimer, requestedFrame = 0
let arrivalSeat, viewSeat, eyeFrame = 0
const seatMap = createSeatMap(mapRoot, commit)

function drawMini() {
  const selected = new Set(selection)
  const row = selection[0].row
  const lines = [-1, 0, 1].map(delta => {
    const line = document.createElement('div')
    line.className = 'mini-line' + (delta ? ' neighbor' : '')
    const name = rowName(row + delta)
    if (!name) return line
    const label = document.createElement('b')
    label.textContent = name
    line.append(label)
    for (const seat of seats.filter(s => s.row === row + delta)) {
      const cell = document.createElement('i')
      if (seat.taken) cell.className = 'sold'
      if (selected.has(seat)) {
        cell.className = 'chosen'
        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.num = seat.num
        button.title = 'View from ' + rowName(seat.row) + seat.num
        button.setAttribute('aria-label',button.title)
        button.setAttribute('aria-pressed',String(seat === viewSeat))
        button.textContent = seat.num
        button.addEventListener('click', () => switchEye(seat))
        cell.append(button)
      }
      line.append(cell)
    }
    line.append(label.cloneNode(true))
    return line
  })
  el('mini').replaceChildren(...lines)
}

function refreshControls() {
  const n = selection.length
  el('minus').disabled = !!direction || n <= 1
  el('plus').disabled = !!direction || n >= 6
  el('book').disabled = !!direction
  preview.disabled = !!direction
}

function numberRange() {
  const first = selection[0].num
  return selection.length === 1 ? String(first) : first + '–' + selection[selection.length - 1].num
}

function commit(group) {
  selection = [...group].sort((a,b) => a.num - b.num)
  arrivalSeat = selection.reduce((a,b) => Math.abs(a.x - 500) <= Math.abs(b.x - 500) ? a : b)
  viewSeat = arrivalSeat
  const n = selection.length
  el('summary').textContent = 'Row ' + rowName(selection[0].row) + ' · ' + (n === 1 ? 'Seat ' : 'Seats ') + numberRange()
  el('count').textContent = n + (n === 1 ? ' ticket' : ' tickets')
  el('price').textContent = n + ' × €12.00'
  el('book').textContent = (n === 1 ? 'Book seat' : 'Book seats') + ' · ' + currency(n * 12)
  drawMini()
  theater?.setSelection(selection)
  refreshControls()
}

function switchEye(seat) {
  if (time !== 4 || direction || seat === viewSeat) return
  cancelAnimationFrame(eyeFrame)
  viewSeat = seat
  theater.setViewSeat(seat,0,true)
  for (const button of el('mini').querySelectorAll('button')) {
    button.setAttribute('aria-pressed',String(Number(button.dataset.num) === seat.num))
  }
  const start = performance.now()
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 450
  function frame(now) {
    const t = clamp((now-start)/duration,0,1)
    theater.setViewSeat(seat,ease(t))
    theater.render(1,yaw)
    if (t < 1) eyeFrame = requestAnimationFrame(frame)
  }
  eyeFrame = requestAnimationFrame(frame)
}

function place(element, x, y, scale) {
  element.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ')'
}

function paint() {
  const { width, height, scale, ox, oy } = layout
  flight = phase(time, .8, 3.4)
  const miniAlpha = phase(time, 3.4, 4)
  const side = Math.min(24, width * .04)
  const hudScale = Math.min(1, (width - 2 * side) / 512, height / 590)
  const uiScale = mix(scale, hudScale, flight)
  place(el('show'), mix(ox + 244*scale, side, flight), mix(oy + 166*scale, side, flight), uiScale)
  place(el('tickets'), mix(ox + 568*scale, width - side - 188*hudScale, flight), mix(oy + 166*scale, side, flight), uiScale)
  place(checkout, (width - 512*uiScale) / 2, mix(oy + 709*scale, height - Math.min(28, height*.04) - 119*hudScale, flight), uiScale)
  canvas.style.opacity = phase(time, 0, .49)
  mapRoot.style.opacity = 1 - phase(time, .41, .80)
  el('shade').style.opacity = flight * .86
  el('mini').style.opacity = miniAlpha
  const seated = time >= 3.4
  preview.classList.toggle('inside', seated)
  el('mode-label').textContent = seated ? 'Seats' : 'Preview'
  if (theater && time > 0) theater.render(flight, yaw)
}

function resize() {
  const width = el('app').clientWidth
  const height = el('app').clientHeight
  const scale = Math.min((width - Math.min(36,width*.08)) / 512, height / 1000)
  layout = { width, height, scale, ox: (width - 1000*scale)/2, oy: (height - 1000*scale)/2 }
  place(el('stage'), layout.ox, layout.oy, scale)
  theater?.resize(width,height,layout)
  paint()
}

function showNotice(message) {
  clearTimeout(noticeTimer)
  el('notice').textContent = message
  noticeTimer = setTimeout(() => { el('notice').textContent = '' }, 4200)
}

function prepareTheater() {
  if (theater) return
  theater = createTheater(canvas,seats)
  theater.resize(layout.width, layout.height, layout)
  theater.setSelection(selection)
  theater.render(0,0)
}

function setCount(n) {
  if (!seatMap.setCount(n)) showNotice('No block of ' + n + ' seats is available together.')
}

function transition(nextDirection) {
  if (direction) return
  try { prepareTheater() }
  catch (error) {
    console.error(error)
    showNotice('Preview needs WebGL. Enable hardware acceleration or try a WebGL-capable browser.')
    return
  }
  direction = nextDirection
  cancelAnimationFrame(eyeFrame)
  if (nextDirection < 0) theater.setViewSeat(arrivalSeat,0,true)
  el('mini').inert = true
  returnYaw = yaw
  canvas.classList.remove('live','looking')
  look = null
  if (document.activeElement === canvas) preview.focus({preventScroll:true})
  canvas.tabIndex = -1
  canvas.setAttribute('aria-hidden','true')
  seatMap.setEnabled(false)
  mapRoot.inert = true
  refreshControls()
  const start = performance.now()
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  function frame(now) {
    const dt = (now - start) / (reduced ? 65 : 1000)
    time = clamp(nextDirection === 1 ? dt : 4 - dt, 0, 4)
    if (nextDirection < 0) {
      const settle = phase(time,3.4,4)
      yaw = returnYaw * settle
      theater.setViewSeat(arrivalSeat,1-settle)
    }
    paint()
    if ((nextDirection === 1 && time < 4) || (nextDirection < 0 && time > 0)) {
      requestAnimationFrame(frame)
      return
    }
    direction = 0
    const live = time === 4
    el('mini').inert = !live
    el('mini').classList.toggle('live',live)
    if (!live) {
      viewSeat = arrivalSeat
      drawMini()
    }
    canvas.classList.toggle('live', live)
    canvas.tabIndex = live ? 0 : -1
    canvas.setAttribute('aria-hidden', String(!live))
    seatMap.setEnabled(!live)
    mapRoot.inert = live
    if (!live && quantityAfterReturn !== null) {
      setCount(quantityAfterReturn)
      quantityAfterReturn = null
    }
    refreshControls()
  }
  requestAnimationFrame(frame)
}

function quantity(delta) {
  if (direction) return
  const next = selection.length + delta
  if (time === 4) {
    quantityAfterReturn = next
    transition(-1)
  } else setCount(next)
}
el('minus').addEventListener('click', () => quantity(-1))
el('plus').addEventListener('click', () => quantity(1))
preview.addEventListener('click', () => transition(time === 4 ? -1 : 1))
const receipt = el('receipt')
el('book').addEventListener('click', () => {
  el('book-row').textContent = rowName(selection[0].row)
  el('book-numbers').textContent = numberRange()
  el('book-total').textContent = currency(selection.length * 12)
  receipt.showModal()
})
receipt.addEventListener('click', event => {
  if (event.target !== receipt) return
  const bounds = receipt.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) receipt.close()
})

function turn(newYaw) {
  yaw = clamp(newYaw, -1.38, 1.38)
  if (!requestedFrame) requestedFrame = requestAnimationFrame(() => {
    requestedFrame = 0
    if (time === 4) theater.render(1,yaw)
  })
}
canvas.addEventListener('pointerdown', event => {
  if (time !== 4 || direction || look || event.button !== 0) return
  look = { x: event.clientX, yaw, id: event.pointerId }
  canvas.setPointerCapture(event.pointerId)
  canvas.classList.add('looking')
  canvas.focus({preventScroll:true})
})
canvas.addEventListener('pointermove', event => {
  if (look?.id === event.pointerId) turn(look.yaw + (event.clientX - look.x) * 2.7 / layout.width)
})
canvas.addEventListener('lostpointercapture', () => { look = null; canvas.classList.remove('looking') })
window.addEventListener('keydown', event => {
  if (time !== 4 || direction || receipt.open) return
  if (event.key === 'Escape') transition(-1)
  if (['ArrowLeft','ArrowRight'].includes(event.key)) {
    event.preventDefault()
    turn(yaw + (event.key === 'ArrowLeft' ? .09 : -.09))
  }
})
commit(seatMap.getSelection())
resize()
window.addEventListener('resize',resize)
canvas.setAttribute('aria-hidden','true')

// Compile the room after first paint so the alignment phase starts on time.
function warmPreview() {
  if (theater || document.hidden || mapRoot.classList.contains('sm-dragging')) return
  try { prepareTheater() } catch { /* Preview retries on demand and presents the WebGL status. */ }
}
if ('requestIdleCallback' in window) requestIdleCallback(warmPreview)
