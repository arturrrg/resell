# Resell Play Protect review

Prepared 15 November 2026 for the final 1.6.43 APK.

## Artifact

- File: `artifacts/android/Resell-1.6.43.apk`
- Package: `md.maison.reseller`
- Version: `1.6.43` / `1006043`
- SHA-256: `532A2A33EB8C8D882CF7759D0C1E925887250F5776062B93AF27DE64D631E9BB`
- Certificate SHA-256: `a1cfb69eebe1e5399dff77a8c6c77736ec650b7b59afa1f55af9ddabf985b4f1`

This is an optimized release build with debugging disabled. It retains the
existing Android Debug certificate so updates preserve the installed app and
its data. It does not establish a verified developer identity. Changing to a
different signing key requires a separate migration plan; do not uninstall the
current app or rotate keys merely to suppress a warning.

## Observations and checks

The observed warning says Play Protect has not seen an app from this developer
before and that it may be unsafe. The message alone does not establish the
underlying classification, prove malware, or prove the APK safe.

APK signature verification passed. The manifest requests INTERNET and the app's
internal receiver permission; it does not request SMS, accessibility or
notification listener permissions. The exact release APK completed a Microsoft
Defender custom scan without a scan-command error. These are bounded checks,
not a comprehensive malware certification.

## Review submission draft

Resell is an inventory management application distributed directly as an APK.
When installing version 1.6.43, users of earlier builds encountered the message
that Play Protect had not seen an app from this developer before. Please review
the attached artifact identified by the SHA-256 above. The application uses
internet access for its account and inventory services and an internal receiver
permission. The APK signature verifies. The release build disables debugging
and preserves the application's existing signing key for update compatibility.

Before submitting, upload this exact APK to VirusTotal, inspect the result, and
revise the draft to describe any findings. Do not claim zero detections before
the result exists. Uploading may make the APK available to security researchers
and vendors; obtain the owner's approval first. The developer must supply the
contact email and developer name used for the appeal.

Official form: https://support.google.com/googleplay/android-developer/contact/protectappeals

Google guidance: https://developers.google.com/android/play-protect/warning-dev-guidance

Developer registration (a separate process, not a guaranteed warning fix):
https://developer.android.com/developer-verification
