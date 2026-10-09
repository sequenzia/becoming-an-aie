---
title: Recorded support message, reference and machine transcripts
origin: synthetic
kind: output-set
checkedOn: 2026-10-09
summary: A synthetic 94-second voice message, a reference transcript checked against the audio, the machine transcript a fictional pipeline produced, and the summary built from it. Written for the Multimodal systems module. Not a measured result.
---

This artifact is synthetic. The caller, the order, the product names, the transcription service, and every timestamp are invented. The pipeline is a common one: the application splits each recording into 60-second chunks with 2.4 seconds of overlap, sends each chunk to a fictional transcription service, joins the segments, and asks a fictional text model for a summary with a time reference for each claim.

The reference transcript was made by a person listening to the audio, with times read from the waveform.

```text
REFERENCE  msg=vm-2026-1003-0217  duration=94.0 s
[00:00.0-00:06.2]  Hi, this is Dana Ruiz, calling about order 4471-0920.
[00:06.2-00:13.8]  The replacement router arrived, but it's the wrong model. I ordered the AX50, and this is an AX15.
[00:13.8-00:21.0]  I'd like to return it, but only if the return shipping is covered.
[00:21.0-00:28.4]  (no speech; paper rustling, a door)
[00:28.4-00:36.9]  Okay. The packing slip says returns within fifteen days, and it's been twelve.
[00:36.9-00:49.5]  So I need a label by Friday at the latest. I can drop it at the depot on Main Street.
[00:49.5-00:58.2]  If you can't cover shipping, please just send the AX50 and I'll keep both and pay the difference.
[00:58.2-01:07.6]  Either way, please call me back. My number is on the account.
[01:07.6-01:19.0]  Oh, and the first router, the one that failed, I already sent that back on the twentieth.
[01:19.0-01:34.0]  (no speech; hold music from a second call in the background)
```

The machine transcript, as the application stored it after joining the chunks.

```text
MACHINE  msg=vm-2026-1003-0217  service=parla-stt-2  chunks=2 (0.0-60.0, 57.6-94.0)
[00:00.0-00:06.1]  Hi, this is Dana Ruiz, calling about order 4471-0920.
[00:06.1-00:13.9]  The replacement router arrived, but it's the wrong model. I ordered the AX50, and this is an AX15.
[00:13.9-00:20.9]  I'd like to return it, and the return shipping is covered.
[00:21.6-00:26.0]  Thanks for calling, have a great day.
[00:28.5-00:36.8]  Okay. The packing slip says returns within fifty days, and it's been twelve.
[00:36.8-00:49.6]  So I need a label by Friday at the latest. I can drop it at the depot on Main Street.
[00:49.6-00:58.1]  If you can't cover shipping, please just send the AX50 and I'll keep both and pay the difference.
[01:00.6-01:10.0]  Either way, please call me back. My number is on the account.
[01:10.0-01:21.4]  Oh, and the first router, the one that failed, I already sent that back on the twentieth.
[01:24.0-01:30.0]  Thank you.
```

The summary the text model wrote from the machine transcript, with the time reference it gave for each claim.

```yaml
summary:
  - claim: "Customer received the wrong replacement model (AX15 instead of AX50)."
    at: "00:06-00:13"
  - claim: "Customer wants to return it; return shipping is covered."
    at: "00:13-00:20"
  - claim: "Return window is 50 days; 12 days have passed, so there is no urgency."
    at: "00:28-00:36"
  - claim: "Customer asks for a callback."
    at: "01:00-01:10"
  - claim: "Original failed router was already returned on the 20th."
    at: "01:10-01:21"
```

Notes recorded with the run:

- The service returned one segment-level confidence per chunk: 0.93 for chunk 1 and 0.91 for chunk 2.
- Word error rate against the reference, over the 120 reference words, was 10.8%: one substitution and two deletions in the third segment, one substitution in the fifth, and nine inserted words, so (2 + 2 + 9) / 120.
