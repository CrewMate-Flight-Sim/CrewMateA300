# Changelog

## Unreleased

- The FO now takes a go-around altitude from voice - "set go around altitude" uses the Landing window's missed altitude, and "set missed approach altitude 5000" sets the altitude directly - @marxio09dio
- Added "you have control" / "i have control" handover callouts - @marxio09dio
- A go-around altitude with hundreds (e.g. 3500) was read back as "three thousand feet set", and 10,000 ft and flight levels lost their number - the FO now reads the value in full, or "set" when the voice pack can't say it - @marxio09dio
- Added approach deviation callouts: the FO now calls "speed", "sink rate", "bank", "pitch", "localizer" and "glide" when the aircraft leaves the approach limits between 50 and 1000 ft AGL - @marxio09dio
- Added rejected-takeoff callouts: the FO calls "reverse green" then "decel" or "no decel" after a stop is called above 40 kt - @marxio09dio
- Added voice commands: "brake fan on/off", "engage level change", "set green dot speed", "set S speed", "set F speed", "set Vapp" and "loc star set runway track" - @marxio09dio
- The Landing window now has a "Missed App (ft)" field used by "set go around altitude" - @marxio09dio
- Added an "Approach deviation callouts" toggle in Settings - @marxio09dio
- Added Push-to-talk and a Mic On/Off button, bindable to a key, mouse button, joystick, yoke, throttle or controller button in Settings - @marxio09dio
- Voice commands the FO cannot act on are no longer shown as accepted - @marxio09dio
- The FO no longer answers while outside on the walkaround (T-42 to T-32) - ground engineer calls and the preflight timer still work, and an "FO outside" indicator shows meanwhile - @marxio09dio
- A flight started on approach got no spoilers, reverse or decel callouts on landing - they now arm whenever the aircraft is airborne - @marxio09dio
- After a go-around the Landing flow did not run again on the next gear down, so the ground spoilers stayed disarmed - it now runs on every approach - @marxio09dio
- After Landing with the APU set to manual switched off an APU you had started - the FO now leaves the APU alone - @marxio09dio
- Calling the flight controls check a second time made the FO call every control position twice - the new call now restarts the check - @marxio09dio
- Screen readers now announce every icon button, dropdown and slider by name, and the Ok buttons have stronger text contrast - @marxio09dio

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
