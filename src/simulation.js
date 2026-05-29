/**
 * High-Performance BMS Simulation Engine
 * Models multi-preset battery cells (Ns/Np), cycle aging, dynamic power loads,
 * Coulombic efficiency, and thermal heat generation.
 */
export class BMSSimulation {
    constructor() {
        // Active Preset Name
        this.activePreset = 'High Performance';

        // ─── Preset Configurations ───
        this.presets = {
            'High Performance': {
                capacityAh: 100.0,
                initialSoC: 80.0,
                initialSoH: 98.0,
                cellInternalResistance: 0.05, // Ω
                ambientTemp: 25.0, // °C
                cycleCount: 120,
                seriesCells: 96,
                parallelCells: 4,
                nomCellVoltage: 3.7,
                maxCellVoltage: 4.2,
                minCellVoltage: 3.0,
                chargeCurrent: 25.0, // A
                fastChargeCurrent: 80.0, // A
                cvVoltage: 4.2,
                coulombicEfficiency: 0.97,
                loadCurrent: 35.0, // A
                loadResistance: 1.5, // Ω
                powerDraw: 4500.0, // W
                regenPower: 1500.0, // W
                simSpeed: 1, // multiplier
                timeScale: 1, // seconds per tick
                sampleRateMs: 100
            },
            'Standard Performance': {
                capacityAh: 90.0,
                initialSoC: 92.0,
                initialSoH: 82.0,
                cellInternalResistance: 0.12, // Ω
                ambientTemp: 45.0, // °C
                cycleCount: 1200,
                seriesCells: 96,
                parallelCells: 2,
                nomCellVoltage: 3.7,
                maxCellVoltage: 4.25,
                minCellVoltage: 2.8,
                chargeCurrent: 80.0, // A
                fastChargeCurrent: 220.0, // A
                cvVoltage: 4.25,
                coulombicEfficiency: 0.89,
                loadCurrent: 180.0, // A
                loadResistance: 0.2, // Ω
                powerDraw: 45000.0, // W
                regenPower: 1000.0, // W
                simSpeed: 10,
                timeScale: 2,
                sampleRateMs: 25
            },
            'Custom Extreme': {
                capacityAh: 120.0,
                initialSoC: 95.0,
                initialSoH: 96.0,
                cellInternalResistance: 0.03, // Ω
                ambientTemp: 32.0, // °C
                cycleCount: 450,
                seriesCells: 108,
                parallelCells: 5,
                nomCellVoltage: 3.7,
                maxCellVoltage: 4.2,
                minCellVoltage: 3.1,
                chargeCurrent: 60.0, // A
                fastChargeCurrent: 180.0, // A
                cvVoltage: 4.2,
                coulombicEfficiency: 0.95,
                loadCurrent: 120.0, // A
                loadResistance: 0.4, // Ω
                powerDraw: 28000.0, // W
                regenPower: 6000.0, // W
                simSpeed: 2,
                timeScale: 1,
                sampleRateMs: 50
            }
        };

        // Initialize state variables based on default preset
        this.loadPreset('High Performance');

        // Thermal properties
        this.thermalCapacity = 12000.0; // J/K thermal mass of pack
        this.heatDissipationCoeff = 3.5; // W/K to ambient
        this.jouleHeating = 0.0;
        this.convectionCooling = 0.0;
        this.netHeatRate = 0.0;

        // Hardware safety
        this.fuseIntact = true;
        this.shortCircuitTriggered = false;

        // Timestep tracking
        this.lastTime = performance.now();
    }

    loadPreset(name) {
        const config = this.presets[name];
        if (!config) return;

        this.activePreset = name;
        this.capacityAh = config.capacityAh;
        this.sohPercentage = config.initialSoH;
        this.socPercentage = config.initialSoC;
        this.cycleCount = config.cycleCount;
        
        // Pack scaling details
        this.seriesCells = config.seriesCells;
        this.parallelCells = config.parallelCells;
        
        // Cell specs
        this.cellInternalResistance = config.cellInternalResistance;
        this.nomCellVoltage = config.nomCellVoltage;
        this.maxCellVoltage = config.maxCellVoltage;
        this.minCellVoltage = config.minCellVoltage;
        
        // Charge details
        this.chargeCurrentLimit = config.chargeCurrent;
        this.fastChargeCurrentLimit = config.fastChargeCurrent;
        this.cvVoltageLimit = config.cvVoltage;
        this.coulombicEfficiency = config.coulombicEfficiency;

        // Load & Power details
        this.loadCurrent = config.loadCurrent;
        this.loadResistance = config.loadResistance;
        this.powerDraw = config.powerDraw;
        this.regenPower = config.regenPower;

        // Simulation parameters
        this.simSpeed = config.simSpeed;
        this.timeScale = config.timeScale;
        this.sampleRateMs = config.sampleRateMs;

        // Temperatures
        this.ambientTemp = config.ambientTemp;
        this.packTemp = config.ambientTemp;
        this.mosfetTemp = config.ambientTemp;

        // Mode: 'DISCHARGE', 'CHARGE_STD', 'CHARGE_FAST', 'REGEN', 'IDLE'
        this.mode = 'IDLE';

        // Derived variables
        this.recalculatePackMetrics();

        // Stored charge in Coulombs
        this.maxCapacityCoulombs = this.packCapacityAh * 3600;
        this.chargeCoulombs = this.maxCapacityCoulombs * (this.socPercentage / 100.0);
    }

    recalculatePackMetrics() {
        // Pack capacity scales with parallel cells and SoH degradation
        this.packCapacityAh = this.capacityAh * this.parallelCells * (this.sohPercentage / 100.0);
        
        // Pack resistance is scaled: R_pack = (Ns / Np) * R_cell * (degradation factor)
        // Degraded SoH increases resistance: e.g. at 80% SoH, resistance is multiplied by 1.2
        const ageResistanceMultiplier = 2.0 - (this.sohPercentage / 100.0);
        this.packResistance = (this.seriesCells / this.parallelCells) * this.cellInternalResistance * ageResistanceMultiplier;

        // Pack nominal parameters
        this.packNomVoltage = this.seriesCells * this.nomCellVoltage;
        this.packMaxVoltage = this.seriesCells * this.maxCellVoltage;
        this.packMinVoltage = this.seriesCells * this.minCellVoltage;
        
        // Auto-scaling voltage divider for ATmega32 Controller ADC0
        // We scale the divider ratio so that PackMaxVoltage outputs ~4.2V for safety margin on 5V ADC
        this.voltageDividerRatio = 4.2 / this.packMaxVoltage;

        // Auto-scaling current shunt for ADC1
        // High capacity packs use lower shunt resistance to prevent melting
        // For standard 12V BMS we used 0.01Ω. For high power (>200A) we use 0.0002Ω (0.2mΩ)
        this.shuntResistance = this.packMaxVoltage > 100 ? 0.0002 : 0.005; // Ω
        this.opAmpGain = this.packMaxVoltage > 100 ? 100.0 : 10.0; // Gain scales up for small shunt drops
    }

    resetSoC() {
        // Recalculate pack open circuit voltage
        const avgCellOcv = this.calculateCellOcv(this.socPercentage);
        const packOcv = this.seriesCells * avgCellOcv;
        this.chargeCoulombs = this.maxCapacityCoulombs * (this.socPercentage / 100.0);
        this.mcuVoltage = packOcv;
    }

    triggerShortCircuit() {
        this.shortCircuitTriggered = true;
        this.mode = 'DISCHARGE';
        this.powerDraw = this.packMaxVoltage * 300.0; // extreme short load
        this.fuseIntact = false;  // Blows immediately
    }

    replaceFuse() {
        if (!this.fuseIntact) {
            this.fuseIntact = true;
            this.shortCircuitTriggered = false;
            this.mode = 'IDLE';
            this.powerDraw = this.presets[this.activePreset].powerDraw;
        }
    }

    update(currentTime) {
        // Delta time scaled by simulation speed and tick multiplier
        const baseDt = Math.min((currentTime - this.lastTime) / 1000, 1.0);
        this.lastTime = currentTime;

        const dt = baseDt * this.simSpeed * this.timeScale;

        // 1. BOARD POWER SUPPLY & FUSE STATUS
        if (!this.fuseIntact) {
            this.mcuVoltage = 0.0;
            this.mcuCurrent = 0.0;
            this.mcuTemperature = 0.0;
            this.packCurrent = 0.0;
            this.packVoltage = 0.0;
            this.mosfetDutyCycle = 0.0;
            this.mosfetPower = 0.0;
            this.jouleHeating = 0.0;
            this.convectionCooling = this.heatDissipationCoeff * (this.packTemp - this.ambientTemp);
            this.netHeatRate = -this.convectionCooling;
            
            // Heat cooling down back to ambient
            this.packTemp += (this.ambientTemp - this.packTemp) * (0.01 * dt);
            this.mosfetTemp += (this.ambientTemp - this.mosfetTemp) * (0.1 * dt);
            this.systemState = 'POWER_LOSS';
            return;
        }

        // 2. PACK CURRENT & VOLTAGE PHYSICS (Hardware behavior)
        let targetCurrent = 0.0; // A. Discharging is positive, Charging is negative

        if (this.mode === 'DISCHARGE') {
            // Calculate current based on Power Draw or Load Resistance
            // I = P / V
            const estVoltage = this.seriesCells * this.calculateCellOcv(this.socPercentage);
            targetCurrent = this.powerDraw / Math.max(10.0, estVoltage);
        } else if (this.mode === 'REGEN') {
            const estVoltage = this.seriesCells * this.calculateCellOcv(this.socPercentage);
            targetCurrent = -this.regenPower / Math.max(10.0, estVoltage); // Charging
        } else if (this.mode === 'CHARGE_STD') {
            targetCurrent = -this.chargeCurrentLimit;
        } else if (this.mode === 'CHARGE_FAST') {
            targetCurrent = -this.fastChargeCurrentLimit;
        } else {
            targetCurrent = 0.0; // IDLE
        }

        // Calculate Pack Open Circuit Voltage
        const cellOcv = this.calculateCellOcv(this.socPercentage);
        const packOcv = this.seriesCells * cellOcv;

        // Closed Circuit Voltage: V = V_ocv - I * R_pack
        this.packVoltage = packOcv - targetCurrent * this.packResistance;
        this.packCurrent = targetCurrent;

        // Clamp pack voltage to physical limits
        this.packVoltage = Math.min(this.packMaxVoltage * 1.1, Math.max(0.0, this.packVoltage));

        // 3. THERMISTOR TEMPERATURE SENSING
        // Model thermistor resistance. NTC Pullup 10k. 
        const tempK = this.packTemp + 273.15;
        const beta = 3950.0;
        const tempRefK = 298.15; // 25°C
        const r25 = 10000.0;
        this.rThermistor = r25 * Math.exp(beta * (1.0 / tempK - 1.0 / tempRefK));
        this.vThermistorOut = 5.0 * (this.rThermistor / (10000.0 + this.rThermistor));

        // 4. ATmega32 Controller ANALOG SIGNALS
        // Voltage Divider output (0-5V range scaling)
        this.vDividerOut = this.packVoltage * this.voltageDividerRatio;
        this.vDividerOut = Math.min(5.0, Math.max(0.0, this.vDividerOut));

        // Current Shunt drop + Op-Amp output (0-5V range scaling)
        // V_shunt = I * R_shunt
        this.vShuntDrop = Math.abs(this.packCurrent) * this.shuntResistance;
        this.vOpAmpOut = this.vShuntDrop * this.opAmpGain;
        this.vOpAmpOut = Math.min(5.0, Math.max(0.0, this.vOpAmpOut));

        // ADC raw updates (10-bit resolution)
        this.adc0Raw = Math.round((this.vDividerOut / 5.0) * 1023);
        this.adc1Raw = Math.round((this.vOpAmpOut / 5.0) * 1023);
        this.adc2Raw = Math.round((this.vThermistorOut / 5.0) * 1023);

        // MCU Calculated variables (Virtual Firmware)
        this.mcuVoltage = (this.adc0Raw / 1023.0) * 5.0 / this.voltageDividerRatio;
        const calcAmp = (this.adc1Raw / 1023.0) * 5.0 / (this.shuntResistance * this.opAmpGain);
        this.mcuCurrent = this.packCurrent < 0 ? -calcAmp : calcAmp;

        // Steinhart-Hart calculation inside firmware
        if (this.adc2Raw > 0 && this.adc2Raw < 1023) {
            const rNtcCalc = 10000.0 / (1023.0 / this.adc2Raw - 1.0);
            const logR = Math.log(rNtcCalc);
            const coeffA = 0.001129;
            const coeffB = 0.000234;
            const coeffC = 0.000000087;
            const tempKCalc = 1.0 / (coeffA + coeffB * logR + coeffC * logR * logR * logR);
            this.mcuTemperature = tempKCalc - 273.15;
        } else {
            this.mcuTemperature = this.adc2Raw <= 0 ? 120.0 : -40.0;
        }

        // 5. SAFETY & SWITCHING LOGIC
        this.flagOverVoltage = this.mcuVoltage > this.packMaxVoltage * 1.02;
        this.flagUnderVoltage = this.mcuVoltage < this.packMinVoltage * 0.98;
        this.flagOverCurrent = (this.mcuCurrent < -this.fastChargeCurrentLimit * 1.1) || (this.mcuCurrent > 300.0);
        this.flagOverTemp = this.mcuTemperature > 55.0;
        this.flagCharging = this.mcuCurrent < -0.5;

        // MOSFET State logic
        if (this.flagOverTemp || this.flagOverCurrent || (this.flagUnderVoltage && this.mcuCurrent > 0.5)) {
            this.systemState = 'TRIPPED';
            this.mosfetDutyCycle = 0.0; // Cut off gate driver
            this.packCurrent = 0.0;     // Force zero current through board
            this.packVoltage = packOcv;
        } else if (this.flagOverVoltage || this.flagUnderVoltage) {
            this.systemState = 'WARNING';
            // Limit duty cycle for protection
            if (this.flagOverVoltage && this.flagCharging) {
                this.mosfetDutyCycle = 0.15; // trickle
                this.packCurrent *= 0.15;
            } else {
                this.mosfetDutyCycle = 0.7;
                this.packCurrent *= 0.7;
            }
        } else {
            this.systemState = 'NORMAL';
            if (this.flagCharging) {
                // Taper charge in Constant Voltage CV mode
                const cvCutoffStart = 0.85; // CV begins at 85% SoC
                if (this.socPercentage > cvCutoffStart * 100) {
                    const taperFactor = 1.0 - (this.socPercentage - cvCutoffStart * 100) / (100 - cvCutoffStart * 100);
                    this.mosfetDutyCycle = Math.max(0.05, taperFactor);
                    this.packCurrent *= this.mosfetDutyCycle;
                } else {
                    this.mosfetDutyCycle = 1.0;
                }
            } else {
                this.mosfetDutyCycle = 1.0;
            }
        }

        // 6. DYNAMIC SoC & SoH LIFE CYCLE MODELING
        // Charge integration (Coulomb Counting)
        // Negative current adds charge (multiplied by Coulombic efficiency during charging)
        if (this.packCurrent < 0) {
            this.chargeCoulombs -= this.packCurrent * dt * this.coulombicEfficiency;
        } else {
            this.chargeCoulombs -= this.packCurrent * dt;
        }
        
        // Clamp charge coulombs
        this.chargeCoulombs = Math.min(this.maxCapacityCoulombs, Math.max(0.0, this.chargeCoulombs));
        const socCc = (this.chargeCoulombs / this.maxCapacityCoulombs) * 100.0;

        // OCV estimation
        const avgCellV = this.mcuVoltage / this.seriesCells;
        const socOcv = this.calculateOcvSoc(avgCellV);

        // Blended Hybrid SoC: Idle blends to OCV, active loads rely on CC
        let blendFactor = 0.00005;
        if (Math.abs(this.packCurrent) < 0.5) {
            blendFactor = 0.02; // Converge to OCV during resting
        }
        this.socPercentage = blendFactor * socOcv + (1.0 - blendFactor) * socCc;
        this.socPercentage = Math.min(100.0, Math.max(0.0, this.socPercentage));

        // Cycle Count & SoH Degradation
        // One full cycle corresponds to discharging 100% of max capacity
        if (this.packCurrent > 0.0) {
            const cycleIncrement = (this.packCurrent * dt) / this.maxCapacityCoulombs;
            this.cycleCount += cycleIncrement;
            
            // Degradation equation: SoH drops by 0.001% per full cycle under standard load,
            // or faster under extreme currents and high heats
            const heatFactor = Math.max(1.0, (this.packTemp - 25.0) / 10.0);
            const stressFactor = Math.max(1.0, Math.abs(this.packCurrent) / this.capacityAh);
            this.sohPercentage -= cycleIncrement * 0.002 * heatFactor * stressFactor;
            this.sohPercentage = Math.max(50.0, this.sohPercentage); // floor at 50%
            
            this.recalculatePackMetrics();
        }

        // 7. THERMAL DYNAMICS MODEL
        // Q_generated = I^2 * R_pack
        this.jouleHeating = Math.pow(this.packCurrent, 2) * this.packResistance;
        
        // Q_dissipated = h * A * (T_pack - T_ambient)
        this.convectionCooling = this.heatDissipationCoeff * (this.packTemp - this.ambientTemp);
        this.netHeatRate = this.jouleHeating - this.convectionCooling;
        
        // dT = (Q_gen - Q_conv) * dt / C_thermal
        const dTemp = this.netHeatRate * dt / this.thermalCapacity;
        this.packTemp += dTemp;
        
        // Clamp pack temperature to logical limits
        this.packTemp = Math.max(-40.0, Math.min(120.0, this.packTemp));

        // MOSFET Heating
        const rdsOn = 0.044; // Ω
        const mosfetConductionLoss = Math.pow(this.packCurrent, 2) * rdsOn * this.mosfetDutyCycle;
        const mosfetSwitchingLoss = Math.abs(this.packCurrent) * this.packVoltage * 0.0005;
        const mosfetPower = mosfetConductionLoss + mosfetSwitchingLoss;
        const targetMosfetTemp = this.ambientTemp + mosfetPower * 10.0;
        this.mosfetTemp += (targetMosfetTemp - this.mosfetTemp) * (0.05 * dt);
    }

    calculateCellOcv(soc) {
        // Lithium Ion OCV mapping (average cell voltage)
        const s = soc / 100.0;
        // Cubic approximation curve modeling discharge plateaus
        // empty = 3.0V, nominal = 3.7V, full = 4.2V
        return 3.0 + 1.2 * s - 0.4 * s * (1.0 - s) + 0.4 * Math.pow(s, 3);
    }

    calculateOcvSoc(vCellOcv) {
        // Inverse of OCV mapping
        if (vCellOcv >= this.maxCellVoltage) return 100.0;
        if (vCellOcv <= this.minCellVoltage) return 0.0;
        
        // Linear segments interpolation for ADC readings
        const span = this.maxCellVoltage - this.minCellVoltage;
        const progress = (vCellOcv - this.minCellVoltage) / span;
        return progress * 100.0;
    }
}
