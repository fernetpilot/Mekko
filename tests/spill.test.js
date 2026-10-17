import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lagBane, naermeste, punktVed, lagRundeteller, MAAL_S, GRENSE, MIDTSTRIPE_X } from '../public/spill/js/banedata.js';
import { nyBil, kjor, stoppMotVegg, autopilot, kmt, VMAKS } from '../public/spill/js/kjoring.js';
import { startKamera, folgKamera, spillKamera } from '../public/spill/js/kamera.js';

const bane = lagBane();

test('banen er lukket og starter rett fram (+z) til venstre for bilen', () => {
  const [forste] = bane.punkter;
  assert.ok(Math.abs(forste.x - MIDTSTRIPE_X) < 1e-9);
  assert.ok(Math.abs(forste.z) < 1e-9);
  assert.ok(forste.tz > 0.999);
  const siste = bane.punkter.at(-1);
  assert.ok(Math.hypot(siste.x - forste.x, siste.z - forste.z) < bane.steg * 1.5);
  assert.ok(bane.lengde > 800 && bane.lengde < 1500);
});

test('deler av banen som ikke henger sammen, ligger langt nok fra hverandre til autovernet', () => {
  const p = bane.punkter;
  for (let i = 0; i < p.length; i += 2) {
    for (let j = i + 1; j < p.length; j += 2) {
      const langs = Math.min(Math.abs(p[i].s - p[j].s), bane.lengde - Math.abs(p[i].s - p[j].s));
      if (langs < 80) continue;
      assert.ok(Math.hypot(p[i].x - p[j].x, p[i].z - p[j].z) > GRENSE * 2 + 5, `s=${p[i].s} og s=${p[j].s}`);
    }
  }
});

test('naermeste gir avvik fra midtlinjen, positivt til venstre', () => {
  const n = naermeste(bane, 0, 10);              // bilen i høyre felt
  assert.ok(Math.abs(n.avvik + MIDTSTRIPE_X) < 0.05);
  assert.ok(Math.abs(n.s - 10) < 0.5);
  const v = naermeste(bane, MIDTSTRIPE_X + 3, 10, n.i);
  assert.ok(Math.abs(v.avvik - 3) < 0.05);
});

test('punktVed følger banen', () => {
  const p = punktVed(bane, 20, -MIDTSTRIPE_X);
  assert.ok(Math.abs(p.x) < 0.3 && Math.abs(p.z - 20) < 0.5);
});

test('rundetelleren krever hele runden før den gir tid', () => {
  const r = lagRundeteller(bane.lengde);
  const L = bane.lengde;
  let t = 0;
  const kjorTil = (s) => { t += 1; return r.oppdater(((s % L) + L) % L, t); };
  kjorTil(MAAL_S - 5);
  assert.equal(kjorTil(MAAL_S + 1), 'start');
  // Rett tilbake over linjen (snarvei) teller ikke som runde
  kjorTil(MAAL_S - 3);
  assert.equal(kjorTil(MAAL_S + 2), 'start');
  // En hel runde, i små steg
  let svar = null;
  for (let s = MAAL_S + 10; s <= MAAL_S + L + 15; s += 10) svar = kjorTil(s) ?? svar;
  assert.equal(svar, 'rekord');
  assert.equal(r.runder, 1);
  assert.ok(r.beste > 0);
});

test('gass gir fart, og bilen holder seg under toppfarten', () => {
  const b = nyBil();
  for (let i = 0; i < 600; i++) kjor(b, { x: 0, z: 1 }, 1 / 60);
  assert.ok(kmt(b) > 90 && kmt(b) <= VMAKS * 3.6 + 0.01);
  assert.ok(b.z > 100 && Math.abs(b.x) < 1e-6);
});

test('styring til høyre svinger mot -x (bilens høyre side)', () => {
  const b = nyBil({ fart: 15 });
  for (let i = 0; i < 60; i++) kjor(b, { x: 1, z: 1 }, 1 / 60);
  assert.ok(b.retning < 0 && b.x < 0);
});

test('gresset bremser bilen', () => {
  const asfalt = nyBil({ fart: 28 }), gress = nyBil({ fart: 28 });
  for (let i = 0; i < 120; i++) {
    kjor(asfalt, { x: 0, z: 1 }, 1 / 60);
    kjor(gress, { x: 0, z: 1 }, 1 / 60, { gress: true });
  }
  assert.ok(kmt(gress) < kmt(asfalt) * 0.7);
});

test('berøring: bilen svinger mot retningen fingeren peker og gir gass selv', () => {
  const b = nyBil({ fart: 10 });
  for (let i = 0; i < 120; i++) kjor(b, { retning: { x: 1, z: 0 } }, 1 / 60);
  assert.ok(b.retning > 1);
  assert.ok(b.s > 10 / VMAKS);
});

test('autovernet stopper farten utover', () => {
  const b = nyBil({ retning: Math.PI / 2, fart: 20 });   // kjører mot +x
  stoppMotVegg(b, 1, 0, 0.5);
  assert.ok(b.vx <= 0);
  assert.ok(Math.abs(b.x + 0.5) < 1e-9);
});

test('autopiloten holder bilen i høyre felt i omtrent samme fart', () => {
  const b = nyBil({ fart: 60 / 3.6 });
  let spor = naermeste(bane, b.x, b.z).i;
  for (let i = 0; i < 60 * 40; i++) {
    const n = naermeste(bane, b.x, b.z, spor);
    spor = n.i;
    const p = punktVed(bane, n.s + 12, -MIDTSTRIPE_X);
    kjor(b, autopilot(b, p.x, p.z, 60 / 3.6), 1 / 60);
    assert.ok(Math.abs(n.avvik) < GRENSE - 1, `kom av veien ved s=${n.s}`);
  }
  assert.ok(Math.abs(kmt(b) - 60) < 6);
});

test('spillkameraet starter der følgekameraet blir stående i jevn fart', () => {
  for (const aspekt of [0.46, 1.6]) {
    const k = spillKamera(aspekt);
    const start = startKamera(aspekt, 0, 0, 0, 16);
    const ledd = { x: 0, z: 0 };
    let mal;
    for (let i = 0; i < 600; i++) mal = folgKamera(ledd, k, 0, 0, 0, 16, 1 / 60);
    assert.ok(Math.hypot(mal.x - start.mal.x, mal.z - start.mal.z) < 0.01);
  }
});
