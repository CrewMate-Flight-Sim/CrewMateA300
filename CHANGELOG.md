# Changelog

## [0.4.1] - 2026-11-11

- Voice commands did nothing and the microphone list only showed "Default" when Windows had the English (UK) or another non-US English speech pack, with "The language for the grammar does not match the language of the speech recognizer." in the log - any English speech pack now works - @marxio09dio
- Parking checklist now validates APU bleed, engines, fuel pumps, and window/probe heat states against the sim before marking items complete - @alexlenh
- New "Taxi (Vectored)" flow used for when vectored SID is configured - @alexlenh
- Voice hints reworked: initial climb and after-takeoff-climb phases, approach hints only when configured, and a "stop" hint before V1 on the takeoff roll - @alexlenh
- Cargo variant support: "arm slides" / "disarm slides" hints replace cabin crew variants - @alexlenh
- Flows: added Nav light and Flight directors on steps; Takeoff Data accepts "set and checked" - @alexlenh

## [0.4.0] - 2026-10-25

- Initial release of A300 version - @alexlenh @marxio09dio

## [0.3.2] - 2026-08-26

- Add GSX Support - @alexlenh
- Improve the voice hints - @alexlenh
- Bugs fixed - @alexlenh
- APU Bleed is now an orderable command - @alexlenh
- Post landing timer uses physical chrono now - @alexlenh

## [0.3.1] - 2026-04-28

- Added FO controls check in taxi flow after CA checks his/her controls - @alexlenh
- Tighter checklist validation tolerance - @alexlenh
- Added Secure procedures - @alexlenh

## [0.3.0] - 2026-04-23

- Initial release of A310 version – @alexlenh @marxio09dio
