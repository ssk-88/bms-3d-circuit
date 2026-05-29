import * as THREE from 'three';

// ── Shared Materials ────────────────────────────────────────────────────────
const MAT = {
  pcbGreen:        new THREE.MeshStandardMaterial({ color: 0x1a5c2a, roughness: 0.8 }),
  pcbGreenBottom:  new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 0.8 }),
  pcbCopper:       new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.9, roughness: 0.3 }),
  icBody:          new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }),
  pin:             new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.95, roughness: 0.2 }),
  goldPin:         new THREE.MeshStandardMaterial({ color: 0xdaa520, metalness: 0.95, roughness: 0.2 }),
  resistorBody:    new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.7 }),
  ceramicCap:      new THREE.MeshStandardMaterial({ color: 0xcc6600, roughness: 0.5 }),
  electrolyticBody:new THREE.MeshStandardMaterial({ color: 0x1a1a3a, roughness: 0.4 }),
  crystalBody:     new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.9, roughness: 0.15 }),
  fuseGlass:       new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.1 }),
  fuseCap:         new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.2 }),
  to220Body:       new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 }),
  to220Tab:        new THREE.MeshStandardMaterial({ color: 0xaabbcc, metalness: 0.85, roughness: 0.25 }),
  white:           new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
  shuntBody:       new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.6 }),
  wire:            new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 }),
};

// ── Helper: Canvas-based text sprite ────────────────────────────────────────
export function createLabel(text, size = 3) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 36px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size * (canvas.width / canvas.height), size, 1);
  return sprite;
}

// ── 1. PCB ──────────────────────────────────────────────────────────────────
export function createPCB(width = 100, height = 80) {
  const group = new THREE.Group();
  group.name = 'PCB';

  const thickness = 1.6; // standard FR4 thickness in mm

  // Main board – top face green
  const boardGeo = new THREE.BoxGeometry(width, thickness, height);
  const boardMaterials = [
    MAT.pcbGreen,       // +X
    MAT.pcbGreen,       // -X
    MAT.pcbGreen,       // +Y  (top)
    MAT.pcbGreenBottom, // -Y  (bottom)
    MAT.pcbGreen,       // +Z
    MAT.pcbGreen,       // -Z
  ];
  const board = new THREE.Mesh(boardGeo, boardMaterials);
  group.add(board);

  // Copper ground plane on bottom (thin layer)
  const copperGeo = new THREE.BoxGeometry(width - 4, 0.035, height - 4);
  const copper = new THREE.Mesh(copperGeo, MAT.pcbCopper);
  copper.position.y = -thickness / 2 - 0.018;
  group.add(copper);

  // Mounting holes at corners
  const holeRadius = 1.6;
  const holeGeo = new THREE.CylinderGeometry(holeRadius, holeRadius, thickness + 0.2, 16);
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.4 });
  const inset = 4;
  const corners = [
    [-(width / 2 - inset), 0, -(height / 2 - inset)],
    [ (width / 2 - inset), 0, -(height / 2 - inset)],
    [-(width / 2 - inset), 0,  (height / 2 - inset)],
    [ (width / 2 - inset), 0,  (height / 2 - inset)],
  ];
  corners.forEach(([x, y, z]) => {
    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.position.set(x, y, z);
    group.add(hole);
  });

  // Silkscreen text placeholder (simple white rectangle)
  const silkGeo = new THREE.PlaneGeometry(18, 4);
  const silk = new THREE.Mesh(silkGeo, MAT.white);
  silk.rotation.x = -Math.PI / 2;
  silk.position.set(0, thickness / 2 + 0.02, height / 2 - 8);
  group.add(silk);

  // Floating label
  const lbl = createLabel('BMS v1.0', 5);
  lbl.position.set(0, thickness / 2 + 3, height / 2 - 8);
  group.add(lbl);

  group.userData = { type: 'PCB', label: 'BMS v1.0', ref: 'PCB1' };
  return group;
}

// ── 2. DIP IC ───────────────────────────────────────────────────────────────
export function createDIP(pins = 28, label = 'IC') {
  const group = new THREE.Group();
  group.name = label;

  const pinsPerSide = pins / 2;
  const pinPitch = 2.54;                        // mm
  const bodyLength = pinsPerSide * pinPitch;     // along X
  const bodyWidth = pins <= 8 ? 6.4 : 7.6;      // mm (narrow / wide)
  const bodyHeight = 3.2;

  // Body
  const bodyGeo = new THREE.BoxGeometry(bodyLength, bodyHeight, bodyWidth);
  const body = new THREE.Mesh(bodyGeo, MAT.icBody);
  body.position.y = bodyHeight / 2 + 0.8;       // lift above PCB surface
  group.add(body);

  // Notch circle (pin-1 indicator)
  const notchGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.15, 16);
  const notch = new THREE.Mesh(notchGeo, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 }));
  notch.rotation.x = Math.PI / 2;
  notch.position.set(-bodyLength / 2 + 2, bodyHeight / 2 + 0.8 + bodyHeight / 2 + 0.08, 0);
  group.add(notch);

  // Pins – thin rectangles that bend down
  const pinW = 0.5, pinH = 0.2, pinSegV = 2.5, pinSegH = 1.2;
  const pinGeoV = new THREE.BoxGeometry(pinW, pinSegV, pinH);
  const pinGeoH = new THREE.BoxGeometry(pinW, pinH, pinSegH);

  for (let i = 0; i < pinsPerSide; i++) {
    const x = -bodyLength / 2 + pinPitch * (i + 0.5);

    // Bottom-left side (−Z)
    const pv1 = new THREE.Mesh(pinGeoV, MAT.pin);
    pv1.position.set(x, pinSegV / 2 - 0.5, -bodyWidth / 2 - pinSegH);
    group.add(pv1);
    const ph1 = new THREE.Mesh(pinGeoH, MAT.pin);
    ph1.position.set(x, -0.5, -bodyWidth / 2 - pinSegH / 2);
    group.add(ph1);

    // Bottom-right side (+Z)
    const pv2 = new THREE.Mesh(pinGeoV, MAT.pin);
    pv2.position.set(x, pinSegV / 2 - 0.5, bodyWidth / 2 + pinSegH);
    group.add(pv2);
    const ph2 = new THREE.Mesh(pinGeoH, MAT.pin);
    ph2.position.set(x, -0.5, bodyWidth / 2 + pinSegH / 2);
    group.add(ph2);
  }

  // Label on top
  const lbl = createLabel(label, 3);
  lbl.position.set(0, bodyHeight + 2.5, 0);
  group.add(lbl);

  group.userData = { type: 'DIP', label, ref: label };
  return group;
}

// ── 3. TO-220 Package ───────────────────────────────────────────────────────
export function createTO220(label = 'TO220') {
  const group = new THREE.Group();
  group.name = label;

  const bw = 10, bh = 9, bd = 4.5;

  // Plastic body
  const bodyGeo = new THREE.BoxGeometry(bw, bh, bd);
  const body = new THREE.Mesh(bodyGeo, MAT.to220Body);
  body.position.y = bh / 2 + 0.8;
  group.add(body);

  // Metal tab (on back, extends upward)
  const tabGeo = new THREE.BoxGeometry(bw, 4, 0.5);
  const tab = new THREE.Mesh(tabGeo, MAT.to220Tab);
  tab.position.set(0, bh + 0.8 - 1, -bd / 2 + 0.25);
  group.add(tab);

  // Tab hole
  const holeGeo = new THREE.CylinderGeometry(1, 1, 0.6, 12);
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 });
  const hole = new THREE.Mesh(holeGeo, holeMat);
  hole.rotation.x = Math.PI / 2;
  hole.position.set(0, bh + 0.8, -bd / 2 + 0.25);
  group.add(hole);

  // 3 pins
  const pinGeo = new THREE.BoxGeometry(0.6, 3.5, 0.3);
  for (let i = -1; i <= 1; i++) {
    const p = new THREE.Mesh(pinGeo, MAT.pin);
    p.position.set(i * 2.54, -1.0, 0);
    group.add(p);
  }

  // Label
  const lbl = createLabel(label, 3);
  lbl.position.set(0, bh + 4, 0);
  group.add(lbl);

  group.userData = { type: 'TO220', label, ref: label };
  return group;
}

// ── 4. Axial Resistor ───────────────────────────────────────────────────────
export function createResistor(colorBands = [0xff0000, 0x000000, 0xff0000, 0xdaa520]) {
  const group = new THREE.Group();
  group.name = 'Resistor';

  const bodyLen = 5, bodyR = 1;

  // Body cylinder
  const bodyGeo = new THREE.CylinderGeometry(bodyR, bodyR, bodyLen, 16);
  const body = new THREE.Mesh(bodyGeo, MAT.resistorBody);
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.5;
  group.add(body);

  // Color bands
  const bandW = 0.5;
  const positions = [-1.6, -0.6, 0.4, 1.8];
  colorBands.forEach((c, i) => {
    if (i >= positions.length) return;
    const bandGeo = new THREE.CylinderGeometry(bodyR + 0.05, bodyR + 0.05, bandW, 16);
    const bandMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.rotation.z = Math.PI / 2;
    band.position.set(positions[i], 1.5, 0);
    group.add(band);
  });

  // Wire leads
  const wireGeo = new THREE.CylinderGeometry(0.15, 0.15, 3, 6);
  const wireL = new THREE.Mesh(wireGeo, MAT.wire);
  wireL.rotation.z = Math.PI / 2;
  wireL.position.set(-4, 1.5, 0);
  group.add(wireL);

  const wireR = new THREE.Mesh(wireGeo, MAT.wire);
  wireR.rotation.z = Math.PI / 2;
  wireR.position.set(4, 1.5, 0);
  group.add(wireR);

  group.userData = { type: 'Resistor', label: 'R', ref: 'R' };
  return group;
}

// ── 5. Ceramic Disc Capacitor ───────────────────────────────────────────────
export function createCapCeramic() {
  const group = new THREE.Group();
  group.name = 'CeramicCap';

  // Disc body
  const discGeo = new THREE.CylinderGeometry(2.5, 2.5, 1.2, 20);
  const disc = new THREE.Mesh(discGeo, MAT.ceramicCap);
  disc.position.y = 3;
  group.add(disc);

  // Two wire leads
  const wireGeo = new THREE.CylinderGeometry(0.12, 0.12, 3, 6);
  for (const xOff of [-1, 1]) {
    const w = new THREE.Mesh(wireGeo, MAT.wire);
    w.position.set(xOff * 0.8, 1.2, 0);
    group.add(w);
  }

  group.userData = { type: 'CeramicCap', label: 'C (ceramic)', ref: 'C' };
  return group;
}

// ── 6. Electrolytic Capacitor ───────────────────────────────────────────────
export function createCapElectrolytic(value = '10uF') {
  const group = new THREE.Group();
  group.name = `Cap_${value}`;

  const radius = 3, height = 8;

  // Main cylinder body
  const bodyGeo = new THREE.CylinderGeometry(radius, radius, height, 20);
  const body = new THREE.Mesh(bodyGeo, MAT.electrolyticBody);
  body.position.y = height / 2 + 0.8;
  group.add(body);

  // Silver top
  const topGeo = new THREE.CylinderGeometry(radius - 0.3, radius, 0.4, 20);
  const top = new THREE.Mesh(topGeo, MAT.pin);
  top.position.y = height + 0.8 + 0.2;
  group.add(top);

  // Polarity stripe
  const stripeGeo = new THREE.BoxGeometry(0.3, height - 1, 0.3);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.set(radius - 0.15, height / 2 + 0.8, 0);
  group.add(stripe);

  // Two pins
  const pinGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.5, 6);
  const p1 = new THREE.Mesh(pinGeo, MAT.wire);
  p1.position.set(-1, -0.5, 0);
  group.add(p1);
  const p2 = new THREE.Mesh(pinGeo, MAT.wire);
  p2.position.set(1, -0.5, 0);
  group.add(p2);

  // Label
  const lbl = createLabel(value, 2.5);
  lbl.position.set(0, height + 3, 0);
  group.add(lbl);

  group.userData = { type: 'ElectrolyticCap', label: value, ref: `C_${value}` };
  return group;
}

// ── 7. Crystal (HC49) ───────────────────────────────────────────────────────
export function createCrystal() {
  const group = new THREE.Group();
  group.name = 'Crystal';

  // Metal can body (rounded box approximation via cylinder + box)
  const bodyGeo = new THREE.BoxGeometry(5, 3.5, 11);
  const body = new THREE.Mesh(bodyGeo, MAT.crystalBody);
  body.position.y = 2.5;
  group.add(body);

  // Rounded ends
  const capGeo = new THREE.CylinderGeometry(1.75, 1.75, 5, 12);
  const cap1 = new THREE.Mesh(capGeo, MAT.crystalBody);
  cap1.rotation.x = Math.PI / 2;
  cap1.position.set(0, 2.5, -5.5);
  group.add(cap1);
  const cap2 = new THREE.Mesh(capGeo, MAT.crystalBody);
  cap2.rotation.x = Math.PI / 2;
  cap2.position.set(0, 2.5, 5.5);
  group.add(cap2);

  // Two pins
  const pinGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.5, 6);
  for (const zOff of [-2.5, 2.5]) {
    const p = new THREE.Mesh(pinGeo, MAT.wire);
    p.position.set(0, -0.5, zOff);
    group.add(p);
  }

  // Label
  const lbl = createLabel('16MHz', 2);
  lbl.position.set(0, 5.5, 0);
  group.add(lbl);

  group.userData = { type: 'Crystal', label: '16MHz', ref: 'Y1' };
  return group;
}

// ── 8. LED (5mm) ────────────────────────────────────────────────────────────
export function createLED(color = 0xff0000) {
  const group = new THREE.Group();
  group.name = 'LED';

  // Opaque base
  const baseMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const baseGeo = new THREE.CylinderGeometry(2.5, 2.5, 1.5, 16);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 2.5;
  group.add(base);

  // Translucent dome
  const domeMat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.6,
    roughness: 0.2,
    emissive: color,
    emissiveIntensity: 0.15,
  });
  const domeGeo = new THREE.SphereGeometry(2.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.position.y = 3.25;
  group.add(dome);

  // Two legs (different lengths → anode longer)
  const legGeo1 = new THREE.CylinderGeometry(0.15, 0.15, 4, 6);
  const leg1 = new THREE.Mesh(legGeo1, MAT.wire);
  leg1.position.set(-0.8, -0.3, 0);
  group.add(leg1);

  const legGeo2 = new THREE.CylinderGeometry(0.15, 0.15, 3, 6);
  const leg2 = new THREE.Mesh(legGeo2, MAT.wire);
  leg2.position.set(0.8, 0.2, 0);
  group.add(leg2);

  const colorName = '#' + new THREE.Color(color).getHexString();
  group.userData = { type: 'LED', label: `LED(${colorName})`, ref: 'LED' };
  return group;
}

// ── 9. Glass Tube Fuse ──────────────────────────────────────────────────────
export function createFuse() {
  const group = new THREE.Group();
  group.name = 'Fuse';

  const tubeLen = 10, tubeR = 2;

  // Glass tube
  const tubeGeo = new THREE.CylinderGeometry(tubeR, tubeR, tubeLen, 16, 1, true);
  const tube = new THREE.Mesh(tubeGeo, MAT.fuseGlass);
  tube.rotation.z = Math.PI / 2;
  tube.position.y = 3;
  group.add(tube);

  // End caps
  const capGeo = new THREE.CylinderGeometry(tubeR + 0.2, tubeR + 0.2, 1.5, 16);
  const capL = new THREE.Mesh(capGeo, MAT.fuseCap);
  capL.rotation.z = Math.PI / 2;
  capL.position.set(-tubeLen / 2 - 0.5, 3, 0);
  group.add(capL);
  const capR = new THREE.Mesh(capGeo, MAT.fuseCap);
  capR.rotation.z = Math.PI / 2;
  capR.position.set(tubeLen / 2 + 0.5, 3, 0);
  group.add(capR);

  // Internal wire
  const wireGeo = new THREE.CylinderGeometry(0.08, 0.08, tubeLen, 4);
  const wire = new THREE.Mesh(wireGeo, MAT.wire);
  wire.rotation.z = Math.PI / 2;
  wire.position.y = 3;
  group.add(wire);

  // Lead wires
  const leadGeo = new THREE.CylinderGeometry(0.2, 0.2, 3, 6);
  for (const xOff of [-tubeLen / 2 - 2.5, tubeLen / 2 + 2.5]) {
    const lead = new THREE.Mesh(leadGeo, MAT.wire);
    lead.rotation.z = Math.PI / 2;
    lead.position.set(xOff, 3, 0);
    group.add(lead);
  }

  group.userData = { type: 'Fuse', label: 'Fuse', ref: 'F1' };
  return group;
}

// ── 10. Diode ───────────────────────────────────────────────────────────────
export function createDiode() {
  const group = new THREE.Group();
  group.name = 'Diode';

  const bodyLen = 4, bodyR = 1.1;

  // Body
  const bodyGeo = new THREE.CylinderGeometry(bodyR, bodyR, bodyLen, 16);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.5;
  group.add(body);

  // Cathode band
  const bandGeo = new THREE.CylinderGeometry(bodyR + 0.06, bodyR + 0.06, 0.7, 16);
  const band = new THREE.Mesh(bandGeo, MAT.white);
  band.rotation.z = Math.PI / 2;
  band.position.set(bodyLen / 2 - 0.8, 1.5, 0);
  group.add(band);

  // Wire leads
  const wireGeo = new THREE.CylinderGeometry(0.15, 0.15, 3, 6);
  for (const xOff of [-1, 1]) {
    const w = new THREE.Mesh(wireGeo, MAT.wire);
    w.rotation.z = Math.PI / 2;
    w.position.set(xOff * (bodyLen / 2 + 1.5), 1.5, 0);
    group.add(w);
  }

  group.userData = { type: 'Diode', label: 'Diode', ref: 'D' };
  return group;
}

// ── 11. Thermistor ──────────────────────────────────────────────────────────
export function createThermistor() {
  const group = new THREE.Group();
  group.name = 'Thermistor';

  // Bead (sphere)
  const beadGeo = new THREE.SphereGeometry(1.5, 14, 10);
  const beadMat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.6 });
  const bead = new THREE.Mesh(beadGeo, beadMat);
  bead.position.y = 3;
  group.add(bead);

  // Wire leads
  const wireGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.5, 6);
  for (const xOff of [-0.6, 0.6]) {
    const w = new THREE.Mesh(wireGeo, MAT.wire);
    w.position.set(xOff, 0.8, 0);
    group.add(w);
  }

  group.userData = { type: 'Thermistor', label: 'NTC', ref: 'TH' };
  return group;
}

// ── 12. Pin Header Connector ────────────────────────────────────────────────
export function createConnector(pins = 2, rows = 1) {
  const group = new THREE.Group();
  group.name = `Connector_${pins}x${rows}`;

  const pitch = 2.54;
  const cols = Math.ceil(pins / rows);
  const housingW = cols * pitch;
  const housingD = rows * pitch;
  const housingH = 2.5;

  // Black plastic housing
  const housingGeo = new THREE.BoxGeometry(housingW, housingH, housingD);
  const housing = new THREE.Mesh(housingGeo, MAT.icBody);
  housing.position.y = housingH / 2 + 0.8;
  group.add(housing);

  // Gold pins
  const pinGeo = new THREE.BoxGeometry(0.5, housingH + 5, 0.5);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const p = new THREE.Mesh(pinGeo, MAT.goldPin);
      p.position.set(
        -housingW / 2 + pitch * (c + 0.5),
        (housingH + 5) / 2 - 2.5,
        -housingD / 2 + pitch * (r + 0.5)
      );
      group.add(p);
    }
  }

  group.userData = { type: 'Connector', label: `J_${pins}pin`, ref: 'J' };
  return group;
}

// ── 13. MOSFET (TO-220 wrapper) ─────────────────────────────────────────────
export function createMOSFET(label = 'MOSFET') {
  const group = createTO220(label);
  group.userData.type = 'MOSFET';
  return group;
}

// ── 14. Shunt Resistor (4-terminal power resistor) ──────────────────────────
export function createShuntResistor() {
  const group = new THREE.Group();
  group.name = 'ShuntResistor';

  const bw = 12, bh = 3, bd = 5;

  // White ceramic body
  const bodyGeo = new THREE.BoxGeometry(bw, bh, bd);
  const body = new THREE.Mesh(bodyGeo, MAT.shuntBody);
  body.position.y = bh / 2 + 0.8;
  group.add(body);

  // 4 terminals (2 per side)
  const termGeo = new THREE.BoxGeometry(0.8, 3, 0.4);
  const termPositions = [
    [-bw / 2 + 1.5, -0.3, -bd / 2 - 0.5],
    [-bw / 2 + 1.5, -0.3,  bd / 2 + 0.5],
    [ bw / 2 - 1.5, -0.3, -bd / 2 - 0.5],
    [ bw / 2 - 1.5, -0.3,  bd / 2 + 0.5],
  ];
  termPositions.forEach(([x, y, z]) => {
    const t = new THREE.Mesh(termGeo, MAT.pin);
    t.position.set(x, y, z);
    group.add(t);
  });

  // Label
  const lbl = createLabel('R_shunt', 2.5);
  lbl.position.set(0, bh + 3, 0);
  group.add(lbl);

  group.userData = { type: 'ShuntResistor', label: 'R_shunt', ref: 'R_shunt' };
  return group;
}
