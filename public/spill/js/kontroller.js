// Styring: piltaster/WASD, håndkontroll, og på skjermen en «joystick» som dukker opp der man setter
// fingeren (eller musa). Med fingeren peker man i den retningen bilen skal kjøre, og bilen gir gass
// selv; slipper man, ruller den ut. Overført fra Controls.js i Starter Kit Racing (MIT).

export function lagKontroller(sone) {
  const taster = {};
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    taster[e.code] = true;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => { taster[e.code] = false; });
  addEventListener('blur', () => { for (const k of Object.keys(taster)) taster[k] = false; });

  // Joystick: en glassring med en knott, der fingeren treffer skjermen
  const ring = document.createElement('div');
  ring.className = 'styre-ring';
  ring.setAttribute('aria-hidden', 'true');
  const knott = document.createElement('div');
  knott.className = 'styre-knott';
  ring.append(knott);
  document.body.append(ring);

  const RADIUS = 44;
  let pekerId = null, startX = 0, startY = 0;
  const dra = { x: 0, y: 0, aktiv: false };

  sone.addEventListener('pointerdown', (e) => {
    if (pekerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    sone.setPointerCapture(e.pointerId);
    pekerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    Object.assign(dra, { x: 0, y: 0, aktiv: true });
    ring.style.left = `${startX}px`;
    ring.style.top = `${startY}px`;
    ring.classList.add('synlig');
    knott.style.transform = '';
  });
  sone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pekerId) return;
    let dx = (e.clientX - startX) / RADIUS, dy = (e.clientY - startY) / RADIUS;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    dra.x = dx;
    dra.y = dy;
    knott.style.transform = `translate(${dx * RADIUS}px, ${dy * RADIUS}px)`;
  });
  const slipp = (e) => {
    if (e.pointerId !== pekerId) return;
    pekerId = null;
    Object.assign(dra, { x: 0, y: 0, aktiv: false });
    ring.classList.remove('synlig');
  };
  sone.addEventListener('pointerup', slipp);
  sone.addEventListener('pointercancel', slipp);

  return {
    /**
     * Leser styringen. kam = kameraets bilde fra folgKamera() (frem og høyre): brukes til å gjøre retningen på skjermen om til
     * en retning i verden. Svarer { x, z } (tastatur) eller { retning } (finger), og om noe er trykket.
     */
    les(kam) {
      let x = 0, z = 0;
      if (taster.KeyA || taster.ArrowLeft) x -= 1;
      if (taster.KeyD || taster.ArrowRight) x += 1;
      if (taster.KeyW || taster.ArrowUp) z += 1;
      if (taster.KeyS || taster.ArrowDown || taster.Space) z -= 1;
      for (const gp of navigator.getGamepads?.() ?? []) {
        if (!gp) continue;
        if (Math.abs(gp.axes[0]) > 0.15) x = gp.axes[0];
        const gass = gp.buttons[7]?.value ?? 0, brems = gp.buttons[6]?.value ?? 0;
        if (gass > 0.1 || brems > 0.1) z = gass - brems;
        break;
      }
      const l = Math.hypot(dra.x, dra.y);
      if (dra.aktiv && l > 0.15) {
        // Opp på skjermen er «frem» for kameraet, høyre er kameraets høyre
        return {
          retning: {
            x: (kam.hoyre.x * dra.x - kam.frem.x * dra.y) / l,
            z: (kam.hoyre.z * dra.x - kam.frem.z * dra.y) / l,
          },
          aktiv: true,
        };
      }
      return { x, z, aktiv: x !== 0 || z !== 0 || dra.aktiv };
    },
    trykket: (kode) => !!taster[kode],
  };
}
