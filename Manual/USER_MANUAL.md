# CrewmateA300 — User Manual

**CrewmateA300** is a virtual First Officer companion for the **Airbus A300** in Microsoft Flight Simulator. It listens to your voice, responds with audio callouts, runs automated cockpit flows, and guides you through interactive checklists — just like a real crew member.

---

<div style="text-align: center;">
  <img src="../crewmate.png" alt="Crewmate avatar" width="800">
</div>

## Table of Contents

1. [Getting Started](#getting-started)
2. [Tutorial](#tutorial)
3. [Voice Commands](#voice-commands)
4. [Tips & Troubleshooting](#tips--troubleshooting)

---

## Getting Started

### Requirements

- Install **an English** Windows speech recognition language pack (Settings → Time & language → Speech). Regional variants (e.g. US, UK, Australia, India) are supported — whichever English recognizer Windows exposes. If several English packs are installed, the active engine follows Windows' installed-recognizer order.
- **Set up Windows Speech Recognition once** before using the Voice Trainer. The trainer teaches Windows your voice, and Windows needs an existing speech profile to train. If the setup has never been run, there is no profile and training cannot start.
- To use the trainer app, set your Display Language to EN‑US while training (you can change it back afterward).

### Voice Modes

CrewmateA300 supports two voice recognition modes, chosen with **Voice Mode** in Settings:

| Mode                 | How it works                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Always listening** | The microphone is always listening. Speak naturally.                                                            |
| **Push-to-talk**     | The FO only listens while you hold the **PTT button**. Keep holding until you finish the command, then release. |

The mic button on the toolbar is the master switch in both modes. When it is off the FO hears nothing, even with PTT held. The icon shows what the FO can hear:

| Toolbar mic | Meaning                                            |
| ----------- | -------------------------------------------------- |
| Crossed out | Off. The FO hears nothing.                         |
| Red         | Always listening. The FO hears everything.         |
| Faded red   | Push-to-talk, ready. Hold the PTT button to speak. |
| Green       | Push-to-talk, PTT held. The FO is listening.       |

### PTT and Mic On/Off Buttons

Both buttons can be a keyboard key, mouse button 4 or 5, or a button or hat on a joystick, yoke, throttle or game controller. They work while MSFS has focus, including in fullscreen.

- **PTT Button**: hold to talk in Push-to-talk mode.
- **Mic On/Off**: works like clicking the toolbar mic, in either mode. It only works while the sim is connected.

To set one, open **Settings → Microphone**, click **Set** and press the key or button. Press **Esc** or click **Cancel** to stop without changing it, and click **×** to clear it.

CrewMate does not take the key or button away from MSFS, so pick one that is not bound to anything in the sim. Analog triggers and axes cannot be bound.

### Voice Settings

| Setting               | What it does                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Input Device**      | Which microphone the speech engine listens to.                                                                                                     |
| **Sound Volume**      | How loud the FO's audio is (0–200; above 100 amplifies).                                                                                           |
| **Voice Sensitivity** | How confident the engine must be before accepting a command (50–100). Lower is more tolerant and may accept the wrong command; higher is stricter. |
| **Voice Mode**        | **Always listening** or **Push-to-talk**. See [Voice Modes](#voice-modes).                                                                         |
| **PTT Button**        | The key or button held to talk in Push-to-talk mode.                                                                                               |
| **Mic On/Off**        | A key or button that switches the mic on and off, like the toolbar mic.                                                                            |

---

## Tutorial

### Assumptions

This tutorial assumes you are parked at the gate with engines off. You are the Captain and PF (Pilot Flying); CrewMate acts as PM (Pilot Monitoring).

### Typical preflight timeline (example)

- 45 min: Crew arrives at aircraft and PM takes their seat.
- 43 min: PM starts preliminary cockpit preparation.
- 42 min: PM departs for external walkaround. PF starts cockpit preparation on their side.
  ![Cockpit Preparation flow pattern 1](Images/COCKPIT%20PREPARATION%20FLOW%20PATTERN1.png)
  ![Cockpit Preparation flow pattern 2](Images/COCKPIT%20PREPARATION%20FLOW%20PATTERN2.png)
- 30 min: PM returns and starts cockpit preparation on their side.
  ![Cockpit Preparation flow pattern 3](Images/COCKPIT%20PREPARATION%20FLOW%20PATTERN3.png)
  ![Cockpit Preparation flow pattern 4](Images/COCKPIT%20PREPARATION%20FLOW%20PATTERN4.png)
- 25 min: PF conducts the departure briefing (enter takeoff data in the Takeoff Performance window).
- 10 min: PF calls for the BEFORE START checklist to the line.
- 1 min: CrewMate closes the cockpit door. PF and PM perform before start flow, after that PF calls for the BEFORE START checklist below the line.

![Before Start flow pattern](Images/BEFORE%20START%20FLOW%20PATTERN.png)

### Pushback and Engine Start

- Command PM to start engines (e.g., “Start engine 2). PM will set ignition knob to Start A or B and press the starter.
- When ignition is set to OFF, PF and PM will start the AFTER START flow pattern. If anti‑ice will be used, flaps may be left as required.
- On hand signal from ground personnel, call for the AFTER START checklist.

![After Start flow pattern](Images/AFTER%20START%20FLOW%20PATTERN.png)

### Taxi

- PM announces when the cabin is ready.
- Check flight controls at a convenient time before or during taxi (this is done before arming the autobrake).
- Control check sequence: Full Up, Full Down, Full Left, Full Right, Rudder Full Left, Rudder Full Right.
- After the controls check, PM performs the 2nd part of the TAXI flow pattern.
- After T.O. CONFIG pushbutton is pressed and a cabin report is received, PF calls for the BEFORE TAKEOFF to the line checklist.

![Taxi flow pattern](Images/TAXI%20FLOW%20PATTERN.png)

### Line‑up & Takeoff

- PF calls for the Line‑up flow.
- When line‑up clearance is received and the Line‑up flow pattern is complete, PF calls for the BEFORE TAKEOFF below the line checklist.
- When cleared for takeoff, announce “TAKEOFF.”

![Line‑up flow pattern](Images/LINE-UP%20FLOW%20PATTERN.png)

### Acceleration

- The First part of the After‑Takeoff flow is triggered when you are above thrust reduction altitude.
- The Second part of the After‑Takeoff flow is triggered when the aircraft is clean.
- When the aircraft is clean call for the AFTER TAKEOFF CLIMB checklist to the line.
- When the aircraft is above transition altitude and altimeters are standard call for the AFTER TAKEOFF CLIMB checklist below the line.

![Takeoff flow pattern](Images/TAKEOFF%20FLOW%20PATTERN.png)
![Acceleration flow pattern](Images/ACCELERATION%20FLOW%20PATTERN.png)

### Climb to 10,000 ft

![Climb/10,000 ft flow pattern](Images/AT%2010%20000%20FT%20AAL%20FLOW%20PATTERN.png)

### Descent Preparation

- PF should insert landing data in the Landing Performance window.

![Descent preparation items](Images/PF%20DESCENT%20PREP%20ITEMS.png)

### 10k Descent

![10k descent flow pattern](Images/AT%2010%20000%20FT%20AAL%20DES%20FLOW%20PATTERN.png)

### Approach

- After passing the transition level and/or setting the barometric reference, complete the APPROACH checklist.

### Landing

- When LDG CONF is set and a cabin report is received, call for the LANDING checklist.
- PF announces “Continue” at minima or “Go‑around - flaps” as appropriate.

### After Landing

- Disarming the ground spoilers will trigger the After‑Landing flow.
- If anti‑ice is used, flaps may remain at LDG CONF per procedure.
- Once flows done call for the AFTER LANDING checklist.

![After landing flow pattern](Images/AFTER%20LANDING%20FLOW%20PATTERN.png)

### Parking

- Turn off taxi lights when turning into the gate, or ask the PM to confirm.
- Shutting down the engines will trigger the Parking flow.
- After the Parking flow pattern completes, PM calls for the PARKING checklist.

![Parking flow pattern](Images/PARKING%20FLOW%20PATTERN.png)

### Securing the Aircraft

- After the last passenger leaves (if securing the aircraft), call for the SECURE AIRCRAFT checklist.

---

## Voice Commands

Speak these phrases clearly during flight. The FO uses partial matching — you don't need to be word‑perfect, but include the key phrase.

### Preflight Timer

| Say                          | What happens                                                             |
| ---------------------------- | ------------------------------------------------------------------------ |
| "Let's prepare the aircraft" | Starts the preflight countdown timer to help you track preparation time. |

### Ground Engineer

| Say                   | What happens                                |
| --------------------- | ------------------------------------------- |
| "Ground from cockpit" | Ground Engineer will ask whats your request |
| "Cockpit to ground"   | Ground Engineer will ask whats your request |

### Gear

| Say         | What happens                                                      |
| ----------- | ----------------------------------------------------------------- |
| "gear down" | Lowers the landing gear. **Speed must be at or below 270 knots.** |
| "gear up"   | Raises the landing gear.                                          |

### Flaps

The FO will confirm speed limits before moving flaps while airborne.

| Say                         | Flap Setting          | Max Speed |
| --------------------------- | --------------------- | --------- |
| "slats retract"             | Flaps 0/0 (retracted) | —         |
| "slats extend" or "flaps 0" | Flaps 15/0            | 250 kts   |
| "flaps fifteen"             | Flaps 15/15           | 215 kts   |
| "flaps twenty"              | Flaps 20/20           | 205 kts   |
| "flaps fourty"              | Flaps 40              | 175 kts   |

### Engine Anti‑Ice

| Say                   | What happens                               |
| --------------------- | ------------------------------------------ |
| "Engine anti ice on"  | Turns on engine anti‑ice for both engines. |
| "Engine anti ice off" | Turns off engine anti‑ice.                 |

### Wing Anti‑Ice

| Say                 | What happens             |
| ------------------- | ------------------------ |
| "Wing anti ice on"  | Turns on wing anti‑ice.  |
| "Wing anti ice off" | Turns off wing anti‑ice. |

### Lights (Landing / Taxi / Nose / Strobe)

| Say                  | What happens                 |
| -------------------- | ---------------------------- |
| "Landing lights on"  | Turns on landing lights.     |
| "Landing lights off" | Turns off landing lights.    |
| "Taxi lights on"     | Turns on nose taxi light.    |
| "Taxi lights off"    | Turns off nose taxi light.   |
| "Takeoff light on"   | Turns on nose takeoff light. |
| "Strobe lights on"   | Turns on strobes.            |
| "Strobe lights auto" | Sets strobes to AUTO.        |
| "Strobe lights off"  | Turns off strobes.           |

### Flight Director

| Say                   | What happens                     |
| --------------------- | -------------------------------- |
| "Flight Director on"  | Activates the Flight Director.   |
| "Flight Director off" | Deactivates the Flight Director. |

### Autopilot

| Say                                                                                                | What happens                                                         |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| "Autopilot on"                                                                                     | Engages Autopilot 1.                                                 |
| "Set speed **_ or speed select _**"                                                                | Sets commanded speed.                                                |
| "Set heading **\_ or heading select \_\_**"                                                        | Sets commanded heading.                                              |
| "Set altitude **\_** or altitude select **\_** or set flight level **_ or flight level select _**" | Sets commanded altitude.                                             |
| "Pull speed"                                                                                       | Pulls speed knob to select selected speed.                           |
| "Pull speed \_\_\_"                                                                                | Pulls speed knob and sets the commanded speed.                       |
| "Pull heading"                                                                                     | Pulls heading knob to select selected heading.                       |
| "Pull heading \_\_\_"                                                                              | Pulls heading knob and sets the commanded heading.                   |
| "Heading push"                                                                                     | Pushes heading knob to synchronize FCU heading with aircraft heading |
| "Engage nav"                                                                                       | Selects NAV mode.                                                    |
| "Arm land"                                                                                         | Selects LAND mode.                                                   |
| "Arm loc"                                                                                          | Selects V/L mode.                                                    |
| "Altitude **\_** pull or Flight level \_\_\_ pull"                                                 | Sets commanded altitude and pulls altitude knob.                     |
| "Altitude pull or Flight level pull"                                                               | Pulls altitude knob.                                                 |

### Flight Controls Check

| Say                     | What happens                                                                      |
| ----------------------- | --------------------------------------------------------------------------------- |
| "Flight controls check" | Starts the flight controls flow: Up, Down, Left, Right, Rudder Left, Rudder Right |

### Launching Flows by Voice

| Say                                            | Flow launched       |
| ---------------------------------------------- | ------------------- |
| "Clear left" or "Left side clear"              | Clear Left flow     |
| "Runway entry procedure" or "Clear to line up" | Before Takeoff flow |
| "Before start procedure"                       | Before Start flow   |

### Launching Checklists by Voice

| Say                                                         | Checklist launched            |
| ----------------------------------------------------------- | ----------------------------- |
| "Before start checklist to the line"                        | Before start to the line      |
| "Before start checklist below the line"                     | Before start below the line   |
| "After start checklist"                                     | After Start                   |
| "Before takeoff checklist to the line"                      | Before takeoff to the line    |
| "Before takeoff checklist below the line"                   | Before takeoff below the line |
| "After takeoff climb checklist to the line"                 | Climb to the line             |
| "After takeoff climb checklist below the line"              | Climb below the line          |
| "Approach checklist"                                        | Approach                      |
| "Landing checklist"                                         | Landing                       |
| "After landing checklist"                                   | After Landing                 |
| "Parking checklist"                                         | Parking                       |
| "Secure aircraft checklist"                                 | Secure Aircraft               |
| "Stop checklist" or "Abort checklist" or "Cancel checklist" | Aborts the active checklist   |

---

## Tips & Troubleshooting

**The FO isn't hearing me**

- Check that your microphone is selected and working.
- Adjust the **Voice Sensitivity** setting.
- In Push-to-talk mode, check that a **PTT Button** is set and that the toolbar mic turns green while you hold it.

**My PTT or Mic On/Off key does nothing while MSFS has focus**

- MSFS is probably running as administrator. Run CrewMate as administrator too.

**The FO ignores everything I say before departure**

- Between T-42 and T-32 on the preflight timer the FO is outside on the walkaround and does not answer. The **FO outside** indicator is shown while this is the case. Ground engineer calls still work.

**The FO keeps repeating the challenge**

- Your response didn't match the expected phrase. Listen to the challenge and use one of the phrases listed in this manual (voice matching can be tuned in settings).
- If a physical switch must be set first (e.g., parking brake), set it in the cockpit before responding.

**The Voice Trainer says training failed**

- "Value does not fall within the expected range" means Windows has no speech profile for your account. Run Windows Speech Recognition setup once, then start the trainer again.
- The trainer also needs the Windows Display Language set to EN‑US while it runs.

**How do I stop a checklist mid‑way?**

- Say **"Stop checklist"**, **"Abort checklist"**, or **"Cancel checklist"** at any time.

**Can I run flows and checklists manually without voice?**

- Yes. Both can be triggered from the **Flows** and **Checklist** panels in the app UI.

---
