/**
 * BMS Simulation Engine - Circuit calculations & virtual firmware
 * Simulates battery physics, sensor networks, protections, and ATmega328P code
 */
export class BMSSimulation {
    constructor() {
        // Battery Specs
        this.capacityAh = 2.5; // Nominal capacity
        this.maxCapacityCoulombs = this.capacityAh * 3600; // 9000 Coulombs
        this.chargeCoulombs = this.maxCapacityCoulombs * 0.784; // Initial SoC = 78.4%
        this.internalResistance = 0.05; // 50mOhms internal cell resistance
        this.ambientTemp = 25.0; // °C

        // Circuit States & Inputs (Adjusted by UI sliders)
        this.inputVoltage = 12.0;    // Battery terminal voltage (V)
        this.inputCurrent = 2.0;     // Load current (A). Negative is charging
        this.inputTemperature = 25.0;// Thermistor environment temperature (°C)
        this.fuseIntact = true;
        this.shortCircuitTriggered = false;

        // Calculated Board Electronics
        this.vRegulatorOut = 5.0;    // LM7805 Output (V)
        this.vDividerOut = 0.0;      // Voltage sense output to ADC0 (V)
        this.vShuntDrop = 0.0;       // Voltage drop across 0.01Ω shunt (V)
        this.vOpAmpOut = 0.0;        // Op-amp output to ADC1 (V)
        this.rThermistor = 10000.0;  // Thermistor resistance (Ω)
        this.vThermistorOut = 0.0;   // Thermistor divider output to ADC2 (V)
        this.mosfetDutyCycle = 1.0;  // PWM output on PB4 (0.0 to 1.0)
        this.mosfetPower = 0.0;      // MOSFET power dissipation (W)
        this.mosfetTemp = 25.0;      // MOSFET temperature (°C)

        // Virtual MCU ADC registers
        this.adc0Raw = 0; // Voltage sense
        this.adc1Raw = 0; // Current sense
        this.adc2Raw = 0; // Temperature sense

        // Virtual Firmware Calculated values (what MCU thinks they are)
        this.mcuVoltage = 12.0;
        this.mcuCurrent = 2.0;
        this.mcuTemperature = 25.0;
        this.socPercentage = 78.4;
        
        // Safety / Protection Flags
        this.flagOverVoltage = false;
        this.flagUnderVoltage = false;
        this.flagOverCurrent = false;
        this.flagOverTemp = false;
        this.flagCharging = false;
        this.systemState = 'NORMAL'; // 'NORMAL', 'WARNING', 'TRIPPED', 'POWER_LOSS'

        // Constants for Steinhart-Hart equation (NTCLE100E3104B0)
        this.coeffA = 0.001129;
        this.coeffB = 0.000234;
        this.coeffC = 0.000000087;

        // Timestep tracking
        this.lastTime = performance.now();
    }

    resetSoC() {
        // Recalculate OCV SoC and reset Coulomb counter to match
        const ocv = this.inputVoltage - this.inputCurrent * this.internalResistance;
        const ocvSoc = this.calculateOcvSoc(ocv);
        this.chargeCoulombs = this.maxCapacityCoulombs * (ocvSoc / 100.0);
        this.socPercentage = ocvSoc;
    }

    triggerShortCircuit() {
        this.shortCircuitTriggered = true;
        this.inputCurrent = 55.0; // Instantly draw 55A (above 50A limit)
        this.fuseIntact = false;  // Fuse blows instantly
        this.systemState = 'POWER_LOSS';
    }

    replaceFuse() {
        if (!this.fuseIntact) {
            this.fuseIntact = true;
            this.shortCircuitTriggered = false;
            this.inputCurrent = 0.0;
            this.systemState = 'NORMAL';
        }
    }

    update(currentTime) {
        // Delta time in seconds
        const dt = Math.min((currentTime - this.lastTime) / 1000, 1.0); // Cap at 1s for tab defocusing
        this.lastTime = currentTime;

        // 1. POWER SUPPLY SIMULATION
        if (!this.fuseIntact) {
            // Power cut off. Main board dies.
            this.vRegulatorOut = 0.0;
            this.vDividerOut = 0.0;
            this.vShuntDrop = 0.0;
            this.vOpAmpOut = 0.0;
            this.vThermistorOut = 0.0;
            this.adc0Raw = 0;
            this.adc1Raw = 0;
            this.adc2Raw = 0;
            this.mcuVoltage = 0.0;
            this.mcuCurrent = 0.0;
            this.mcuTemperature = 0.0;
            this.mosfetDutyCycle = 0.0;
            this.mosfetPower = 0.0;
            this.mosfetTemp = this.ambientTemp;
            this.systemState = 'POWER_LOSS';
            return;
        }

        // LM7805 delivers +5.0V if input is above ~7V.
        if (this.inputVoltage > 7.0) {
            this.vRegulatorOut = 5.0;
        } else {
            this.vRegulatorOut = Math.max(0, this.inputVoltage - 2.0); // Dropout voltage
        }

        // 2. ANALOG BOARD ELECTRONICS (Hardware behavior)
        
        // Voltage Divider: 10k and 4.7k (per template R2 is 4.7k, divider ratio is 4.7/14.7 = 0.3197)
        const dividerRatio = 4.7 / (10.0 + 4.7);
        this.vDividerOut = this.inputVoltage * dividerRatio;

        // Low-Side Shunt Resistor: R_shunt = 0.01Ω
        this.vShuntDrop = this.inputCurrent * 0.01;

        // Current Op-Amp (TL072): Gain = 10. (per template R9/R10 is 1k, R11/R12 is 10k, gain is 10)
        // V_out = V_shunt * 10
        // We model it as V_out = abs(I) * 0.01 * 10 = abs(I) * 0.1
        // Max measured current is 50A (V_out = 5.0V)
        this.vOpAmpOut = Math.abs(this.inputCurrent) * 0.01 * 10.0;
        this.vOpAmpOut = Math.min(5.0, Math.max(0.0, this.vOpAmpOut)); // Clamped to supply rail

        // Thermistor (NTC 10k @ 25°C, Beta=3950). 
        // Compute NTC resistance R = R25 * exp(Beta * (1/T - 1/298.15))
        const tempK = this.inputTemperature + 273.15;
        const beta = 3950.0;
        const tempRefK = 298.15; // 25°C
        const r25 = 10000.0;
        this.rThermistor = r25 * Math.exp(beta * (1.0 / tempK - 1.0 / tempRefK));

        // Thermistor Divider: V_out = +5V * R_ntc / (R_pullup + R_ntc), R_pullup = 10k
        this.vThermistorOut = 5.0 * (this.rThermistor / (10000.0 + this.rThermistor));

        // 3. VIRTUAL MCU FIRMWARE OPERATIONS (Executing code at 10Hz/20Hz)
        
        // ADC Sample Readings
        this.adc0Raw = Math.round((this.vDividerOut / 5.0) * 1023);
        this.adc0Raw = Math.min(1023, Math.max(0, this.adc0Raw));

        this.adc1Raw = Math.round((this.vOpAmpOut / 5.0) * 1023);
        this.adc1Raw = Math.min(1023, Math.max(0, this.adc1Raw));

        this.adc2Raw = Math.round((this.vThermistorOut / 5.0) * 1023);
        this.adc2Raw = Math.min(1023, Math.max(0, this.adc2Raw));

        // Firmware conversions:
        // Voltage
        this.mcuVoltage = (this.adc0Raw / 1023.0) * 5.0 / dividerRatio;

        // Current (MCU knows sign from Charging Flag or secondary logic, here we assign based on signed input)
        const calcAmp = (this.adc1Raw / 1023.0) * 5.0 * 10.0; // 50A at 5.0V, so scale factor is 10.0
        this.mcuCurrent = this.inputCurrent < 0 ? -calcAmp : calcAmp;

        // Temperature (Steinhart-Hart calculation)
        if (this.adc2Raw > 0 && this.adc2Raw < 1023) {
            const rNtcCalc = 10000.0 / (1023.0 / this.adc2Raw - 1.0);
            const logR = Math.log(rNtcCalc);
            const tempKCalc = 1.0 / (this.coeffA + this.coeffB * logR + this.coeffC * logR * logR * logR);
            this.mcuTemperature = tempKCalc - 273.15;
        } else {
            this.mcuTemperature = this.adc2Raw <= 0 ? 150.0 : -50.0;
        }

        // 4. PROTECTION FIRMWARE LOOP & CHARGING MOSFET CONTROL
        this.flagOverVoltage = this.mcuVoltage > 13.5;
        this.flagUnderVoltage = this.mcuVoltage < 10.8;
        this.flagOverCurrent = (this.mcuCurrent < -10.0) || (this.mcuCurrent > 50.0);
        this.flagOverTemp = this.mcuTemperature > 55.0;
        this.flagCharging = this.mcuCurrent < -0.2;

        // State Machine Decision
        if (this.flagOverTemp || this.flagOverCurrent || this.flagUnderVoltage && this.mcuCurrent > 0.2) {
            this.systemState = 'TRIPPED';
            this.mosfetDutyCycle = 0.0; // Shut down charging / connection
        } else if (this.flagOverVoltage || this.flagUnderVoltage) {
            this.systemState = 'WARNING';
            // Scale PWM duty cycle back to protect cells during charging
            if (this.flagOverVoltage && this.flagCharging) {
                this.mosfetDutyCycle = 0.2; // 20% trickle charge
            } else {
                this.mosfetDutyCycle = 0.8;
            }
        } else {
            this.systemState = 'NORMAL';
            if (this.flagCharging) {
                // If battery is nearing 100%, taper charging using constant-voltage mode emulator
                const chargeRatio = this.chargeCoulombs / this.maxCapacityCoulombs;
                if (chargeRatio > 0.8) {
                    // Constant voltage phase: drop duty cycle as SoC climbs from 80% to 100%
                    this.mosfetDutyCycle = Math.max(0.05, 1.0 - (chargeRatio - 0.8) / 0.2);
                } else {
                    this.mosfetDutyCycle = 1.0; // Constant current phase
                }
            } else {
                this.mosfetDutyCycle = 1.0; // MOSFET fully ON for discharging load path
            }
        }

        // 5. HYBRID STATE OF CHARGE (SoC) ESTIMATION
        // OCV lookup based on calculated open-circuit voltage: V_ocv = V_bat - I * R_internal
        const vOcv = this.mcuVoltage - this.mcuCurrent * this.internalResistance;
        const socOcv = this.calculateOcvSoc(vOcv);

        // Coulomb Counting: SoC_cc = SoC_prev - (I * dt) / capacity
        // Update total stored coulombs (Negative current = charging = adding charge)
        this.chargeCoulombs = this.chargeCoulombs - (this.mcuCurrent * dt);
        this.chargeCoulombs = Math.min(this.maxCapacityCoulombs, Math.max(0.0, this.chargeCoulombs));
        const socCc = (this.chargeCoulombs / this.maxCapacityCoulombs) * 100.0;

        // Complementary Filter Blend (Hybrid SoC Estimation)
        // If current is small, trust OCV more to correct drift. If current is high, trust Coulomb counter more.
        let alpha = 0.0001; // Tiny update rate from OCV under high load to prevent sag influence
        if (Math.abs(this.mcuCurrent) < 0.2) {
            alpha = 0.02; // Blends back to OCV when battery goes idle
        }
        this.socPercentage = alpha * socOcv + (1.0 - alpha) * socCc;
        this.socPercentage = Math.min(100.0, Math.max(0.0, this.socPercentage));

        // 6. THERMAL SIMULATION OF BOARD COMPONENTS
        // MOSFET power = I^2 * R_ds_on * Duty + switching loss. R_ds_on = 0.044Ω (from IRF540N template spec)
        const rdsOn = 0.044;
        const conductionLoss = Math.pow(this.mcuCurrent, 2) * rdsOn * this.mosfetDutyCycle;
        const switchingLoss = Math.abs(this.mcuCurrent) * this.mcuVoltage * 0.001;
        this.mosfetPower = conductionLoss + switchingLoss;

        // Heatsink thermal resistance θ_ja = 15°C/W. T_mosfet = T_amb + Power * θ_ja
        const thermalResistance = 15.0; // °C/W
        this.mosfetTemp = this.ambientTemp + this.mosfetPower * thermalResistance;
        
        // Heat dissipation delay: Smooth the temperature shift
        const targetMosfetTemp = this.ambientTemp + this.mosfetPower * thermalResistance;
        this.mosfetTemp += (targetMosfetTemp - this.mosfetTemp) * 0.1; 
    }

    calculateOcvSoc(vOcv) {
        // Standard Lithium Ion 3S pack curve (9.0V empty, 12.6V full)
        if (vOcv >= 12.6) return 100.0;
        if (vOcv <= 9.0) return 0.0;
        
        // Piecewise linear estimation matching standard discharge curves
        if (vOcv > 12.0) {
            // 12.0V - 12.6V is 75% - 100%
            return 75.0 + 25.0 * ((vOcv - 12.0) / 0.6);
        } else if (vOcv > 11.4) {
            // 11.4V - 12.0V is 25% - 75%
            return 25.0 + 50.0 * ((vOcv - 11.4) / 0.6);
        } else if (vOcv > 10.8) {
            // 10.8V - 11.4V is 5% - 25%
            return 5.0 + 20.0 * ((vOcv - 10.8) / 0.6);
        } else {
            // 9.0V - 10.8V is 0% - 5%
            return 0.0 + 5.0 * ((vOcv - 9.0) / 1.8);
        }
    }
}
