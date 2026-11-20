import comtypes.client
import os
import wave

VOICE_SCRIPTS = [
    # Scene 1: 0:00 - 0:15 (450 frames)
    ("s1_p1_crisis", "Dementia care faces a compounding crisis: medication non-adherence and lost spatial memory.", 1),
    ("s1_p2_brand", "Introducing CortexMed. Zero-hardware 3D spatial memory and clinical medication guardian.", 1),
    
    # Scene 2: 0:15 - 0:30 (450 frames)
    ("s2_command", "The Command Center runs directly in your browser with live zero-mock telemetry, orchestrating AR vision, resident companion, clinical command, and decision support.", 1),
    
    # Scene 3: 0:30 - 0:50 (600 frames) - 30s to 50s
    ("s3_pipeline", "Our LangGraph StateGraph executes a five-node deterministic clinical safety pipeline.", 1),
    ("s3_advil_block", "Warning: Stop. Advil interacts dangerously with Coumadin. Dispensation blocked.", 3),
    ("s3_allergy_intro", "Resident Robert Williams. Documented aspirin allergy intercepted.", 2),
    ("s3_hindi_alert", "Robert, kripya yeh dava na lein. Aspirin allergy.", 3),
    
    # Scene 4: 0:50 - 1:10 (600 frames) - Part 1: 50s-60s, Part 2: 60s-70s
    ("s4_yolo", "Edge AI in action: YOLOv8n ONNX tracks prescription bottles in real time with fifteen percent padded ROI crops, updating 3D spatial memory.", 1),
    ("s4_rppg", "Contactless rPPG extracts facial capillary hemodynamics at thirty frames per second, measuring seventy-two BPM and HRV with zero wearable sensors.", 1),
    
    # Scene 5: 1:10 - 1:25 (450 frames) - 70s-85s
    ("s5_resident_q", "Where did I put my reading glasses?", 1),
    ("s5_companion_a", "Margaret, your reading glasses were indexed 14 minutes ago on the living room table next to the lamp.", 1),
    ("s5_caregiver", "Realtime clinical alerts and 24-hour vitals stream directly to the Caregiver Command dashboard.", 1),
    
    # Scene 6: 1:25 - 1:30 (150 frames) - 85s-90s
    ("s6_outro", "CortexMed. Zero hardware. Real clinical safety.", 3),
]

os.makedirs("audio_clips", exist_ok=True)

voice = comtypes.client.CreateObject("SAPI.SpVoice")
stream = comtypes.client.CreateObject("SAPI.SpFileStream")

for name, text, rate in VOICE_SCRIPTS:
    out_file = os.path.join("audio_clips", f"{name}.wav")
    voice.Rate = rate
    stream.Open(out_file, 3)
    voice.AudioOutputStream = stream
    voice.Speak(text)
    stream.Close()
    
    with wave.open(out_file, 'rb') as w:
        frames = w.getnframes()
        sr = w.getframerate()
        dur = frames / float(sr)
        print(f"{name:18}: {dur:5.2f}s ({frames} frames @ {sr}Hz)")
