import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BMSSimulation } from './simulation.js';
import {
  createPCB,
  createDIP,
  createTO220,
  createResistor,
  createCapCeramic,
  createCapElectrolytic,
  createCrystal,
  createLED,
  createFuse,
  createDiode,
  createThermistor,
  createConnector,
  createMOSFET,
  createShuntResistor,
  createLabel
} from './components.js';

// ─── Section Colors ────────────────────────────────────────────────────────────
const SECTION_COLORS = {
  power:       0xe74c3c,
  voltage:     0x3498db,
  current:     0x2ecc71,
  temperature: 0xf39c12,
  mcu:         0x9b59b6,
  charging:    0xe67e22,
  io:          0x1abc9c
};

// ─── 1. Simulation Setup ───────────────────────────────────────────────────────
const sim = new BMSSimulation();

// Cache DOM Elements
const elPresetSelect = document.getElementById('preset-select');
const elModeSelect = document.getElementById('mode-select');

// Battery Pack Configuration Inputs
const elInputNs = document.getElementById('input-ns');
const elInputNp = document.getElementById('input-np');
const elInputCapacity = document.getElementById('input-capacity');
const elInputSoh = document.getElementById('input-soh');
const elInputCycles = document.getElementById('input-cycles');
const elInputRi = document.getElementById('input-ri');

// Cell Spec Thresholds Inputs
const elInputCellNomV = document.getElementById('input-cell-nom-v');
const elInputCellMaxV = document.getElementById('input-cell-max-v');
const elInputCellMinV = document.getElementById('input-cell-min-v');
const elInputCellChargeCurr = document.getElementById('input-cell-charge-curr');
const elInputCellFastChargeCurr = document.getElementById('input-cell-fast-charge-curr');
const elInputCellCvV = document.getElementById('input-cell-cv-v');
const elInputCoulombicEff = document.getElementById('input-coulombic-eff');

// Environmental & Power Sliders
const elInputPowerDraw = document.getElementById('input-power-draw');
const elValPowerDraw = document.getElementById('val-power-draw');
const elInputRegenPower = document.getElementById('input-regen-power');
const elValRegenPower = document.getElementById('val-regen-power');
const elInputAmbientTemp = document.getElementById('input-ambient-temp');
const elValAmbientTemp = document.getElementById('val-ambient-temp');
const elInputSimSpeed = document.getElementById('input-sim-speed');

const elBtnShortCircuit = document.getElementById('btn-short-circuit');
const elBtnResetFuse = document.getElementById('btn-reset-fuse');
const elBtnResetSoC = document.getElementById('btn-reset-soc');
const elBtnResetCam = document.getElementById('btn-reset-cam');

const elToggleLabels = document.getElementById('toggle-labels');
const elToggleTraces = document.getElementById('toggle-traces');
const elToggleXray = document.getElementById('toggle-xray');
const elToggleExplode = document.getElementById('toggle-explode');
const elToggleGlow = document.getElementById('toggle-glow');

const elSystemStateBadge = document.getElementById('system-state-badge');
const elLcdL1 = document.getElementById('lcd-l1');
const elLcdL2 = document.getElementById('lcd-l2');

// Telemetry & Pack Cards
const elSoCValue = document.getElementById('soc-value');
const elSoCMode = document.getElementById('soc-mode');
const elSoCBar = document.getElementById('soc-bar');

const elSohValue = document.getElementById('soh-value');
const elPackConfigText = document.getElementById('pack-config-text');
const elSohBar = document.getElementById('soh-bar');
const elValPackCap = document.getElementById('val-pack-cap');
const elValPackRes = document.getElementById('val-pack-res');

const elValAmbientTempTelemetry = document.getElementById('val-ambient-temp-telemetry');
const elValPackTempTelemetry = document.getElementById('val-pack-temp-telemetry');
const elValJouleHeat = document.getElementById('val-joule-heat');
const elValConvectionCooling = document.getElementById('val-convection-cooling');
const elValHeatRate = document.getElementById('val-heat-rate');

const elPowerValue = document.getElementById('power-value');
const elTempDisplayVal = document.getElementById('temp-display-val');
const elMosfetTemp = document.getElementById('mosfet-temp');
const elMosfetStatus = document.getElementById('mosfet-status');

// ADC Indicators
const elAdc0Raw = document.getElementById('adc0-raw');
const elAdc0Vin = document.getElementById('adc0-vin');
const elAdc0Calc = document.getElementById('adc0-calc');
const elAdc0Bar = document.getElementById('adc0-bar');

const elAdc1Raw = document.getElementById('adc1-raw');
const elAdc1Vout = document.getElementById('adc1-vout');
const elAdc1Calc = document.getElementById('adc1-calc');
const elAdc1Bar = document.getElementById('adc1-bar');

const elAdc2Raw = document.getElementById('adc2-raw');
const elAdc2Rntc = document.getElementById('adc2-rntc');
const elAdc2Calc = document.getElementById('adc2-calc');
const elAdc2Bar = document.getElementById('adc2-bar');

// Safety Flags & Labels
const elFlagOv = document.getElementById('flag-ov').querySelector('.flag-led');
const elLabelOv = document.getElementById('label-ov');
const elFlagUv = document.getElementById('flag-uv').querySelector('.flag-led');
const elLabelUv = document.getElementById('label-uv');
const elFlagOc = document.getElementById('flag-oc').querySelector('.flag-led');
const elLabelOc = document.getElementById('label-oc');
const elFlagOt = document.getElementById('flag-ot').querySelector('.flag-led');
const elLabelOt = document.getElementById('label-ot');
const elFlagFuse = document.getElementById('flag-fuse').querySelector('.flag-led');
const elFlagCharging = document.getElementById('flag-charging').querySelector('.flag-led');

// Inspector box
const elInspectorSection = document.getElementById('inspector-section');
const elCompName = document.getElementById('comp-name');
const elCompRef = document.getElementById('comp-ref');
const elCompDetails = document.getElementById('comp-details');
const elCompSpecs = document.getElementById('comp-specs');
const elCloseInspector = document.getElementById('close-inspector');

// Config options
let glowEnabled = true;

// ─── 2. Scene Setup ────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080a10);
scene.fog = new THREE.FogExp2(0x080a10, 0.005);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 80, 110);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('circuit-canvas'),
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 30;
controls.maxDistance = 250;
controls.maxPolarAngle = Math.PI / 2.05;

// ─── 3. Lighting ───────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x334466, 0.5);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
mainLight.position.set(40, 80, 60);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
mainLight.shadow.camera.near = 1;
mainLight.shadow.camera.far = 200;
mainLight.shadow.camera.left = -70;
mainLight.shadow.camera.right = 70;
mainLight.shadow.camera.top = 70;
mainLight.shadow.camera.bottom = -70;
mainLight.shadow.bias = -0.0005;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x8899bb, 0.4);
fillLight.position.set(-30, 40, -40);
scene.add(fillLight);

// Section point lights (reduced brightness slightly for realistic glow contrast)
const pointLights = [];
function addSectionLight(x, y, z, color, intensity) {
  const light = new THREE.PointLight(color, intensity, 60);
  light.position.set(x, y, z);
  scene.add(light);
  pointLights.push(light);
  return light;
}

addSectionLight(-35, 10, -30, SECTION_COLORS.power, 0.4);
addSectionLight(25, 10, -20, SECTION_COLORS.voltage, 0.35);
addSectionLight(35, 10, -5, SECTION_COLORS.current, 0.35);
addSectionLight(30, 10, 15, SECTION_COLORS.temperature, 0.35);
addSectionLight(0, 10, 0, SECTION_COLORS.mcu, 0.3);

// ─── 4. Ground Plane ──────────────────────────────────────────────────────────
const groundGeom = new THREE.PlaneGeometry(400, 400);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x04060b,
  roughness: 0.95,
  metalness: 0.1
});
const ground = new THREE.Mesh(groundGeom, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.0;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(400, 80, 0x111624, 0x090d18);
gridHelper.position.y = -0.95;
scene.add(gridHelper);

// ─── 5. PCB and Component Placement ───────────────────────────────────────────
const componentsGroup = new THREE.Group();
componentsGroup.name = 'componentsGroup';
scene.add(componentsGroup);

const labelsGroup = new THREE.Group();
labelsGroup.name = 'labelsGroup';
scene.add(labelsGroup);

const PCB_THICKNESS = 1.6;
const COMP_Y = PCB_THICKNESS; 

// Create PCB
const pcb = createPCB(100, 80);
pcb.name = 'PCB';
componentsGroup.add(pcb);

// Place components matching template positions
function placeComponent(mesh, x, z, meta, labelText) {
  mesh.position.set(x, COMP_Y + (mesh.userData.heightOffset || 0), z);
  mesh.userData = {
    ...mesh.userData,
    type: meta.type,
    label: meta.label,
    ref: meta.ref,
    section: meta.section,
    specs: meta.specs,
    package: meta.package || '',
    pins: meta.pins || ''
  };
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  mesh.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  componentsGroup.add(mesh);

  const lbl = createLabel(labelText || meta.ref, 2.0);
  lbl.position.set(x, COMP_Y + 10, z);
  labelsGroup.add(lbl);

  return mesh;
}

// Power Supply Section
placeComponent(
  createConnector(2), -45, -30,
  {
    type: 'Connector', label: 'Battery Connector', ref: 'J1',
    section: 'power', package: '2-pin screw terminal',
    specs: 'Input: 12V nominal (10–14.4V Li-ion pack), max 5A',
    pins: 'Pin1: V_BAT+, Pin2: GND'
  }
);
placeComponent(
  createFuse(), -35, -30,
  {
    type: 'Safety Fuse', label: 'Safety Fuse', ref: 'F1',
    section: 'power', package: 'Axial 5x20mm',
    specs: '10A fast-blow safety fuse protection',
    pins: 'Pin1: V_BAT_IN, Pin2: V_BAT_FUSED'
  }
);

placeComponent(
  createDiode(), -25, -30,
  {
    type: 'Protection Diode', label: 'Surge Protection Diode', ref: 'D1',
    section: 'power', package: 'Axial DO-201',
    specs: '1.5KE15CA, 15V standoff transient voltage suppressor',
    pins: 'Anode: GND, Cathode: V_BAT_FUSED'
  }
);

placeComponent(
  createTO220(), -15, -25,
  {
    type: 'Voltage Regulator', label: 'Voltage Regulator (7805)', ref: 'U1',
    section: 'power', package: 'TO-220-3',
    specs: 'LM7805CT, Vin 7-35V, Vout 5V ±4% linear regulator',
    pins: 'Pin1: VIN (V_BAT), Pin2: GND, Pin3: VOUT (5V rail)'
  }
);

placeComponent(
  createCapElectrolytic(), -15, -18,
  {
    type: 'Capacitor', label: 'Input Decoupling', ref: 'C1',
    section: 'power', package: 'Electrolytic radial 6.3mm',
    specs: '1µF 25V ceramic decoupling cap',
    pins: 'Pin1(+): VIN, Pin2(-): GND'
  }
);

placeComponent(
  createCapCeramic(), -10, -18,
  {
    type: 'Capacitor', label: 'Output Decoupling', ref: 'C2',
    section: 'power', package: 'Ceramic disc / MLCC',
    specs: '10µF 16V electrolytic output cap',
    pins: 'Pin1: 5V rail, Pin2: GND'
  }
);

placeComponent(
  createCapCeramic(), -5, -18,
  {
    type: 'Capacitor', label: 'Bypass Cap', ref: 'C3',
    section: 'power', package: 'Ceramic disc / MLCC',
    specs: '0.1µF 50V ceramic bypass cap',
    pins: 'Pin1: 5V rail, Pin2: GND'
  }
);

// MCU Section
placeComponent(
  createDIP(28), 0, 0,
  {
    type: 'ATmega32 Controller', label: 'ATmega32 Controller', ref: 'U3',
    section: 'mcu', package: 'DIP-28 (300 mil)',
    specs: 'ATmega328P-PU, 8MHz internal core, 32KB Flash, 2KB SRAM',
    pins: 'PC0: V_SENSE, PC1: I_SENSE, PC2: TEMP, PB4: PWM_GATE, PC4/PC5: I2C SDA/SCL'
  }
);placeComponent(
  createCrystal(), 15, 8,
  {
    type: 'Crystal', label: '12MHz Crystal', ref: 'X1',
    section: 'mcu', package: 'HC-49S',
    specs: '12.000MHz optional external crystal clock source',
    pins: 'Pin1: XTAL1 (PB6), Pin2: XTAL2 (PB7)'
  }
);

placeComponent(
  createCapCeramic(), 18, 10,
  {
    type: 'Capacitor', label: 'Crystal Cap', ref: 'C8',
    section: 'mcu', package: 'Ceramic disc',
    specs: '20pF 50V crystal load capacitor',
    pins: 'Pin1: XTAL1, Pin2: GND'
  }
);

placeComponent(
  createCapCeramic(), 18, 6,
  {
    type: 'Capacitor', label: 'Crystal Cap', ref: 'C9',
    section: 'mcu', package: 'Ceramic disc',
    specs: '20pF 50V crystal load capacitor',
    pins: 'Pin1: XTAL2, Pin2: GND'
  }
);

placeComponent(
  createResistor(), 15, -8,
  {
    type: 'Resistor', label: 'Reset Pullup', ref: 'R_reset',
    section: 'mcu', package: 'Axial 1/4W',
    specs: '10kΩ ±5% pull-up to +5V',
    pins: 'Pin1: 5V, Pin2: RESET (PC6)'
  }
);

placeComponent(
  createCapCeramic(), 18, -8,
  {
    type: 'Capacitor', label: 'Reset Filter', ref: 'C10',
    section: 'mcu', package: 'Ceramic disc',
    specs: '0.1µF 50V decoupling reset filter',
    pins: 'Pin1: RESET, Pin2: GND'
  }
);

// Voltage Sensing Section
placeComponent(
  createResistor(), 25, -22,
  {
    type: 'Resistor', label: 'V-Div Upper (R1)', ref: 'R1',
    section: 'voltage', package: 'Axial 1/4W',
    specs: '10kΩ ±1% metal film, upper divider resistor',
    pins: 'Pin1: V_BAT, Pin2: V_SENSE node'
  }
);

placeComponent(
  createResistor(), 25, -18,
  {
    type: 'Resistor', label: 'V-Div Lower (R2)', ref: 'R2',
    section: 'voltage', package: 'Axial 1/4W',
    specs: '1kΩ ±1% metal film, lower divider resistor',
    pins: 'Pin1: V_SENSE node, Pin2: GND'
  }
);

placeComponent(
  createCapCeramic(), 28, -20,
  {
    type: 'Capacitor', label: 'ADC0 Filter Cap', ref: 'C4',
    section: 'voltage', package: 'Ceramic disc',
    specs: '0.1µF 50V bypass capacitor across input',
    pins: 'Pin1: V_SENSE, Pin2: GND'
  }
);

// Current Sensing Section
placeComponent(
  createDIP(8), 25, -5,
  {
    type: 'Current Amplifier', label: 'Current Amplifier (Op-Amp)', ref: 'U2',
    section: 'current', package: 'DIP-8',
    specs: 'TL072 Dual Op-amp configured for Gain=10',
    pins: 'Pin2: -IN, Pin3: +IN, Pin4: GND, Pin6: Output, Pin8: VCC'
  }
);

placeComponent(
  createResistor(), 30, -10,
  {
    type: 'Resistor', label: 'Op-Amp Input (R9)', ref: 'R9',
    section: 'current', package: 'Axial 1/4W',
    specs: '10kΩ bias resistor',
    pins: 'Pin1: +5V, Pin2: Op-Amp +IN'
  }
);

placeComponent(
  createResistor(), 30, -7,
  {
    type: 'Resistor', label: 'Op-Amp Pulldown (R10)', ref: 'R10',
    section: 'current', package: 'Axial 1/4W',
    specs: '1kΩ pulldown resistor',
    pins: 'Pin1: Op-Amp +IN, Pin2: GND'
  }
);

placeComponent(
  createResistor(), 30, -4,
  {
    type: 'Resistor', label: 'Shunt Connection (R11)', ref: 'R11',
    section: 'current', package: 'Axial 1/4W',
    specs: '1kΩ shunt input resistor',
    pins: 'Pin1: ISENSE, Pin2: Op-Amp -IN'
  }
);

placeComponent(
  createResistor(), 30, -1,
  {
    type: 'Resistor', label: 'Feedback (R12)', ref: 'R12',
    section: 'current', package: 'Axial 1/4W',
    specs: '20kΩ feedback resistor',
    pins: 'Pin1: Op-Amp -IN, Pin2: Op-Amp Output'
  }
);

placeComponent(
  createShuntResistor(), 40, -25,
  {
    type: 'Current Sensor Shunt', label: 'Current Sensor Shunt', ref: 'R_shunt',
    section: 'current', package: '4-terminal Kelvin',
    specs: '0.01Ω 5W 1% metal alloy sense resistor',
    pins: 'Kelvin Sense: BAT-, ISENSE'
  }
);

// Temperature Sensing Section
placeComponent(
  createThermistor(), 30, 15,
  {
    type: 'Temperature Sensor', label: 'Temperature Sensor (NTC)', ref: 'TH1',
    section: 'temperature', package: 'Radial bead',
    specs: 'NTCLE100E3104B0, 10kΩ @ 25°C, Beta=3950K',
    pins: 'Pin1: ADC2 node, Pin2: GND'
  }
);

placeComponent(
  createResistor(), 33, 15,
  {
    type: 'Resistor', label: 'Pullup R (R_pullup)', ref: 'R_pullup',
    section: 'temperature', package: 'Axial 1/4W',
    specs: '10kΩ ±1% pullup to +5V',
    pins: 'Pin1: +5V, Pin2: ADC2 node'
  }
);

// Charging Section
placeComponent(
  createLED(0xff0000), -5, 20,
  {
    type: 'LED', label: 'Status Indicator', ref: 'D2',
    section: 'charging', package: '5mm T-1¾ round',
    specs: 'Red LED, solid for charge, blinking for danger',
    pins: 'Anode: Pin 18 (PB5), Cathode: GND via 330Ω'
  }
);

placeComponent(
  createMOSFET(), -20, 20,
  {
    type: 'MOSFET Switch', label: 'Charging MOSFET Switch', ref: 'Q1',
    section: 'charging', package: 'TO-220AB',
    specs: 'IRF540N N-channel logic-level MOSFET',
    pins: 'Gate: gate res, Drain: load, Source: shunt'
  }
);

placeComponent(
  createResistor(), -15, 25,
  {
    type: 'Resistor', label: 'Gate Resistor', ref: 'R_gate',
    section: 'charging', package: 'Axial 1/4W',
    specs: '100Ω gate current limiting',
    pins: 'Pin1: PB4 (Pin 16), Pin2: MOSFET Gate'
  }
);

placeComponent(
  createCapCeramic(), -12, 25,
  {
    type: 'Capacitor', label: 'Gate Cap (C11)', ref: 'C11',
    section: 'charging', package: 'Ceramic disc',
    specs: '10nF gate stability capacitor',
    pins: 'Pin1: Gate, Pin2: Source'
  }
);

placeComponent(
  createDiode(), -10, 20,
  {
    type: 'Diode', label: 'Gate Protect (D3)', ref: 'D3',
    section: 'charging', package: 'Axial DO-41',
    specs: '1N4148 fast switching gate protection diode',
    pins: 'Anode: Source, Cathode: Gate'
  }
);

// I/O Section
placeComponent(
  createConnector(4), 20, 30,
  {
    type: 'Connector', label: 'LCD Header', ref: 'J2',
    section: 'io', package: '4-pin header',
    specs: 'I2C LCD interface header pinouts',
    pins: 'Pin1: SDA (PC4), Pin2: SCL (PC5), Pin3: +5V, Pin4: GND'
  }
);

placeComponent(
  createConnector(4), 35, 30,
  {
    type: 'Connector', label: 'UART Debug Port', ref: 'J3',
    section: 'io', package: '4-pin header',
    specs: 'Serial UART communications monitor',
    pins: 'Pin1: RX (PD0), Pin2: TX (PD1), Pin3: GND, Pin4: +5V'
  }
);

placeComponent(
  createResistor(), 25, 25,
  {
    type: 'Resistor', label: 'I2C Pullup SDA (R14)', ref: 'R14',
    section: 'io', package: 'Axial 1/4W',
    specs: '10kΩ I2C SDA pull-up',
    pins: 'Pin1: PC4, Pin2: +5V'
  }
);

placeComponent(
  createResistor(), 28, 25,
  {
    type: 'Resistor', label: 'I2C Pullup SCL (R15)', ref: 'R15',
    section: 'io', package: 'Axial 1/4W',
    specs: '10kΩ I2C SCL pull-up',
    pins: 'Pin1: PC5, Pin2: +5V'
  }
);

// ─── 6. Copper Traces & Current Particles ──────────────────────────────────────
const tracesGroup = new THREE.Group();
tracesGroup.name = 'tracesGroup';
scene.add(tracesGroup);

const TRACE_Y = PCB_THICKNESS + 0.15; 
const traceParticles = [];

function createTrace(waypoints, colorHex, linewidth, currentKey) {
  const points = [];
  for (let i = 0; i < waypoints.length; i++) {
    const [x, z] = waypoints[i];
    if (i > 0) {
      const [px, pz] = waypoints[i - 1];
      if (px !== x && pz !== z) {
        points.push(new THREE.Vector3(x, TRACE_Y, pz)); 
      }
    }
    points.push(new THREE.Vector3(x, TRACE_Y, z));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: colorHex,
    linewidth: linewidth || 1,
    transparent: true,
    opacity: 0.7
  });
  const line = new THREE.Line(geometry, material);
  tracesGroup.add(line);

  // Setup current particles
  const particlesGroup = new THREE.Group();
  scene.add(particlesGroup);

  const particleCount = 3;
  const list = [];
  const sphereGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  for (let i = 0; i < particleCount; i++) {
    const p = new THREE.Mesh(sphereGeo, sphereMat);
    particlesGroup.add(p);
    list.push({
      mesh: p,
      t: i / particleCount 
    });
  }

  traceParticles.push({
    group: particlesGroup,
    points: points,
    particles: list,
    currentKey: currentKey,
    baseColor: colorHex,
    lineMesh: line
  });

  return line;
}

// Map Manhattan tracks with simulation current flow references
createTrace([[-45,-30], [-35,-30]], SECTION_COLORS.power, 1, 'power_flow'); // J1 -> F1
createTrace([[-35,-30], [-25,-30], [-15,-25]], SECTION_COLORS.power, 1, 'charge_flow'); // F1 -> TVS -> LM7805
createTrace([[-15,-18], [-5,-18]], SECTION_COLORS.power, 1, 'static_5v'); // 5V rail

// Voltage sense divider trace
createTrace([[-45,-30], [-45,-35], [25,-35], [25,-22]], SECTION_COLORS.voltage, 1, 'static_12v');
createTrace([[25,-18], [25,-15], [5,-15], [5, 0]], SECTION_COLORS.voltage, 1, 'analog_adc0');

// Current sense op-amp trace
createTrace([[40,-25], [35,-25], [35,-10], [30,-10]], SECTION_COLORS.current, 1, 'charge_flow'); // Shunt -> OpAmp
createTrace([[25,-5], [10,-5], [10, 0], [5, 0]], SECTION_COLORS.current, 1, 'analog_adc1'); // OpAmp -> ADC1

// Temp divider trace
createTrace([[30,15], [30,10], [8,10], [8, 0], [5, 0]], SECTION_COLORS.temperature, 1, 'analog_adc2');

// MCU traces
createTrace([[0, 0], [0, 5], [15, 5], [15, 8]], SECTION_COLORS.mcu, 1, 'static_5v');
createTrace([[0, 0], [-5, 0], [-5, 20]], SECTION_COLORS.mcu, 1, 'static_5v');

// PWM gate control trace
createTrace([[0, 0], [-8, 0], [-8, 25], [-15, 25]], SECTION_COLORS.charging, 1, 'control_flow');
createTrace([[-15, 25], [-18, 25], [-18, 20], [-20, 20]], SECTION_COLORS.charging, 1, 'control_flow');

// I2C display traces
createTrace([[20, 30], [25, 30], [25, 25]], SECTION_COLORS.io, 1, 'static_5v');

// Function to animate current pulses along the Manhatten line points
function updateTraceParticles(simData, dt) {
  traceParticles.forEach(tp => {
    let current = 0.0;
    
    if (tp.currentKey === 'charge_flow' || tp.currentKey === 'power_flow') {
      current = simData.fuseIntact ? simData.mcuCurrent : 0.0;
    } else if (tp.currentKey === 'control_flow') {
      current = simData.fuseIntact ? simData.mosfetDutyCycle * 5.0 : 0.0;
    } else if (tp.currentKey === 'analog_adc0' || tp.currentKey === 'analog_adc1' || tp.currentKey === 'analog_adc2') {
      current = simData.fuseIntact ? 0.3 : 0.0; // Slow tiny pulse for signals
    } else if (tp.currentKey.startsWith('static')) {
      current = simData.fuseIntact ? 1.0 : 0.0; // standard constant current
    }

    // Adaptive speed scaling so high currents flow faster, but don't blur excessively
    const speed = Math.sign(current) * Math.min(3.0, Math.pow(Math.abs(current), 0.5) * 0.15); 
    const points = tp.points;
    const numSegs = points.length - 1;

    // Toggle particle rendering based on settings and live fuse status
    tp.group.visible = glowEnabled && simData.fuseIntact && Math.abs(current) > 0.05;
    // Adjust line wire colors to reflect blown state
    if (!simData.fuseIntact) {
      tp.lineMesh.material.color.setHex(0x22222b);
    } else {
      tp.lineMesh.material.color.setHex(tp.baseColor);
    }

    // Set particle color matching state
    let particleColor = 0xffffff;
    if (current < -0.5) {
      particleColor = 0x00ffcc; // Cyan pulses (Charging)
    } else if (current > 100.0 || simData.systemState === 'TRIPPED') {
      particleColor = 0xff4444; // Red pulses (High current/danger)
    } else if (current >= 0.5) {
      particleColor = 0xfff066; // Yellow pulses (discharging)
    }

    tp.particles.forEach(p => {
      p.t += speed * dt;
      p.t = ((p.t % 1.0) + 1.0) % 1.0; // wrap [0, 1]

      const totalT = p.t * numSegs;
      const segIndex = Math.floor(totalT) % numSegs;
      const segT = totalT - Math.floor(totalT);

      const pStart = points[segIndex];
      const pEnd = points[segIndex + 1];

      p.mesh.position.lerpVectors(pStart, pEnd, segT);
      p.mesh.material.color.setHex(particleColor);
    });
  });
}

// ─── 7. UI Controls & Data Bindings ────────────────────────────────────────────
function syncInputsFromSim() {
  elPresetSelect.value = sim.activePreset;
  elModeSelect.value = sim.mode;
  
  elInputNs.value = sim.seriesCells;
  elInputNp.value = sim.parallelCells;
  elInputCapacity.value = sim.capacityAh;
  elInputSoh.value = sim.sohPercentage.toFixed(1);
  elInputCycles.value = Math.round(sim.cycleCount);
  elInputRi.value = sim.cellInternalResistance.toFixed(3);
  
  elInputCellNomV.value = sim.nomCellVoltage.toFixed(2);
  elInputCellMaxV.value = sim.maxCellVoltage.toFixed(2);
  elInputCellMinV.value = sim.minCellVoltage.toFixed(2);
  elInputCellChargeCurr.value = sim.chargeCurrentLimit.toFixed(1);
  elInputCellFastChargeCurr.value = sim.fastChargeCurrentLimit.toFixed(1);
  elInputCellCvV.value = sim.cvVoltageLimit.toFixed(2);
  elInputCoulombicEff.value = sim.coulombicEfficiency.toFixed(2);

  elInputPowerDraw.value = sim.powerDraw;
  elValPowerDraw.textContent = `${sim.powerDraw} W`;
  elInputRegenPower.value = sim.regenPower;
  elValRegenPower.textContent = `${sim.regenPower} W`;
  
  elInputAmbientTemp.value = sim.ambientTemp;
  elValAmbientTemp.textContent = `${sim.ambientTemp.toFixed(1)} °C`;
  
  elInputSimSpeed.value = sim.simSpeed;
}

function bindInput(el, prop, isFloat = true, onChange = null) {
  if (!el) return;
  el.addEventListener('input', (e) => {
    let val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
    if (!isNaN(val)) {
      sim[prop] = val;
      sim.recalculatePackMetrics();
      if (onChange) onChange(val);
    }
  });
}

// Bind Inputs
bindInput(elInputNs, 'seriesCells', false);
bindInput(elInputNp, 'parallelCells', false);
bindInput(elInputCapacity, 'capacityAh');
bindInput(elInputSoh, 'sohPercentage');
bindInput(elInputCycles, 'cycleCount');
bindInput(elInputRi, 'cellInternalResistance');

bindInput(elInputCellNomV, 'nomCellVoltage');
bindInput(elInputCellMaxV, 'maxCellVoltage');
bindInput(elInputCellMinV, 'minCellVoltage');
bindInput(elInputCellChargeCurr, 'chargeCurrentLimit');
bindInput(elInputCellFastChargeCurr, 'fastChargeCurrentLimit');
bindInput(elInputCellCvV, 'cvVoltageLimit');
bindInput(elInputCoulombicEff, 'coulombicEfficiency');

bindInput(elInputPowerDraw, 'powerDraw', true, (val) => {
  elValPowerDraw.textContent = `${val} W`;
});
bindInput(elInputRegenPower, 'regenPower', true, (val) => {
  elValRegenPower.textContent = `${val} W`;
});
bindInput(elInputAmbientTemp, 'ambientTemp', true, (val) => {
  elValAmbientTemp.textContent = `${val.toFixed(1)} °C`;
});

// Dropdowns
elPresetSelect.addEventListener('change', (e) => {
  sim.loadPreset(e.target.value);
  syncInputsFromSim();
});

elModeSelect.addEventListener('change', (e) => {
  sim.mode = e.target.value;
});

elInputSimSpeed.addEventListener('change', (e) => {
  sim.simSpeed = parseInt(e.target.value);
});

// Fault Buttons
elBtnShortCircuit.addEventListener('click', () => {
  sim.triggerShortCircuit();
  elModeSelect.value = 'DISCHARGE';
  elBtnResetFuse.disabled = false;
  elBtnShortCircuit.disabled = true;
});

elBtnResetFuse.addEventListener('click', () => {
  sim.replaceFuse();
  elModeSelect.value = 'IDLE';
  elBtnResetFuse.disabled = true;
  elBtnShortCircuit.disabled = false;
});

elBtnResetSoC.addEventListener('click', () => {
  sim.resetSoC();
});

// Initialize UI from Simulation
syncInputsFromSim();

// Visual Controls Toggles
elToggleLabels.addEventListener('change', (e) => {
  labelsGroup.visible = e.target.checked;
});

elToggleTraces.addEventListener('change', (e) => {
  tracesGroup.visible = e.target.checked;
});

elToggleGlow.addEventListener('change', (e) => {
  glowEnabled = e.target.checked;
});

// Explode Mode
let exploded = false;
const sectionYOffsets = {
  power: 12,
  voltage: 18,
  current: 24,
  temperature: 30,
  mcu: 6,
  charging: 36,
  io: 42
};

elToggleExplode.addEventListener('change', (e) => {
  exploded = e.target.checked;
  
  componentsGroup.children.forEach(child => {
    if (child === pcb) return;
    const section = child.userData.section;
    if (!section) return;

    const offset = sectionYOffsets[section] || 10;
    const baseY = COMP_Y + (child.userData.heightOffset || 0);
    const targetY = exploded ? baseY + offset : baseY;

    const startY = child.position.y;
    const dur = 600;
    const start = performance.now();

    function animateExplode(now) {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      child.position.y = startY + (targetY - startY) * ease;
      if (t < 1) requestAnimationFrame(animateExplode);
    }
    requestAnimationFrame(animateExplode);
  });

  // Move labels too
  labelsGroup.children.forEach((lbl, i) => {
    const comp = componentsGroup.children[i + 1]; 
    if (!comp || !comp.userData.section) return;

    const offset = sectionYOffsets[comp.userData.section] || 10;
    const baseY = COMP_Y + 8;
    const targetY = exploded ? baseY + offset : baseY;

    const startY = lbl.position.y;
    const dur = 600;
    const start = performance.now();

    function animateLabelExplode(now) {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      lbl.position.y = startY + (targetY - startY) * ease;
      if (t < 1) requestAnimationFrame(animateLabelExplode);
    }
    requestAnimationFrame(animateLabelExplode);
  });
});

// X-ray Mode
elToggleXray.addEventListener('change', (e) => {
  const xrayMode = e.target.checked;
  pcb.traverse(child => {
    if (child.isMesh && child.material) {
      child.material.transparent = true;
      child.material.opacity = xrayMode ? 0.2 : 1.0;
      child.material.needsUpdate = true;
    }
  });
});

// Reset Camera
elBtnResetCam.addEventListener('click', () => {
  const startPos = camera.position.clone();
  const endPos = new THREE.Vector3(0, 80, 110);
  const duration = 800;
  const startTime = performance.now();

  function animateReset(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad

    camera.position.lerpVectors(startPos, endPos, ease);
    controls.target.set(0, 0, 0);
    controls.update();

    if (t < 1) requestAnimationFrame(animateReset);
  }
  requestAnimationFrame(animateReset);
  hideInspector();
});

// ─── 8. Raycasting & Interaction ──────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedObject = null;
let originalEmissive = null;

function showInspector(userData) {
  elCompName.textContent = userData.label || userData.type;
  elCompRef.textContent = userData.ref;
  elCompDetails.textContent = userData.description || userData.specs;
  
  let pinListText = '';
  if (userData.pins) {
    pinListText += `Pinouts:\n${userData.pins}\n\n`;
  }
  pinListText += `Specs:\n${userData.specs}`;
  elCompSpecs.textContent = pinListText;

  elInspectorSection.classList.remove('hidden');
}

function hideInspector() {
  elInspectorSection.classList.add('hidden');
  deselectComponent();
}

function deselectComponent() {
  if (selectedObject) {
    selectedObject.traverse(child => {
      if (child.isMesh && child.material && child.material.emissive) {
        child.material.emissive.setHex(0x000000);
        child.material.emissiveIntensity = 0;
      }
    });
    selectedObject = null;
  }
}

function highlightComponent(obj) {
  deselectComponent();
  selectedObject = obj;

  obj.traverse(child => {
    if (child.isMesh && child.material && child.material.emissive) {
      const sectionColor = SECTION_COLORS[obj.userData.section] || 0xffffff;
      child.material.emissive.setHex(sectionColor);
      child.material.emissiveIntensity = 0.4;
    }
  });
}

renderer.domElement.addEventListener('click', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(componentsGroup.children, true);

  if (intersects.length > 0) {
    let target = intersects[0].object;
    while (target && !target.userData.ref) {
      target = target.parent;
    }

    if (target && target.userData.ref) {
      highlightComponent(target);
      showInspector(target.userData);
      controls.autoRotate = false;
    }
  } else {
    hideInspector();
  }
});

elCloseInspector.addEventListener('click', hideInspector);

// ─── 9. Animation Loop & Telemetry Update ──────────────────────────────────────
const clock = new THREE.Clock();

function animate(currentTime) {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // 1. Run simulation math
  sim.update(currentTime);

  // 2. Animate Manhattan trace particles
  updateTraceParticles(sim, dt);

  // 3. Sync PCB physical assets details
  updatePhysicalBoardAssets(sim, elapsed);

  // 4. Update HUD panels
  updateHUD(sim);

  // 5. Floating components animation (skip PCB at index 0)
  componentsGroup.children.forEach((child, i) => {
    if (i === 0) return; 
    if (exploded) return; 
    const baseY = COMP_Y + (child.userData.heightOffset || 0);
    child.position.y = baseY + Math.sin(elapsed * 1.5 + i * 0.3) * 0.05;
  });

  // Rotate point lights slowly
  pointLights.forEach((light, i) => {
    const baseX = light.position.x;
    const baseZ = light.position.z;
    const angle = elapsed * 0.3 + i * (Math.PI * 2 / pointLights.length);
    light.position.x = baseX + Math.sin(angle) * 0.02;
    light.position.z = baseZ + Math.cos(angle) * 0.02;
  });

  controls.update();
  renderer.render(scene, camera);
}

// Sync 3D meshes to show blown fuse, glowing LED
function updatePhysicalBoardAssets(simData, elapsed) {
  // A. Fuse blowing visual
  const fuseMesh = componentsGroup.children.find(c => c.userData && c.userData.ref === 'F1');
  if (fuseMesh) {
    const wireMesh = fuseMesh.children.find(child => child.isMesh && child.geometry.type === 'CylinderGeometry' && child.scale.z > 0.9);
    // Hide wire if fuse blown
    if (wireMesh) {
      wireMesh.visible = simData.fuseIntact;
    }
    // Also try checking children index directly
    if (fuseMesh.children[2]) {
      fuseMesh.children[2].visible = simData.fuseIntact;
    }
  }

  // B. LED glowing / blinking
  const ledMesh = componentsGroup.children.find(c => c.userData && c.userData.ref === 'D2');
  if (ledMesh) {
    ledMesh.traverse(child => {
      if (child.isMesh && child.material && child.material.emissive) {
        if (!simData.fuseIntact) {
          child.material.emissiveIntensity = 0;
        } else if (simData.systemState === 'TRIPPED') {
          // Flash red
          const flash = Math.sin(elapsed * 12) > 0;
          child.material.color.setHex(0xf87171);
          child.material.emissive.setHex(0xf87171);
          child.material.emissiveIntensity = flash ? 1.5 : 0.05;
        } else if (simData.flagCharging) {
          // Solid green
          child.material.color.setHex(0x34d399);
          child.material.emissive.setHex(0x34d399);
          child.material.emissiveIntensity = 1.0;
        } else {
          // Slow pulsing green (Standby)
          child.material.color.setHex(0x34d399);
          child.material.emissive.setHex(0x34d399);
          child.material.emissiveIntensity = 0.15 + 0.1 * Math.sin(elapsed * 2);
        }
      }
    });
  }
}

// HUD Panel synchronization
function updateHUD(simData) {
  // 1. Virtual LCD lines clone
  if (!simData.fuseIntact) {
    elLcdL1.textContent = "SYSTEM OFF";
    elLcdL2.textContent = "REPLACE FUSE";
    elLcdL1.style.color = '#550000';
    elLcdL2.style.color = '#550000';
  } else {
    const stateName = simData.systemState;
    const sign = simData.mcuCurrent < 0 ? '-' : ' ';
    const absI = Math.abs(simData.mcuCurrent).toFixed(1);
    
    elLcdL1.textContent = `SOC: ${simData.socPercentage.toFixed(1)}%   ${stateName.substring(0, 3)}`;
    elLcdL2.textContent = `${simData.mcuVoltage.toFixed(1)}V ${sign}${absI}A ${simData.mcuTemperature.toFixed(0)}C`;
    elLcdL1.style.color = '#44ff44';
    elLcdL2.style.color = '#44ff44';
  }

  // 2. Header state indicator
  elSystemStateBadge.textContent = simData.systemState;
  elSystemStateBadge.className = 'badge-state';
  if (simData.systemState === 'NORMAL') {
    elSystemStateBadge.classList.add('state-normal');
  } else if (simData.systemState === 'WARNING') {
    elSystemStateBadge.classList.add('state-warning');
  } else if (simData.systemState === 'TRIPPED') {
    elSystemStateBadge.classList.add('state-error');
  } else {
    elSystemStateBadge.textContent = 'POWER LOSS';
    elSystemStateBadge.classList.add('state-error');
  }

  // 3. Telemetry cards values
  elSoCValue.textContent = `${simData.socPercentage.toFixed(1)}%`;
  elSoCBar.style.width = `${simData.socPercentage}%`;

  // Sync Pack Health Card
  if (elSohValue) elSohValue.textContent = `${simData.sohPercentage.toFixed(1)}%`;
  if (elPackConfigText) elPackConfigText.textContent = `${simData.seriesCells}S x ${simData.parallelCells}P`;
  if (elSohBar) elSohBar.style.width = `${simData.sohPercentage}%`;
  if (elValPackCap) elValPackCap.textContent = `${simData.packCapacityAh.toFixed(1)} Ah`;
  if (elValPackRes) elValPackRes.textContent = `${simData.packResistance.toFixed(4)} Ω`;

  // Sync Thermal Dynamics Card
  if (elValAmbientTempTelemetry) elValAmbientTempTelemetry.textContent = `${simData.ambientTemp.toFixed(1)} °C`;
  if (elValPackTempTelemetry) elValPackTempTelemetry.textContent = `${simData.packTemp.toFixed(1)} °C`;
  if (elValJouleHeat) elValJouleHeat.textContent = `${simData.jouleHeating.toFixed(1)} W`;
  if (elValConvectionCooling) elValConvectionCooling.textContent = `${simData.convectionCooling.toFixed(1)} W`;
  if (elValHeatRate) {
    const netRate = simData.netHeatRate;
    const rateSign = netRate > 0.05 ? '+' : '';
    elValHeatRate.textContent = `${rateSign}${netRate.toFixed(1)} W`;
    elValHeatRate.className = netRate > 0.05 ? 'text-red' : (netRate < -0.05 ? 'text-green' : '');
  }

  if (simData.mcuCurrent < 0) {
    elSoCMode.textContent = 'Constant Current Phase';
    elPowerValue.textContent = `-${Math.abs(simData.mcuVoltage * simData.mcuCurrent).toFixed(1)} W`;
    elPowerValue.className = 'card-value text-green';
  } else {
    elSoCMode.textContent = 'Coulomb Counting Active';
    elPowerValue.textContent = `${(simData.mcuVoltage * simData.mcuCurrent).toFixed(1)} W`;
    elPowerValue.className = 'card-value';
  }

  elTempDisplayVal.textContent = `${simData.mcuTemperature.toFixed(1)} °C`;
  elMosfetTemp.textContent = `${simData.mosfetTemp.toFixed(1)} °C`;
  
  if (simData.mosfetDutyCycle > 0.01) {
    elMosfetStatus.textContent = `${(simData.mosfetDutyCycle * 100).toFixed(0)}% PWM`;
    elMosfetStatus.className = 'card-value text-green';
  } else {
    elMosfetStatus.textContent = 'SHUTDOWN';
    elMosfetStatus.className = 'card-value text-red';
  }

  // 4. ADC metrics lists
  elAdc0Raw.textContent = simData.adc0Raw;
  elAdc0Vin.textContent = `${simData.vDividerOut.toFixed(2)}V`;
  elAdc0Calc.textContent = `${simData.mcuVoltage.toFixed(1)}V (${(simData.mcuVoltage / simData.seriesCells).toFixed(2)}V/cell)`;
  elAdc0Bar.style.width = `${(simData.adc0Raw / 1023) * 100}%`;

  elAdc1Raw.textContent = simData.adc1Raw;
  elAdc1Vout.textContent = `${simData.vOpAmpOut.toFixed(2)}V`;
  const mcuSign = simData.mcuCurrent < 0 ? '-' : '';
  elAdc1Calc.textContent = `${mcuSign}${Math.abs(simData.mcuCurrent).toFixed(1)}A`;
  elAdc1Bar.style.width = `${(simData.adc1Raw / 1023) * 100}%`;

  elAdc2Raw.textContent = simData.adc2Raw;
  elAdc2Rntc.textContent = `${(simData.rThermistor / 1000).toFixed(1)}kΩ`;
  elAdc2Calc.textContent = `${simData.mcuTemperature.toFixed(1)}°C`;
  elAdc2Bar.style.width = `${(simData.adc2Raw / 1023) * 100}%`;

  // 5. Safety Flags LEDs & Dynamic Labels
  setLedClass(elFlagOv, simData.flagOverVoltage, 'red');
  if (elLabelOv) elLabelOv.textContent = `Over-Voltage (>${(simData.packMaxVoltage * 1.02).toFixed(1)}V)`;

  setLedClass(elFlagUv, simData.flagUnderVoltage, 'red');
  if (elLabelUv) elLabelUv.textContent = `Under-Voltage (<${(simData.packMinVoltage * 0.98).toFixed(1)}V)`;

  setLedClass(elFlagOc, simData.flagOverCurrent, 'red');
  if (elLabelOc) elLabelOc.textContent = `Over-Current (>${simData.fastChargeCurrentLimit.toFixed(0)}A)`;

  setLedClass(elFlagOt, simData.flagOverTemp, 'red');
  // Temp threshold is static 55C
  
  setLedClass(elFlagFuse, simData.fuseIntact, 'green', true); 
  setLedClass(elFlagCharging, simData.flagCharging, 'green');
}

function setLedClass(ledEl, active, colorClass, inverted = false) {
  ledEl.className = 'flag-led';
  const isGlowing = inverted ? !active : active;
  if (isGlowing) {
    ledEl.classList.add(colorClass === 'red' ? 'red' : 'green');
  } else {
    ledEl.classList.add(inverted ? 'red' : 'gray'); 
  }
}

// Initialize Loop
requestAnimationFrame(animate);

// Remove Loading Overlay when 3D compilation finishes
const loadingEl = document.getElementById('loading');
if (loadingEl) {
  loadingEl.classList.add('done');
}

// ─── 10. Window Resize ────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
