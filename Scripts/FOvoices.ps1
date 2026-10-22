# Pass -Only <name>[,<name>] to regenerate just those phrases; a full run rewrites every ogg in every pack
param([string[]]$Only)

# This script uses Azure Cognitive Services for high-quality TTS
# You'll need a free Azure account: https://azure.microsoft.com/free/

# === LOAD .env ===


# === CONFIGURATION ===

$voicesToGenerate = @(
    "en-US-JennyNeural", 
    "en-US-AriaNeural", 
    "en-US-GuyNeural", 
    "en-US-ChristopherNeural"
)

$phrases = @{
    "0"                                    = "Zero"
    "1"                                    = "One"
    "100_knots"                            = "One hundred knots"
    "2"                                    = "Two"
    "3"                                    = "Three"
    "4"                                    = "Four"
    "5"                                    = "Five"
    "6"                                    = "Six"
    "7"                                    = "Seven"
    "8"                                    = "Eight"
    "9"                                    = "Niner"
    "after_start_checklist_completed"      = "After start checklist completed"
    "anti_ice"                             = "Anti ice"
    "approach_checklist_completed"         = "Approach checklist completed"
    "are_you_sure"                         = "Are you sure?"
    "auto_brake"                           = "Auto brake"
    "before_start_checklist_completed"     = "Before start checklist completed"
    "cabin_landing"                        = "Cabin crew, please be seated for landing"
    "cabin_secure"                         = "Flight deck. Ok. Captain, cabin is secured"
    "cabin_not_secure"                     = "Cabin is NOT secured"
    "cabin_takeoff"                        = "Cabin crew, please be seated for takeoff"
    "check"                                = "Check"
    "check_beacon"                         = "Beacon is not on"
    "check_belts"                          = "Seat belt sign is not on"
    "check_flaps"                          = "Check flaps"
    "check_landing_gear"                   = "Check landing gear"
    "check_speed"                          = "Check speed"
    "check_spoilers"                       = "Check spoilers"
    "checked"                              = "Checked"
    "clear_right"                          = "Clear right"
    "confirmed"                            = "Confirmed"
    "decel"                                = "Deecel"
    "fire_test"                            = "A P U Fire test"
    "three_minutes"                        = "Three minutes"
    "three_minutes_not_passed"             = "Three minutes not passed yet"
    "fl_100"                               = "Flight level one hundred"
    "flight_controls"                      = "Flight controls"
    "fuel_quantity"                        = "Fuel quantity"
    "fuel_pumps"                           = "Fuel pumps"
    "full_down"                            = "Full down"
    "full_left"                            = "Full left"
    "full_right"                           = "Full right"
    "full_up"                              = "Full up"
    "gear_down"                            = "Gear down"
    "gs_alive"                             = "Glideslope alive"
    "gear_up"                              = "Gear up, neutral"
    "landing_elev_set"                     = "Landing elevation set"
    "landing_checklist_completed"          = "Landing checklist completed"
    "minimum"                              = "Minimum"
    "nav_prof_armed"                       = "Nav and profile armed"
    "neutral"                              = "Neutral"
    "no_decel"                             = "No deecel"
    "no_reverse_engine_1_and_2"            = "No reverse engine one and two"
    "no_spoilers"                          = "No spoilers"
    "now_at"                               = "Now"
    "Ok"                                   = "Ok"
    "one_to_go"                            = "One thousand to go"
    "parking_brake"                        = "Parking brake"
    "parking_checklist_completed"          = "Parking checklist completed"
    "passing_flight_level"                 = "Passing flight level"
    "point"                                = "Point"
    "positive_climb"                       = "Positive climb"
    "pressure_zero"                        = "Pressure zero"
    "ready"                                = "Ready"
    "reverse_green"                        = "Reverse green"
    "rotate"                               = "Rotate"
    "set"                                  = "Set"
    "speed_checked"                        = "Speed checked"
    "spoilers"                             = "Spoilers"
    "standard_cross_checked"               = "Standard cross checked"
    "standard_set"                         = "Standard Set"
    "ten_thousand"                         = "Ten thousand"
    "hundred"                              = "Hundred"
    "thousand"                             = "Thousand"
    "thrust_set"                           = "Thrust set"
    "tcas"                                 = "T cas"
    "tons"                                 = "Tons"
    "transiton_altitude"                   = "Transition altitude"
    "transiton_level"                      = "Transition level"
    "v_one"                                = "V one"
    "walkaround"                           = "I'll perform the walkaround now"
    "walkaround_completed"                 = "Walkaround completed, all good no issues found"
    "wing_lights"                          = "Wing lights"
    "80_knots"                             = "Eighty knots"
    "altimeters"                           = "Altimeters"
    "apu"                                  = "A P U"
    "apu_bleed"                            = "A P U bleed"
    "askid"                                = "Anti skid"
    "apu_bat"                              = "A P U and Batteries"
    "secure_checklist_completed"           = "Securing aircraft checklist completed"
    "before_start_to_the_line_completed"   = "Before start checklist completed to the line "
    "before_takeoff_checklist_complete"    = "Before takeoff checklist complete"
    "before_takeoff_completed_to_the_line" = "Before Takeoff Checklist completed to the line"
    "brakes"                               = "Brake and anti skid"
    "briefing"                             = "Briefing"
    "climb_to_the_line_completed"          = "After takeoff climb checklist completed to the line"
    "climb_checklist_completed"            = "After takeoff climb checklist completed"
    "cockpit_prep"                         = "Cockpit prep"
    "diff_p"                               = "Differential pressure"
    "ecam_stat"                            = "E CAM status"
    "engines"                              = "Engines"
    "gear"                                 = "Landing gear"
    "hand_signal"                          = "Hand signal"
    "ign"                                  = "Ignition"
    "ldg_elev"                             = "Landing elevation"
    "light_sign"                           = "Lights and signs"
    "navigation"                           = "Navigation"
    "radar"                                = "Weather Radar"
    "pack_1_on"                            = "Pack one on"
    "pack_2_on"                            = "Pack two on"
    "parking_brake_and_chocks"             = "Parking brake and chocks"
    "performance_fmas"                     = "Performance and F M A's"
    "pitch_trim"                           = "Pitch Trim"
    "signs"                                = "Signs"
    "slats_ext"                            = "Slats extended"
    "slats_flaps"                          = "Slats and flaps"
    "slats_retr"                           = "Slats retracted"
    "flaps_0"                              = "Flaps zero"
    "flaps_15"                             = "Flaps fifteen"
    "flaps_20"                             = "Flaps twenty"
    "flaps_40"                             = "Flaps fourty"
    "valve_open"                           = "Valve open"
    "valve_closed"                         = "Valve closed"
    "after_landing_checklist_completed"    = "After Landing checklist completed"
    "15_0"                                 = "Fifteen zero"
    "15"                                   = "Fifteen"
    "20"                                   = "Twenty"
    "windows"                              = "Windows"
    "beacon"                               = "Beacon"
    "closed"                               = "Closed"
    "rud_trim"                             = "Rudder trim"
    "takeoff_config"                       = "Takeoff Config"
    "transponder"                          = "Transponder"
    "cabin"                                = "Cabin"
    "packs"                                = "Packs"
    "feet_set"                             = "feet set"
    "100_above"                            = "one hundred above"
    "i_have_ctrl"                          = "I have control"
    "you_have_ctrl"                        = "You have control"
    "speed"                                = "Speed"
    "sink_rate"                            = "Sink rate"
    "bank"                                 = "Bank"
    "pitch"                                = "Pitch"
    "loc"                                  = "Loke"
    "glide"                                = "Glide"
}
# Derive folder name from voice: "en-US-JennyNeural" -> "Jenny"

# Find Python automatically
$pythonExe = Get-Command python.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $pythonExe) { $pythonExe = "py" } # Fallback to launcher


# === DYNAMIC FFmpeg SEARCH ===
$ffmpegExe = Get-Command ffmpeg -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source

if (-not $ffmpegExe) {
    # Fallback to your specific path if it's not in the System PATH
    $ffmpegExe = "C:\Users\extra\Downloads\Wwise-Unpacker-master\Tools\ffmpeg.exe"
}

if (-not (Test-Path $ffmpegExe)) {
    Write-Error "[FOvoices] FFmpeg NOT FOUND! Please install it or check the path: $ffmpegExe"
    exit 1
}
Write-Host "[FOvoices] Using FFmpeg from: $ffmpegExe" -ForegroundColor Yellow

# === VOICE GENERATION LOOP ===
foreach ($voiceName in $voicesToGenerate) {
    
    $voiceShortName = ($voiceName -replace '^.*-([A-Za-z]+)Neural$', '$1')
    $outDir = Join-Path $PSScriptRoot "..\src-tauri\sounds\$voiceShortName"
    $outDir = [System.IO.Path]::GetFullPath($outDir)
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null

    Write-Host "`n[FOvoices] >>> STARTING VOICE: $voiceShortName" -ForegroundColor Cyan

    foreach ($file in $phrases.Keys) {
        if ($Only -and $Only -notcontains $file) { continue }
        $text = $phrases[$file]
        $mp3Path = "$outDir\$file.mp3"
        $oggPath = "$outDir\$file.ogg"

        try {
            # Use edge-tts (free)
            edge-tts --voice $voiceName --text "$text" --write-media "$mp3Path"
            
            # Convert to OGG
            if (Test-Path $mp3Path) {
                & $ffmpegExe -i "$mp3Path" -c:a libvorbis -q:a 4 "$oggPath" -y -loglevel error
                Remove-Item $mp3Path -ErrorAction SilentlyContinue
                Write-Host "[FOvoices] [OK] $file"
            }
        }
        catch {
            Write-Error "[FOvoices] Failed $file : $_"
        }
    }
}

Write-Host "[FOvoices] Completed! Audio files created in $outDir"